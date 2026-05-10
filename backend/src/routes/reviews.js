const router = require("express").Router();
const { z } = require("zod");
const { v4: uuidv4 } = require("uuid");
const prisma = require("../lib/prisma");
const { reviewQueue } = require("../lib/queue");
const { authenticate } = require("../middleware/auth");
const { reviewLimiter } = require("../middleware/rateLimiter");

const SUPPORTED_LANGUAGES = [
  "javascript", "typescript", "python", "java", "go",
  "rust", "cpp", "c", "csharp", "ruby", "php", "swift",
];

const createReviewSchema = z.object({
  title: z.string().min(1).max(100),
  code: z.string().min(10).max(10000),
  language: z.enum(SUPPORTED_LANGUAGES),
});

// POST /api/reviews  — submit new review job
router.post("/", authenticate, reviewLimiter, async (req, res, next) => {
  try {
    const body = createReviewSchema.parse(req.body);

    const review = await prisma.review.create({
      data: {
        id: uuidv4(),
        userId: req.user.id,
        title: body.title,
        code: body.code,
        language: body.language,
        status: "PENDING",
      },
    });

    // Push to Bull queue
    await reviewQueue.add(
      { reviewId: review.id, code: body.code, language: body.language },
      { jobId: review.id }
    );

    res.status(202).json({
      reviewId: review.id,
      status: "PENDING",
      message: "Review queued. Connect to SSE stream to receive results.",
    });
  } catch (err) {
    if (err.name === "ZodError") {
      return res.status(400).json({ error: err.errors[0].message });
    }
    next(err);
  }
});

// GET /api/reviews  — list user's reviews
router.get("/", authenticate, async (req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, language: true,
        status: true, createdAt: true,
      },
    });
    res.json({ reviews });
  } catch (err) {
    next(err);
  }
});

// GET /api/reviews/:id  — get single review with result
router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const review = await prisma.review.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }
    res.json({ review });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
