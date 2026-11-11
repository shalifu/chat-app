import express, { Router } from "express";
import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";
import Connection from "../models/Connection.js";
import Block from "../models/Block.js";
import ConversationSetting from "../models/ConversationSetting.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { requireAdult, requireAuth } from "../middleware/auth.js";
import { resolveMessageContext } from "../services/messageContext.js";
import { createNotification } from "../services/notifications.js";

const messageActionWindowMs = 10 * 60 * 1000;
const maxMediaBytes = 50 * 1024 * 1024;
const mediaRetentionMs = 24 * 60 * 60 * 1000;
const voiceRetentionMs = 24 * 60 * 60 * 1000;

function serializeMessage(message) {
  return {
    id: message._id.toString(),
    senderId: message.sender.toString(),
    recipientId: message.recipient.toString(),
    type: message.type || "text",
    content: message.content,
    mediaFileId: message.mediaFileId?.toString() || null,
    mediaMimeType: message.mediaMimeType || null,
    mediaName: message.mediaName || null,
    mediaSize: message.mediaSize ?? null,
    mediaDurationSeconds: message.mediaDurationSeconds ?? null,
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
  let cleanupTimer;

  function getMediaBucket() {
    return new GridFSBucket(mongoose.connection.db, { bucketName: "messageMedia" });
  }

  async function cleanupExpiredMedia() {
    if (mongoose.connection.readyState !== 1) return;
    const bucket = getMediaBucket();
    const files = await mongoose.connection.db.collection("messageMedia.files")
      .find({ "metadata.expiresAt": { $lte: new Date() } }, { projection: { _id: 1 } })
      .limit(100)
      .toArray();
    await Promise.all(files.map((file) => bucket.delete(file._id).catch(() => {})));
  }

  cleanupTimer = setInterval(() => cleanupExpiredMedia().catch((error) => console.error("Could not clean expired message media:", error)), 60 * 1000);
  cleanupTimer.unref?.();

  router.post("/media", requireAuth, requireAdult, (req, res, next) => {
    express.raw({ type: "application/octet-stream", limit: maxMediaBytes })(req, res, (error) => {
      if (error) return res.status(error.status === 413 ? 413 : 400).json({ message: error.status === 413 ? "Files must be 50 MB or smaller." : "Could not read this file." });
      return next();
    });
  }, async (req, res, next) => {
    let fileId;
    try {
      const recipientId = req.get("X-Recipient-Id") || "";
      const mimeType = (req.get("X-Media-Type") || "").split(";")[0].trim().toLowerCase();
      const voiceDurationHeader = req.get("X-Voice-Note-Duration");
      const voiceDurationSeconds = voiceDurationHeader === undefined ? null : Number(voiceDurationHeader);
      let originalName = req.get("X-File-Name") || "attachment";
      try { originalName = decodeURIComponent(originalName); } catch { /* Keep the safe header value. */ }
      originalName = originalName.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 255);
      const file = req.body;
      if (!mongoose.isValidObjectId(recipientId) || recipientId === req.userId) {
        return res.status(400).json({ message: "Choose a valid person to message." });
      }
      if (!Buffer.isBuffer(file) || !file.length) return res.status(400).json({ message: "Choose a file to send." });
      if (file.length > maxMediaBytes) return res.status(413).json({ message: "Files must be 50 MB or smaller." });
      if (!/^(image|video|audio)\/[a-zA-Z0-9.+-]+$/.test(mimeType)) {
        return res.status(415).json({ message: "Choose an image, GIF, video, or audio file." });
      }
      if (voiceDurationHeader !== undefined && (!mimeType.startsWith("audio/") || !Number.isFinite(voiceDurationSeconds) || voiceDurationSeconds <= 0 || voiceDurationSeconds > 30)) {
        return res.status(400).json({ message: "Voice notes must be 30 seconds or shorter." });
      }
      const [sender, recipient, connection] = await Promise.all([
        User.findById(req.userId).select("name messagingEnabled +privateContacts"),
        User.findById(recipientId).select("isPrivate messagingEnabled +privateContacts"),
        Connection.findOne({ status: "accepted", $or: [
          { memberA: req.userId, memberB: recipientId },
          { memberA: recipientId, memberB: req.userId },
        ] }),
      ]);
      if (!sender || !recipient) return res.status(404).json({ message: "That account could not be found." });
      if (sender.messagingEnabled === false) return res.status(403).json({ message: "Messaging is disabled for your account." });
      if (recipient.messagingEnabled === false) return res.status(403).json({ message: "This person is not accepting messages right now." });
      if (await Block.exists({ $or: [
        { blockedBy: req.userId, blockedUser: recipientId },
        { blockedBy: recipientId, blockedUser: req.userId },
      ] })) return res.status(403).json({ message: "This account cannot receive your messages." });
      const legacyConnection = sender.privateContacts.some((contact) => contact.equals(recipientId)) &&
        recipient.privateContacts.some((contact) => contact.equals(req.userId));
      if (recipient.isPrivate && !connection && !legacyConnection) {
        return res.status(403).json({ message: "Accept a connection request before sending a message." });
      }

      const kind = voiceDurationHeader !== undefined ? "voice" : mimeType === "image/gif" ? "gif" : mimeType.startsWith("image/") ? "image" : mimeType.startsWith("video/") ? "video" : "audio";
      const bucket = getMediaBucket();
      const upload = bucket.openUploadStream(originalName, {
        contentType: mimeType,
        metadata: { senderId: req.userId, recipientId, expiresAt: null },
      });
      fileId = upload.id;
      await new Promise((resolve, reject) => {
        upload.once("error", reject);
        upload.once("finish", resolve);
        upload.end(file);
      });
      const message = await Message.create({
        sender: req.userId,
        recipient: recipientId,
        type: kind,
        content: kind === "voice" ? "Voice note" : "",
        mediaFileId: fileId,
        mediaMimeType: mimeType,
        mediaName: originalName,
        mediaSize: file.length,
        ...(kind === "voice" ? { mediaDurationSeconds: voiceDurationSeconds } : {}),
      });
      await mongoose.connection.db.collection("messageMedia.files").updateOne(
        { _id: fileId },
        { $set: { "metadata.messageId": message._id.toString() } }
      );
      const responseMessage = serializeMessage(message);
      await createNotification(io, {
        recipient: recipientId,
        sender: req.userId,
        type: "direct_message",
        title: `New ${kind} from ${sender.name}`,
        body: "Open your notifications to view it.",
        targetType: "person",
        targetId: req.userId,
      });
      io.to(recipientId).emit("message:new", responseMessage);
      return res.status(201).json({ message: responseMessage });
    } catch (error) {
      if (fileId) await getMediaBucket().delete(fileId).catch(() => {});
      return next(error);
    }
  });

  router.get("/media/:fileId", requireAuth, requireAdult, async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.fileId)) return res.status(404).end();
      const fileId = new mongoose.Types.ObjectId(req.params.fileId);
      const message = await Message.findOne({ mediaFileId: fileId }).select("sender recipient expiresAt mediaMimeType mediaName").lean();
      if (!message || (message.sender.toString() !== req.userId && message.recipient.toString() !== req.userId) ||
        (message.expiresAt && message.expiresAt <= new Date())) return res.status(404).end();
      const peerId = message.sender.toString() === req.userId ? message.recipient : message.sender;
      if (await Block.exists({ $or: [
        { blockedBy: req.userId, blockedUser: peerId },
        { blockedBy: peerId, blockedUser: req.userId },
      ] })) return res.status(403).end();
      res.set("Content-Type", message.mediaMimeType || "application/octet-stream");
      res.set("Cache-Control", "private, no-store");
      res.set("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(message.mediaName || "attachment")}`);
      return getMediaBucket().openDownloadStream(fileId).on("error", () => res.status(404).end()).pipe(res);
    } catch (error) {
      return next(error);
    }
  });

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
      }).select("_id mediaFileId type").lean();
      const messageIds = data.map((message) => message._id.toString());
      const seenAt = new Date();
      const expiresAtByMessageId = {};
      if (messageIds.length) {
        const expirationEnabled = await ConversationSetting.exists({
          deleteAfterSeen: true,
          $or: [
            { user: req.userId, contact: userId },
            { user: userId, contact: req.userId },
          ],
        });
        const mediaMessages = data.filter((message) => message.mediaFileId);
        const mediaIds = mediaMessages.map((message) => message._id);
        const textIds = data.filter((message) => !message.mediaFileId && message.type !== "call").map((message) => message._id);
        const expiresAt = new Date(seenAt.getTime() + mediaRetentionMs);
        await Message.updateMany({ _id: { $in: messageIds } }, { $set: { seenAt } });
        if (mediaIds.length) {
          for (const message of mediaMessages) {
            const messageExpiresAt = new Date(seenAt.getTime() + (message.type === "voice" ? voiceRetentionMs : mediaRetentionMs));
            await Message.updateOne({ _id: message._id }, { $set: { expiresAt: messageExpiresAt } });
            expiresAtByMessageId[message._id.toString()] = messageExpiresAt;
            await mongoose.connection.db.collection("messageMedia.files").updateOne(
              { "metadata.messageId": message._id.toString() },
              { $set: { "metadata.expiresAt": messageExpiresAt } }
            );
          }
        }
        if (expirationEnabled && textIds.length) {
          await Message.updateMany({ _id: { $in: textIds } }, { $set: { expiresAt } });
          for (const message of data.filter((item) => !item.mediaFileId && item.type !== "call")) expiresAtByMessageId[message._id.toString()] = expiresAt;
        }
      }
      const payload = {
        senderId: userId,
        recipientId: req.userId,
        messageIds,
        seenAt,
        expiresAtByMessageId,
      };
      io.to(userId).to(req.userId).emit("message:seen", payload);
      return res.json({ messageIds, seenAt, expiresAtByMessageId });
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
      const after = new Date(req.query.after);
      if (setting?.clearedAt || (req.query.after && Number.isFinite(after.getTime()))) {
        conversationQuery.createdAt = {};
        if (setting?.clearedAt) conversationQuery.createdAt.$gt = setting.clearedAt;
        if (req.query.after && Number.isFinite(after.getTime())) conversationQuery.createdAt.$gte = after;
      }
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
      if (message.mediaFileId) await getMediaBucket().delete(message.mediaFileId).catch(() => {});
      io.to(response.senderId).to(response.recipientId).emit("message:deleted", response);
      return res.json({ messageId: response.messageId });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

export { serializeMessage };
