import Message, { MESSAGE_STATUS } from "../models/Message.js";
import User from "../models/User.js";
import ContactRequest, { REQUEST_STATUS } from "../models/ContactRequest.js";
import { MAX_AUDIO_SECONDS, uploadMessageAttachments } from "../lib/uploads.js";
import { MENTION_FIELDS, resolveMentions } from "../lib/mentions.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

// escape user input before it goes into a regex
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// contacts are mutual, so an accepted request in either direction counts
const areContacts = (userId, otherUserId) =>
  ContactRequest.exists({
    status: REQUEST_STATUS.ACCEPTED,
    $or: [
      { senderId: userId, receiverId: otherUserId },
      { senderId: otherUserId, receiverId: userId },
    ],
  });

export const getMessagesByUserId = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: userToChatId } = req.params;

    const search = (req.query.search || "").trim();
    const filter = {
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    };
    if (search) filter.text = { $regex: escapeRegex(search), $options: "i" };

    const messages = await Message.find(filter)
      .sort({ createdAt: 1 })
      .populate("replyTo", "text image audio senderId");

    // opening the conversation is what turns their messages into read ones
    if (!search) {
      const unread = await Message.find({
        senderId: userToChatId,
        receiverId: myId,
        status: { $ne: MESSAGE_STATUS.READ },
      }).select("_id");

      if (unread.length > 0) {
        const ids = unread.map((m) => m._id);
        await Message.updateMany(
          { _id: { $in: ids } },
          { status: MESSAGE_STATUS.READ },
        );

        const partnerSocketId = getReceiverSocketId(userToChatId);
        if (partnerSocketId) {
          io.to(partnerSocketId).emit("messagesRead", {
            byUserId: myId.toString(),
            messageIds: ids.map((id) => id.toString()),
          });
        }
        messages.forEach((message) => {
          if (message.senderId.equals(userToChatId)) {
            message.status = MESSAGE_STATUS.READ;
          }
        });
      }
    }

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ message: "Internal server eror" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, audio, audioDuration, replyTo } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    if (!text && !image && !audio) {
      return res
        .status(400)
        .json({ message: "Text, image or audio is required." });
    }
    if (senderId.equals(receiverId)) {
      return res
        .status(400)
        .json({ message: "Cannot send messages to yourself." });
    }
    if (audioDuration && Number(audioDuration) > MAX_AUDIO_SECONDS) {
      return res.status(400).json({
        message: `Voice messages cannot be longer than ${MAX_AUDIO_SECONDS} seconds.`,
      });
    }
    const receiverExists = await User.exists({ _id: receiverId });
    if (!receiverExists) {
      return res.status(404).json({ message: "Receiver not found." });
    }
    if (!(await areContacts(senderId, receiverId))) {
      return res
        .status(403)
        .json({ message: "You can only message your contacts." });
    }

    let imageUrl;
    let audioUrl;

    // report upload failures on their own, they are not our bug and the
    // generic 500 gave the user nothing to act on
    try {
      ({ imageUrl, audioUrl } = await uploadMessageAttachments({
        image,
        audio,
      }));
    } catch (error) {
      console.log("Cloudinary upload failed: ", error.message);
      return res
        .status(502)
        .json({ message: "Attachment upload failed. Please try again." });
    }

    // a reply only counts if it belongs to this same conversation
    let replyToId;
    if (replyTo) {
      const parent = await Message.findOne({
        _id: replyTo,
        $or: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      }).select("_id");
      if (parent) replyToId = parent._id;
    }

    const receiverSocketId = getReceiverSocketId(receiverId);

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      audio: audioUrl,
      audioDuration: audio ? Number(audioDuration) || undefined : undefined,
      replyTo: replyToId,
      mentions: await resolveMentions(text, [receiverId, senderId]),
      // if their socket is there to receive it, it is delivered on arrival
      status: receiverSocketId ? MESSAGE_STATUS.DELIVERED : MESSAGE_STATUS.SENT,
    });

    await newMessage.save();
    await newMessage.populate("mentions", MENTION_FIELDS);
    await newMessage.populate("replyTo", "text image audio senderId");

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getChatPartners = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    // channel messages share this collection and carry no receiver, so they
    // must stay out of the direct message partner list
    const messages = await Message.find({
      channelId: { $exists: false },
      $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
    });

    const chatPartnersIds = [
      ...new Set(
        messages.map((msg) =>
          msg.senderId.toString() === loggedInUserId.toString()
            ? msg.receiverId.toString()
            : msg.senderId.toString(),
        ),
      ),
    ];

    const chatPartners = await User.find({
      _id: { $in: chatPartnersIds },
    }).select("fullName username profilePic");

    res.status(200).json(chatPartners);
  } catch (error) {
    console.log("Error in getChatPartners: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const { messageId } = req.params;

    // a direct message has no moderators, only its author can take it back
    const message = await Message.findOneAndDelete({
      _id: messageId,
      senderId: loggedInUserId,
      channelId: { $exists: false },
    });
    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    const receiverSocketId = getReceiverSocketId(message.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageDeleted", {
        messageId: message._id.toString(),
        senderId: loggedInUserId.toString(),
      });
    }

    res.status(200).json({ message: "Message deleted." });
  } catch (error) {
    console.log("Error in deleteMessage controller: ", error.message);
    res.status(500).json({ message: "Error deleting message" });
  }
};

// called the moment someone connects: anything that was waiting for them is
// delivered now, and whoever sent it finds out
export const markPendingAsDelivered = async (userId) => {
  try {
    const pending = await Message.find({
      receiverId: userId,
      status: MESSAGE_STATUS.SENT,
    }).select("_id senderId");
    if (pending.length === 0) return;

    await Message.updateMany(
      { _id: { $in: pending.map((m) => m._id) } },
      { status: MESSAGE_STATUS.DELIVERED },
    );

    // one event per sender, carrying only the messages that were theirs
    const bySender = new Map();
    pending.forEach((message) => {
      const key = message.senderId.toString();
      bySender.set(key, [...(bySender.get(key) || []), message._id.toString()]);
    });

    bySender.forEach((messageIds, senderId) => {
      const socketId = getReceiverSocketId(senderId);
      if (socketId) {
        io.to(socketId).emit("messagesDelivered", { toUserId: userId, messageIds });
      }
    });
  } catch (error) {
    console.log("Error marking messages delivered: ", error.message);
  }
};

// a message that lands while the conversation is already open is read the
// moment it arrives, not only when the page is opened again
export const markConversationAsRead = async (readerId, fromUserId) => {
  try {
    const unread = await Message.find({
      senderId: fromUserId,
      receiverId: readerId,
      status: { $ne: MESSAGE_STATUS.READ },
    }).select("_id");
    if (unread.length === 0) return;

    const ids = unread.map((message) => message._id);
    await Message.updateMany(
      { _id: { $in: ids } },
      { status: MESSAGE_STATUS.READ },
    );

    const senderSocketId = getReceiverSocketId(fromUserId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messagesRead", {
        byUserId: readerId.toString(),
        messageIds: ids.map((id) => id.toString()),
      });
    }
  } catch (error) {
    console.log("Error marking conversation read: ", error.message);
  }
};
