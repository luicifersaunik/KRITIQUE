const { createLogger, format, transports } = require("winston");

const { combine, timestamp, printf, colorize, errors, json } = format;

// ── Human-readable format for development ──────
const devFormat = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? " " + JSON.stringify(meta)
      : "";
    return `${timestamp} ${level}: ${stack || message}${metaStr}`;
  })
);

// ── JSON format for production (grep/Datadog/CloudWatch friendly) ──
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: process.env.NODE_ENV === "production" ? prodFormat : devFormat,
  transports: [
    new transports.Console(),
    // In production you'd add: new transports.File({ filename: "error.log", level: "error" })
  ],
  // Never crash the app on logger errors
  exitOnError: false,
});

// ── Request logger middleware ───────────────────
const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? "error"
      : res.statusCode >= 400 ? "warn"
      : "info";

    logger[level]("HTTP request", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      user_id: req.user?.id || null,
      ip: req.ip,
    });
  });
  next();
};

module.exports = { logger, requestLogger };
