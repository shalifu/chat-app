import mongoose from "mongoose";

const groupMessageSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true, maxlength: 4000 },
  },
  { timestamps: true }
);

groupMessageSchema.index({ group: 1, createdAt: 1 });

export default mongoose.model("GroupMessage", groupMessageSchema);
