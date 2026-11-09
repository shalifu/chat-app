import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "node:http";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Server } from "socket.io";
import authRoutes from "./routes/auth.js";
import createUserRouter from "./routes/users.js";
import adminRoutes from "./routes/admin.js";
import messageRoutes, { serializeMessage } from "./routes/messages.js";
import createGroupRouter from "./routes/groups.js";
import activityRoutes from "./routes/activity.js";
import notificationRoutes from "./routes/notifications.js";
import Message from "./models/Message.js";
import Connection from "./models/Connection.js";
import User from "./models/User.js";
import { createNotification } from "./services/notifications.js";
import { requireAdult, requireAuth } from "./middleware/auth.js";
import connectDB from "./config/db.js";

const port = Number(process.env.PORT || 5000);
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes("replace-this")) {
  throw new Error("Set JWT_SECRET in server/.env to a long, random value.");
}

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: clientUrl, methods: ["GET", "POST"] },
});

app.use(cors({ origin: clientUrl }));
app.use(express.json({ limit: "10kb" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/users", createUserRouter(io));
app.use("/api/admin", adminRoutes(io));
app.use("/api/messages", messageRoutes);
app.use("/api/groups", createGroupRouter(io));
app.use("/api/activity", activityRoutes);
app.use("/api/notifications", notificationRoutes);

app.post("/api/messages", requireAuth, requireAdult, async (req, res, next) => {
  try {
    const recipientId = typeof req.body.recipientId === "string" ? req.body.recipientId : "";
    const content = typeof req.body.content === "string" ? req.body.content.trim() : "";

    if (!mongoose.isValidObjectId(recipientId)) {
      return res.status(400).json({ message: "Choose a valid person to message." });
    }
    if (recipientId === req.userId) {
      return res.status(400).json({ message: "You cannot send a message to yourself." });
    }
    if (!content || content.length > 4000) {
      return res.status(400).json({ message: "Message must be between 1 and 4000 characters." });
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
    const legacyConnection = sender.privateContacts.some((contact) => contact.equals(recipientId)) &&
      recipient.privateContacts.some((contact) => contact.equals(req.userId));
    if (!connection && !legacyConnection) {
      return res.status(403).json({ message: "Accept a connection request before sending a message." });
    }

    const message = await Message.create({
      sender: req.userId,
      recipient: recipientId,
      content,
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
  socket.join(socket.data.userId);
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
