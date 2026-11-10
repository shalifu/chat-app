import { Router } from "express";
import mongoose from "mongoose";
import Connection from "../models/Connection.js";
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
      const [currentUser, connections] = await Promise.all([
        User.findById(req.userId).select("name username +privateContacts"),
        Connection.find({ $or: [{ memberA: req.userId }, { memberB: req.userId }] }),
      ]);
      if (!currentUser) return res.status(404).json({ message: "Account not found." });

      const connectionMap = new Map();
      const relatedUserIds = [...currentUser.privateContacts];
      for (const connection of connections) {
        const otherId = connection.memberA.toString() === req.userId
          ? connection.memberB
          : connection.memberA;
        connectionMap.set(otherId.toString(), connection);
        relatedUserIds.push(otherId);
      }

      const users = await User.find({
        _id: { $ne: req.userId },
        $or: [
          { isPrivate: { $ne: true } },
          { _id: { $in: relatedUserIds } },
        ],
      })
        .select("name username messagingEnabled isPrivate +privateContacts")
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
        latestMessages.map((message) => [message._id.toString(), message.createdAt])
      );
      return res.json({
        users: users.map((user) =>
          serializeUser(
            user,
            req.userId,
            connectionMap.get(user._id.toString()),
            currentUser,
            latestMessageAtByUser.get(user._id.toString()) || null
          )
        ),
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
      if (!person || (person.isPrivate && !person.privateContacts.some((contact) => contact.equals(req.userId)))) {
        return res.status(404).json({ message: "User not found." });
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
