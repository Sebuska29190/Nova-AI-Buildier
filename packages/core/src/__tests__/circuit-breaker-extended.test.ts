import { describe, it, expect, beforeEach } from "bun:test";
import { ToolCircuitBreaker } from "../safety/circuit-breaker-tools.ts";

describe("Tool Circuit Breaker", () => {
  let breaker: ToolCircuitBreaker;

  beforeEach(() => {
    breaker = new ToolCircuitBreaker({
      maxToolCallsPerTask: 5,
      maxAgentDepth: 3,
      taskTimeoutSeconds: 10,
      maxDuplicateHash: 2,
    });
  });

  it("should allow calls within limits", () => {
    breaker.initTask("task-1");
    expect(() => breaker.beforeCall({
      taskId: "task-1",
      agentId: "agent-1",
      toolName: "read_file",
      toolParams: { path: "/tmp/test" },
      paramsHash: "hash-1",
      iteration: 0,
    })).not.toThrow();
    breaker.resetTask("task-1");
  });

  it("should block after max tool calls", () => {
    breaker.initTask("task-2");
    for (let i = 0; i < 5; i++) {
      breaker.beforeCall({
        taskId: "task-2",
        agentId: "agent-1",
        toolName: "read_file",
        toolParams: { path: `/tmp/test${i}` },
        paramsHash: `hash-${i}`,
        iteration: i,
      });
    }
    // 6th call should throw
    expect(() => breaker.beforeCall({
      taskId: "task-2",
      agentId: "agent-1",
      toolName: "read_file",
      toolParams: { path: "/tmp/test5" },
      paramsHash: "hash-5",
      iteration: 5,
    })).toThrow();
    breaker.resetTask("task-2");
  });

  it("should detect duplicate hash loops", () => {
    breaker.initTask("task-3");
    breaker.beforeCall({
      taskId: "task-3",
      agentId: "agent-1",
      toolName: "search",
      toolParams: { query: "same" },
      paramsHash: "same-hash",
      iteration: 0,
    });
    breaker.beforeCall({
      taskId: "task-3",
      agentId: "agent-1",
      toolName: "search",
      toolParams: { query: "same" },
      paramsHash: "same-hash",
      iteration: 1,
    });
    // 3rd duplicate should throw
    expect(() => breaker.beforeCall({
      taskId: "task-3",
      agentId: "agent-1",
      toolName: "search",
      toolParams: { query: "same" },
      paramsHash: "same-hash",
      iteration: 2,
    })).toThrow();
    breaker.resetTask("task-3");
  });

  it("should track agent depth", () => {
    breaker.initTask("task-4");
    // Simulate agent→agent→agent (3 levels)
    for (let i = 0; i < 3; i++) {
      breaker.beforeCall({
        taskId: "task-4",
        agentId: `agent-${i}`,
        toolName: "run_agent",
        toolParams: {},
        paramsHash: `agent-hash-${i}`,
        iteration: i,
      });
    }
    // 4th agent call should throw (depth > 3)
    expect(() => breaker.beforeCall({
      taskId: "task-4",
      agentId: "agent-3",
      toolName: "run_agent",
      toolParams: {},
      paramsHash: "agent-hash-3",
      iteration: 3,
    })).toThrow();
    breaker.resetTask("task-4");
  });

  it("should unwind depth on afterCall", () => {
    breaker.initTask("task-5");
    breaker.beforeCall({
      taskId: "task-5",
      agentId: "agent-1",
      toolName: "run_agent",
      toolParams: {},
      paramsHash: "h1",
      iteration: 0,
    });
    breaker.afterCall({ taskId: "task-5", toolName: "run_agent" });
    const state = breaker.getTaskState("task-5");
    expect(state.agentDepth).toBe(0);
    breaker.resetTask("task-5");
  });

  it("should reset task state", () => {
    breaker.initTask("task-6");
    breaker.beforeCall({
      taskId: "task-6",
      agentId: "agent-1",
      toolName: "read_file",
      toolParams: {},
      paramsHash: "h1",
      iteration: 0,
    });
    breaker.resetTask("task-6");
    const state = breaker.getTaskState("task-6");
    expect(state.callCount).toBe(0);
  });

  it("should allow different hashes without triggering loop detection", () => {
    breaker.initTask("task-7");
    for (let i = 0; i < 5; i++) {
      breaker.beforeCall({
        taskId: "task-7",
        agentId: "agent-1",
        toolName: "search",
        toolParams: { query: `query-${i}` },
        paramsHash: `unique-hash-${i}`,
        iteration: i,
      });
    }
    // All different hashes — no loop detection
    breaker.resetTask("task-7");
  });

  it("should support config updates", () => {
    breaker.updateConfig({ maxToolCallsPerTask: 10 });
    const config = breaker.getConfig();
    expect(config.maxToolCallsPerTask).toBe(10);
  });
});
