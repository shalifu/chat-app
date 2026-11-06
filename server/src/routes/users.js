import { Router } from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import { requireAdult, requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, requireAdult, async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.userId).select("+privateContacts");
    const users = await User.find({
      _id: { $ne: req.userId },
      $or: [
        { isPrivate: { $ne: true } },
        { _id: { $in: currentUser.privateContacts } },
      ],
    })
      .select("name username messagingEnabled isPrivate")
      .sort({ name: 1 })
      .lean();
    return res.json({
      users: users.map((user) => ({
        id: user._id.toString(),
        name: user.name,
        username: user.username,
        isPrivate: user.isPrivate === true,
        messagingEnabled: user.messagingEnabled !== false,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/private", requireAuth, requireAdult, async (req, res, next) => {
  try {
    const userCode = typeof req.body.userCode === "string" ? req.body.userCode.trim() : "";
    if (!/^\d{5}$/.test(userCode)) {
      return res.status(400).json({ message: "Enter a valid five-digit ID." });
    }

    const person = await User.findOne({ userCode }).select("name username isPrivate messagingEnabled");
    if (!person) {
      return res.status(404).json({ message: "No account was found with that ID." });
    }
    if (person.id === req.userId) {
      return res.status(400).json({ message: "That is your own ID." });
    }

    await Promise.all([
      User.updateOne({ _id: req.userId }, { $addToSet: { privateContacts: person._id } }),
      User.updateOne({ _id: person._id }, { $addToSet: { privateContacts: req.userId } }),
    ]);

    return res.json({
      user: {
        id: person.id,
        name: person.name,
        username: person.username,
        isPrivate: person.isPrivate === true,
        messagingEnabled: person.messagingEnabled !== false,
      },
    });
  } catch (error) {
    return next(error);
  }
});

export function isValidUserId(id) {
  return mongoose.isValidObjectId(id);
}

export default router;
