import { Router } from "express";
import mongoose from "mongoose";
import Connection from "../models/Connection.js";
import Group from "../models/Group.js";
import GroupMessage from "../models/GroupMessage.js";
import Message from "../models/Message.js";
import Notification from "../models/Notification.js";
import UsageSession from "../models/UsageSession.js";
import User from "../models/User.js";
import { createNotifications } from "../services/notifications.js";
import { requireAdult, requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";

export default function createAdminRouter(io) {
const router = Router();

router.use(requireAuth, requireAdult, requireAdmin);

router.get("/analytics", async (_req, res, next) => {
  try {
    const now = new Date();
    const activeSince = new Date(now.getTime() - 2 * 60 * 1000);
    const [users, usage, directMessages, groupMessages, groupCount] = await Promise.all([
      User.find()
        .select("name username age isPrivate email messagingEnabled isAdmin createdAt lastLoginAt loginCount")
        .sort({ createdAt: -1 })
        .lean(),
      UsageSession.aggregate([
        {
          $group: {
            _id: "$user",
            activeSeconds: { $sum: "$activeSeconds" },
            sessionCount: { $sum: 1 },
            lastActiveAt: { $max: "$lastActiveAt" },
            activeNow: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ["$endedAt", null] }, { $gte: ["$lastActiveAt", activeSince] }] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      Message.aggregate([{ $group: { _id: "$sender", count: { $sum: 1 } } }]),
      GroupMessage.aggregate([{ $group: { _id: "$sender", count: { $sum: 1 } } }]),
      Group.countDocuments(),
    ]);

    const usageByUser = new Map(usage.map((item) => [item._id.toString(), item]));
    const messagesByUser = new Map();
    for (const item of [...directMessages, ...groupMessages]) {
      const id = item._id.toString();
      messagesByUser.set(id, (messagesByUser.get(id) || 0) + item.count);
    }
    const serializedUsers = users.map((user) => {
      const stats = usageByUser.get(user._id.toString());
      return {
        id: user._id.toString(),
        name: user.name,
        username: user.username,
        age: user.age,
        isPrivate: user.isPrivate === true,
        email: user.email,
        messagingEnabled: user.messagingEnabled !== false,
        isAdmin: user.isAdmin === true,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        loginCount: user.loginCount || 0,
        lastActiveAt: stats?.lastActiveAt || null,
        activeSeconds: stats?.activeSeconds || 0,
        sessionCount: stats?.sessionCount || 0,
        activeNow: (stats?.activeNow || 0) > 0,
        messagesSent: messagesByUser.get(user._id.toString()) || 0,
      };
    });

    return res.json({
      summary: {
        totalUsers: users.length,
        activeNow: serializedUsers.filter((user) => user.activeNow).length,
        totalLogins: users.reduce((total, user) => total + (user.loginCount || 0), 0),
        totalActiveSeconds: usage.reduce((total, item) => total + item.activeSeconds, 0),
        totalMessages: [...messagesByUser.values()].reduce((total, count) => total + count, 0),
        totalGroups: groupCount,
        serverUptimeSeconds: Math.floor(process.uptime()),
      },
      users: serializedUsers,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/notifications", async (req, res, next) => {
  try {
    const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
    const body = typeof req.body.body === "string" ? req.body.body.trim() : "";
    const recipientId = typeof req.body.recipientId === "string" ? req.body.recipientId : "";
    if (!title || title.length > 120) {
      return res.status(400).json({ message: "Notification title must be between 1 and 120 characters." });
    }
    if (!body || body.length > 240) {
      return res.status(400).json({ message: "Notification message must be between 1 and 240 characters." });
    }
    if (recipientId !== "all" && !mongoose.isValidObjectId(recipientId)) {
      return res.status(400).json({ message: "Choose a valid notification recipient." });
    }

    const recipients = recipientId === "all"
      ? await User.find().select("_id").lean()
      : await User.find({ _id: recipientId }).select("_id").lean();
    if (!recipients.length) {
      return res.status(404).json({ message: "Notification recipient not found." });
    }
    const notifications = await createNotifications(io, recipients.map((user) => ({
      recipient: user._id,
      sender: req.userId,
      type: "admin_announcement",
      title,
      body,
      targetType: "announcement",
      targetId: req.userId,
    })));
    return res.status(201).json({ sent: notifications.length });
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
    ).select("name email messagingEnabled isAdmin");

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

router.delete("/users/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid account." });
    }
    if (userId === req.userId) {
      return res.status(400).json({ message: "You cannot delete your own admin account." });
    }

    const user = await User.findById(userId).select("isAdmin");
    if (!user) {
      return res.status(404).json({ message: "Account not found." });
    }
    if (user.isAdmin) {
      return res.status(403).json({ message: "Admin accounts cannot be deleted from this dashboard." });
    }

    const groupsWithUser = await Group.find({ members: userId }).select("_id members createdBy").lean();
    const deletedGroupIds = groupsWithUser
      .filter((group) => group.members.length === 1)
      .map((group) => group._id);
    const changedGroupIds = groupsWithUser
      .filter((group) => group.members.length > 1)
      .map((group) => group._id);
    await Promise.all([
      Message.deleteMany({ $or: [{ sender: userId }, { recipient: userId }] }),
      GroupMessage.deleteMany({
        $or: [{ sender: userId }, ...(deletedGroupIds.length ? [{ group: { $in: deletedGroupIds } }] : [])],
      }),
      Connection.deleteMany({ $or: [{ memberA: userId }, { memberB: userId }] }),
      UsageSession.deleteMany({ user: userId }),
      Notification.deleteMany({ $or: [{ recipient: userId }, { sender: userId }] }),
      User.updateMany({ privateContacts: userId }, { $pull: { privateContacts: userId } }),
      User.updateMany({ favoriteUsers: userId }, { $pull: { favoriteUsers: userId } }),
    ]);
    await Group.deleteMany({ _id: { $in: deletedGroupIds } });
    await Group.updateMany({ _id: { $in: changedGroupIds } }, { $pull: { members: userId } });
    const groupsToTransfer = groupsWithUser.filter(
      (group) => group.createdBy.toString() === userId && group.members.length > 1
    );
    await Promise.all(groupsToTransfer.map((group) => Group.updateOne(
      { _id: group._id },
      { $set: { createdBy: group.members.find((member) => member.toString() !== userId) } }
    )));
    await User.deleteOne({ _id: userId });

    const changedGroups = await Group.find({ _id: { $in: changedGroupIds } })
      .populate("members", "name username")
      .lean();
    for (const group of changedGroups) {
      const responseGroup = {
        id: group._id.toString(),
        name: group.name,
        createdBy: group.createdBy.toString(),
        isPrivate: true,
        isMember: true,
        memberCount: group.members.length,
        members: group.members.map((member) => ({
          id: member._id.toString(),
          name: member.name,
          username: member.username,
        })),
        createdAt: group.createdAt,
      };
      for (const member of group.members) {
        io.to(member._id.toString()).emit("group:updated", responseGroup);
      }
    }
    io.to(userId).emit("account:deleted");
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

return router;
}
