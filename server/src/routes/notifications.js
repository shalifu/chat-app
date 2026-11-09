import { Router } from "express";
import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import { requireAdult, requireAuth } from "../middleware/auth.js";
import { serializeNotification } from "../services/notifications.js";

const router = Router();

router.use(requireAuth, requireAdult);

router.get("/", async (req, res, next) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipient: req.userId })
        .populate("sender", "name username")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      Notification.countDocuments({ recipient: req.userId, readAt: null }),
    ]);
    return res.json({
      notifications: notifications.map(serializeNotification),
      unreadCount,
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/read-all", async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipient: req.userId, readAt: null },
      { $set: { readAt: new Date() } }
    );
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:notificationId/read", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.notificationId)) {
      return res.status(400).json({ message: "Invalid notification." });
    }
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, recipient: req.userId, readAt: null },
      { $set: { readAt: new Date() } },
      { new: true }
    )
      .populate("sender", "name username")
      .lean();
    if (!notification) {
      const exists = await Notification.exists({
        _id: req.params.notificationId,
        recipient: req.userId,
      });
      if (!exists) return res.status(404).json({ message: "Notification not found." });
      return res.json({ ok: true });
    }
    return res.json({ notification: serializeNotification(notification) });
  } catch (error) {
    return next(error);
  }
});

export default router;
