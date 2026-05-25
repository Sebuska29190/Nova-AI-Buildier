/**
 * Tool Circuit Breaker — Safety Middleware dla tool calli
 * 
 * Chroni przed:
 * - Infinite loops (zbyt wiele tool calli w jednym tasku)
 * - Rekurencyjnymi agent handoff (agent→tool→agent→tool→...)
 * - Resource exhaustion (brak limitu czasowego)
 * 
 * RÓŻNI SIĘ od circuit-breaker.ts (który chroni providerów LLM).
 * Ten chroni przed nadmiernym używaniem narzędzi przez agenta.
 * 
 * @see https://arxiv.org/abs/2505.02077 (Open Challenges in Multi-Agent Security)
 * @see https://genai.owasp.org/resource/multi-agentic-system-threat-modeling-guide-v1-0/
 */

import { emitEvent } from "../event-bus/index.ts";

// ─── Typy ──────────────────────────────────────────────────────

export interface ToolCircuitBreakerConfig {
  /** Maksymalna liczba tool calli w jednym tasku (default: 50) */
  maxToolCallsPerTask: number;
  /** Maksymalna głębokość agent→agent handoff (default: 5) */
  maxAgentDepth: number;
  /** Timeout na cały task w sekundach (default: 120) */
  taskTimeoutSeconds: number;
  /** Maksymalna liczba powtórzeń tego samego hasha (default: 3) */
  maxDuplicateHash: number;
}

export interface ToolCallContext {
  taskId: string;
  agentId: string;
  toolName: string;
  toolParams: Record<string, unknown>;
  paramsHash: string;
  iteration: number;
}

const DEFAULT_CONFIG: ToolCircuitBreakerConfig = {
  maxToolCallsPerTask: 50,
  maxAgentDepth: 5,
  taskTimeoutSeconds: 120,
  maxDuplicateHash: 3,
};

// ─── Custom Errors ─────────────────────────────────────────────

export class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

export class DepthLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DepthLimitError";
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export class LoopDetectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoopDetectionError";
  }
}

// ─── Tool Circuit Breaker ─────────────────────────────────────

class ToolCircuitBreaker {
  private config: ToolCircuitBreakerConfig;
  
  /** Licznik tool calli per task */
  private callCounters = new Map<string, number>();
  /** Głębokość agent handoff per task */
  private agentDepths = new Map<string, number>();
  /** Czas startu taska */
  private taskStartTimes = new Map<string, number>();
  /** Hash registry dla loop detection */
  private hashRegistry = new Map<string, string[]>();

  constructor(config: Partial<ToolCircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Hook: przed wykonaniem tool calla.
   * Rzuca error jeśli któryś z limitów został przekroczony.
   */
  beforeCall(ctx: ToolCallContext): void {
    const { taskId, agentId, toolName, iteration, paramsHash } = ctx;

    // ─── 1. Globalny timeout ──────────────────────────────────
    const startTime = this.taskStartTimes.get(taskId);
    if (startTime) {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > this.config.taskTimeoutSeconds) {
        this.emitBreach(taskId, agentId, "timeout", `Task timeout (${elapsed.toFixed(1)}s > ${this.config.taskTimeoutSeconds}s)`);
        throw new TimeoutError(
          `Task ${taskId.slice(0, 8)}: timeout after ${elapsed.toFixed(1)}s ` +
          `(limit: ${this.config.taskTimeoutSeconds}s)`
        );
      }
    }

    // ─── 2. Circuit Breaker — liczba tool calli ──────────────
    const currentCount = (this.callCounters.get(taskId) || 0) + 1;
    this.callCounters.set(taskId, currentCount);

    if (currentCount > this.config.maxToolCallsPerTask) {
      this.emitBreach(taskId, agentId, "circuit_breaker", 
        `Exceeded ${this.config.maxToolCallsPerTask} tool calls`);
      throw new CircuitBreakerError(
        `Task ${taskId.slice(0, 8)}: exceeded ${this.config.maxToolCallsPerTask} tool calls ` +
        `(attempted ${currentCount})`
      );
    }

    // ─── 3. Depth limit dla agent→agent ──────────────────────
    if (toolName.startsWith("agent_") || toolName.includes("run_agent")) {
      const currentDepth = (this.agentDepths.get(taskId) || 0) + 1;
      this.agentDepths.set(taskId, currentDepth);

      if (currentDepth > this.config.maxAgentDepth) {
        this.emitBreach(taskId, agentId, "depth_limit",
          `Agent depth ${currentDepth} > ${this.config.maxAgentDepth}`);
        throw new DepthLimitError(
          `Task ${taskId.slice(0, 8)}: agent depth ${currentDepth} > ` +
          `${this.config.maxAgentDepth} (tool: ${toolName})`
        );
      }
    }

    // ─── 4. Hash-based loop detection ─────────────────────────
    const hashes = this.hashRegistry.get(taskId) || [];
    hashes.push(paramsHash);
    this.hashRegistry.set(taskId, hashes);

    const duplicateCount = hashes.filter(h => h === paramsHash).length;
    if (duplicateCount > this.config.maxDuplicateHash) {
      this.emitBreach(taskId, agentId, "loop_detected",
        `Hash ${paramsHash.slice(0, 8)} appeared ${duplicateCount}x`);
      throw new LoopDetectionError(
        `Task ${taskId.slice(0, 8)}: loop detected — tool "${toolName}" ` +
        `with same params called ${duplicateCount}x`
      );
    }
  }

