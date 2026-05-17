const router = require("express").Router();
const jwt = require("jsonwebtoken");
const { redisSub, reviewChannel } = require("../lib/queue");
const prisma = require("../lib/prisma");

/**
 * GET /api/stream/:reviewId?token=<jwt>
 *
 * Server-Sent Events endpoint.
 * - Auth via query param token (SSE can't set headers in browser)
 * - Subscribes to Redis pub/sub channel for the review
 * - Streams AI tokens as SSE events to the client
 * - Sends DONE or ERROR event to close the connection
 */
router.get("/:reviewId", async (req, res) => {
  // ── Auth via query param (SSE limitation) ─────
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  const { reviewId } = req.params;

  // Verify review belongs to user
  const review = await prisma.review.findFirst({
    where: { id: reviewId, userId: user.id },
  });
  if (!review) {
    return res.status(404).json({ error: "Review not found" });
  }

  // ── If already completed, stream cached result ─
  if (review.status === "COMPLETED" && review.result) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: "token", text: review.result })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    return res.end();
  }

  // ── Set SSE headers ───────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
  res.flushHeaders();

  // ── Heartbeat to keep connection alive ─────────
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 15000);

  // ── Subscribe to Redis channel ─────────────────
  const channel = reviewChannel(reviewId);
  const subscriber = redisSub.duplicate();

  await subscriber.subscribe(channel);

  subscriber.on("message", (ch, message) => {
    if (ch !== channel) return;
    try {
      const data = JSON.parse(message);
      res.write(`data: ${JSON.stringify(data)}\n\n`);

      if (data.type === "done" || data.type === "error") {
        cleanup();
      }
    } catch (e) {
      console.error("SSE parse error:", e);
    }
  });

  let cleaningUp = false;
  const cleanup = () => {
    if (cleaningUp) return;
    cleaningUp = true;
    
    clearInterval(heartbeat);
    subscriber.unsubscribe(channel).catch(() => {});
    subscriber.quit().catch(() => {});
    if (!res.writableEnded) {
      res.end();
    }
  };

  req.on("close", cleanup);
});

module.exports = router;
