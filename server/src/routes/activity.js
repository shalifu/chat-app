import { Router } from "express";
import UsageSession from "../models/UsageSession.js";
import { requireAdult, requireAuth } from "../middleware/auth.js";

const router = Router();
const maxHeartbeatGapSeconds = 90;

router.use(requireAuth, requireAdult);

function getSessionId(req, res) {
  const sessionId = typeof req.body.sessionId === "string" ? req.body.sessionId : "";
  if (!/^[\da-f-]{36}$/i.test(sessionId)) {
    res.status(400).json({ message: "Invalid activity session." });
    return null;
  }
  return sessionId;
}

router.post("/heartbeat", async (req, res, next) => {
  try {
    const sessionId = getSessionId(req, res);
    if (!sessionId) return;

    const now = new Date();
    const session = await UsageSession.findOne({ sessionId, user: req.userId });
    if (!session) {
      await UsageSession.create({
        sessionId,
        user: req.userId,
        startedAt: now,
        lastActiveAt: now,
      });
      return res.json({ ok: true });
    }

    if (!session.endedAt) {
      const elapsedSeconds = Math.max(0, Math.floor((now - session.lastActiveAt) / 1000));
      session.activeSeconds += Math.min(elapsedSeconds, maxHeartbeatGapSeconds);
      session.lastActiveAt = now;
      await session.save();
    }
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/end", async (req, res, next) => {
  try {
    const sessionId = getSessionId(req, res);
    if (!sessionId) return;

    const session = await UsageSession.findOne({ sessionId, user: req.userId });
    if (session && !session.endedAt) {
      const now = new Date();
      const elapsedSeconds = Math.max(0, Math.floor((now - session.lastActiveAt) / 1000));
      session.activeSeconds += Math.min(elapsedSeconds, maxHeartbeatGapSeconds);
      session.lastActiveAt = now;
      session.endedAt = now;
      await session.save();
    }
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

export default router;
