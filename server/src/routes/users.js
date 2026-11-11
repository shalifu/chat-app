import { Router } from "express";
import mongoose from "mongoose";
import Connection from "../models/Connection.js";
import Block from "../models/Block.js";
import ConversationSetting from "../models/ConversationSetting.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { requireAdult, requireAuth } from "../middleware/auth.js";
import { createNotification } from "../services/notifications.js";

function canonicalMembers(firstId, secondId) {
  return String(firstId) < String(secondId)
    ? { memberA: firstId, memberB: secondId }
    : { memberA: secondId, memberB: firstId };
}

function serializeUser(user, currentUserId, connection, currentUser, lastMessageAt = null) {
  let connectionStatus = "none";
  if (connection?.status === "accepted") {
    connectionStatus = "connected";
  } else if (connection?.status === "pending") {
    connectionStatus = connection.requestedBy.toString() === currentUserId ? "sent" : "received";
  } else if (
    currentUser?.privateContacts.some((contact) => contact.toString() === user._id.toString()) &&
    user.privateContacts?.some((contact) => contact.toString() === currentUserId)
  ) {
    connectionStatus = "connected";
  }

  return {
    id: user._id.toString(),
    name: user.name,
    username: user.username,
    isPrivate: user.isPrivate === true,
    messagingEnabled: user.messagingEnabled !== false,
    connectionStatus,
    isFavorite: currentUser?.favoriteUsers?.some((favorite) => favorite.toString() === user._id.toString()) || false,
    isFavoritedByYou: user.favoriteUsers?.some((favorite) => favorite.toString() === currentUserId) || false,
    isBlocked: false,
    lastMessageAt,
    ...(connection ? { connectionId: connection._id.toString() } : {}),
  };
}

