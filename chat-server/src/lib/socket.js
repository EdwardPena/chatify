import { Server as SocketServer } from "socket.io";
import http from "http";
import express from "express";
import { ENV } from "./env.js";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";
import { dropFromVoiceRooms, registerVoiceHandlers } from "./voice.js";
import { dropFromCalls, registerCallHandlers } from "./calls.js";
import Server from "../models/Server.js";
import {
  markConversationAsRead,
  markPendingAsDelivered,
} from "../controllers/message.controllers.js";

const app = express();
const server = http.createServer(app);

const io = new SocketServer(server, {
  cors: {
    origin: [ENV.CLIENT_URL],
    credentials: true,
  },
});

// apply auth middleware to all socket connections
io.use(socketAuthMiddleware);

// one person can have several tabs open, and a refresh briefly overlaps the
// old socket with the new one, so a user maps to a SET of sockets. Deleting
// the user on any one disconnect used to knock them offline while they were
// still sitting in another tab.
const userSockets = new Map(); // userId -> Set<socketId>

const userRoom = (userId) => `user:${userId}`;

// callers only ever need somewhere to send to, and a room reaches every tab
export function getReceiverSocketId(userId) {
  const id = userId?.toString();
  return userSockets.get(id)?.size ? userRoom(id) : undefined;
}

const onlineUserIds = () => [...userSockets.keys()];

const addUserSocket = (userId, socketId) => {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(socketId);
};

// a user goes offline only once their last socket is gone
const removeUserSocket = (userId, socketId) => {
  const sockets = userSockets.get(userId);
  if (!sockets) return;

  sockets.delete(socketId);
  if (sockets.size === 0) userSockets.delete(userId);
};

// channel traffic goes to a room per server instead of to every socket
export const serverRoom = (serverId) => `server:${serverId}`;

// called right after someone creates or joins a server, otherwise they would
// only start receiving its events on their next reconnect
export function joinServerRoom(userId, serverId) {
  io.in(userRoom(userId)).socketsJoin(serverRoom(serverId));
}

export function leaveServerRoom(userId, serverId) {
  io.in(userRoom(userId)).socketsLeave(serverRoom(serverId));
}

io.on("connection", async (socket) => {
  console.log("A user connected", socket.user.fullName);

  const userId = socket.userId;
  addUserSocket(userId, socket.id);
  socket.join(userRoom(userId));

  //io.emit() is used to send events to all connected clients
  io.emit("getOnlineUsers", onlineUserIds());

  try {
    const servers = await Server.find({ "members.userId": userId }).select(
      "_id",
    );
    servers.forEach((joined) => socket.join(serverRoom(joined._id)));
  } catch (error) {
    console.log("Error joining server rooms: ", error.message);
  }

  // anything sent while they were away is delivered now
  markPendingAsDelivered(userId);

  // the client says so when a message lands in a conversation it has open
  socket.on("messages:read", ({ fromUserId } = {}) => {
    if (fromUserId) markConversationAsRead(userId, fromUserId);
  });

  registerVoiceHandlers(io, socket);
  registerCallHandlers(io, socket, getReceiverSocketId);

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.user.fullName);
    dropFromVoiceRooms(io, socket);
    dropFromCalls(io, socket, getReceiverSocketId);
    removeUserSocket(userId, socket.id);
    io.emit("getOnlineUsers", onlineUserIds());
  });
});

export { io, app, server };
