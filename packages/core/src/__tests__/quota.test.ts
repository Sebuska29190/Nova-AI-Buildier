// Quota system tests
import { describe, it, expect } from "bun:test";
import { checkQuota, recordUsage, getUsage } from "../quota.ts";

describe("Quota System", () => {
  it("allows requests within limits", () => {
    expect(() => checkQuota("test-session")).not.toThrow();
  });

  it("records usage", () => {
    recordUsage("test-session", 100, 50, 0.001);
    const usage = getUsage("test-session");
    expect(usage.session.inputTokens).toBe(100);
    expect(usage.session.outputTokens).toBe(50);
  });

  it("accumulates usage", () => {
    recordUsage("test-session", 200, 100, 0.002);
    const usage = getUsage("test-session");
    expect(usage.session.inputTokens).toBe(300);
    expect(usage.session.outputTokens).toBe(150);
  });
});
