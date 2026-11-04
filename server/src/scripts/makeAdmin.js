import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";

const email =
  typeof process.argv[2] === "string" ? process.argv[2].trim().toLowerCase() : "";

if (!email) {
  console.error("Usage: npm run make-admin -- <registered-email>");
  process.exitCode = 1;
} else {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ububiko";
    await mongoose.connect(mongoUri);
    const user = await User.findOneAndUpdate(
      { email },
      { $set: { isAdmin: true } },
      { new: true, runValidators: true }
    ).select("name email");

    if (!user) {
      throw new Error(`No registered account found for ${email}. Create the account first.`);
    }

    console.log(`Admin access granted to ${user.name} (${user.email}).`);
  } catch (error) {
    console.error("Could not grant admin access:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
