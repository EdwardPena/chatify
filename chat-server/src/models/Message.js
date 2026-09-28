import mongoose from "mongoose";

export const MESSAGE_STATUS = {
  SENT: "sent",
  DELIVERED: "delivered",
  READ: "read",
};

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // channel messages are addressed to a room, not to a person
      required: function () {
        return !this.channelId;
      },
    },
    // set on channel messages only, direct messages leave it out
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
    },
    // everyone tagged in the text, resolved when the message is sent so the
    // handles cannot be rewritten afterwards
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // the message this one answers, if any
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    // direct messages carry a receipt: it leaves as sent, becomes delivered
    // once their socket has it, and read once they open the conversation
    status: {
      type: String,
      enum: Object.values(MESSAGE_STATUS),
      default: MESSAGE_STATUS.SENT,
    },
    text: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    image: {
      type: String,
    },
    audio: {
      type: String,
    },
    // length of the voice note in seconds, so the bubble can render a duration
    // without having to download the file first
    audioDuration: {
      type: Number,
      min: 0,
    },
  },
  { timestamps: true },
);

// a channel is read back in order, every time someone opens it
messageSchema.index({ channelId: 1, createdAt: 1 });

// marking a conversation delivered or read hits this on every socket connect
messageSchema.index({ receiverId: 1, status: 1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
