import { Router } from "express";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function createToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    age: user.age,
    userCode: user.userCode,
    isPrivate: user.isPrivate === true,
    email: user.email,
    isAdmin: user.isAdmin === true,
    messagingEnabled: user.messagingEnabled !== false,
  };
}

function normalizeUsername(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isValidUsername(value) {
  return /^[a-z0-9_]{3,24}$/.test(value);
}

async function createUserCode() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const code = String(randomInt(10000, 100000));
    if (!(await User.exists({ userCode: code }))) return code;
  }
  throw new Error("Could not allocate a unique user ID.");
}

router.post("/register", async (req, res, next) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const username = normalizeUsername(req.body.username);
    const email =
      typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const age = Number(req.body.age);

    if (name.length < 2 || name.length > 60) {
      return res.status(400).json({ message: "Name must be between 2 and 60 characters." });
    }
    if (!isValidUsername(username)) {
      return res.status(400).json({ message: "Username must be 3–24 characters using letters, numbers, or underscores." });
    }
    if (!Number.isInteger(age) || age < 15 || age > 120) {
      return res.status(400).json({ message: "You must enter an age of 15 or older to create an account." });
    }
    if (req.body.isPrivate !== undefined && typeof req.body.isPrivate !== "boolean") {
      return res.status(400).json({ message: "Choose whether your account should be private." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }
    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({ message: "Password must be between 8 and 72 characters." });
    }
    const existing = await User.exists({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(409).json({ message: "That email or username is already in use." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const user = await User.create({
          name,
          username,
          age,
          isPrivate: req.body.isPrivate === true,
          userCode: await createUserCode(),
          email,
          passwordHash,
        });
        return res.status(201).json({ token: createToken(user), user: publicUser(user) });
      } catch (error) {
        if (error?.code === 11000 && error.keyPattern?.userCode) continue;
        if (error?.code === 11000) {
          return res.status(409).json({ message: "That email or username is already in use." });
        }
        throw error;
      }
    }
    throw new Error("Could not allocate a unique user ID.");
  } catch (error) {
    return next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const email =
      typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const user = await User.findOne({ email }).select("+passwordHash");

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Email or password is incorrect." });
    }
    user.lastLoginAt = new Date();
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save();
    return res.json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "Account not found." });
    }
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.patch("/profile", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("+privateContacts +passwordHash");
    if (!user) {
      return res.status(404).json({ message: "Account not found." });
    }

    const age = req.body.age === undefined ? user.age : Number(req.body.age);
    const username =
      req.body.username === undefined ? user.username : normalizeUsername(req.body.username);
    const name = req.body.name === undefined ? user.name : (typeof req.body.name === "string" ? req.body.name.trim() : "");
    if (!Number.isInteger(age) || age < 15 || age > 120) {
      return res.status(400).json({ message: "You must be at least 15 to use Ububiko." });
    }
    if (!isValidUsername(username)) {
      return res.status(400).json({ message: "Username must be 3–24 characters using letters, numbers, or underscores." });
    }
    if (name.length < 2 || name.length > 60) {
      return res.status(400).json({ message: "Name must be between 2 and 60 characters." });
    }
    if (req.body.newPassword !== undefined) {
      const currentPassword = typeof req.body.currentPassword === "string" ? req.body.currentPassword : "";
      const newPassword = typeof req.body.newPassword === "string" ? req.body.newPassword : "";
      if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
        return res.status(400).json({ message: "Your current password is incorrect." });
      }
      if (newPassword.length < 8 || newPassword.length > 72) {
        return res.status(400).json({ message: "New password must be between 8 and 72 characters." });
      }
      user.passwordHash = await bcrypt.hash(newPassword, 12);
    }
    if (req.body.isPrivate !== undefined && typeof req.body.isPrivate !== "boolean") {
      return res.status(400).json({ message: "Choose whether your account should be private." });
    }
    if (username !== user.username && await User.exists({ username, _id: { $ne: user._id } })) {
      return res.status(409).json({ message: "That username is already in use." });
    }

    user.age = age;
    user.username = username;
    user.name = name;
    if (req.body.isPrivate !== undefined) user.isPrivate = req.body.isPrivate;
    for (let attempt = 0; !user.userCode && attempt < 10; attempt += 1) {
      user.userCode = await createUserCode();
      try {
        await user.save();
      } catch (error) {
        if (error?.code === 11000 && error.keyPattern?.userCode) {
          user.userCode = undefined;
          continue;
        }
        if (error?.code === 11000) {
          return res.status(409).json({ message: "That username is already in use." });
        }
        throw error;
      }
    }
    if (!user.userCode) {
      throw new Error("Could not allocate a unique user ID.");
    }
    if (user.isModified()) {
      try {
        await user.save();
      } catch (error) {
        if (error?.code === 11000) {
          return res.status(409).json({ message: "That username is already in use." });
        }
        throw error;
      }
    }
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

export default router;
