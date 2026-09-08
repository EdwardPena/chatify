import mongoose from "mongoose";
import User from "../models/User.js";
import ContactRequest, { REQUEST_STATUS } from "../models/ContactRequest.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

const PUBLIC_USER_FIELDS = "fullName username profilePic";

// escape user input before it goes into a regex
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// req.user still carries the email, keep it out of socket payloads
const toPublicUser = (user) => ({
  _id: user._id,
  fullName: user.fullName,
  username: user.username,
  profilePic: user.profilePic,
});

// contacts are mutual, so one row covers the pair no matter who started it
const findRelationship = (userId, otherUserId) =>
  ContactRequest.findOne({
    $or: [
      { senderId: userId, receiverId: otherUserId },
      { senderId: otherUserId, receiverId: userId },
    ],
  });

// tells the client which button to show for a searched user
const describeRelationship = (relationship, myId) => {
  if (!relationship) return { status: "none" };
  if (relationship.status === REQUEST_STATUS.ACCEPTED) {
    return { status: "accepted", requestId: relationship._id };
  }
  if (relationship.status === REQUEST_STATUS.PENDING) {
    const iSentIt = relationship.senderId.toString() === myId.toString();
    return {
      status: iSentIt ? "outgoing_pending" : "incoming_pending",
      requestId: relationship._id,
    };
  }
  return { status: "rejected", requestId: relationship._id };
};

// ids of everyone the user has actually accepted
export const getAcceptedContactIds = async (userId) => {
  const accepted = await ContactRequest.find({
    status: REQUEST_STATUS.ACCEPTED,
    $or: [{ senderId: userId }, { receiverId: userId }],
  }).select("senderId receiverId");

  return accepted.map((request) =>
    request.senderId.toString() === userId.toString()
      ? request.receiverId
      : request.senderId,
  );
};

export const getMyContacts = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    const contactIds = await getAcceptedContactIds(loggedInUserId);
    const contacts = await User.find({ _id: { $in: contactIds } })
      .select(PUBLIC_USER_FIELDS)
      .sort({ fullName: 1 });

    res.status(200).json({ users: contacts });
  } catch (error) {
    console.log("Error in getMyContacts controller: ", error.message);
    res.status(500).json({ message: "Error fetching contacts" });
  }
};

export const searchUsers = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const username = (req.query.username || "").trim().toLowerCase();

    if (!username) {
      return res.status(400).json({ message: "A username is required." });
    }

    const matches = await User.find({
      _id: { $ne: loggedInUserId },
      username: { $regex: `^${escapeRegex(username)}`, $options: "i" },
    })
      .select(PUBLIC_USER_FIELDS)
      .limit(10);

    // annotate each hit with the current relationship so the client knows
    // whether to offer "Add", "Pending" or "Already a contact"
    const results = await Promise.all(
      matches.map(async (user) => {
        const relationship = await findRelationship(loggedInUserId, user._id);
        return {
          ...user.toObject(),
          relationship: describeRelationship(relationship, loggedInUserId),
        };
      }),
    );

    res.status(200).json({ users: results });
  } catch (error) {
    console.log("Error in searchUsers controller: ", error.message);
    res.status(500).json({ message: "Error searching users" });
  }
};

export const sendContactRequest = async (req, res) => {
  try {
    const senderId = req.user._id;
    const username = (req.body.username || "").trim().toLowerCase();

    if (!username) {
      return res.status(400).json({ message: "A username is required." });
    }

    const receiver = await User.findOne({ username }).select(
      PUBLIC_USER_FIELDS,
    );
    if (!receiver) {
      return res.status(404).json({ message: `No user named @${username}.` });
    }
    if (receiver._id.equals(senderId)) {
      return res
        .status(400)
        .json({ message: "You cannot add yourself as a contact." });
    }

    const existing = await findRelationship(senderId, receiver._id);

    if (existing) {
      if (existing.status === REQUEST_STATUS.ACCEPTED) {
        return res
          .status(409)
          .json({ message: `@${username} is already one of your contacts.` });
      }

      if (existing.status === REQUEST_STATUS.PENDING) {
        // they already asked us: sending back is the same as accepting
        if (existing.receiverId.equals(senderId)) {
          existing.status = REQUEST_STATUS.ACCEPTED;
          await existing.save();

          const senderSocketId = getReceiverSocketId(receiver._id);
          if (senderSocketId) {
            io.to(senderSocketId).emit("contactRequestAccepted", {
              user: toPublicUser(req.user),
            });
          }

          return res.status(200).json({
            message: `@${username} is now a contact.`,
            request: existing,
            contact: receiver,
          });
        }

        // duplicate of our own request: no new row, no spam for the receiver
        return res
          .status(409)
          .json({ message: `Your request to @${username} is still pending.` });
      }

      // previously rejected: reuse the row so the unique index stays happy and
      // the user gets a second chance instead of a dead end
      existing.senderId = senderId;
      existing.receiverId = receiver._id;
      existing.status = REQUEST_STATUS.PENDING;
      await existing.save();

      const retrySocketId = getReceiverSocketId(receiver._id);
      if (retrySocketId) {
        io.to(retrySocketId).emit("contactRequest", {
          _id: existing._id,
          status: existing.status,
          createdAt: existing.createdAt,
          sender: toPublicUser(req.user),
        });
      }

      return res.status(201).json({
        message: `Contact request sent to @${username}.`,
        request: existing,
      });
    }

    const newRequest = await ContactRequest.create({
      senderId,
      receiverId: receiver._id,
      status: REQUEST_STATUS.PENDING,
    });

    const receiverSocketId = getReceiverSocketId(receiver._id);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("contactRequest", {
        _id: newRequest._id,
        status: newRequest.status,
        createdAt: newRequest.createdAt,
        sender: toPublicUser(req.user),
      });
    }

    res.status(201).json({
      message: `Contact request sent to @${username}.`,
      request: newRequest,
    });
  } catch (error) {
    // the unique index fired because two identical requests raced each other
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "You already have a request with this user." });
    }
    console.log("Error in sendContactRequest controller: ", error.message);
    res.status(500).json({ message: "Error sending contact request" });
  }
};

