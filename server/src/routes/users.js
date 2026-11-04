import { Router } from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId } })
      .select("name email messagingEnabled createdAt")
      .sort({ name: 1 })
      .lean();
    return res.json({
      users: users.map((user) => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        messagingEnabled: user.messagingEnabled !== false,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

export function isValidUserId(id) {
  return mongoose.isValidObjectId(id);
}

export default router;
