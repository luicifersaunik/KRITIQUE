require("dotenv").config();
const Bull = require("bull");
const Redis = require("ioredis");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PrismaClient } = require("@prisma/client");
const { buildReviewPrompt } = require("./prompt");

const prisma = new PrismaClient();

// ─── Redis publisher (separate from subscriber) ──
const redisPublisher = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379",
  { maxRetriesPerRequest: null, enableReadyCheck: false }
);

// ─── Gemini setup ────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
});

// ─── Bull Queue (same config as backend) ─────────
const reviewQueue = new Bull("review-queue", {
  redis: {
    port: 6379,
    host: process.env.REDIS_URL
      ? new URL(process.env.REDIS_URL).hostname
      : "localhost",
  },
});

const reviewChannel = (reviewId) => `review:stream:${reviewId}`;

/**
 * Publish a message to the SSE Redis channel
 */
const publish = async (reviewId, data) => {
  await redisPublisher.publish(
    reviewChannel(reviewId),
    JSON.stringify(data)
  );
};

/**
 * Process a single review job
 */
const processReview = async (job) => {
  const { reviewId, code, language } = job.data;
  const startTime = Date.now();

  console.log(`⚙️  Processing review ${reviewId} [${language}]`);

  // Mark as PROCESSING in DB
  await prisma.review.update({
    where: { id: reviewId },
    data: { status: "PROCESSING" },
  });

  let fullResult = "";

  try {
    const prompt = buildReviewPrompt(code, language);

    // ── Stream from Gemini ───────────────────────
    const streamResult = await model.generateContentStream(prompt);

    for await (const chunk of streamResult.stream) {
      const text = chunk.text();
      if (text) {
        fullResult += text;
        // Publish each token chunk to Redis → SSE clients receive it live
        await publish(reviewId, { type: "token", text });
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Review ${reviewId} completed in ${duration}s`);

    // ── Save completed result to DB ──────────────
    await prisma.review.update({
      where: { id: reviewId },
      data: { status: "COMPLETED", result: fullResult },
    });

    // ── Signal stream is done ────────────────────
    await publish(reviewId, { type: "done", duration });
  } catch (err) {
    console.error(`❌ Review ${reviewId} failed:`, err.message);

    await prisma.review.update({
      where: { id: reviewId },
      data: { status: "FAILED" },
    });

    await publish(reviewId, {
      type: "error",
      message: "AI review failed. Please try again.",
    });

    throw err; // Let Bull handle retry logic
  }
};

// ─── Register job processor ──────────────────────
reviewQueue.process(1, processReview); // concurrency = 1 to control API rate

// ─── Queue event listeners ───────────────────────
reviewQueue.on("ready", () => {
  console.log("🔄 Kritique worker ready — listening for review jobs...");
});

reviewQueue.on("failed", (job, err) => {
  console.error(`Job ${job.id} failed after all retries: ${err.message}`);
});

reviewQueue.on("stalled", (job) => {
  console.warn(`Job ${job.id} stalled — will be retried`);
});

// ─── Graceful shutdown ───────────────────────────
const shutdown = async () => {
  console.log("Shutting down worker...");
  await reviewQueue.close();
  await prisma.$disconnect();
  redisPublisher.quit();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
