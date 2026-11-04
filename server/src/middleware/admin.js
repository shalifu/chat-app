import User from "../models/User.js";

export async function requireAdmin(req, res, next) {
  try {
    const user = await User.findById(req.userId).select("isAdmin");
    if (!user || user.isAdmin !== true) {
      return res.status(403).json({ message: "Admin access is required." });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}
