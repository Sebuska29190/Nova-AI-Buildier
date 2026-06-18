import { describe, it, expect, beforeEach } from "bun:test";
import { qualityScorer } from "../agent/scoring.ts";

describe("Quality Scorer", () => {
  beforeEach(() => {
    // Reset by creating fresh scores
    qualityScorer.recordPass("test-agent-1", 0.8, 5);
    qualityScorer.recordPass("test-agent-1", 0.9, 6);
    qualityScorer.recordFail("test-agent-2", 0.2, "No evidence found");
  });

  it("should track pass/fail correctly", () => {
    const score1 = qualityScorer.get("test-agent-1");
    expect(score1.validatorPasses).toBeGreaterThanOrEqual(2);
    expect(score1.totalRuns).toBeGreaterThanOrEqual(2);
  });

  it("should calculate trust levels", () => {
    // Agent with passes should be neutral or verified
    const score1 = qualityScorer.get("test-agent-1");
    expect(["neutral", "verified"]).toContain(score1.trustLevel);

    // Agent with failures should be low or degraded
    const score2 = qualityScorer.get("test-agent-2");
    expect(["low", "degraded"]).toContain(score2.trustLevel);
  });

  it("should return trust badges", () => {
    const badge1 = qualityScorer.getTrustBadge("test-agent-1");
    expect(badge1.emoji).toBeTruthy();
    expect(badge1.color).toBeTruthy();
    expect(badge1.label).toBeTruthy();
  });

  it("should sort by trust level", () => {
    const sorted = qualityScorer.listByTrust();
    expect(sorted.length).toBeGreaterThan(0);
    // Verified should come before degraded
    const verifiedIdx = sorted.findIndex(s => s.trustLevel === "verified");
    const degradedIdx = sorted.findIndex(s => s.trustLevel === "degraded");
    if (verifiedIdx >= 0 && degradedIdx >= 0) {
      expect(verifiedIdx).toBeLessThan(degradedIdx);
    }
  });

  it("should handle unknown agents gracefully", () => {
    const score = qualityScorer.get("nonexistent-agent");
    expect(score).toBeDefined();
    expect(score.trustLevel).toBe("neutral");
  });
});
