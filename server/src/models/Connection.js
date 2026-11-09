import mongoose from "mongoose";

const connectionSchema = new mongoose.Schema(
  {
    memberA: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    memberB: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted"], default: "pending", required: true },
  },
  { timestamps: true }
);

connectionSchema.index({ memberA: 1, memberB: 1 }, { unique: true });

export default mongoose.model("Connection", connectionSchema);
