import mongoose from "mongoose";

const conversationSettingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    clearedAt: { type: Date, default: null },
    deleteAfterSeen: { type: Boolean, default: false },
  },
  { timestamps: true }
);

conversationSettingSchema.index({ user: 1, contact: 1 }, { unique: true });

export default mongoose.model("ConversationSetting", conversationSettingSchema);
