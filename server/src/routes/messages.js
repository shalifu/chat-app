import { Router } from "express";
import mongoose from "mongoose";
import Connection from "../models/Connection.js";
import Block from "../models/Block.js";
import ConversationSetting from "../models/ConversationSetting.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { requireAdult, requireAuth } from "../middleware/auth.js";
import { resolveMessageContext } from "../services/messageContext.js";

const messageActionWindowMs = 10 * 60 * 1000;

function serializeMessage(message) {
  return {
    id: message._id.toString(),
    senderId: message.sender.toString(),
    recipientId: message.recipient.toString(),
    type: message.type || "text",
    content: message.content,
    replyTo: message.replyTo?.senderName && message.replyTo?.content !== undefined
      ? { senderName: message.replyTo.senderName, content: message.replyTo.content }
      : null,
    forwardedFrom: message.forwardedFrom?.senderName && message.forwardedFrom?.content !== undefined
      ? { senderName: message.forwardedFrom.senderName, content: message.forwardedFrom.content }
      : null,
    createdAt: message.createdAt,
    editedAt: message.editedAt || null,
    seenAt: message.seenAt || null,
    expiresAt: message.expiresAt || null,
    callType: message.callType || null,
    callStatus: message.callStatus || null,
    durationSeconds: message.durationSeconds ?? null,
  };
}

export default function createMessageRouter(io) {
  const router = Router();

  router.patch("/:userId/seen", requireAuth, requireAdult, async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (!mongoose.isValidObjectId(userId)) {
        return res.status(400).json({ message: "Invalid user." });
      }
      if (userId === req.userId) {
        return res.status(400).json({ message: "You cannot mark messages as seen for yourself." });
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
      if (await Block.exists({ $or: [
        { blockedBy: req.userId, blockedUser: userId },
        { blockedBy: userId, blockedUser: req.userId },
      ] })) {
        return res.status(403).json({ message: "This conversation is unavailable." });
      }
      const legacyConnection = currentUser?.privateContacts.some((contact) => contact.equals(userId)) &&
        legacyContact?.privateContacts.some((contact) => contact.equals(req.userId));
      if (person.isPrivate && !connection && !legacyConnection) {
        return res.status(403).json({ message: "Accept a connection request before opening this conversation." });
      }
      const data = await Message.find({
        sender: userId,
        recipient: req.userId,
        seenAt: null,
      }).select("_id").lean();
      const messageIds = data.map((message) => message._id.toString());
      const seenAt = new Date();
      let expiresAt = null;
      if (messageIds.length) {
        const expirationEnabled = await ConversationSetting.exists({
          deleteAfterSeen: true,
          $or: [
            { user: req.userId, contact: userId },
            { user: userId, contact: req.userId },
          ],
        });
        if (expirationEnabled) expiresAt = new Date(seenAt.getTime() + 24 * 60 * 60 * 1000);
        await Message.updateMany(
          { _id: { $in: messageIds } },
          { $set: {
            seenAt,
            ...(expiresAt ? { expiresAt } : {}),
          } }
        );
      }
      const payload = {
        senderId: userId,
        recipientId: req.userId,
        messageIds,
        seenAt,
        expiresAt,
      };
      io.to(userId).to(req.userId).emit("message:seen", payload);
      return res.json({ messageIds, seenAt, expiresAt });
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/:userId/settings", requireAuth, requireAdult, async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (!mongoose.isValidObjectId(userId) || userId === req.userId) {
        return res.status(400).json({ message: "Choose a valid conversation." });
      }
      if (typeof req.body.deleteAfterSeen !== "boolean") {
        return res.status(400).json({ message: "Choose whether seen messages should be deleted." });
      }
      if (!await User.exists({ _id: userId })) return res.status(404).json({ message: "User not found." });
      const setting = await ConversationSetting.findOneAndUpdate(
        { user: req.userId, contact: userId },
        { $set: { deleteAfterSeen: req.body.deleteAfterSeen } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      return res.json({ deleteAfterSeen: setting.deleteAfterSeen });
    } catch (error) {
      return next(error);
    }
  });

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
      if (await Block.exists({ $or: [
        { blockedBy: req.userId, blockedUser: userId },
        { blockedBy: userId, blockedUser: req.userId },
      ] })) {
        return res.status(403).json({ message: "This conversation is unavailable." });
      }
      const legacyConnection = currentUser?.privateContacts.some((contact) => contact.equals(userId)) &&
        legacyContact?.privateContacts.some((contact) => contact.equals(req.userId));
      if (person.isPrivate && !connection && !legacyConnection) {
        return res.status(403).json({ message: "Accept a connection request before opening this conversation." });
      }

      const setting = await ConversationSetting.findOne({ user: req.userId, contact: userId }).select("clearedAt").lean();
      const conversationQuery = {
        $or: [
          { sender: req.userId, recipient: userId },
          { sender: userId, recipient: req.userId },
        ],
      };
      if (setting?.clearedAt) conversationQuery.createdAt = { $gt: setting.clearedAt };
      const messages = await Message.find(conversationQuery)
        .sort({ createdAt: 1, _id: 1 })
        .limit(500)
        .lean();
      const [conversationPreferences, expirationEnabled] = await Promise.all([
        ConversationSetting.findOne({ user: req.userId, contact: userId }).select("deleteAfterSeen").lean(),
        ConversationSetting.exists({
          deleteAfterSeen: true,
          $or: [
            { user: req.userId, contact: userId },
            { user: userId, contact: req.userId },
          ],
        }),
      ]);
      return res.json({
        messages: messages.map(serializeMessage),
        settings: { deleteAfterSeen: Boolean(conversationPreferences?.deleteAfterSeen), expirationEnabled: Boolean(expirationEnabled) },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/:userId/clear", requireAuth, requireAdult, async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (!mongoose.isValidObjectId(userId) || userId === req.userId) {
        return res.status(400).json({ message: "Choose a valid conversation to clear." });
      }
      const person = await User.exists({ _id: userId });
      if (!person) return res.status(404).json({ message: "User not found." });
      const clearedAt = new Date();
      await ConversationSetting.updateOne(
        { user: req.userId, contact: userId },
        { $set: { clearedAt } },
        { upsert: true }
      );
      return res.json({ clearedAt });
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
        { _id: messageId, sender: req.userId, type: { $ne: "call" }, createdAt: { $gte: cutoff } },
        { $set: { content, editedAt: new Date() } },
        { new: true, runValidators: true }
      );
      if (!message) {
        const ownedMessage = await Message.exists({ _id: messageId, sender: req.userId, type: { $ne: "call" } });
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
        type: { $ne: "call" },
        createdAt: { $gte: cutoff },
      });
      if (!message) {
        const ownedMessage = await Message.exists({ _id: messageId, sender: req.userId, type: { $ne: "call" } });
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
