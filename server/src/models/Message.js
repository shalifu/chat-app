import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: { type: String, enum: ["text", "image", "video", "audio", "voice", "gif", "call"], default: "text" },
    content: { type: String, default: "", trim: true, maxlength: 4000 },
    mediaFileId: { type: mongoose.Schema.Types.ObjectId, default: null },
    mediaMimeType: { type: String, default: null },
    mediaName: { type: String, default: null, maxlength: 255 },
    mediaSize: { type: Number, default: null },
    mediaDurationSeconds: { type: Number, min: 0, max: 30, default: null },
    replyTo: {
      senderName: { type: String, trim: true, maxlength: 80 },
      content: { type: String, trim: true, maxlength: 4000 },
    },
    forwardedFrom: {
      senderName: { type: String, trim: true, maxlength: 80 },
      content: { type: String, trim: true, maxlength: 4000 },
    },
    editedAt: { type: Date, default: null },
    seenAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    callType: { type: String, enum: ["audio", "video"] },
    callStatus: { type: String, enum: ["missed", "declined", "cancelled", "completed", "disconnected"] },
    durationSeconds: { type: Number, min: 0 },
  },
  { timestamps: true }
);

messageSchema.index({ sender: 1, recipient: 1, createdAt: 1 });
messageSchema.index({ recipient: 1, sender: 1, createdAt: 1 });
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Message", messageSchema);
