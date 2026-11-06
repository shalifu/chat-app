import jwt from "jsonwebtoken";
import User from "../models/User.js";

export function requireAuth(req, res, next) {
  const authorization = req.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ message: "Sign in to continue." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ message: "Your session has expired. Sign in again." });
  }
}

export async function requireAdult(req, res, next) {
  try {
    const user = await User.findById(req.userId).select("age");
    if (!user || !Number.isInteger(user.age) || user.age < 15) {
      return res.status(403).json({ message: "You must be at least 15 to use Ububiko." });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}
