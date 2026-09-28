import mongoose from "mongoose";
import Role, { PERMISSIONS } from "../models/Role.js";
import Server from "../models/Server.js";
import {
  ensureServerRoles,
  getAuthority,
  getDefaultRole,
  serializeRole,
} from "../lib/permissions.js";
import { io, serverRoom } from "../lib/socket.js";

const KNOWN_PERMISSIONS = Object.values(PERMISSIONS);

// loads a server only when the caller belongs to it, together with what they
// are allowed to do in it
const findServerForMember = async (serverId, userId) => {
  if (!mongoose.isValidObjectId(serverId)) return {};

  const server = await Server.findOne({
    _id: serverId,
    "members.userId": userId,
  });
  if (!server) return {};

  return { server, authority: await getAuthority(server, userId) };
};

// the whole table travels together, the client never patches one role in place
const broadcastRoles = async (server) => {
  const roles = await Role.find({ serverId: server._id }).sort({
    position: -1,
    name: 1,
  });

  io.to(serverRoom(server._id)).emit("serverRolesUpdated", {
    serverId: server._id.toString(),
    roles: roles.map(serializeRole),
  });

  return roles;
};

// you may shape any role that does not outrank you, except the one you hold
// yourself. Escalation is stopped by holdsAll below, not by rank, so a role
// sitting level with yours is still yours to manage.
const outranksOrEqual = (authority, role) =>
  authority.isOwner ||
  (role.position <= authority.position &&
    !role._id.equals(authority.role?._id));

const validatePermissions = (permissions) => {
  if (!Array.isArray(permissions)) return "Permissions must be a list.";

  const unknown = permissions.find((p) => !KNOWN_PERMISSIONS.includes(p));
  return unknown ? `Unknown permission: ${unknown}` : null;
};

export const getServerRoles = async (req, res) => {
  try {
    const { server } = await findServerForMember(req.params.id, req.user._id);
    if (!server) return res.status(404).json({ message: "Server not found." });

    const roles = await ensureServerRoles(server);
    res.status(200).json({ roles: roles.map(serializeRole) });
  } catch (error) {
    console.log("Error in getServerRoles controller: ", error.message);
    res.status(500).json({ message: "Error fetching roles" });
  }
};

export const createRole = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const { name, color, permissions = [] } = req.body;

    const trimmed = (name || "").trim();
    if (!trimmed) {
      return res.status(400).json({ message: "A role name is required." });
    }

    const invalid = validatePermissions(permissions);
    if (invalid) return res.status(400).json({ message: invalid });

    const { server, authority } = await findServerForMember(
      req.params.id,
      loggedInUserId,
    );
    if (!server) return res.status(404).json({ message: "Server not found." });
    if (!authority.can(PERMISSIONS.MANAGE_ROLES)) {
      return res
        .status(403)
        .json({ message: "You do not have permission to manage roles." });
    }
    // handing out more than you hold is how a role becomes a back door
    if (!authority.holdsAll(permissions)) {
      return res.status(403).json({
        message: "You can only grant permissions you hold yourself.",
      });
    }

    // a new role starts just above the default one, never above the person
    // making it: dropping it at the top would put it out of reach of the
    // admins who are supposed to manage it
    const defaultRole = getDefaultRole(authority.roles);
    const position = Math.max(
      0,
      Math.min(
        authority.isOwner ? Number.MAX_SAFE_INTEGER : authority.position - 1,
        (defaultRole?.position ?? 0) + 1,
      ),
    );

    const role = await Role.create({
      serverId: server._id,
      name: trimmed,
      color: color || undefined,
      permissions: [...new Set(permissions)],
      position,
      createdBy: loggedInUserId,
    });

    await broadcastRoles(server);
    res.status(201).json({ role: serializeRole(role) });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "This server already has a role with that name." });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    console.log("Error in createRole controller: ", error.message);
    res.status(500).json({ message: "Error creating role" });
  }
};

export const updateRole = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const { name, color, permissions } = req.body;

    if (permissions !== undefined) {
      const invalid = validatePermissions(permissions);
      if (invalid) return res.status(400).json({ message: invalid });
    }

    const { server, authority } = await findServerForMember(
      req.params.id,
      loggedInUserId,
    );
    if (!server) return res.status(404).json({ message: "Server not found." });
    if (!authority.can(PERMISSIONS.MANAGE_ROLES)) {
      return res
        .status(403)
        .json({ message: "You do not have permission to manage roles." });
    }

    const role = authority.roles.find((r) => r._id.equals(req.params.roleId));
    if (!role) return res.status(404).json({ message: "Role not found." });

    if (!outranksOrEqual(authority, role)) {
      return res.status(403).json({
        message: role._id.equals(authority.role?._id)
          ? "You cannot edit the role you hold yourself."
          : "You cannot edit a role above your own.",
      });
    }
    if (permissions !== undefined && !authority.holdsAll(permissions)) {
      return res.status(403).json({
        message: "You can only grant permissions you hold yourself.",
      });
    }

    if (name !== undefined) {
      const trimmed = name.trim();
      if (!trimmed) {
        return res.status(400).json({ message: "A role name is required." });
      }
      // the three a server is born with keep their names, members rely on them
      if (role.isSystem && trimmed !== role.name) {
        return res
          .status(400)
          .json({ message: "Built in roles cannot be renamed." });
      }
      role.name = trimmed;
    }
    if (color !== undefined) role.color = color;
    if (permissions !== undefined) role.permissions = [...new Set(permissions)];

    await role.save();
    await broadcastRoles(server);

    res.status(200).json({ role: serializeRole(role) });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "This server already has a role with that name." });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    console.log("Error in updateRole controller: ", error.message);
    res.status(500).json({ message: "Error updating role" });
  }
};

export const deleteRole = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    const { server, authority } = await findServerForMember(
      req.params.id,
      loggedInUserId,
    );
    if (!server) return res.status(404).json({ message: "Server not found." });
    if (!authority.can(PERMISSIONS.MANAGE_ROLES)) {
      return res
        .status(403)
        .json({ message: "You do not have permission to manage roles." });
    }

    const role = authority.roles.find((r) => r._id.equals(req.params.roleId));
    if (!role) return res.status(404).json({ message: "Role not found." });
    if (role.isSystem) {
      return res
        .status(400)
        .json({ message: "Built in roles cannot be deleted." });
    }
    if (!outranksOrEqual(authority, role)) {
      return res.status(403).json({
        message: role._id.equals(authority.role?._id)
          ? "You cannot delete the role you hold yourself."
          : "You cannot delete a role above your own.",
      });
    }

    // nobody is left without a role: they fall back to the default one
    const fallback = getDefaultRole(authority.roles);
    server.members.forEach((member) => {
      if (member.roleId?.equals(role._id)) member.roleId = fallback._id;
    });
    await server.save();
    await role.deleteOne();

    await broadcastRoles(server);
    io.to(serverRoom(server._id)).emit("serverMembersReassigned", {
      serverId: server._id.toString(),
      fromRoleId: role._id.toString(),
      toRoleId: fallback._id.toString(),
    });

    res.status(200).json({ message: `${role.name} deleted.` });
  } catch (error) {
    console.log("Error in deleteRole controller: ", error.message);
    res.status(500).json({ message: "Error deleting role" });
  }
};
