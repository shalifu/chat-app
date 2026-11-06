import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "node:http";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Server } from "socket.io";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import adminRoutes from "./routes/admin.js";
import messageRoutes, { serializeMessage } from "./routes/messages.js";
import createGroupRouter from "./routes/groups.js";
import Message from "./models/Message.js";
import User from "./models/User.js";
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
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", createGroupRouter(io));

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
    const [sender, recipient] = await Promise.all([
      User.findById(req.userId).select("messagingEnabled isPrivate +privateContacts"),
      User.findById(recipientId).select("messagingEnabled isPrivate +privateContacts"),
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
    if (
      (sender.isPrivate || recipient.isPrivate) &&
      (!sender.privateContacts.some((contact) => contact.equals(recipientId)) ||
        !recipient.privateContacts.some((contact) => contact.equals(req.userId)))
    ) {
      return res.status(403).json({ message: "Add each other by five-digit ID before messaging this private account." });
    }

    const message = await Message.create({
      sender: req.userId,
      recipient: recipientId,
      content,
    });
    const responseMessage = serializeMessage(message);
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
