import mongoose from "mongoose";

// everything a role can be granted
export const PERMISSIONS = {
  MANAGE_SERVER: "manageServer",
  MANAGE_CHANNELS: "manageChannels",
  MANAGE_MEMBERS: "manageMembers",
  MANAGE_ROLES: "manageRoles",
  MODERATE_MESSAGES: "moderateMessages",
};

// the three roles every server is born with, in the order they outrank each
// other. Position matters: you may only manage roles below your own.
export const SYSTEM_ROLES = [
  {
    name: "Admin",
    color: "#6366f1",
    position: 2,
    permissions: Object.values(PERMISSIONS),
  },
  {
    // moderators keep conversations clean, they do not reshape the server
    name: "Moderator",
    color: "#f59e0b",
    position: 1,
    permissions: [PERMISSIONS.MODERATE_MESSAGES],
  },
  {
    name: "Member",
    color: "#94a3b8",
    position: 0,
    permissions: [],
    isDefault: true,
  },
];

const roleSchema = new mongoose.Schema(
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
      maxlength: 30,
    },
    // shown as a dot beside the name, and as the colour of its badge
    color: {
      type: String,
      default: "#94a3b8",
      match: /^#[0-9a-fA-F]{6}$/,
    },
    permissions: {
      type: [String],
      default: [],
      validate: {
        validator: (list) =>
          list.every((p) => Object.values(PERMISSIONS).includes(p)),
        message: "Unknown permission",
      },
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    // the three a server is born with: they may be edited but never deleted,
    // so a server can never end up with nothing to hand a new member
    isSystem: {
      type: Boolean,
      default: false,
    },
    position: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

roleSchema.index({ serverId: 1, name: 1 }, { unique: true });

const Role = mongoose.model("Role", roleSchema);

export default Role;
