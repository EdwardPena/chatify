import Channel, { CHANNEL_TYPES } from "../models/Channel.js";
import Server from "../models/Server.js";

// channelId -> Map(userId -> { socketId, user })
// voice presence only matters while people are connected, so it lives in
// memory and disappears with the process, exactly like the online user map
const voiceRooms = new Map();

const voiceRoom = (channelId) => `voice:${channelId}`;
const serverRoom = (serverId) => `server:${serverId}`;

const getRoom = (channelId) => {
  if (!voiceRooms.has(channelId)) voiceRooms.set(channelId, new Map());
  return voiceRooms.get(channelId);
};

// what the client renders under a voice channel in the sidebar
export const getVoiceParticipants = (channelId) => {
  const room = voiceRooms.get(channelId.toString());
  if (!room) return [];
  return [...room.values()].map((entry) => entry.user);
};

// what everyone in the server sees about someone sitting in a voice channel
const toVoiceUser = (socket, media = {}) => ({
  _id: socket.userId,
  fullName: socket.user.fullName,
  username: socket.user.username,
  profilePic: socket.user.profilePic,
  isMuted: Boolean(media.isMuted),
  isCameraOn: Boolean(media.isCameraOn),
  isSharingScreen: Boolean(media.isSharingScreen),
});

// everyone in the server sees who is talking, not just the people in the call
const broadcastParticipants = (io, serverId, channelId) => {
  io.to(serverRoom(serverId)).emit("voice:participants", {
    channelId,
    participants: getVoiceParticipants(channelId),
  });
};

// a socket may only sit in one voice channel at a time, the same way a person
// can only be in one room at a time
const leaveVoiceChannel = (io, socket, channelId) => {
  const room = voiceRooms.get(channelId);
  const entry = room?.get(socket.userId);
  if (!entry || entry.socketId !== socket.id) return;

  room.delete(socket.userId);
  socket.leave(voiceRoom(channelId));

  io.to(voiceRoom(channelId)).emit("voice:userLeft", {
    channelId,
    userId: socket.userId,
  });
  broadcastParticipants(io, entry.serverId, channelId);

  if (room.size === 0) voiceRooms.delete(channelId);
};

// called on disconnect, when we no longer know which channel they were in
export const dropFromVoiceRooms = (io, socket) => {
  for (const channelId of [...voiceRooms.keys()]) {
    leaveVoiceChannel(io, socket, channelId);
  }
};

export const registerVoiceHandlers = (io, socket) => {
  socket.on("voice:join", async ({ channelId } = {}) => {
    try {
      const channel = await Channel.findById(channelId);
      if (!channel || channel.type !== CHANNEL_TYPES.VOICE) return;

      // a voice channel is only open to the members of its server
      const isMember = await Server.exists({
        _id: channel.serverId,
        "members.userId": socket.userId,
      });
      if (!isMember) return;

      const id = channel._id.toString();
      const serverId = channel.serverId.toString();

      dropFromVoiceRooms(io, socket);

      const room = getRoom(id);
      // the newcomer dials everyone already inside, so it needs the list
      // before it is added to it
      const peers = [...room.values()].map((entry) => entry.user);

      const user = toVoiceUser(socket);
      room.set(socket.userId, { socketId: socket.id, serverId, user });
      socket.join(voiceRoom(id));

      socket.emit("voice:peers", { channelId: id, peers });
      socket.to(voiceRoom(id)).emit("voice:userJoined", { channelId: id, user });
      broadcastParticipants(io, serverId, id);
    } catch (error) {
      console.log("Error in voice:join handler: ", error.message);
    }
  });

  socket.on("voice:leave", ({ channelId } = {}) => {
    if (channelId) leaveVoiceChannel(io, socket, channelId.toString());
    else dropFromVoiceRooms(io, socket);
  });

  // pure relay: offers, answers and ice candidates travel between two peers
  // and the server never looks inside them
  socket.on("voice:signal", ({ channelId, toUserId, signal } = {}) => {
    const room = voiceRooms.get(String(channelId));
    const target = room?.get(String(toUserId));
    if (!target || !room.has(socket.userId)) return;

    io.to(target.socketId).emit("voice:signal", {
      channelId: String(channelId),
      fromUserId: socket.userId,
      signal,
    });
  });

  // mic, camera and screen share all travel on the same announcement
  socket.on("voice:media", ({ channelId, ...media } = {}) => {
    const id = String(channelId);
    const entry = voiceRooms.get(id)?.get(socket.userId);
    if (!entry) return;

    entry.user = toVoiceUser(socket, media);
    broadcastParticipants(io, entry.serverId, id);
  });
};
