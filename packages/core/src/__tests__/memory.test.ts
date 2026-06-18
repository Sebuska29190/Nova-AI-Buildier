import { describe, it, expect, beforeEach } from "bun:test";
import { agentMemory } from "../agent/memory.ts";

describe("Agent Memory Manager", () => {
  const testAgentId = "test-memory-agent";

  beforeEach(() => {
    // Clean up test memories
    agentMemory.forgetByAgent(testAgentId);
  });

  it("should save and retrieve memories", () => {
    agentMemory.add(testAgentId, "semantic", "TypeScript is statically typed", 4, ["lang"]);
    const results = agentMemory.search(testAgentId, "TypeScript");
    expect(results.length).toBe(1);
    expect(results[0].content).toContain("TypeScript");
    expect(results[0].importance).toBe(4);
  });

  it("should filter by type", () => {
    agentMemory.add(testAgentId, "episodic", "Ran tests successfully", 3, ["test"]);
    agentMemory.add(testAgentId, "semantic", "React uses JSX syntax", 4, ["frontend"]);
    
    const episodic = agentMemory.search(testAgentId, undefined, "episodic");
    const semantic = agentMemory.search(testAgentId, undefined, "semantic");
    
    expect(episodic.every(m => m.type === "episodic")).toBe(true);
    expect(semantic.every(m => m.type === "semantic")).toBe(true);
  });

  it("should filter by importance", () => {
    agentMemory.add(testAgentId, "semantic", "Minor detail", 1);
    agentMemory.add(testAgentId, "semantic", "Critical finding", 5);
    
    const high = agentMemory.search(testAgentId, undefined, undefined, 4);
    expect(high.every(m => m.importance >= 4)).toBe(true);
    expect(high.some(m => m.content.includes("Critical"))).toBe(true);
  });

  it("should delete memories", () => {
    const saved = agentMemory.add(testAgentId, "semantic", "To be deleted", 3);
    const deleted = agentMemory.forget(saved.id);
    expect(deleted).toBe(true);
    
    const results = agentMemory.search(testAgentId, "To be deleted");
    expect(results.length).toBe(0);
  });

  it("should count memories", () => {
    agentMemory.forgetByAgent(testAgentId);
    agentMemory.add(testAgentId, "semantic", "One", 3);
    agentMemory.add(testAgentId, "semantic", "Two", 3);
    
    const count = agentMemory.count(testAgentId);
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("should inject memory into system prompt", () => {
    agentMemory.add(testAgentId, "semantic", "Always use strict mode in TypeScript", 5, ["rule"]);
    const injection = agentMemory.injectMemory(testAgentId);
    expect(injection).toContain("Persistent Memory");
    expect(injection).toContain("TypeScript");
  });

  it("should return empty injection for unknown agent", () => {
    const injection = agentMemory.injectMemory("nonexistent-agent-xyz");
    expect(injection).toBe("");
  });
});
