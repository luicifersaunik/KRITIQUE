require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createServer } = require("http");

const authRoutes = require("./routes/auth");
const reviewRoutes = require("./routes/reviews");
const streamRoutes = require("./routes/stream");
const healthRoutes = require("./routes/health");
const { errorHandler } = require("./middleware/errorHandler");
const { apiLimiter } = require("./middleware/rateLimiter");
const { logger, requestLogger } = require("./logger");

const app = express();
const httpServer = createServer(app);

// ─── Middleware ──────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(requestLogger);
app.use("/api", apiLimiter);

// ─── Routes ─────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/stream", streamRoutes);
app.use("/health", healthRoutes);

app.get("/", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Error Handler ───────────────────────────────
app.use(errorHandler);

// ─── Start ───────────────────────────────────────
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  logger.info(`Kritique backend started`, { port: PORT, env: process.env.NODE_ENV });
});
