/**
 * Testy jednostkowe dla ToolCircuitBreaker
 * 
 * Testujemy wyłącznie logikę breakera — bez LLM, bez tooli.
 * Zgodnie z rekomendacją @CodeReviewer: testability gap 🔴
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { ToolCircuitBreaker, CircuitBreakerError, DepthLimitError, LoopDetectionError } from "../circuit-breaker-tools.ts";

let hashCounter = 0;
function uniqueHash(): string {
  return `h_${++hashCounter}_${Date.now()}`;
}

function makeCtx(overrides: Partial<{
  taskId: string;
  agentId: string;
  toolName: string;
  toolParams: Record<string, unknown>;
  paramsHash: string;
  iteration: number;
}> = {}) {
  return {
    taskId: overrides.taskId ?? "test-task-1",
    agentId: overrides.agentId ?? "agent-1",
    toolName: overrides.toolName ?? "web_search",
    toolParams: overrides.toolParams ?? { query: "test" },
    paramsHash: overrides.paramsHash ?? uniqueHash(),
    iteration: overrides.iteration ?? 0,
  };
}

describe("ToolCircuitBreaker", () => {
  let breaker: ToolCircuitBreaker;

  beforeEach(() => {
    hashCounter = 0;
    breaker = new ToolCircuitBreaker({
      maxToolCallsPerTask: 5,
      maxAgentDepth: 2,
      taskTimeoutSeconds: 60,
      maxDuplicateHash: 3,  // 3 identical hashes allowed
    });
  });

  // ─── Circuit Breaker ────────────────────────────────────────

  it("should allow calls within limit", () => {
    const taskId = "cb-1";
    breaker.initTask(taskId);
    
    // 5 calls with unique hashes should be fine (limit = 5)
    for (let i = 0; i < 5; i++) {
      expect(() => breaker.beforeCall(makeCtx({ taskId, paramsHash: uniqueHash(), iteration: i }))).not.toThrow();
    }
  });

  it("should throw CircuitBreakerError when exceeding maxToolCalls", () => {
    const taskId = "cb-2";
    breaker.initTask(taskId);
    
    // 5 calls with unique hashes are fine
    for (let i = 0; i < 5; i++) {
      breaker.beforeCall(makeCtx({ taskId, paramsHash: uniqueHash(), iteration: i }));
    }
    
    // 6th call should throw
    expect(() => breaker.beforeCall(makeCtx({ taskId, paramsHash: uniqueHash(), iteration: 5 })))
      .toThrow(CircuitBreakerError);
    
    // Verify error message contains helpful info
    try {
      breaker.beforeCall(makeCtx({ taskId, paramsHash: uniqueHash(), iteration: 6 }));
    } catch (e) {
      expect(e).toBeInstanceOf(CircuitBreakerError);
      expect((e as CircuitBreakerError).message).toContain("exceeded");
      expect((e as CircuitBreakerError).message).toContain("5");
    }
  });

  it("should allow calls after reset", () => {
    const taskId = "cb-3";
    breaker.initTask(taskId);
    
    // Exceed limit
    for (let i = 0; i < 5; i++) {
      breaker.beforeCall(makeCtx({ taskId, paramsHash: uniqueHash(), iteration: i }));
    }
    expect(() => breaker.beforeCall(makeCtx({ taskId, paramsHash: uniqueHash(), iteration: 5 })))
      .toThrow(CircuitBreakerError);
    
    // Reset and try again
    breaker.resetTask(taskId);
    breaker.initTask(taskId);
    
    // Should work again
    expect(() => breaker.beforeCall(makeCtx({ taskId, paramsHash: uniqueHash(), iteration: 0 }))).not.toThrow();
  });

  it("should track call count correctly", () => {
    const taskId = "cb-4";
    breaker.initTask(taskId);
    
    expect(breaker.getTaskState(taskId).callCount).toBe(0);
    
    breaker.beforeCall(makeCtx({ taskId, paramsHash: uniqueHash() }));
    expect(breaker.getTaskState(taskId).callCount).toBe(1);
    
    breaker.beforeCall(makeCtx({ taskId, paramsHash: uniqueHash() }));
    expect(breaker.getTaskState(taskId).callCount).toBe(2);
  });

  // ─── Depth Limit ────────────────────────────────────────────

  it("should not limit non-agent tools for depth", () => {
    const taskId = "depth-1";
    breaker = new ToolCircuitBreaker({
      maxToolCallsPerTask: 20,  // Higher limit so we can test depth
      maxAgentDepth: 2,
      taskTimeoutSeconds: 60,
      maxDuplicateHash: 3,
    });
    breaker.initTask(taskId);
    
    // Even with many calls, non-agent tools don't increase depth
    for (let i = 0; i < 10; i++) {
      expect(() => breaker.beforeCall(makeCtx({ 
        taskId, toolName: "web_search", paramsHash: uniqueHash(), iteration: i 
      }))).not.toThrow();
    }
    
    // Verify depth is still 0
    expect(breaker.getTaskState(taskId).agentDepth).toBe(0);
  });

  it("should track depth for agent tools", () => {
    const taskId = "depth-2";
    breaker.initTask(taskId);
    
    breaker.beforeCall(makeCtx({ taskId, toolName: "agent_research", paramsHash: uniqueHash() }));
    expect(breaker.getTaskState(taskId).agentDepth).toBe(1);
    
    breaker.beforeCall(makeCtx({ taskId, toolName: "run_agent", paramsHash: uniqueHash() }));
    expect(breaker.getTaskState(taskId).agentDepth).toBe(2);
  });

  it("should throw DepthLimitError when exceeding agent depth", () => {
    const taskId = "depth-3";
    breaker.initTask(taskId);
    
    // 2 agent calls are fine (limit = 2)
    breaker.beforeCall(makeCtx({ taskId, toolName: "agent_a", paramsHash: uniqueHash(), iteration: 0 }));
    breaker.beforeCall(makeCtx({ taskId, toolName: "agent_b", paramsHash: uniqueHash(), iteration: 1 }));
    
    // 3rd should throw
    expect(() => breaker.beforeCall(makeCtx({ taskId, toolName: "agent_c", paramsHash: uniqueHash(), iteration: 2 })))
      .toThrow(DepthLimitError);
  });

  it("should unwind depth on afterCall for agent tools", () => {
    const taskId = "depth-4";
    breaker.initTask(taskId);
    
    breaker.beforeCall(makeCtx({ taskId, toolName: "agent_a", paramsHash: uniqueHash() }));
    expect(breaker.getTaskState(taskId).agentDepth).toBe(1);
    
    breaker.afterCall({ taskId, toolName: "agent_a" });
    expect(breaker.getTaskState(taskId).agentDepth).toBe(0);
    
    // Should be able to call again
    breaker.beforeCall(makeCtx({ taskId, toolName: "agent_b", paramsHash: uniqueHash() }));
    expect(breaker.getTaskState(taskId).agentDepth).toBe(1);
  });

  it("should not unwind depth for non-agent tools", () => {
    const taskId = "depth-5";
    breaker.initTask(taskId);
    
    breaker.afterCall({ taskId, toolName: "web_search" });
    // Depth stays 0
    expect(breaker.getTaskState(taskId).agentDepth).toBe(0);
  });

  // ─── Loop Detection ─────────────────────────────────────────

  it("should allow different hashes", () => {
    const taskId = "loop-1";
    breaker = new ToolCircuitBreaker({
      maxToolCallsPerTask: 20,  // Higher limit so we can test 10 different hashes
      maxAgentDepth: 2,
      taskTimeoutSeconds: 60,
      maxDuplicateHash: 3,
    });
    breaker.initTask(taskId);
    
    // Different params hashes should be fine
    for (let i = 0; i < 10; i++) {
      expect(() => breaker.beforeCall(makeCtx({ 
        taskId, 
        paramsHash: `hash_${i}`,
        iteration: i 
      }))).not.toThrow();
    }
  });

  it("should throw LoopDetectionError when same hash appears too many times", () => {
    const taskId = "loop-2";
    breaker.initTask(taskId);
    
    const sameHash = "same_hash_12345";
    
    // 3 times is fine (limit = 3)
    breaker.beforeCall(makeCtx({ taskId, paramsHash: sameHash, iteration: 0 }));
    breaker.beforeCall(makeCtx({ taskId, paramsHash: sameHash, iteration: 1 }));
    breaker.beforeCall(makeCtx({ taskId, paramsHash: sameHash, iteration: 2 }));
    
    // 4th time should throw
    expect(() => breaker.beforeCall(makeCtx({ taskId, paramsHash: sameHash, iteration: 3 })))
      .toThrow(LoopDetectionError);
  });

  it("should reset hash registry on resetTask", () => {
    const taskId = "loop-3";
    breaker.initTask(taskId);
    
    const sameHash = "dup_hash_abc";
    
    // Fill with same hash
    breaker.beforeCall(makeCtx({ taskId, paramsHash: sameHash, iteration: 0 }));
    breaker.beforeCall(makeCtx({ taskId, paramsHash: sameHash, iteration: 1 }));
    breaker.beforeCall(makeCtx({ taskId, paramsHash: sameHash, iteration: 2 }));
    expect(() => breaker.beforeCall(makeCtx({ taskId, paramsHash: sameHash, iteration: 3 })))
      .toThrow(LoopDetectionError);
    
    // Reset
    breaker.resetTask(taskId);
    breaker.initTask(taskId);
    
    // Should work again
    expect(() => breaker.beforeCall(makeCtx({ taskId, paramsHash: sameHash, iteration: 0 })))
      .not.toThrow();
  });

  // ─── Timeout ────────────────────────────────────────────────

  it("should not timeout immediately", () => {
    const taskId = "timeout-1";
    breaker.initTask(taskId);
    
    expect(breaker.isTimedOut(taskId)).toBe(false);
  });

  it("should report timeout after configured seconds", async () => {
    const taskId = "timeout-2";
    breaker = new ToolCircuitBreaker({ taskTimeoutSeconds: 0.01 }); // 10ms timeout
    breaker.initTask(taskId);
    
    // Wait a bit
    await new Promise(r => setTimeout(r, 20));
    
    expect(breaker.isTimedOut(taskId)).toBe(true);
  });

  it("should throw TimeoutError on beforeCall after timeout", async () => {
    const taskId = "timeout-3";
    breaker = new ToolCircuitBreaker({ taskTimeoutSeconds: 0.01 }); // 10ms timeout
    breaker.initTask(taskId);
    
    // Wait a bit
    await new Promise(r => setTimeout(r, 20));
    
    // This should throw
    expect(() => breaker.beforeCall(makeCtx({ taskId, paramsHash: uniqueHash(), iteration: 0 })))
      .toThrow(/timeout/i);
  });

  // ─── Konfiguracja ───────────────────────────────────────────

  it("should allow updating config at runtime", () => {
    breaker.updateConfig({ maxToolCallsPerTask: 100 });
    expect(breaker.getConfig().maxToolCallsPerTask).toBe(100);
  });

  it("should use updated config for validation", () => {
    const taskId = "config-1";
    breaker.initTask(taskId);
    
    // Default limit is 5
    for (let i = 0; i < 5; i++) {
      breaker.beforeCall(makeCtx({ taskId, paramsHash: uniqueHash(), iteration: i }));
    }
    expect(() => breaker.beforeCall(makeCtx({ taskId, paramsHash: uniqueHash(), iteration: 5 })))
      .toThrow(CircuitBreakerError);
    
    // Update limit to 10
    breaker.updateConfig({ maxToolCallsPerTask: 10 });
    
    // New task should use new limit
    const taskId2 = "config-2";
    breaker.initTask(taskId2);
    for (let i = 0; i < 10; i++) {
      expect(() => breaker.beforeCall(makeCtx({ taskId: taskId2, paramsHash: uniqueHash(), iteration: i })))
        .not.toThrow();
    }
  });

  // ─── Stan taska ─────────────────────────────────────────────

  it("should return state for existing task", () => {
    const taskId = "state-1";
    breaker.initTask(taskId);
    
    const state = breaker.getTaskState(taskId);
    expect(state).toHaveProperty("callCount");
    expect(state).toHaveProperty("agentDepth");
    expect(state).toHaveProperty("elapsedSeconds");
    expect(state).toHaveProperty("hashCount");
    expect(state.callCount).toBe(0);
    expect(state.agentDepth).toBe(0);
  });

  it("should return zeros for non-existent task", () => {
    const state = breaker.getTaskState("nonexistent");
    expect(state.callCount).toBe(0);
    expect(state.agentDepth).toBe(0);
    expect(state.hashCount).toBe(0);
  });

  // ─── Scenariusz: symulacja realnego ataku ───────────────────

  it("should prevent 'Agent Wars' infinite loop scenario", () => {
    // Symulacja: Agent A wywołuje Agent B, który wywołuje Agent A...
    // (Case study z arXiv 2503.12345)
    const taskId = "agent-wars";
    breaker.initTask(taskId);
    
    // Symulujemy wzajemne wywoływanie agentów
    breaker.beforeCall(makeCtx({ taskId, toolName: "agent_A", paramsHash: uniqueHash(), iteration: 0 }));
    breaker.afterCall({ taskId, toolName: "agent_A" });
    
    breaker.beforeCall(makeCtx({ taskId, toolName: "agent_B", paramsHash: uniqueHash(), iteration: 1 }));
    breaker.afterCall({ taskId, toolName: "agent_B" });
    
    // Agent B wywołuje Agent A z powrotem
    breaker.beforeCall(makeCtx({ taskId, toolName: "agent_A", paramsHash: uniqueHash(), iteration: 2 }));
    breaker.afterCall({ taskId, toolName: "agent_A" });
    
    // Agent A wywołuje Agent B — depth = 2, jeszcze OK
    breaker.beforeCall(makeCtx({ taskId, toolName: "agent_B", paramsHash: uniqueHash(), iteration: 3 }));
    breaker.afterCall({ taskId, toolName: "agent_B" });
    
    // Agent B wywołuje Agent A — depth = 3 > 2 (limit) → DepthLimitError
    expect(() => breaker.beforeCall(makeCtx({ taskId, toolName: "agent_A", paramsHash: uniqueHash(), iteration: 4 })))
      .toThrow(DepthLimitError);
  });

  it("should prevent 'Budget Drain' recursive tool calling", () => {
    // Symulacja: agent wywołuje search_web → summarize → search_web...
    // (Case study z OWASP — $500 kosztów w 3 minuty)
    const taskId = "budget-drain";
    breaker.initTask(taskId);
    
    // 5 calls OK
    for (let i = 0; i < 5; i++) {
      breaker.beforeCall(makeCtx({ taskId, toolName: "web_search", paramsHash: uniqueHash(), iteration: i }));
    }
    
    // 6th call → CircuitBreakerError
    expect(() => breaker.beforeCall(makeCtx({ taskId, toolName: "web_search", paramsHash: uniqueHash(), iteration: 5 })))
      .toThrow(CircuitBreakerError);
  });
});
