import mongoose from "mongoose";
import Channel, { CHANNEL_TYPES, slugifyChannelName } from "../models/Channel.js";
import Message from "../models/Message.js";
import Server from "../models/Server.js";
import { PERMISSIONS } from "../models/Role.js";
import { getAuthority } from "../lib/permissions.js";
import { MENTION_FIELDS, resolveMentions } from "../lib/mentions.js";
import { MAX_AUDIO_SECONDS, uploadMessageAttachments } from "../lib/uploads.js";
import { io, serverRoom } from "../lib/socket.js";
import { serializeChannel } from "./server.controllers.js";

const PUBLIC_USER_FIELDS = "fullName username profilePic";

// escape user input before it goes into a regex
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// how many messages a channel hands back on open, oldest last
const MESSAGE_PAGE_SIZE = 100;

// a channel is only reachable through the server that owns it, so both are
// loaded together and the membership is checked once
const findChannelForMember = async (channelId, userId) => {
  if (!mongoose.isValidObjectId(channelId)) return {};

  const channel = await Channel.findById(channelId);
  if (!channel) return {};

  const server = await Server.findOne({
    _id: channel.serverId,
    "members.userId": userId,
  });
  if (!server) return {};

  return { channel, server, authority: await getAuthority(server, userId) };
};

export const updateChannel = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    const { channel, server, authority } = await findChannelForMember(
      req.params.id,
      loggedInUserId,
    );
    if (!channel) return res.status(404).json({ message: "Channel not found." });
    if (!authority.can(PERMISSIONS.MANAGE_CHANNELS)) {
      return res
        .status(403)
        .json({ message: "You do not have permission to edit channels." });
    }

    const { name, topic } = req.body;

    if (name !== undefined) {
      const slug = slugifyChannelName(name);
      if (!slug) {
        return res.status(400).json({
          message: "Channel names need at least one letter or number.",
        });
      }
      channel.name = slug;
    }
    if (topic !== undefined) channel.topic = topic.trim();

    await channel.save();

    io.to(serverRoom(server._id)).emit("channelUpdated", {
      channel: serializeChannel(channel),
    });

    res.status(200).json({ channel: serializeChannel(channel) });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "This server already has a channel with that name." });
    }
    console.log("Error in updateChannel controller: ", error.message);
    res.status(500).json({ message: "Error updating channel" });
  }
};

export const deleteChannel = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    const { channel, server, authority } = await findChannelForMember(
      req.params.id,
      loggedInUserId,
    );
    if (!channel) return res.status(404).json({ message: "Channel not found." });
    if (!authority.can(PERMISSIONS.MANAGE_CHANNELS)) {
      return res
        .status(403)
        .json({ message: "You do not have permission to delete channels." });
    }

    // a server without a single text channel has nowhere to talk
    if (channel.type === CHANNEL_TYPES.TEXT) {
      const textChannels = await Channel.countDocuments({
        serverId: server._id,
        type: CHANNEL_TYPES.TEXT,
      });
      if (textChannels <= 1) {
        return res
          .status(400)
          .json({ message: "A server needs at least one text channel." });
      }
    }

    await Message.deleteMany({ channelId: channel._id });
    await channel.deleteOne();

    io.to(serverRoom(server._id)).emit("channelDeleted", {
      serverId: server._id.toString(),
      channelId: channel._id.toString(),
    });

    res.status(200).json({ message: `#${channel.name} deleted.` });
  } catch (error) {
    console.log("Error in deleteChannel controller: ", error.message);
    res.status(500).json({ message: "Error deleting channel" });
  }
};

