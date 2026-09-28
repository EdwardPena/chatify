import mongoose from "mongoose";
import Role, { PERMISSIONS, SYSTEM_ROLES } from "../models/Role.js";

// a server created before roles were documents has none of its own, and its
// members still carry the old role name. This builds the three system roles
// and adopts those members, once, the first time the server is touched.
const adoptLegacyMembers = async (server, roles) => {
  const raw = await mongoose.connection
    .collection("servers")
    .findOne({ _id: server._id }, { projection: { members: 1 } });

  const legacyByUser = new Map(
    (raw?.members || []).map((member) => [
      String(member.userId),
      String(member.role || ""),
    ]),
  );
  const byName = new Map(roles.map((role) => [role.name.toLowerCase(), role]));
  const fallback = roles.find((role) => role.isDefault) || roles.at(-1);

  server.members.forEach((member) => {
    if (member.roleId) return;

    const legacy = legacyByUser.get(String(member.userId));
    member.roleId = (legacy && byName.get(legacy)?._id) || fallback._id;
  });

  await server.save();
};

// every server has its roles loaded through here, so the ones that predate
// the model get them created on first use instead of breaking
export const ensureServerRoles = async (server) => {
  let roles = await Role.find({ serverId: server._id }).sort({
    position: -1,
    name: 1,
  });

  if (roles.length === 0) {
    roles = await Role.insertMany(
      SYSTEM_ROLES.map((role) => ({
        ...role,
        serverId: server._id,
        isSystem: true,
      })),
    );
    roles.sort((a, b) => b.position - a.position || a.name.localeCompare(b.name));
  }

  // members with nothing assigned fall back to the default role
  if (server.members.some((member) => !member.roleId)) {
    await adoptLegacyMembers(server, roles);
  }

  return roles;
};

export const getDefaultRole = (roles) =>
  roles.find((role) => role.isDefault) || roles.at(-1);

// everything the guards need about one person in one server, resolved once so
// a request does not keep re-reading the same roles
export const getAuthority = async (server, userId) => {
  const roles = await ensureServerRoles(server);
  const isOwner = server.isOwner(userId);

  const member = server.getMember(userId);
  const role =
    roles.find((r) => r._id.equals(member?.roleId)) || getDefaultRole(roles);

  const permissions = isOwner
    ? Object.values(PERMISSIONS)
    : [...(role?.permissions || [])];

  return {
    roles,
    role,
    isOwner,
    permissions,
    // the owner outranks everyone, so nobody can reshape a role above them
    position: isOwner ? Number.POSITIVE_INFINITY : (role?.position ?? -1),
    can: (permission) => isOwner || permissions.includes(permission),
    // you may never hand out more than you hold yourself
    holdsAll: (list) => isOwner || list.every((p) => permissions.includes(p)),
  };
};

export const serializeRole = (role) => ({
  _id: role._id,
  name: role.name,
  color: role.color,
  permissions: role.permissions,
  isDefault: role.isDefault,
  isSystem: role.isSystem,
  position: role.position,
});

export { PERMISSIONS };
