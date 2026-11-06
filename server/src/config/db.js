import mongoose from "mongoose";

export default async function connectDB() {
  const mongoUri = process.env.MONGO_URI?.trim();
  if (!mongoUri || mongoUri.includes("YOUR_MONGODB_ATLAS_CONNECTION_STRING")) {
    throw new Error("Set MONGO_URI in server/.env to your MongoDB Atlas connection string.");
  }
  if (!mongoUri.startsWith("mongodb://") && !mongoUri.startsWith("mongodb+srv://")) {
    throw new Error("MONGO_URI must start with mongodb:// or mongodb+srv://.");
  }

  await mongoose.connect(mongoUri);
  console.log("MongoDB Atlas Connected");
}