export const getChannelMessages = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    const { channel } = await findChannelForMember(
      req.params.id,
      loggedInUserId,
    );
    if (!channel) return res.status(404).json({ message: "Channel not found." });
    if (channel.type !== CHANNEL_TYPES.TEXT) {
      return res
        .status(400)
        .json({ message: "Voice channels do not keep messages." });
    }

    const search = (req.query.search || "").trim();
    const filter = { channelId: channel._id };
    if (search) filter.text = { $regex: escapeRegex(search), $options: "i" };

    // take the newest page from the database, then flip it back into reading
    // order for the client
    const messages = await Message.find(filter)
      .populate("senderId", PUBLIC_USER_FIELDS)
      .populate("mentions", MENTION_FIELDS)
      .populate({
        path: "replyTo",
        select: "text image audio senderId",
        populate: { path: "senderId", select: PUBLIC_USER_FIELDS },
      })
      .sort({ createdAt: -1 })
      .limit(MESSAGE_PAGE_SIZE);

    res.status(200).json(messages.reverse());
  } catch (error) {
    console.log("Error in getChannelMessages controller: ", error.message);
    res.status(500).json({ message: "Error fetching messages" });
  }
};

export const sendChannelMessage = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const { text, image, audio, audioDuration, replyTo } = req.body;

    if (!text && !image && !audio) {
      return res
        .status(400)
        .json({ message: "Text, image or audio is required." });
    }
    if (audioDuration && Number(audioDuration) > MAX_AUDIO_SECONDS) {
      return res.status(400).json({
        message: `Voice messages cannot be longer than ${MAX_AUDIO_SECONDS} seconds.`,
      });
    }

    const { channel, server, authority } = await findChannelForMember(
      req.params.id,
      loggedInUserId,
    );
    if (!channel) return res.status(404).json({ message: "Channel not found." });
    if (channel.type !== CHANNEL_TYPES.TEXT) {
      return res
        .status(400)
        .json({ message: "You can only post in text channels." });
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

    // a reply only counts if it belongs to this same channel
    let replyToId;
    if (replyTo) {
      const parent = await Message.findOne({
        _id: replyTo,
        channelId: channel._id,
      }).select("_id");
      if (parent) replyToId = parent._id;
    }

    const mentions = await resolveMentions(
      text,
      server.members.map((member) => member.userId),
    );

    const newMessage = new Message({
      senderId: loggedInUserId,
      channelId: channel._id,
      mentions,
      replyTo: replyToId,
      text,
      image: imageUrl,
      audio: audioUrl,
      audioDuration: audio ? Number(audioDuration) || undefined : undefined,
    });

    await newMessage.save();
    await newMessage.populate("mentions", MENTION_FIELDS);
    await newMessage.populate({
      path: "replyTo",
      select: "text image audio senderId",
      populate: { path: "senderId", select: PUBLIC_USER_FIELDS },
    });

    // the sender is rendered from the same shape the history endpoint returns
    const sentMessage = {
      ...newMessage.toObject(),
      // the client needs to know which server this belongs to, to tally
      // unread counts for servers it has not opened yet
      serverId: server._id,
      senderId: {
        _id: req.user._id,
        fullName: req.user.fullName,
        username: req.user.username,
        profilePic: req.user.profilePic,
      },
    };

    io.to(serverRoom(server._id)).emit("newChannelMessage", sentMessage);

    res.status(201).json(sentMessage);
  } catch (error) {
    console.log("Error in sendChannelMessage controller: ", error.message);
    res.status(500).json({ message: "Error sending message" });
  }
};

export const deleteChannelMessage = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const { id, messageId } = req.params;

    if (!mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ message: "Invalid message id." });
    }

    const { channel, server, authority } = await findChannelForMember(id, loggedInUserId);
    if (!channel) return res.status(404).json({ message: "Channel not found." });

    const message = await Message.findOne({
      _id: messageId,
      channelId: channel._id,
    });
    if (!message) return res.status(404).json({ message: "Message not found." });

    // you can always delete your own words, moderators can delete anyone's
    const isAuthor = message.senderId.equals(loggedInUserId);
    if (!isAuthor && !authority.can(PERMISSIONS.MODERATE_MESSAGES)) {
      return res
        .status(403)
        .json({ message: "You can only delete your own messages." });
    }

    await message.deleteOne();

    io.to(serverRoom(server._id)).emit("channelMessageDeleted", {
      channelId: channel._id.toString(),
      messageId: message._id.toString(),
    });

    res.status(200).json({ message: "Message deleted." });
  } catch (error) {
    console.log("Error in deleteChannelMessage controller: ", error.message);
    res.status(500).json({ message: "Error deleting message" });
  }
};
