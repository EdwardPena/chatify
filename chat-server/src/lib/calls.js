import ContactRequest, { REQUEST_STATUS } from "../models/ContactRequest.js";

// callId -> { callerId, calleeId, withVideo, isAnswered }
// a direct call is a two person room that only exists while it rings or runs
const calls = new Map();

// contacts are mutual, so an accepted request in either direction counts
const areContacts = (userId, otherUserId) =>
  ContactRequest.exists({
    status: REQUEST_STATUS.ACCEPTED,
    $or: [
      { senderId: userId, receiverId: otherUserId },
      { senderId: otherUserId, receiverId: userId },
    ],
  });

const makeCallId = (a, b) => [a, b].sort().join(":");

const otherParty = (call, userId) =>
  call.callerId === userId ? call.calleeId : call.callerId;

// one place to tear a call down, whoever caused it
const endCall = (io, callId, endedBy, reason, getSocketId) => {
  const call = calls.get(callId);
  if (!call) return;

  calls.delete(callId);

  [call.callerId, call.calleeId].forEach((userId) => {
    if (userId === endedBy) return;
    const socketId = getSocketId(userId);
    if (socketId) io.to(socketId).emit("call:ended", { callId, reason });
  });
};

// called on disconnect, when we no longer know which call they were in
export const dropFromCalls = (io, socket, getSocketId) => {
  for (const [callId, call] of [...calls.entries()]) {
    if (call.callerId === socket.userId || call.calleeId === socket.userId) {
      endCall(io, callId, socket.userId, "disconnected", getSocketId);
    }
  }
};

export const registerCallHandlers = (io, socket, getSocketId) => {
  socket.on("call:invite", async ({ toUserId, withVideo } = {}) => {
    try {
      if (!toUserId || toUserId === socket.userId) return;

      // you can only ring someone who agreed to be your contact
      if (!(await areContacts(socket.userId, toUserId))) {
        return socket.emit("call:failed", {
          message: "You can only call your contacts.",
        });
      }

      const calleeSocketId = getSocketId(toUserId);
      if (!calleeSocketId) {
        return socket.emit("call:failed", { message: "They are offline." });
      }

      const callId = makeCallId(socket.userId, toUserId);
      if (calls.has(callId)) {
        return socket.emit("call:failed", { message: "Already in a call." });
      }

      calls.set(callId, {
        callerId: socket.userId,
        calleeId: toUserId,
        withVideo: Boolean(withVideo),
        isAnswered: false,
      });

      io.to(calleeSocketId).emit("call:incoming", {
        callId,
        withVideo: Boolean(withVideo),
        from: {
          _id: socket.userId,
          fullName: socket.user.fullName,
          username: socket.user.username,
          profilePic: socket.user.profilePic,
        },
      });
      socket.emit("call:ringing", { callId });
    } catch (error) {
      console.log("Error in call:invite handler: ", error.message);
    }
  });

  socket.on("call:accept", ({ callId } = {}) => {
    const call = calls.get(callId);
    if (!call || call.calleeId !== socket.userId) return;

    call.isAnswered = true;
    const callerSocketId = getSocketId(call.callerId);
    // the caller makes the offer, so it is the one told to start
    if (callerSocketId) io.to(callerSocketId).emit("call:accepted", { callId });

    // the invite rang in every tab this person has open, the rest can stop
    socket.broadcast.to(`user:${socket.userId}`).emit("call:handled", { callId });
  });

  socket.on("call:decline", ({ callId } = {}) => {
    const call = calls.get(callId);
    if (!call || call.calleeId !== socket.userId) return;

    socket.broadcast.to(`user:${socket.userId}`).emit("call:handled", { callId });
    endCall(io, callId, socket.userId, "declined", getSocketId);
  });

  socket.on("call:end", ({ callId } = {}) => {
    const call = calls.get(callId);
    if (!call) return;
    if (call.callerId !== socket.userId && call.calleeId !== socket.userId) return;

    endCall(io, callId, socket.userId, "ended", getSocketId);
  });

  // pure relay, the server never looks inside the offer, answer or candidate
  socket.on("call:signal", ({ callId, signal } = {}) => {
    const call = calls.get(callId);
    if (!call) return;
    if (call.callerId !== socket.userId && call.calleeId !== socket.userId) return;

    const targetSocketId = getSocketId(otherParty(call, socket.userId));
    if (targetSocketId) {
      io.to(targetSocketId).emit("call:signal", { callId, signal });
    }
  });
};
