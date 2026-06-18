import { describe, it, expect } from "bun:test";
import { learningLoop } from "../agent/learning.ts";

describe("Learning Loop", () => {
  it("should have remediate method", () => {
    expect(typeof learningLoop.remediate).toBe("function");
  });

  it("should have apply method", () => {
    expect(typeof learningLoop.apply).toBe("function");
  });

  it("should return null for non-degraded agents", () => {
    const result = learningLoop.remediate("nonexistent-agent");
    expect(result).toBeNull();
  });

  it("should track learning history", () => {
    const history = learningLoop.getHistory("nonexistent-agent");
    expect(Array.isArray(history)).toBe(true);
  });

  it("should have getHistory method", () => {
    expect(typeof learningLoop.getHistory).toBe("function");
  });
});
