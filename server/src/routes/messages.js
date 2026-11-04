import { Router } from "express";
import mongoose from "mongoose";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function serializeMessage(message) {
  return {
    id: message._id.toString(),
    senderId: message.sender.toString(),
    recipientId: message.recipient.toString(),
    content: message.content,
    createdAt: message.createdAt,
  };
}

router.get("/:userId", requireAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user." });
    }
    if (userId === req.userId) {
      return res.status(400).json({ message: "You cannot start a conversation with yourself." });
    }
    if (!(await User.exists({ _id: userId }))) {
      return res.status(404).json({ message: "User not found." });
    }

    const messages = await Message.find({
      $or: [
        { sender: req.userId, recipient: userId },
        { sender: userId, recipient: req.userId },
      ],
    })
      .sort({ createdAt: 1, _id: 1 })
      .limit(500)
      .lean();
    return res.json({ messages: messages.map(serializeMessage) });
  } catch (error) {
    return next(error);
  }
});

export default router;

export { serializeMessage };
