import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      required: true,
      validate: (members) => members.length > 0,
    },
    isPrivate: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Group", groupSchema);
