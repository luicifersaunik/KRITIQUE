const { CircuitBreaker } = require("../src/circuit-breaker");

// Suppress logger output during tests
jest.mock("../src/logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

describe("CircuitBreaker", () => {
  let breaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      name: "test",
      failureThreshold: 3,
      recoveryTimeout: 1000, // 1s for fast tests
    });
  });

  test("starts in CLOSED state", () => {
    expect(breaker.state).toBe("CLOSED");
  });

  test("passes through successful calls", async () => {
    const result = await breaker.call(async () => "success");
    expect(result).toBe("success");
    expect(breaker.state).toBe("CLOSED");
  });

  test("counts failures correctly", async () => {
    const failFn = async () => { throw new Error("fail"); };
    await expect(breaker.call(failFn)).rejects.toThrow("fail");
    await expect(breaker.call(failFn)).rejects.toThrow("fail");
    expect(breaker.failureCount).toBe(2);
    expect(breaker.state).toBe("CLOSED"); // not yet at threshold
  });

  test("opens after hitting failure threshold", async () => {
    const failFn = async () => { throw new Error("fail"); };
    for (let i = 0; i < 3; i++) {
      await expect(breaker.call(failFn)).rejects.toThrow();
    }
    expect(breaker.state).toBe("OPEN");
  });

  test("fails fast when OPEN without calling fn", async () => {
    const failFn = async () => { throw new Error("fail"); };
    for (let i = 0; i < 3; i++) {
      await expect(breaker.call(failFn)).rejects.toThrow();
    }

    const expensiveFn = jest.fn(async () => "result");
    await expect(breaker.call(expensiveFn)).rejects.toThrow("OPEN");
    expect(expensiveFn).not.toHaveBeenCalled(); // Fast fail — fn never ran
  });

  test("transitions to HALF_OPEN after recovery timeout", async () => {
    const failFn = async () => { throw new Error("fail"); };
    for (let i = 0; i < 3; i++) {
      await expect(breaker.call(failFn)).rejects.toThrow();
    }
    expect(breaker.state).toBe("OPEN");

    // Simulate recovery timeout
    breaker.lastFailureTime = Date.now() - 2000;
    const successFn = async () => "recovered";
    const result = await breaker.call(successFn);
    expect(result).toBe("recovered");
    expect(breaker.state).toBe("CLOSED");
  });

  test("resets failure count on success", async () => {
    const failFn = async () => { throw new Error("fail"); };
    await expect(breaker.call(failFn)).rejects.toThrow();
    expect(breaker.failureCount).toBe(1);

    await breaker.call(async () => "ok");
    expect(breaker.failureCount).toBe(0);
  });
});
