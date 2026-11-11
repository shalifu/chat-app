import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    type: {
      type: String,
      enum: ["direct_message", "connection_request", "group_message", "group_added", "favorite", "admin_announcement"],
      required: true,
    },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, required: true, maxlength: 240 },
    targetType: { type: String, enum: ["person", "group", "announcement"], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
// MongoDB removes a notification five days after it is marked as read.
notificationSchema.index({ readAt: 1 }, { expireAfterSeconds: 5 * 24 * 60 * 60 });

export default mongoose.model("Notification", notificationSchema);
