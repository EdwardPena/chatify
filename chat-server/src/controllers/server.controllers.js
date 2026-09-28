import mongoose from "mongoose";
import Channel, { CHANNEL_TYPES, slugifyChannelName } from "../models/Channel.js";
import Server, { generateInviteCode } from "../models/Server.js";
import Role, { PERMISSIONS, SYSTEM_ROLES } from "../models/Role.js";
import {
  ensureServerRoles,
  getAuthority,
  getDefaultRole,
  serializeRole,
} from "../lib/permissions.js";
import Message from "../models/Message.js";
import cloudinary from "../lib/cloudinary.js";
import { getVoiceParticipants } from "../lib/voice.js";
import {
  getReceiverSocketId,
  io,
  joinServerRoom,
  leaveServerRoom,
  serverRoom,
} from "../lib/socket.js";

const PUBLIC_USER_FIELDS = "fullName username profilePic";

// what a brand new server starts with: one place to write, one place to talk
const STARTER_CHANNELS = [
  { name: "general", type: CHANNEL_TYPES.TEXT, topic: "Everything that matters, in one place." },
  { name: "lounge", type: CHANNEL_TYPES.VOICE, topic: "" },
];

export const serializeChannel = (channel) => ({
  _id: channel._id,
  serverId: channel.serverId,
  name: channel.name,
  type: channel.type,
  topic: channel.topic,
  // voice presence is live state, it never comes from the database
  participants:
    channel.type === CHANNEL_TYPES.VOICE
      ? getVoiceParticipants(channel._id)
      : undefined,
});

// the client hides every privileged control behind the fields this returns,
// so it is always built from the same resolved authority the guards use
const serializeServer = (server, authority, channels) => ({
  _id: server._id,
  name: server.name,
  icon: server.icon,
  ownerId: server.ownerId,
  inviteCode: server.inviteCode,
  role: authority.role ? serializeRole(authority.role) : null,
  roles: authority.roles.map(serializeRole),
  permissions: authority.permissions,
  isOwner: authority.isOwner,
  memberCount: server.members.length,
  channels: channels?.map(serializeChannel),
});

const serializeMember = (member) => ({
  _id: member.userId._id,
  fullName: member.userId.fullName,
  username: member.userId.username,
  profilePic: member.userId.profilePic,
  roleId: member.roleId,
  joinedAt: member.joinedAt,
});

// loads a server only when the caller belongs to it, so the routes below can
// trust whatever comes back
export const findServerForMember = async (serverId, userId) => {
  if (!mongoose.isValidObjectId(serverId)) return null;
  return Server.findOne({ _id: serverId, "members.userId": userId });
};

const getServerChannels = (serverId) =>
  Channel.find({ serverId }).sort({ type: 1, name: 1 });

export const getMyServers = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    const servers = await Server.find({ "members.userId": loggedInUserId }).sort(
      { createdAt: 1 },
    );

    const payload = await Promise.all(
      servers.map(async (server) =>
        serializeServer(server, await getAuthority(server, loggedInUserId)),
      ),
    );

    res.status(200).json({ servers: payload });
  } catch (error) {
    console.log("Error in getMyServers controller: ", error.message);
    res.status(500).json({ message: "Error fetching servers" });
  }
};

export const getServerById = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    const server = await findServerForMember(req.params.id, loggedInUserId);
    if (!server) return res.status(404).json({ message: "Server not found." });

    const [authority, channels] = await Promise.all([
      getAuthority(server, loggedInUserId),
      getServerChannels(server._id),
    ]);

    res.status(200).json(serializeServer(server, authority, channels));
  } catch (error) {
    console.log("Error in getServerById controller: ", error.message);
    res.status(500).json({ message: "Error fetching server" });
  }
};

