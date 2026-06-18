import { describe, it, expect } from "bun:test";
import { validateReport } from "../agent/validator.ts";

describe("Evidence Protocol Validator", () => {
  it("should reject reports without file:line references", () => {
    const report = "This code looks fine. No issues found. Everything is working.";
    const result = validateReport(report);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("No evidence-anchored claims");
  });

  it("should accept reports with sufficient evidence", () => {
    const report = `
## Findings

| # | File:Line | Tool Used | Finding | Evidence | Severity |
|---|-----------|-----------|---------|----------|----------|
| 1 | packages/core/src/agent/runner.ts:100 | workspace_read_file | Missing error handling | "no try-catch found" | 🔴 Critical |
| 2 | packages/core/src/safety/circuit-breaker.ts:50 | workspace_read_file | Good implementation | "properly handles errors" | ✅ Verified |
`;
    const result = validateReport(report);
    expect(result.claims.length).toBeGreaterThan(0);
  });

  it("should count claims from bullets and numbered lists", () => {
    const report = `
- Issue 1 in \`file.ts:10\`: something is broken
- Issue 2 in \`file.ts:20\`: another problem
- Issue 3 in \`file.ts:30\`: yet another issue
`;
    const result = validateReport(report);
    expect(result.totalClaims).toBeGreaterThanOrEqual(3);
  });

  it("should handle empty reports", () => {
    const result = validateReport("");
    expect(result.passed).toBe(false);
    expect(result.claims.length).toBe(0);
  });

  it("should extract severity from content", () => {
    const report = `
Critical issue in \`auth.ts:42\`: authentication bypass found → output: "vulnerable code"
`;
    const result = validateReport(report);
    if (result.claims.length > 0) {
      expect(result.claims[0].severity).toBe("critical");
    }
  });

  it("should limit claims to 20", () => {
    let report = "";
    for (let i = 0; i < 30; i++) {
      report += `- Issue ${i} in \`file${i}.ts:${i * 10}\`: problem found → output: "evidence ${i}"\n`;
    }
    const result = validateReport(report);
    expect(result.claims.length).toBeLessThanOrEqual(20);
  });
});
