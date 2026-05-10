const Bull = require("bull");
const Redis = require("ioredis");

// ─── Redis client (for pub/sub and caching) ──────
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const redisSub = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("error", (err) => console.error("❌ Redis error:", err.message));

// ─── Bull Queue ──────────────────────────────────
const reviewQueue = new Bull("review-queue", {
  redis: {
    port: 6379,
    host: process.env.REDIS_URL
      ? new URL(process.env.REDIS_URL).hostname
      : "localhost",
  },
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// ─── Pub/Sub channel name helper ─────────────────
const reviewChannel = (reviewId) => `review:stream:${reviewId}`;

module.exports = { redis, redisSub, reviewQueue, reviewChannel };