export const createServer = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const name = (req.body.name || "").trim();
    const { icon } = req.body;

    if (!name) {
      return res.status(400).json({ message: "A server name is required." });
    }
    if (name.length > 40) {
      return res
        .status(400)
        .json({ message: "Server names are limited to 40 characters." });
    }

    let iconUrl;
    if (icon) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(icon, {
          folder: "chatify/server-icons",
        });
        iconUrl = uploadResponse.secure_url;
      } catch (error) {
        console.log("Cloudinary upload failed: ", error.message);
        return res
          .status(502)
          .json({ message: "Icon upload failed. Please try again." });
      }
    }

    const server = await Server.create({ name, icon: iconUrl, ownerId });

    // the roles come first, the owner needs one to be given
    const roles = await Role.insertMany(
      SYSTEM_ROLES.map((role) => ({
        ...role,
        serverId: server._id,
        isSystem: true,
        createdBy: ownerId,
      })),
    );
    roles.sort((a, b) => b.position - a.position || a.name.localeCompare(b.name));

    // whoever creates a server runs it
    server.members.push({ userId: ownerId, roleId: roles[0]._id });
    await server.save();

    const channels = await Channel.insertMany(
      STARTER_CHANNELS.map((channel) => ({
        ...channel,
        serverId: server._id,
        createdBy: ownerId,
      })),
    );

    joinServerRoom(ownerId, server._id);

    const authority = await getAuthority(server, ownerId);
    res.status(201).json(serializeServer(server, authority, channels));
  } catch (error) {
    // two servers drew the same invite code, which the unique index caught
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "Could not create the server. Please try again." });
    }
    console.log("Error in createServer controller: ", error.message);
    res.status(500).json({ message: "Error creating server" });
  }
};

export const joinServer = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const inviteCode = (req.body.inviteCode || "").trim().toLowerCase();

    if (!inviteCode) {
      return res.status(400).json({ message: "An invite code is required." });
    }

    const server = await Server.findOne({ inviteCode });
    if (!server) {
      return res.status(404).json({ message: "That invite code is not valid." });
    }
    if (server.getMember(loggedInUserId)) {
      return res
        .status(409)
        .json({ message: `You are already in ${server.name}.` });
    }

    const roles = await ensureServerRoles(server);
    server.members.push({
      userId: loggedInUserId,
      roleId: getDefaultRole(roles)._id,
    });
    await server.save();

    const [authority, channels] = await Promise.all([
      getAuthority(server, loggedInUserId),
      getServerChannels(server._id),
    ]);

    // tell the room before joining it, so the newcomer is not told about itself
    io.to(serverRoom(server._id)).emit("serverMemberJoined", {
      serverId: server._id.toString(),
      member: {
        _id: req.user._id,
        fullName: req.user.fullName,
        username: req.user.username,
        profilePic: req.user.profilePic,
        roleId: authority.role?._id,
      },
    });
    joinServerRoom(loggedInUserId, server._id);

    res.status(200).json(serializeServer(server, authority, channels));
  } catch (error) {
    console.log("Error in joinServer controller: ", error.message);
    res.status(500).json({ message: "Error joining server" });
  }
};

export const updateServer = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    const server = await findServerForMember(req.params.id, loggedInUserId);
    if (!server) return res.status(404).json({ message: "Server not found." });

    const authority = await getAuthority(server, loggedInUserId);
    if (!authority.can(PERMISSIONS.MANAGE_SERVER)) {
      return res
        .status(403)
        .json({ message: "You do not have permission to edit this server." });
    }

    const { name, icon } = req.body;

    if (name !== undefined) {
      const trimmed = name.trim();
      if (!trimmed) {
        return res.status(400).json({ message: "A server name is required." });
      }
      server.name = trimmed;
    }

    if (icon) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(icon, {
          folder: "chatify/server-icons",
        });
        server.icon = uploadResponse.secure_url;
      } catch (error) {
        console.log("Cloudinary upload failed: ", error.message);
        return res
          .status(502)
          .json({ message: "Icon upload failed. Please try again." });
      }
    }

    await server.save();

    io.to(serverRoom(server._id)).emit("serverUpdated", {
      serverId: server._id.toString(),
      name: server.name,
      icon: server.icon,
    });

    res.status(200).json(serializeServer(server, authority));
  } catch (error) {
    console.log("Error in updateServer controller: ", error.message);
    res.status(500).json({ message: "Error updating server" });
  }
};