export const getContactRequests = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    const [incoming, outgoing] = await Promise.all([
      ContactRequest.find({
        receiverId: loggedInUserId,
        status: REQUEST_STATUS.PENDING,
      })
        .populate("senderId", PUBLIC_USER_FIELDS)
        .sort({ createdAt: -1 }),
      ContactRequest.find({
        senderId: loggedInUserId,
        status: REQUEST_STATUS.PENDING,
      })
        .populate("receiverId", PUBLIC_USER_FIELDS)
        .sort({ createdAt: -1 }),
    ]);

    res.status(200).json({
      incoming: incoming.map((request) => ({
        _id: request._id,
        createdAt: request.createdAt,
        user: request.senderId,
      })),
      outgoing: outgoing.map((request) => ({
        _id: request._id,
        createdAt: request.createdAt,
        user: request.receiverId,
      })),
    });
  } catch (error) {
    console.log("Error in getContactRequests controller: ", error.message);
    res.status(500).json({ message: "Error fetching contact requests" });
  }
};

export const acceptContactRequest = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid request id." });
    }

    // only the receiver of a still-pending request may accept it
    const request = await ContactRequest.findOneAndUpdate(
      {
        _id: id,
        receiverId: loggedInUserId,
        status: REQUEST_STATUS.PENDING,
      },
      { status: REQUEST_STATUS.ACCEPTED },
      { new: true },
    );

    if (!request) {
      return res.status(404).json({ message: "Contact request not found." });
    }

    const contact = await User.findById(request.senderId).select(
      PUBLIC_USER_FIELDS,
    );

    const senderSocketId = getReceiverSocketId(request.senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("contactRequestAccepted", {
        user: toPublicUser(req.user),
      });
    }

    res.status(200).json({ message: "Contact request accepted.", contact });
  } catch (error) {
    console.log("Error in acceptContactRequest controller: ", error.message);
    res.status(500).json({ message: "Error accepting contact request" });
  }
};

export const rejectContactRequest = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid request id." });
    }

    const request = await ContactRequest.findOneAndUpdate(
      {
        _id: id,
        receiverId: loggedInUserId,
        status: REQUEST_STATUS.PENDING,
      },
      { status: REQUEST_STATUS.REJECTED },
      { new: true },
    );

    if (!request) {
      return res.status(404).json({ message: "Contact request not found." });
    }

    // the sender is deliberately not notified, a rejection should be quiet
    res.status(200).json({ message: "Contact request rejected." });
  } catch (error) {
    console.log("Error in rejectContactRequest controller: ", error.message);
    res.status(500).json({ message: "Error rejecting contact request" });
  }
};

export const cancelContactRequest = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid request id." });
    }

    const request = await ContactRequest.findOneAndDelete({
      _id: id,
      senderId: loggedInUserId,
      status: REQUEST_STATUS.PENDING,
    });

    if (!request) {
      return res.status(404).json({ message: "Contact request not found." });
    }

    const receiverSocketId = getReceiverSocketId(request.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("contactRequestCancelled", {
        requestId: request._id,
      });
    }

    res.status(200).json({ message: "Contact request cancelled." });
  } catch (error) {
    console.log("Error in cancelContactRequest controller: ", error.message);
    res.status(500).json({ message: "Error cancelling contact request" });
  }
};

export const removeContact = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const { id: contactId } = req.params;

    if (!mongoose.isValidObjectId(contactId)) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    // deleting the row rather than flagging it means either side can send a
    // fresh request afterwards
    const removed = await ContactRequest.findOneAndDelete({
      status: REQUEST_STATUS.ACCEPTED,
      $or: [
        { senderId: loggedInUserId, receiverId: contactId },
        { senderId: contactId, receiverId: loggedInUserId },
      ],
    });

    if (!removed) {
      return res.status(404).json({ message: "Contact not found." });
    }

    const contactSocketId = getReceiverSocketId(contactId);
    if (contactSocketId) {
      io.to(contactSocketId).emit("contactRemoved", {
        userId: loggedInUserId.toString(),
      });
    }

    res.status(200).json({ message: "Contact removed." });
  } catch (error) {
    console.log("Error in removeContact controller: ", error.message);
    res.status(500).json({ message: "Error removing contact" });
  }
};