export default function createUserRouter(io) {
  const router = Router();
  router.use(requireAuth, requireAdult);

  async function createConnectionRequest(requesterId, recipient) {
    const members = canonicalMembers(requesterId, recipient._id);
    let connection = await Connection.findOne(members);
    let created = false;
    if (!connection) {
      try {
        connection = await Connection.create({
          ...members,
          requestedBy: requesterId,
          recipient: recipient._id,
        });
        created = true;
      } catch (error) {
        if (error?.code !== 11000) throw error;
        connection = await Connection.findOne(members);
        if (!connection) throw error;
      }
    }
    return { connection, created };
  }

  router.get("/", async (req, res, next) => {
    try {
      const [currentUser, connections, blockedUsers, conversationSettings] = await Promise.all([
        User.findById(req.userId).select("name username favoriteUsers +privateContacts"),
        Connection.find({ $or: [{ memberA: req.userId }, { memberB: req.userId }] }),
        Block.find({ blockedBy: req.userId }).select("blockedUser").lean(),
        ConversationSetting.find({ user: req.userId, clearedAt: { $ne: null } }).select("contact clearedAt").lean(),
      ]);
      if (!currentUser) return res.status(404).json({ message: "Account not found." });

      const connectionMap = new Map();
      const blockedUserIds = new Set(blockedUsers.map((block) => block.blockedUser.toString()));
      const clearedAtByUser = new Map(conversationSettings.map((setting) => [
        setting.contact.toString(),
        setting.clearedAt,
      ]));
      for (const connection of connections) {
        const otherId = connection.memberA.toString() === req.userId
          ? connection.memberB
          : connection.memberA;
        connectionMap.set(otherId.toString(), connection);
      }

      const users = await User.find({
        _id: { $ne: req.userId },
      })
        .select("name username messagingEnabled isPrivate favoriteUsers +privateContacts")
        .sort({ name: 1 })
        .lean();
      const userIds = users.map((user) => user._id);
      const latestMessages = userIds.length
        ? await Message.aggregate([
          {
            $match: {
              $or: [
                { sender: currentUser._id, recipient: { $in: userIds } },
                { recipient: currentUser._id, sender: { $in: userIds } },
              ],
            },
          },
          { $sort: { createdAt: -1, _id: -1 } },
          {
            $group: {
              _id: {
                $cond: [
                  { $eq: ["$sender", currentUser._id] },
                  "$recipient",
                  "$sender",
                ],
              },
              createdAt: { $first: "$createdAt" },
            },
          },
        ])
        : [];
      const latestMessageAtByUser = new Map(
        latestMessages
          .filter((message) => {
            const clearedAt = clearedAtByUser.get(message._id.toString());
            return !clearedAt || message.createdAt > clearedAt;
          })
          .map((message) => [message._id.toString(), message.createdAt])
      );
      return res.json({
        users: users.map((user) => ({
          ...serializeUser(
            user,
            req.userId,
            connectionMap.get(user._id.toString()),
            currentUser,
            latestMessageAtByUser.get(user._id.toString()) || null
          ),
          isBlocked: blockedUserIds.has(user._id.toString()),
        })),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/private", async (req, res, next) => {
    try {
      const userCode = typeof req.body.userCode === "string" ? req.body.userCode.trim() : "";
      if (!/^\d{5}$/.test(userCode)) {
        return res.status(400).json({ message: "Enter a valid five-digit ID." });
      }

      const [person, currentUser] = await Promise.all([
        User.findOne({ userCode }).select("name username isPrivate messagingEnabled +privateContacts"),
        User.findById(req.userId).select("+privateContacts"),
      ]);
      if (!person) {
        return res.status(404).json({ message: "No account was found with that ID." });
      }
      if (person.id === req.userId) {
        return res.status(400).json({ message: "That is your own ID." });
      }
      if (await Block.exists({ $or: [
        { blockedBy: req.userId, blockedUser: person._id },
        { blockedBy: person._id, blockedUser: req.userId },
      ] })) {
        return res.status(403).json({ message: "This account cannot be connected right now." });
      }

      const { connection, created } = await createConnectionRequest(req.userId, person);
      const user = serializeUser(person, req.userId, connection, currentUser);
      if (created) {
        await createNotification(io, {
          recipient: person._id,
          sender: req.userId,
          type: "connection_request",
          title: "Connection request",
          body: `${currentUser.name} wants to connect with you.`,
          targetType: "person",
          targetId: req.userId,
        });
        io.to(person.id).emit("connection:updated", { userId: req.userId });
      }
      return res.json({ user });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/:userId/connect", async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (!mongoose.isValidObjectId(userId)) {
        return res.status(400).json({ message: "Invalid user." });
      }
      if (userId === req.userId) {
        return res.status(400).json({ message: "You cannot connect with yourself." });
      }
      const [person, currentUser] = await Promise.all([
        User.findById(userId).select("name username isPrivate messagingEnabled +privateContacts"),
        User.findById(req.userId).select("name username +privateContacts"),
      ]);
      if (!person) {
        return res.status(404).json({ message: "User not found." });
      }
      if (await Block.exists({ $or: [
        { blockedBy: req.userId, blockedUser: person._id },
        { blockedBy: person._id, blockedUser: req.userId },
      ] })) {
        return res.status(403).json({ message: "This account cannot be connected right now." });
      }

      const { connection, created } = await createConnectionRequest(req.userId, person);
      if (created) {
        await createNotification(io, {
          recipient: person._id,
          sender: req.userId,
          type: "connection_request",
          title: "Connection request",
          body: `${currentUser.name} wants to connect with you.`,
          targetType: "person",
          targetId: req.userId,
        });

        io.to(person.id).emit("connection:updated", { userId: req.userId });
      }
      return res.json({ user: serializeUser(person, req.userId, connection, currentUser) });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/:userId/block", async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (!mongoose.isValidObjectId(userId) || userId === req.userId) {
        return res.status(400).json({ message: "Choose a valid person to block." });
      }
      const person = await User.exists({ _id: userId });
      if (!person) return res.status(404).json({ message: "User not found." });

      await Block.updateOne(
        { blockedBy: req.userId, blockedUser: userId },
        { $setOnInsert: { blockedBy: req.userId, blockedUser: userId } },
        { upsert: true }
      );
      const connection = await Connection.findOneAndDelete({
        $or: [
          { memberA: req.userId, memberB: userId },
          { memberA: userId, memberB: req.userId },
        ],
      });
      if (connection) io.to(userId).emit("connection:updated", { userId: req.userId });
      return res.json({ ok: true });
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/:userId/favorite", async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (!mongoose.isValidObjectId(userId) || userId === req.userId) {
        return res.status(400).json({ message: "Choose a valid person to favorite." });
      }
      if (typeof req.body.isFavorite !== "boolean") {
        return res.status(400).json({ message: "Choose whether this person is a favorite." });
      }
      const [person, currentUser] = await Promise.all([
        User.findById(userId).select("_id"),
        User.findById(req.userId).select("name favoriteUsers"),
      ]);
      if (!person || !currentUser) return res.status(404).json({ message: "Person not found." });

      const wasFavorite = currentUser.favoriteUsers.some((favorite) => favorite.toString() === userId);
      if (req.body.isFavorite) currentUser.favoriteUsers.addToSet(userId);
      else currentUser.favoriteUsers.pull(userId);
      await currentUser.save();
      io.to(userId).emit("favorite:updated", { userId: req.userId, isFavoritedByYou: req.body.isFavorite });
      if (req.body.isFavorite && !wasFavorite) {
        await createNotification(io, {
          recipient: userId,
          sender: req.userId,
          type: "favorite",
          title: "Added you to favorites",
          body: `${currentUser.name} added you to their favorites.`,
          targetType: "person",
          targetId: req.userId,
        });
      }
      return res.json({ userId, isFavorite: req.body.isFavorite });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/:userId/block", async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (!mongoose.isValidObjectId(userId) || userId === req.userId) {
        return res.status(400).json({ message: "Choose a valid person to unblock." });
      }
      const result = await Block.deleteOne({ blockedBy: req.userId, blockedUser: userId });
      if (!result.deletedCount) return res.status(404).json({ message: "That person is not blocked." });
      io.to(userId).emit("connection:updated", { userId: req.userId });
      return res.json({ ok: true });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/connections/:connectionId/accept", async (req, res, next) => {
    try {
      const { connectionId } = req.params;
      if (!mongoose.isValidObjectId(connectionId)) {
        return res.status(400).json({ message: "Invalid connection request." });
      }
      const connection = await Connection.findOneAndUpdate(
        { _id: connectionId, recipient: req.userId, status: "pending" },
        { $set: { status: "accepted" } },
        { new: true }
      );
      if (!connection) {
        return res.status(404).json({ message: "Connection request not found." });
      }
      const [recipient, requester] = await Promise.all([
        User.findById(connection.recipient).select("name"),
        User.findById(connection.requestedBy).select("name"),
      ]);
      if (requester && recipient) {
        await createNotification(io, {
          recipient: connection.requestedBy,
          sender: connection.recipient,
          type: "connection_request",
          title: "Connection accepted",
          body: `${recipient.name} accepted your connection request.`,
          targetType: "person",
          targetId: connection.recipient,
        });
      }
      io.to(connection.requestedBy.toString()).emit("connection:updated", { userId: req.userId });
      io.to(connection.recipient.toString()).emit("connection:updated", { userId: connection.requestedBy.toString() });
      return res.json({ ok: true });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/connections/:connectionId", async (req, res, next) => {
    try {
      const { connectionId } = req.params;
      if (!mongoose.isValidObjectId(connectionId)) {
        return res.status(400).json({ message: "Invalid connection request." });
      }
      const connection = await Connection.findOneAndDelete({
        _id: connectionId,
        status: "pending",
        $or: [{ requestedBy: req.userId }, { recipient: req.userId }],
      });
      if (!connection) {
        return res.status(404).json({ message: "Connection request not found." });
      }
      const otherId = connection.requestedBy.toString() === req.userId
        ? connection.recipient.toString()
        : connection.requestedBy.toString();
      io.to(otherId).emit("connection:updated", { userId: req.userId });
      return res.json({ ok: true });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

export function isValidUserId(id) {
  return mongoose.isValidObjectId(id);
}
