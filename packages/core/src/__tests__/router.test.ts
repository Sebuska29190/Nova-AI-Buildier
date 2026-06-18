import { describe, it, expect } from "bun:test";
import { capabilityRegistry } from "../agent/router.ts";

describe("Smart Router v2", () => {
  it("should extract domains from task description", () => {
    const matches = capabilityRegistry.match("fix the TypeScript API endpoint", 5);
    expect(matches.length).toBeGreaterThan(0);
    // Should find agents with typescript or api-design domains
    const topAgent = matches[0];
    expect(topAgent.score).toBeGreaterThan(0);
  });

  it("should rank specialists higher for complex tasks", () => {
    const matches = capabilityRegistry.match(
      "design a microservices architecture with Kubernetes, implement circuit breakers, and set up CI/CD pipeline with Docker and Terraform for a distributed system",
      5
    );
    expect(matches.length).toBeGreaterThan(0);
    // Top agent should have devops or architecture domain
    const reasons = matches[0].reason;
    const hasRelevantDomain = reasons.some(r => r.includes("domain:"));
    expect(hasRelevantDomain).toBe(true);
  });

  it("should match language-specific tasks", () => {
    const pyMatches = capabilityRegistry.match("write a Python FastAPI endpoint", 3);
    const tsMatches = capabilityRegistry.match("write a TypeScript Express endpoint", 3);
    expect(pyMatches.length).toBeGreaterThan(0);
    expect(tsMatches.length).toBeGreaterThan(0);
  });

  it("should return empty for completely unrelated tasks", () => {
    const matches = capabilityRegistry.match("zzzzz", 5);
    expect(matches.length).toBe(0);
  });

  it("should include trust level in results", () => {
    const matches = capabilityRegistry.match("code review", 3);
    for (const m of matches) {
      expect(m.trustLevel).toBeDefined();
      expect(["verified", "neutral", "low", "degraded"]).toContain(m.trustLevel);
    }
  });

  it("should handle bigram matching", () => {
    const matches = capabilityRegistry.match("react specialist for component architecture", 5);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("should list all capabilities", () => {
    const caps = capabilityRegistry.list();
    expect(caps.length).toBeGreaterThan(0);
    // Each capability should have required fields
    for (const cap of caps) {
      expect(cap.agentId).toBeTruthy();
      expect(cap.name).toBeTruthy();
      expect(typeof cap.specificity).toBe("number");
    }
  });
});
