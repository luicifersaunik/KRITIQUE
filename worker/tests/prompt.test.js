const { buildReviewPrompt } = require("../src/prompt");

describe("buildReviewPrompt", () => {
  const sampleCode = `function add(a, b) { return a + b; }`;

  test("includes the language in the prompt", () => {
    const prompt = buildReviewPrompt(sampleCode, "javascript");
    expect(prompt).toContain("javascript");
  });

  test("includes the code verbatim", () => {
    const prompt = buildReviewPrompt(sampleCode, "javascript");
    expect(prompt).toContain(sampleCode);
  });

  test("includes all required review sections", () => {
    const prompt = buildReviewPrompt(sampleCode, "python");
    expect(prompt).toContain("Summary");
    expect(prompt).toContain("Strengths");
    expect(prompt).toContain("Issues Found");
    expect(prompt).toContain("Performance");
    expect(prompt).toContain("Security");
    expect(prompt).toContain("Score");
  });

  test("includes severity levels", () => {
    const prompt = buildReviewPrompt(sampleCode, "python");
    expect(prompt).toContain("Critical");
    expect(prompt).toContain("Major");
    expect(prompt).toContain("Minor");
  });

  test("wraps code in a code block", () => {
    const prompt = buildReviewPrompt(sampleCode, "go");
    expect(prompt).toContain("```go");
    expect(prompt).toContain("```");
  });

  test("handles multi-line code", () => {
    const multiLine = `function foo() {\n  const x = 1;\n  return x;\n}`;
    const prompt = buildReviewPrompt(multiLine, "javascript");
    expect(prompt).toContain(multiLine);
  });

  test("handles different languages without error", () => {
    const langs = ["typescript", "python", "go", "rust", "java", "cpp"];
    langs.forEach((lang) => {
      expect(() => buildReviewPrompt(sampleCode, lang)).not.toThrow();
    });
  });
});
