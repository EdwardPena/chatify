import crypto from "crypto";
import mongoose from "mongoose";

// short code people paste to join, random enough that nobody guesses one
export const generateInviteCode = () => crypto.randomBytes(4).toString("hex");

const memberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // roles are documents of their own now, so a server can invent new ones
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const serverSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    icon: {
      type: String,
      default: "",
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: {
      type: [memberSchema],
      default: [],
    },
    inviteCode: {
      type: String,
      required: true,
      unique: true,
      default: generateInviteCode,
    },
  },
  { timestamps: true },
);

// the sidebar asks "which servers am I in" on every page load
serverSchema.index({ "members.userId": 1 });

serverSchema.methods.getMember = function (userId) {
  return this.members.find(
    (member) => member.userId.toString() === userId.toString(),
  );
};

serverSchema.methods.isOwner = function (userId) {
  return this.ownerId.toString() === userId.toString();
};

const Server = mongoose.model("Server", serverSchema);

export default Server;
