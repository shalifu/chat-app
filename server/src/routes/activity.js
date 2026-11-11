import { Router } from "express";
import UsageSession from "../models/UsageSession.js";
import UsageDaily from "../models/UsageDaily.js";
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

async function recordDailyUsage(userId, endAt, seconds) {
  let remaining = seconds;
  let cursor = endAt.getTime() - seconds * 1000;
  while (remaining > 0) {
    const current = new Date(cursor);
    const dayStart = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate()));
    const nextDay = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const untilMidnight = Math.max(1, Math.ceil((nextDay.getTime() - cursor) / 1000));
    const segment = Math.min(remaining, untilMidnight);
    await UsageDaily.updateOne(
      { user: userId, dayStart },
      { $inc: { activeSeconds: segment } },
      { upsert: true }
    );
    cursor += segment * 1000;
    remaining -= segment;
  }
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
      const trackedSeconds = Math.min(elapsedSeconds, maxHeartbeatGapSeconds);
      if (trackedSeconds) await recordDailyUsage(req.userId, now, trackedSeconds);
      session.activeSeconds += trackedSeconds;
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
      const trackedSeconds = Math.min(elapsedSeconds, maxHeartbeatGapSeconds);
      if (trackedSeconds) await recordDailyUsage(req.userId, now, trackedSeconds);
      session.activeSeconds += trackedSeconds;
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
