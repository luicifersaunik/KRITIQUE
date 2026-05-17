const Bull = require("bull");
const Redis = require("ioredis");

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redisClientOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

const buildBullRedisConfig = () => {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    tls: url.protocol === "rediss:" ? {} : undefined,
    ...redisClientOptions,
  };
};

// ─── Redis client (for pub/sub and caching) ──────
const redis = new Redis(redisUrl, redisClientOptions);

const redisSub = new Redis(redisUrl, redisClientOptions);

redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("error", (err) => console.error("❌ Redis error:", err.message));

// ─── Bull Queue ──────────────────────────────────
const reviewQueue = new Bull("review-queue", {
  redis: buildBullRedisConfig(),
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
