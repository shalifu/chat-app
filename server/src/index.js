import "dotenv/config";
import { createHmac } from "node:crypto";
import express from "express";
import cors from "cors";
import http from "node:http";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Server } from "socket.io";
import authRoutes from "./routes/auth.js";
import createUserRouter from "./routes/users.js";
import adminRoutes from "./routes/admin.js";
import createMessageRouter, { serializeMessage } from "./routes/messages.js";
import createGroupRouter from "./routes/groups.js";
import activityRoutes from "./routes/activity.js";
import notificationRoutes from "./routes/notifications.js";
import Message from "./models/Message.js";
import Block from "./models/Block.js";
import Connection from "./models/Connection.js";
import User from "./models/User.js";
import { createNotification } from "./services/notifications.js";
import { resolveMessageContext } from "./services/messageContext.js";
import { requireAdult, requireAuth } from "./middleware/auth.js";
import connectDB from "./config/db.js";

const port = Number(process.env.PORT || 5000);
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const turnUrls = process.env.TURN_URL?.split(",").map((url) => url.trim()).filter(Boolean) || [];
const turnSecret = process.env.TURN_SECRET;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes("replace-this")) {
  throw new Error("Set JWT_SECRET in server/.env to a long, random value.");
}
if (Boolean(turnUrls.length) !== Boolean(turnSecret)) {
  throw new Error("Set both TURN_URL and TURN_SECRET in server/.env, or leave both unset.");
}

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: clientUrl, methods: ["GET", "POST"] },
});
const activeCalls = new Map();
const onlineSockets = new Map();

async function saveCallHistory(activeCall, reason) {
  const callStatus = reason === "timeout" || (reason === "disconnected" && activeCall.status === "ringing")
    ? "missed"
    : reason === "declined"
      ? "declined"
      : reason === "disconnected"
        ? "disconnected"
        : reason === "ended" && activeCall.status === "ringing"
          ? "cancelled"
          : "completed";
  const durationSeconds = activeCall.acceptedAt
    ? Math.max(0, Math.floor((Date.now() - activeCall.acceptedAt.getTime()) / 1000))
    : 0;
  const message = await Message.create({
    sender: activeCall.callerId,
    recipient: activeCall.calleeId,
    type: "call",
    content: `${activeCall.video ? "Video" : "Audio"} call`,
    callType: activeCall.video ? "video" : "audio",
    callStatus,
    durationSeconds,
  });
  const responseMessage = serializeMessage(message);
  io.to(responseMessage.senderId).to(responseMessage.recipientId).emit("message:new", responseMessage);
}

async function getVisibleUserIds(userId) {
  const [user, connections, publicUsers] = await Promise.all([
    User.findById(userId).select("+privateContacts"),
    Connection.find({ $or: [{ memberA: userId }, { memberB: userId }] }).select("memberA memberB"),
    User.find({ _id: { $ne: userId }, isPrivate: { $ne: true } }).select("_id"),
  ]);
  if (!user) return [];
  const visibleIds = new Set(user.privateContacts.map((id) => id.toString()));
  for (const connection of connections) {
    visibleIds.add(connection.memberA.toString() === userId
      ? connection.memberB.toString()
      : connection.memberA.toString());
  }
  for (const publicUser of publicUsers) visibleIds.add(publicUser._id.toString());
  return [...visibleIds];
}

async function announcePresence(userId, online) {
  const user = await User.findById(userId).select("isPrivate");
  if (!user) return;
  if (!user.isPrivate) {
    io.emit("presence:update", { userId, online });
    return;
  }
  const visibleIds = await getVisibleUserIds(userId);
  for (const visibleId of visibleIds) {
    io.to(visibleId).emit("presence:update", { userId, online });
  }
}

