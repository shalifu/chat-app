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
    type: { type: String, enum: ["text", "call"], default: "text" },
    content: { type: String, required: true, trim: true, maxlength: 4000 },
    editedAt: { type: Date, default: null },
    callType: { type: String, enum: ["audio", "video"] },
    callStatus: { type: String, enum: ["missed", "declined", "cancelled", "completed", "disconnected"] },
    durationSeconds: { type: Number, min: 0 },
  },
  { timestamps: true }
);

messageSchema.index({ sender: 1, recipient: 1, createdAt: 1 });

export default mongoose.model("Message", messageSchema);