export const deleteServer = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    const server = await findServerForMember(req.params.id, loggedInUserId);
    if (!server) return res.status(404).json({ message: "Server not found." });
    // admins run a server, but only the owner may destroy it
    if (!server.isOwner(loggedInUserId)) {
      return res
        .status(403)
        .json({ message: "Only the owner can delete this server." });
    }

    const channels = await Channel.find({ serverId: server._id }).select("_id");
    await Message.deleteMany({ channelId: { $in: channels.map((c) => c._id) } });
    await Channel.deleteMany({ serverId: server._id });
    await Role.deleteMany({ serverId: server._id });
    await server.deleteOne();

    io.to(serverRoom(server._id)).emit("serverDeleted", {
      serverId: server._id.toString(),
    });

    res.status(200).json({ message: "Server deleted." });
  } catch (error) {
    console.log("Error in deleteServer controller: ", error.message);
    res.status(500).json({ message: "Error deleting server" });
  }
};

export const leaveServer = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    const server = await findServerForMember(req.params.id, loggedInUserId);
    if (!server) return res.status(404).json({ message: "Server not found." });
    if (server.isOwner(loggedInUserId)) {
      return res.status(400).json({
        message: "Owners cannot leave their own server, delete it instead.",
      });
    }

    server.members = server.members.filter(
      (member) => !member.userId.equals(loggedInUserId),
    );
    await server.save();

    leaveServerRoom(loggedInUserId, server._id);
    io.to(serverRoom(server._id)).emit("serverMemberLeft", {
      serverId: server._id.toString(),
      userId: loggedInUserId.toString(),
    });

    res.status(200).json({ message: `You left ${server.name}.` });
  } catch (error) {
    console.log("Error in leaveServer controller: ", error.message);
    res.status(500).json({ message: "Error leaving server" });
  }
};

export const getServerMembers = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    const isMember = await findServerForMember(req.params.id, loggedInUserId);
    if (!isMember) return res.status(404).json({ message: "Server not found." });

    const server = await Server.findById(req.params.id).populate(
      "members.userId",
      PUBLIC_USER_FIELDS,
    );

    res.status(200).json({
      members: server.members
        .filter((member) => member.userId)
        .map(serializeMember),
    });
  } catch (error) {
    console.log("Error in getServerMembers controller: ", error.message);
    res.status(500).json({ message: "Error fetching members" });
  }
};

export const updateMemberRole = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const { userId } = req.params;
    const { roleId } = req.body;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id." });
    }
    if (!mongoose.isValidObjectId(roleId)) {
      return res.status(400).json({ message: "Invalid role id." });
    }

    const server = await findServerForMember(req.params.id, loggedInUserId);
    if (!server) return res.status(404).json({ message: "Server not found." });

    const authority = await getAuthority(server, loggedInUserId);
    if (!authority.can(PERMISSIONS.MANAGE_MEMBERS)) {
      return res
        .status(403)
        .json({ message: "You do not have permission to manage members." });
    }
    if (server.isOwner(userId)) {
      return res
        .status(400)
        .json({ message: "The owner's role cannot be changed." });
    }
    if (userId === loggedInUserId.toString()) {
      return res.status(400).json({ message: "You cannot change your own role." });
    }

    const member = server.getMember(userId);
    if (!member) return res.status(404).json({ message: "Member not found." });

    const role = authority.roles.find((r) => r._id.equals(roleId));
    if (!role) return res.status(404).json({ message: "Role not found." });

    // handing out a role that outranks you is an escalation
    if (!authority.isOwner && role.position > authority.position) {
      return res
        .status(403)
        .json({ message: "You cannot assign a role above your own." });
    }
    const current = authority.roles.find((r) => r._id.equals(member.roleId));
    if (!authority.isOwner && current && current.position > authority.position) {
      return res
        .status(403)
        .json({ message: "You cannot change someone who outranks you." });
    }

    member.roleId = role._id;
    await server.save();

    io.to(serverRoom(server._id)).emit("serverMemberRoleChanged", {
      serverId: server._id.toString(),
      userId: userId.toString(),
      roleId: role._id.toString(),
      permissions: role.permissions,
    });

    res.status(200).json({ message: `Role updated to ${role.name}.` });
  } catch (error) {
    console.log("Error in updateMemberRole controller: ", error.message);
    res.status(500).json({ message: "Error updating role" });
  }
};

