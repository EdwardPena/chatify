import mongoose from "mongoose";

export const CHANNEL_TYPES = {
  TEXT: "text",
  VOICE: "voice",
};

// channel names are handles, not titles: "Design Sync" becomes "design-sync"
export const slugifyChannelName = (name) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

const channelSchema = new mongoose.Schema(
  {
    serverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Server",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 1,
      maxlength: 30,
      match: /^[a-z0-9-]+$/,
    },
    type: {
      type: String,
      enum: Object.values(CHANNEL_TYPES),
      default: CHANNEL_TYPES.TEXT,
      required: true,
    },
    topic: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

// one #general per server, enforced by the database rather than by a check
channelSchema.index({ serverId: 1, name: 1 }, { unique: true });

const Channel = mongoose.model("Channel", channelSchema);

export default Channel;
