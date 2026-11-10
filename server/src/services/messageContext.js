import mongoose from "mongoose";
import Group from "../models/Group.js";
import GroupMessage from "../models/GroupMessage.js";
import Message from "../models/Message.js";

export async function resolveMessageContext(reference, userId) {
  if (
    !reference ||
    typeof reference !== "object" ||
    !["direct", "group"].includes(reference.sourceType) ||
    !mongoose.isValidObjectId(reference.messageId)
  ) {
    return null;
  }

  if (reference.sourceType === "direct") {
    const message = await Message.findOne({
      _id: reference.messageId,
      type: { $ne: "call" },
      $or: [{ sender: userId }, { recipient: userId }],
    }).populate("sender", "name");
    if (!message) return null;
    return { senderName: message.sender.name, content: message.content };
  }

  const message = await GroupMessage.findById(reference.messageId).populate("sender", "name");
  if (!message) return null;
  const group = await Group.exists({ _id: message.group, members: userId });
  if (!group) return null;
  return { senderName: message.sender.name, content: message.content };
}