export const removeMember = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    const server = await findServerForMember(req.params.id, loggedInUserId);
    if (!server) return res.status(404).json({ message: "Server not found." });

    const authority = await getAuthority(server, loggedInUserId);
    if (!authority.can(PERMISSIONS.MANAGE_MEMBERS)) {
      return res
        .status(403)
        .json({ message: "You do not have permission to manage members." });
    }
    if (server.isOwner(userId)) {
      return res.status(400).json({ message: "The owner cannot be removed." });
    }
    if (userId === loggedInUserId.toString()) {
      return res
        .status(400)
        .json({ message: "Use leave server to remove yourself." });
    }

    const member = server.getMember(userId);
    if (!member) return res.status(404).json({ message: "Member not found." });

    const theirRole = authority.roles.find((r) => r._id.equals(member.roleId));
    if (!authority.isOwner && theirRole && theirRole.position > authority.position) {
      return res
        .status(403)
        .json({ message: "You cannot remove someone who outranks you." });
    }

    server.members = server.members.filter(
      (m) => m.userId.toString() !== userId,
    );
    await server.save();

    leaveServerRoom(userId, server._id);
    io.to(serverRoom(server._id)).emit("serverMemberLeft", {
      serverId: server._id.toString(),
      userId: userId.toString(),
    });

    const kickedSocketId = getReceiverSocketId(userId);
    if (kickedSocketId) {
      io.to(kickedSocketId).emit("serverRemoved", {
        serverId: server._id.toString(),
        serverName: server.name,
      });
    }

    res.status(200).json({ message: "Member removed." });
  } catch (error) {
    console.log("Error in removeMember controller: ", error.message);
    res.status(500).json({ message: "Error removing member" });
  }
};

export const createChannel = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const { type = CHANNEL_TYPES.TEXT, topic = "" } = req.body;
    const name = slugifyChannelName(req.body.name || "");

    if (!name) {
      return res.status(400).json({
        message: "Channel names need at least one letter or number.",
      });
    }
    if (!Object.values(CHANNEL_TYPES).includes(type)) {
      return res.status(400).json({ message: "Invalid channel type." });
    }

    const server = await findServerForMember(req.params.id, loggedInUserId);
    if (!server) return res.status(404).json({ message: "Server not found." });

    const authority = await getAuthority(server, loggedInUserId);
    if (!authority.can(PERMISSIONS.MANAGE_CHANNELS)) {
      return res
        .status(403)
        .json({ message: "You do not have permission to create channels." });
    }

    const channel = await Channel.create({
      serverId: server._id,
      name,
      type,
      topic: topic.trim(),
      createdBy: loggedInUserId,
    });

    io.to(serverRoom(server._id)).emit("channelCreated", {
      channel: serializeChannel(channel),
    });

    res.status(201).json({ channel: serializeChannel(channel) });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "This server already has a channel with that name." });
    }
    console.log("Error in createChannel controller: ", error.message);
    res.status(500).json({ message: "Error creating channel" });
  }
};

export const regenerateInviteCode = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    const server = await findServerForMember(req.params.id, loggedInUserId);
    if (!server) return res.status(404).json({ message: "Server not found." });

    const authority = await getAuthority(server, loggedInUserId);
    if (!authority.can(PERMISSIONS.MANAGE_SERVER)) {
      return res
        .status(403)
        .json({ message: "You do not have permission to reset the invite code." });
    }

    server.inviteCode = generateInviteCode();
    await server.save();

    res.status(200).json({ inviteCode: server.inviteCode });
  } catch (error) {
    console.log("Error in regenerateInviteCode controller: ", error.message);
    res.status(500).json({ message: "Error resetting invite code" });
  }
};
