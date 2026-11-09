import { Router } from "express";
import mongoose from "mongoose";
import Connection from "../models/Connection.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { requireAdult, requireAuth } from "../middleware/auth.js";

const messageActionWindowMs = 10 * 60 * 1000;

function serializeMessage(message) {
  return {
    id: message._id.toString(),
    senderId: message.sender.toString(),
    recipientId: message.recipient.toString(),
    content: message.content,
    createdAt: message.createdAt,
    editedAt: message.editedAt || null,
  };
}

export default function createMessageRouter(io) {
  const router = Router();

  router.get("/:userId", requireAuth, requireAdult, async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (!mongoose.isValidObjectId(userId)) {
        return res.status(400).json({ message: "Invalid user." });
      }
      if (userId === req.userId) {
        return res.status(400).json({ message: "You cannot start a conversation with yourself." });
      }
      const [person, connection, currentUser, legacyContact] = await Promise.all([
        User.findById(userId).select("isPrivate"),
        Connection.findOne({
          status: "accepted",
          $or: [
            { memberA: req.userId, memberB: userId },
            { memberA: userId, memberB: req.userId },
          ],
        }),
        User.findById(req.userId).select("+privateContacts"),
        User.findById(userId).select("+privateContacts"),
      ]);
      if (!person) {
        return res.status(404).json({ message: "User not found." });
      }
      const legacyConnection = currentUser?.privateContacts.some((contact) => contact.equals(userId)) &&
        legacyContact?.privateContacts.some((contact) => contact.equals(req.userId));
      if (!connection && !legacyConnection) {
        return res.status(403).json({ message: "Accept a connection request before opening this conversation." });
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

  router.patch("/:messageId", requireAuth, requireAdult, async (req, res, next) => {
    try {
      const { messageId } = req.params;
      const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
      if (!mongoose.isValidObjectId(messageId)) {
        return res.status(400).json({ message: "Invalid message." });
      }
      if (!content || content.length > 4000) {
        return res.status(400).json({ message: "Message must be between 1 and 4000 characters." });
      }
      const cutoff = new Date(Date.now() - messageActionWindowMs);
      const message = await Message.findOneAndUpdate(
        { _id: messageId, sender: req.userId, createdAt: { $gte: cutoff } },
        { $set: { content, editedAt: new Date() } },
        { new: true, runValidators: true }
      );
      if (!message) {
        const ownedMessage = await Message.exists({ _id: messageId, sender: req.userId });
        if (ownedMessage) {
          return res.status(403).json({ message: "Messages can only be edited or deleted within 10 minutes of sending." });
        }
        return res.status(404).json({ message: "Message not found or you cannot edit it." });
      }
      const responseMessage = serializeMessage(message);
      io.to(responseMessage.senderId).to(responseMessage.recipientId).emit("message:updated", responseMessage);
      return res.json({ message: responseMessage });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/:messageId", requireAuth, requireAdult, async (req, res, next) => {
    try {
      const { messageId } = req.params;
      if (!mongoose.isValidObjectId(messageId)) {
        return res.status(400).json({ message: "Invalid message." });
      }
      const cutoff = new Date(Date.now() - messageActionWindowMs);
      const message = await Message.findOneAndDelete({
        _id: messageId,
        sender: req.userId,
        createdAt: { $gte: cutoff },
      });
      if (!message) {
        const ownedMessage = await Message.exists({ _id: messageId, sender: req.userId });
        if (ownedMessage) {
          return res.status(403).json({ message: "Messages can only be edited or deleted within 10 minutes of sending." });
        }
        return res.status(404).json({ message: "Message not found or you cannot delete it." });
      }
      const response = {
        messageId: message._id.toString(),
        senderId: message.sender.toString(),
        recipientId: message.recipient.toString(),
      };
      io.to(response.senderId).to(response.recipientId).emit("message:deleted", response);
      return res.json({ messageId: response.messageId });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

export { serializeMessage };
