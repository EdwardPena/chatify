import mongoose from "mongoose";

export const REQUEST_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
};

const contactRequestSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(REQUEST_STATUS),
      default: REQUEST_STATUS.PENDING,
      required: true,
    },
  },
  { timestamps: true },
);

// one row per pair, blocks duplicate requests at the database level
contactRequestSchema.index({ senderId: 1, receiverId: 1 }, { unique: true });

// for looking up contacts and pending requests by one side
contactRequestSchema.index({ receiverId: 1, status: 1 });
contactRequestSchema.index({ senderId: 1, status: 1 });

const ContactRequest = mongoose.model("ContactRequest", contactRequestSchema);

export default ContactRequest;
