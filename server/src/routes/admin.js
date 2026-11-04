import { Router } from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/users", async (_req, res, next) => {
  try {
    const users = await User.find()
      .select("name email messagingEnabled isAdmin createdAt")
      .sort({ createdAt: -1 })
      .lean();
    return res.json({
      users: users.map((user) => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        messagingEnabled: user.messagingEnabled !== false,
        isAdmin: user.isAdmin === true,
        createdAt: user.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/users/:userId/messaging", async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid account." });
    }
    if (typeof req.body.messagingEnabled !== "boolean") {
      return res.status(400).json({ message: "Choose whether messaging is enabled." });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { messagingEnabled: req.body.messagingEnabled } },
      { new: true, runValidators: true }
    ).select("name email messagingEnabled");

    if (!user) {
      return res.status(404).json({ message: "Account not found." });
    }

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        messagingEnabled: user.messagingEnabled,
        isAdmin: user.isAdmin === true,
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
