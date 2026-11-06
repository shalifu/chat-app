import { Router } from "express";
import mongoose from "mongoose";
import Group from "../models/Group.js";
import GroupMessage from "../models/GroupMessage.js";
import User from "../models/User.js";
import { requireAdult, requireAuth } from "../middleware/auth.js";

function serializeGroup(group, userId) {
  const isMember = group.members.some((member) => member._id.toString() === userId);
  return {
    id: group._id.toString(),
    name: group.name,
    createdBy: group.createdBy.toString(),
    isPrivate: group.isPrivate,
    isMember,
    memberCount: group.members.length,
    members: isMember ? group.members.map((member) => ({
      id: member._id.toString(),
      name: member.name,
      username: member.username,
    })) : [],
    createdAt: group.createdAt,
  };
}

function serializeGroupMessage(message) {
  return {
    id: message._id.toString(),
    groupId: message.group.toString(),
    senderId: message.sender._id.toString(),
    senderName: message.sender.name,
    content: message.content,
    createdAt: message.createdAt,
  };
}

export default function createGroupRouter(io) {
  const router = Router();
  router.use(requireAuth, requireAdult);

  router.get("/", async (req, res, next) => {
    try {
      const groups = await Group.find({
        $or: [{ members: req.userId }, { isPrivate: false }],
      })
        .populate("members", "name username")
        .sort({ updatedAt: -1 })
        .lean();
      return res.json({ groups: groups.map((group) => serializeGroup(group, req.userId)) });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
      if (name.length < 2 || name.length > 80) {
        return res.status(400).json({ message: "Group name must be between 2 and 80 characters." });
      }
      if (req.body.isPrivate !== undefined && typeof req.body.isPrivate !== "boolean") {
        return res.status(400).json({ message: "Choose whether this group should be private." });
      }
      const group = await Group.create({
        name,
        createdBy: req.userId,
        members: [req.userId],
        isPrivate: req.body.isPrivate !== false,
      });
      await group.populate("members", "name username");
      return res.status(201).json({ group: serializeGroup(group, req.userId) });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/:groupId/join", async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.groupId)) {
        return res.status(400).json({ message: "Invalid group." });
      }
      const group = await Group.findById(req.params.groupId);
      if (!group || group.isPrivate) {
        return res.status(404).json({ message: "Public group not found." });
      }
      group.members.addToSet(req.userId);
      await group.save();
      await group.populate("members", "name username");
      const responseGroup = serializeGroup(group, req.userId);
      for (const member of group.members) {
        io.to(member._id.toString()).emit("group:updated", responseGroup);
      }
      return res.json({ group: responseGroup });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/:groupId/members", async (req, res, next) => {
    try {
      const { groupId } = req.params;
      if (!mongoose.isValidObjectId(groupId)) {
        return res.status(400).json({ message: "Invalid group." });
      }
      const group = await Group.findById(groupId);
      if (!group) return res.status(404).json({ message: "Group not found." });
      if (group.createdBy.toString() !== req.userId) {
        return res.status(403).json({ message: "Only the group creator can add members." });
      }
      const identifier = typeof req.body.identifier === "string" ? req.body.identifier.trim().toLowerCase() : "";
      if (!identifier) return res.status(400).json({ message: "Enter a username or five-digit ID." });
      const query = /^\d{5}$/.test(identifier) ? { userCode: identifier } : { username: identifier };
      const user = await User.findOne(query).select("name username userCode isPrivate");
      if (!user) {
        return res.status(404).json({ message: "Account not found." });
      }
      if (user.isPrivate && !/^\d{5}$/.test(identifier)) {
        return res.status(400).json({ message: "Private accounts must be added using their five-digit ID." });
      }
      if (group.members.some((member) => member.equals(user._id))) {
        return res.status(409).json({ message: "That person is already a group member." });
      }
      group.members.addToSet(user._id);
      await group.save();
      await group.populate("members", "name username");
      const responseGroup = serializeGroup(group, req.userId);
      io.to(user.id).emit("group:added", responseGroup);
      for (const member of group.members) {
        if (!member.equals(user._id)) io.to(member.toString()).emit("group:updated", responseGroup);
      }
      return res.json({ group: responseGroup });
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/:groupId/privacy", async (req, res, next) => {
    try {
      const { groupId } = req.params;
      if (!mongoose.isValidObjectId(groupId)) {
        return res.status(400).json({ message: "Invalid group." });
      }
      if (typeof req.body.isPrivate !== "boolean") {
        return res.status(400).json({ message: "Choose whether this group should be private." });
      }
      const group = await Group.findById(groupId);
      if (!group) return res.status(404).json({ message: "Group not found." });
      if (group.createdBy.toString() !== req.userId) {
        return res.status(403).json({ message: "Only the group creator can change group privacy." });
      }
      group.isPrivate = req.body.isPrivate;
      await group.save();
      await group.populate("members", "name username");
      const responseGroup = serializeGroup(group, req.userId);
      for (const member of group.members) {
        io.to(member._id.toString()).emit("group:updated", responseGroup);
      }
      return res.json({ group: responseGroup });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:groupId/messages", async (req, res, next) => {
    try {
      const { groupId } = req.params;
      if (!mongoose.isValidObjectId(groupId)) {
        return res.status(400).json({ message: "Invalid group." });
      }
      const group = await Group.findOne({ _id: groupId, members: req.userId });
      if (!group) return res.status(404).json({ message: "Group not found." });
      const messages = await GroupMessage.find({ group: groupId })
        .populate("sender", "name")
        .sort({ createdAt: 1, _id: 1 })
        .limit(500)
        .lean();
      return res.json({ messages: messages.map(serializeGroupMessage) });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/:groupId/messages", async (req, res, next) => {
    try {
      const { groupId } = req.params;
      const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
      if (!mongoose.isValidObjectId(groupId)) {
        return res.status(400).json({ message: "Invalid group." });
      }
      if (!content || content.length > 4000) {
        return res.status(400).json({ message: "Message must be between 1 and 4000 characters." });
      }
      const [group, sender] = await Promise.all([
        Group.findOne({ _id: groupId, members: req.userId }),
        User.findById(req.userId).select("name messagingEnabled"),
      ]);
      if (!group) return res.status(404).json({ message: "Group not found." });
      if (!sender || sender.messagingEnabled === false) {
        return res.status(403).json({ message: "Messaging is disabled for your account." });
      }
      const message = await GroupMessage.create({ group: groupId, sender: req.userId, content });
      await message.populate("sender", "name");
      const responseMessage = serializeGroupMessage(message);
      for (const memberId of group.members) {
        if (memberId.toString() !== req.userId) {
          io.to(memberId.toString()).emit("group:message:new", responseMessage);
        }
      }
      return res.status(201).json({ message: responseMessage });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
