/**
 * Integration tests for /api/auth routes.
 * Uses supertest — hits real Express routes but mocks Prisma.
 * No real DB needed to run CI.
 */
const request = require("supertest");
const express = require("express");
const authRoutes = require("../src/routes/auth");
const { errorHandler } = require("../src/middleware/errorHandler");

// ── Mock Prisma ────────────────────────────────
jest.mock("../src/lib/prisma", () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock("../src/logger", () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  requestLogger: (req, res, next) => next(),
}));

const prisma = require("../src/lib/prisma");
const bcrypt = require("bcryptjs");

// ── Build minimal test app ─────────────────────
const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use(errorHandler);

// Set required env vars for JWT signing
process.env.JWT_SECRET = "test_secret_that_is_long_enough_32ch";

describe("POST /api/auth/register", () => {
  beforeEach(() => jest.clearAllMocks());

  test("201: registers a new user and returns token", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: "uuid-1",
      name: "Saurabh",
      email: "s@test.com",
      password: "hashed",
    });

    const res = await request(app).post("/api/auth/register").send({
      name: "Saurabh",
      email: "s@test.com",
      password: "password123",
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user).toMatchObject({ name: "Saurabh", email: "s@test.com" });
    expect(res.body.user).not.toHaveProperty("password"); // Never expose password
  });

  test("409: returns conflict if email already exists", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "existing" });

    const res = await request(app).post("/api/auth/register").send({
      name: "Test",
      email: "existing@test.com",
      password: "password123",
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already registered/i);
  });

  test("400: rejects invalid email format", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Test",
      email: "not-an-email",
      password: "password123",
    });
    expect(res.status).toBe(400);
  });

  test("400: rejects password shorter than 6 chars", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Test",
      email: "t@test.com",
      password: "123",
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(() => jest.clearAllMocks());

  test("200: returns token on valid credentials", async () => {
    const hashed = await bcrypt.hash("password123", 10);
    prisma.user.findUnique.mockResolvedValue({
      id: "uuid-1",
      name: "Saurabh",
      email: "s@test.com",
      password: hashed,
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "s@test.com",
      password: "password123",
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
  });

  test("401: rejects wrong password", async () => {
    const hashed = await bcrypt.hash("correctpassword", 10);
    prisma.user.findUnique.mockResolvedValue({
      id: "uuid-1",
      name: "Test",
      email: "t@test.com",
      password: hashed,
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "t@test.com",
      password: "wrongpassword",
    });

    expect(res.status).toBe(401);
  });

  test("401: rejects non-existent user", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app).post("/api/auth/login").send({
      email: "ghost@test.com",
      password: "password123",
    });

    expect(res.status).toBe(401);
  });
});
