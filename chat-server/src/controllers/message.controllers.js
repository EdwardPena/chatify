import Message from "../models/Message.js";
import User from "../models/User.js";
import ContactRequest, { REQUEST_STATUS } from "../models/ContactRequest.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

// the largest voice note we accept, keeps a single request well inside the
// 10mb express.json limit (base64 inflates the payload by roughly a third)
const MAX_AUDIO_SECONDS = 120;

// the cloudinary api rejects data urls that carry extra mime parameters, and
// MediaRecorder produces "audio/webm;codecs=opus", so keep just the media type
const stripMimeParams = (dataUrl) => {
  const separator = dataUrl.indexOf(",");
  if (separator === -1 || !dataUrl.startsWith("data:")) return dataUrl;

  const mimeType = dataUrl.slice(5, separator).split(";")[0];
  return `data:${mimeType};base64,${dataUrl.slice(separator + 1)}`;
};

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

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ message: "Internal server eror" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, audio, audioDuration } = req.body;
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
      if (image) {
        const uploadResponse = await cloudinary.uploader.upload(image);
        imageUrl = uploadResponse.secure_url;
      }

      if (audio) {
        // cloudinary serves audio under the "video" resource type
        const uploadResponse = await cloudinary.uploader.upload(
          stripMimeParams(audio),
          {
            resource_type: "video",
            folder: "chatify/voice-messages",
          },
        );
        audioUrl = uploadResponse.secure_url;
      }
    } catch (error) {
      console.log("Cloudinary upload failed: ", error.message);
      return res
        .status(502)
        .json({ message: "Attachment upload failed. Please try again." });
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      audio: audioUrl,
      audioDuration: audio ? Number(audioDuration) || undefined : undefined,
    });

    await newMessage.save();

    const receiverSocketId = getReceiverSocketId(receiverId);
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

    const messages = await Message.find({
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
