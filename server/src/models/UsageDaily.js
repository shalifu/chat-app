import mongoose from "mongoose";

const usageDailySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dayStart: { type: Date, required: true },
    activeSeconds: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

usageDailySchema.index({ user: 1, dayStart: 1 }, { unique: true });

export default mongoose.model("UsageDaily", usageDailySchema);