  /**
   * Hook: po wykonaniu tool calla.
   * Używane do unwind głębokości agent handoff.
   */
  afterCall(ctx: Pick<ToolCallContext, "taskId" | "toolName">): void {
    if (ctx.toolName.startsWith("agent_") || ctx.toolName.includes("run_agent")) {
      const currentDepth = this.agentDepths.get(ctx.taskId) || 0;
      if (currentDepth > 0) {
        this.agentDepths.set(ctx.taskId, currentDepth - 1);
      }
    }
  }

  /**
   * Inicjalizuje liczniki dla nowego taska.
   * Wywołaj przed rozpoczęciem tool loop.
   */
  initTask(taskId: string): void {
    this.callCounters.set(taskId, 0);
    this.taskStartTimes.set(taskId, Date.now());
    this.hashRegistry.set(taskId, []);
    // Agent depth nie inicjalizujemy — startuje od 0 (undefined → 0)
  }

  /**
   * Resetuje wszystkie liczniki dla taska po zakończeniu.
   */
  resetTask(taskId: string): void {
    this.callCounters.delete(taskId);
    this.agentDepths.delete(taskId);
    this.taskStartTimes.delete(taskId);
    this.hashRegistry.delete(taskId);
  }

  /**
   * Sprawdza czy task przekroczył timeout.
   */
  isTimedOut(taskId: string): boolean {
    const startTime = this.taskStartTimes.get(taskId);
    if (!startTime) return false;
    return (Date.now() - startTime) / 1000 > this.config.taskTimeoutSeconds;
  }

  /**
   * Zwraca aktualny stan liczników dla taska (debugging).
   */
  getTaskState(taskId: string): {
    callCount: number;
    agentDepth: number;
    elapsedSeconds: number;
    hashCount: number;
  } {
    return {
      callCount: this.callCounters.get(taskId) || 0,
      agentDepth: this.agentDepths.get(taskId) || 0,
      elapsedSeconds: this.taskStartTimes.has(taskId)
        ? (Date.now() - (this.taskStartTimes.get(taskId) || Date.now())) / 1000
        : 0,
      hashCount: (this.hashRegistry.get(taskId) || []).length,
    };
  }

  /**
   * Emituje event o naruszeniu limitu.
   */
  private emitBreach(
    taskId: string,
    agentId: string,
    kind: string,
    detail: string
  ): void {
    emitEvent({
      type: "event",
      kind: "tool_call",
      sessionId: taskId,
      data: {
        event: "circuit_breach",
        agentId,
        kind,
        detail,
        timestamp: new Date().toISOString(),
      } as Record<string, unknown>,
    });
  }

  /**
   * Aktualizuje konfigurację (runtime).
   */
  updateConfig(config: Partial<ToolCircuitBreakerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Zwraca aktualną konfigurację.
   */
  getConfig(): ToolCircuitBreakerConfig {
    return { ...this.config };
  }
}

// ─── Singleton ─────────────────────────────────────────────────

export const toolBreaker = new ToolCircuitBreaker();

// ─── Eksport klasy dla testów ──────────────────────────────────

export { ToolCircuitBreaker };
export type { ToolCircuitBreakerConfig };
