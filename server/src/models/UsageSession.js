import mongoose from "mongoose";

const usageSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    startedAt: { type: Date, required: true, default: Date.now },
    lastActiveAt: { type: Date, required: true, default: Date.now },
    activeSeconds: { type: Number, required: true, default: 0 },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("UsageSession", usageSessionSchema);
