/**
 * Prompt Engineering Module
 *
 * Constructs a structured, context-aware prompt for Gemini.
 * Separates concerns: system context, code context, review guidelines.
 * This modularity is intentional — easy to A/B test prompts independently.
 */

const REVIEW_GUIDELINES = `
You are an expert software engineer conducting a thorough code review.
Your review must cover exactly these sections, in this order:

## 🔍 Summary
One paragraph overview of what the code does and your overall assessment.

## ✅ Strengths
2-4 specific things the code does well. Be precise, reference line patterns.

## 🐛 Issues Found
List each issue with:
- **Severity**: Critical / Major / Minor
- **Description**: What the problem is
- **Fix**: Concrete code suggestion or approach

If no issues found, explicitly say so.

## ⚡ Performance & Scalability
Identify bottlenecks, inefficient patterns, or scalability concerns.

## 🔒 Security
Flag any security vulnerabilities (injection, auth issues, exposed secrets, etc.)

## 🏗️ Refactoring Suggestions
Optional improvements for readability, maintainability, or design patterns.

## 📊 Score
Rate the code: X/10 and one sentence justification.

Rules:
- Be direct and specific. No vague feedback.
- Reference actual patterns or line content from the code.
- If the code is good, say so — don't invent problems.
- Use markdown formatting for clarity.
`;

/**
 * Build the final prompt for Gemini
 * @param {string} code - The code to review
 * @param {string} language - Programming language
 * @returns {string} Full prompt
 */
const buildReviewPrompt = (code, language) => {
  return `${REVIEW_GUIDELINES}

---

**Language:** ${language}

**Code to Review:**
\`\`\`${language}
${code}
\`\`\`

Begin your review now:`;
};

module.exports = { buildReviewPrompt };
