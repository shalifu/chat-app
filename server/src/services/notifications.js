import Notification from "../models/Notification.js";

export function serializeNotification(notification) {
  return {
    id: notification._id.toString(),
    recipientId: notification.recipient.toString(),
    type: notification.type,
    title: notification.title,
    body: notification.body,
    targetType: notification.targetType,
    targetId: notification.targetId.toString(),
    sender: notification.sender
      ? {
          id: notification.sender._id.toString(),
          name: notification.sender.name,
          username: notification.sender.username,
        }
      : null,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
}

export async function createNotification(io, values) {
  const notification = await Notification.create(values);
  if (values.sender) await notification.populate("sender", "name username");
  const response = serializeNotification(notification);
  io.to(values.recipient.toString()).emit("notification:new", response);
  return response;
}

export async function createNotifications(io, items) {
  if (!items.length) return [];
  const notifications = await Notification.insertMany(items);
  await Notification.populate(notifications, { path: "sender", select: "name username" });
  const responses = notifications.map(serializeNotification);
  for (const notification of responses) {
    io.to(notification.recipientId).emit("notification:new", notification);
  }
  return responses;
}