app.use(cors({ origin: clientUrl }));
app.use(express.json({ limit: "10kb" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/users", createUserRouter(io));
app.use("/api/admin", adminRoutes(io));
app.use("/api/messages", createMessageRouter(io));
app.use("/api/groups", createGroupRouter(io));
app.use("/api/activity", activityRoutes);
app.use("/api/notifications", notificationRoutes);
app.get("/api/calls/ice-servers", requireAuth, requireAdult, (req, res) => {
  const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
  if (turnUrls.length && turnSecret) {
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
    const username = `${expiresAt}:${req.userId}`;
    const credential = createHmac("sha1", turnSecret).update(username).digest("base64");
    iceServers.push({ urls: turnUrls, username, credential });
  }
  return res.json({ iceServers });
});

app.post("/api/messages", requireAuth, requireAdult, async (req, res, next) => {
  try {
    const recipientId = typeof req.body.recipientId === "string" ? req.body.recipientId : "";
    let content = typeof req.body.content === "string" ? req.body.content.trim() : "";

    if (!mongoose.isValidObjectId(recipientId)) {
      return res.status(400).json({ message: "Choose a valid person to message." });
    }
    if (recipientId === req.userId) {
      return res.status(400).json({ message: "You cannot send a message to yourself." });
    }
    const [sender, recipient, connection] = await Promise.all([
      User.findById(req.userId).select("name username messagingEnabled +privateContacts"),
      User.findById(recipientId).select("messagingEnabled +privateContacts"),
      Connection.findOne({
        status: "accepted",
        $or: [
          { memberA: req.userId, memberB: recipientId },
          { memberA: recipientId, memberB: req.userId },
        ],
      }),
    ]);
    if (!sender || !recipient) {
      return res.status(404).json({ message: "That account could not be found." });
    }
    if (sender.messagingEnabled === false) {
      return res.status(403).json({ message: "Messaging is disabled for your account." });
    }
    if (recipient.messagingEnabled === false) {
      return res.status(403).json({ message: "This person is not accepting messages right now." });
    }
    if (await Block.exists({ $or: [
      { blockedBy: req.userId, blockedUser: recipientId },
      { blockedBy: recipientId, blockedUser: req.userId },
    ] })) {
      return res.status(403).json({ message: "This account cannot receive your messages." });
    }
    const legacyConnection = sender.privateContacts.some((contact) => contact.equals(recipientId)) &&
      recipient.privateContacts.some((contact) => contact.equals(req.userId));
    if (!connection && !legacyConnection) {
      return res.status(403).json({ message: "Accept a connection request before sending a message." });
    }

    let replyTo = null;
    let forwardedFrom = null;
    if (req.body.replyTo !== undefined) {
      replyTo = await resolveMessageContext(req.body.replyTo, req.userId);
      if (!replyTo) return res.status(400).json({ message: "The message to reply to could not be found." });
    }
    if (req.body.forwardedFrom !== undefined) {
      forwardedFrom = await resolveMessageContext(req.body.forwardedFrom, req.userId);
      if (!forwardedFrom) return res.status(400).json({ message: "The message to forward could not be found." });
      content = forwardedFrom.content;
    }
    if (!content || content.length > 4000) {
      return res.status(400).json({ message: "Message must be between 1 and 4000 characters." });
    }
    const message = await Message.create({
      sender: req.userId,
      recipient: recipientId,
      content,
      ...(replyTo ? { replyTo } : {}),
      ...(forwardedFrom ? { forwardedFrom } : {}),
    });
    const responseMessage = serializeMessage(message);
    await createNotification(io, {
      recipient: recipientId,
      sender: req.userId,
      type: "direct_message",
      title: `New message from ${sender.name}`,
      body: "Open your notifications to view it.",
      targetType: "person",
      targetId: req.userId,
    });
    io.to(recipientId).emit("message:new", responseMessage);
    return res.status(201).json({ message: responseMessage });
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  return res.status(500).json({ message: "Something went wrong. Please try again." });
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string") {
      return next(new Error("Authentication required."));
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("age");
    if (!user || !Number.isInteger(user.age) || user.age < 15) {
      return next(new Error("Your account is not eligible to use Ububiko."));
    }
    socket.data.userId = payload.sub;
    return next();
  } catch {
    return next(new Error("Invalid or expired session."));
  }
});

io.on("connection", (socket) => {
  const userId = socket.data.userId.toString();
  socket.join(userId);
  const userSockets = onlineSockets.get(userId) || new Set();
  userSockets.add(socket.id);
  onlineSockets.set(userId, userSockets);
  if (userSockets.size === 1) {
    announcePresence(userId, true).catch((error) => console.error("Could not announce online status:", error));
  }

  socket.on("presence:list", async (callback) => {
    if (typeof callback !== "function") return;
    try {
      const visibleIds = new Set(await getVisibleUserIds(userId));
      callback([...onlineSockets.keys()].filter((onlineId) => visibleIds.has(onlineId)));
    } catch (error) {
      console.error("Could not load online status:", error);
      callback([]);
    }
  });

  function finishCall(callId, reason = "ended") {
    const activeCall = activeCalls.get(callId);
    if (!activeCall) return;
    clearTimeout(activeCall.timeout);
    activeCalls.delete(callId);
    io.to(activeCall.callerId).to(activeCall.calleeId).emit("call:ended", { callId, reason });
    saveCallHistory(activeCall, reason).catch((error) => {
      console.error("Could not save call history:", error);
    });
  }

  function acknowledge(callback, result) {
    if (typeof callback === "function") callback(result);
  }

  function readPayload(payload) {
    return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  }

  socket.on("call:invite", async (rawPayload, callback) => {
    const payload = readPayload(rawPayload);
    const { callId, to, video } = payload;
    if (
      typeof callId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(callId) ||
      typeof to !== "string" ||
      !mongoose.isValidObjectId(to) ||
      to === userId ||
      typeof video !== "boolean"
    ) {
      acknowledge(callback, { ok: false, message: "Invalid call invitation." });
      return;
    }

    try {
      const [caller, recipient, connection, block] = await Promise.all([
        User.findById(userId).select("name messagingEnabled"),
        User.findById(to).select("name messagingEnabled"),
        Connection.findOne({
          status: "accepted",
          $or: [
            { memberA: userId, memberB: to },
            { memberA: to, memberB: userId },
          ],
        }),
        Block.exists({ $or: [
          { blockedBy: userId, blockedUser: to },
          { blockedBy: to, blockedUser: userId },
        ] }),
      ]);
      if (!caller || !recipient || !connection || block) {
        acknowledge(callback, { ok: false, message: "Calls are available only between accepted connections." });
        return;
      }
      if (caller.messagingEnabled === false || recipient.messagingEnabled === false) {
        acknowledge(callback, { ok: false, message: "Calls are unavailable while messaging is disabled." });
        return;
      }
      const participantBusy = [...activeCalls.values()].some((call) =>
        call.callerId === userId || call.calleeId === userId || call.callerId === to || call.calleeId === to
      );
      if (participantBusy) {
        acknowledge(callback, { ok: false, message: "One of you is already on another call." });
        return;
      }

      const activeCall = {
        callId,
        callerId: userId,
        calleeId: to,
        video,
        status: "ringing",
        acceptedAt: null,
        timeout: null,
        queuedCandidates: [],
      };
      activeCall.timeout = setTimeout(() => {
        if (activeCalls.get(callId) === activeCall) finishCall(callId, "timeout");
      }, 30000);
      activeCalls.set(callId, activeCall);
      io.to(to).emit("call:incoming", {
        callId,
        fromId: userId,
        fromName: caller.name,
        video,
      });
      acknowledge(callback, { ok: true });
    } catch (error) {
      console.error("Could not create call invitation:", error);
      acknowledge(callback, { ok: false, message: "Could not start the call. Please try again." });
    }
  });

  socket.on("call:accept", (rawPayload, callback) => {
    const payload = readPayload(rawPayload);
    const activeCall = activeCalls.get(payload.callId);
    if (!activeCall || activeCall.calleeId !== userId || activeCall.status !== "ringing") {
      acknowledge(callback, { ok: false, message: "This call is no longer available." });
      return;
    }
    clearTimeout(activeCall.timeout);
    activeCall.timeout = null;
    activeCall.status = "active";
    activeCall.acceptedAt = new Date();
    io.to(activeCall.callerId).emit("call:accepted", { callId: activeCall.callId });
    for (const queuedCandidate of activeCall.queuedCandidates) {
      io.to(queuedCandidate.to).emit("call:candidate", {
        callId: activeCall.callId,
        candidate: queuedCandidate.candidate,
      });
    }
    activeCall.queuedCandidates = [];
    acknowledge(callback, { ok: true });
  });

  socket.on("call:preparing", (rawPayload, callback) => {
    const payload = readPayload(rawPayload);
    const activeCall = activeCalls.get(payload.callId);
    if (!activeCall || activeCall.calleeId !== userId || activeCall.status !== "ringing") {
      acknowledge(callback, { ok: false, message: "This call is no longer available." });
      return;
    }
    clearTimeout(activeCall.timeout);
    activeCall.timeout = setTimeout(() => {
      if (activeCalls.get(activeCall.callId) === activeCall) finishCall(activeCall.callId, "timeout");
    }, 90000);
    io.to(activeCall.callerId).emit("call:preparing", { callId: activeCall.callId });
    acknowledge(callback, { ok: true });
  });

  socket.on("call:reject", (rawPayload) => {
    const payload = readPayload(rawPayload);
    const activeCall = activeCalls.get(payload.callId);
    if (!activeCall || activeCall.calleeId !== userId) return;
    finishCall(activeCall.callId, "declined");
  });

  socket.on("call:end", (rawPayload) => {
    const payload = readPayload(rawPayload);
    const activeCall = activeCalls.get(payload.callId);
    if (!activeCall || (activeCall.callerId !== userId && activeCall.calleeId !== userId)) return;
    finishCall(activeCall.callId);
  });

  function relayCallSignal(eventName, rawPayload, callback) {
    const payload = readPayload(rawPayload);
    const activeCall = activeCalls.get(payload.callId);
    if (!activeCall) {
      acknowledge(callback, { ok: false, message: "This call is no longer active." });
      return;
    }
    const peerId = activeCall.callerId === userId
      ? activeCall.calleeId
      : activeCall.calleeId === userId
        ? activeCall.callerId
        : null;
    if (!peerId) {
      acknowledge(callback, { ok: false, message: "You are not part of this call." });
      return;
    }
    if (
      (eventName === "call:offer" && activeCall.callerId !== userId) ||
      (eventName === "call:answer" && activeCall.calleeId !== userId)
    ) {
      acknowledge(callback, { ok: false, message: "This call signal is not valid for your role." });
      return;
    }
    const serialized = JSON.stringify(payload.value);
    if (typeof serialized !== "string" || serialized.length > 100000) {
      acknowledge(callback, { ok: false, message: "Call signal is too large." });
      return;
    }
    if (activeCall.status === "ringing" && eventName === "call:candidate") {
      activeCall.queuedCandidates.push({ to: peerId, candidate: payload.value });
      acknowledge(callback, { ok: true });
      return;
    }
    if (activeCall.status !== "active") {
      acknowledge(callback, { ok: false, message: "This call is not ready for signaling." });
      return;
    }
    io.to(peerId).emit(eventName, {
      callId: activeCall.callId,
      [eventName === "call:candidate" ? "candidate" : "description"]: payload.value,
    });
    acknowledge(callback, { ok: true });
  }

  socket.on("call:offer", (rawPayload, callback) => {
    const payload = readPayload(rawPayload);
    if (payload.description?.type !== "offer" || typeof payload.description.sdp !== "string") {
      acknowledge(callback, { ok: false, message: "Invalid call offer." });
      return;
    }
    relayCallSignal("call:offer", { ...payload, value: payload.description }, callback);
  });
  socket.on("call:answer", (rawPayload, callback) => {
    const payload = readPayload(rawPayload);
    if (payload.description?.type !== "answer" || typeof payload.description.sdp !== "string") {
      acknowledge(callback, { ok: false, message: "Invalid call answer." });
      return;
    }
    relayCallSignal("call:answer", { ...payload, value: payload.description }, callback);
  });
  socket.on("call:candidate", (rawPayload, callback) => {
    const payload = readPayload(rawPayload);
    if (!payload.candidate || typeof payload.candidate.candidate !== "string") {
      acknowledge(callback, { ok: false, message: "Invalid network candidate." });
      return;
    }
    relayCallSignal("call:candidate", { ...payload, value: payload.candidate }, callback);
  });

  socket.on("disconnect", () => {
    for (const [callId, activeCall] of activeCalls) {
      if (activeCall.callerId === userId || activeCall.calleeId === userId) finishCall(callId, "disconnected");
    }
    const activeSockets = onlineSockets.get(userId);
    activeSockets?.delete(socket.id);
    if (activeSockets?.size === 0) {
      onlineSockets.delete(userId);
      announcePresence(userId, false).catch((error) => console.error("Could not announce offline status:", error));
    }
  });
});

async function start() {
  await connectDB();
  httpServer.listen(port, () => {
    console.log(`Ububiko API listening on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Could not start Ububiko:", error);
  process.exitCode = 1;
});
