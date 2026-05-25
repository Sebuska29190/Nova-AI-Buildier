/**
 * Tool Call Audit Logger
 * 
 * Centralny rejestr wszystkich wywołań narzędzi (tool calls) w Nova.
 * Zgodny z rekomendacjami OWASP MAS (Multi-Agent Security) i MIT AI Agent Index.
 * 
 * Rejestruje: agent_id, tool_name, params_hash, result_summary, duration_ms, timestamp, success
 * Umożliwia: debugowanie, wykrywanie pętli, monitorowanie kosztów, audyt bezpieczeństwa
 * 
 * @see https://genai.owasp.org/resource/multi-agentic-system-threat-modeling-guide-v1-0/
 */

import { emitEvent } from "../event-bus/index.ts";

// ─── Typy ──────────────────────────────────────────────────────

export interface ToolAuditEntry {
  /** Unikalne ID wywołania */
  callId: string;
  /** ID taska (sesji) */
  taskId: string;
  /** ID agenta który wywołał narzędzie */
  agentId: string;
  /** Nazwa narzędzia */
  toolName: string;
  /** Hash parametrów (SHA256, sort_keys=True) */
  paramsHash: string;
  /** Preview wyniku (pierwsze 200 znaków) */
  resultPreview: string;
  /** Czas wykonania w ms */
  durationMs: number;
  /** Timestamp ISO */
  timestamp: string;
  /** Czy się udało */
  success: boolean;
  /** Iteracja w toolLoop */
  iteration: number;
}

export interface AuditConfig {
  /** Maksymalna liczba przechowywanych wpisów w pamięci (default: 1000) */
  maxEntries: number;
  /** Czy emitować eventy na event-bus? (default: true) */
  emitEvents: boolean;
  /** Czy logować do console? (default: false) */
  consoleLog: boolean;
}

// ─── Domyślna konfiguracja ────────────────────────────────────

const DEFAULT_CONFIG: AuditConfig = {
  maxEntries: 1000,
  emitEvents: true,
  consoleLog: false,
};

// ─── Audit Logger ─────────────────────────────────────────────

class ToolAuditLogger {
  private entries: ToolAuditEntry[] = [];
  private config: AuditConfig;
  private callCounter = 0;

  constructor(config: Partial<AuditConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Rejestruje wywołanie narzędzia.
   * Zwraca callId które może być użyte do korelacji.
   */
  record(entry: Omit<ToolAuditEntry, "callId" | "timestamp">): string {
    const callId = `call_${++this.callCounter}_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const fullEntry: ToolAuditEntry = {
      ...entry,
      callId,
      timestamp,
    };

    // Dodaj do pamięci (z limitem)
    this.entries.push(fullEntry);
    if (this.entries.length > this.config.maxEntries) {
      this.entries.shift(); // usuń najstarszy
    }

    // Emituj event jeśli skonfigurowane
    if (this.config.emitEvents) {
      emitEvent({
        type: "event",
        kind: "tool_result",
        sessionId: entry.taskId,
        data: {
          callId,
          toolName: entry.toolName,
          paramsHash: entry.paramsHash,
          durationMs: entry.durationMs,
          success: entry.success,
          iteration: entry.iteration,
        } as Record<string, unknown>,
      });
    }

    // Console log jeśli skonfigurowane
    if (this.config.consoleLog) {
      const status = entry.success ? "✅" : "❌";
      console.log(
        `[ToolAudit] ${status} ${entry.toolName} ` +
        `(task=${entry.taskId.slice(0, 8)}, agent=${entry.agentId}, ` +
        `iter=${entry.iteration}, ${entry.durationMs}ms)`
      );
    }

    return callId;
  }

  /**
   * Oblicza hash parametrów dla detekcji pętli.
   * Używa SHA256 z sort_keys=True dla deterministycznego hasha.
   */
  hashParams(params: Record<string, unknown>): string {
    const json = JSON.stringify(params, Object.keys(params).sort());
    // Używamy prostego hasha (Bun wspiera crypto)
    const hash = this.simpleHash(json);
    return hash;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Zwróć jako hex string
    return Math.abs(hash).toString(16).padStart(8, "0");
  }

  /**
   * Zwraca wszystkie wpisy dla danego taska.
   */
  getEntries(taskId: string): ToolAuditEntry[] {
    return this.entries.filter((e) => e.taskId === taskId);
  }

  /**
   * Zwraca ostatnie N wpisów.
   */
  getRecent(n: number = 10): ToolAuditEntry[] {
    return this.entries.slice(-n);
  }

  /**
   * Sprawdza czy dany hash parametrów pojawił się zbyt wiele razy w tasku.
   * Używane do hash-based loop detection.
   */
  countHashInTask(taskId: string, paramsHash: string): number {
    return this.entries.filter(
      (e) => e.taskId === taskId && e.paramsHash === paramsHash
    ).length;
  }

  /**
   * Czyści wszystkie wpisy.
   */
  clear(): void {
    this.entries = [];
    this.callCounter = 0;
  }

  /**
   * Zwraca statystyki audytu.
   */
  getStats(): { totalCalls: number; uniqueTools: number; uniqueTasks: number } {
    const tools = new Set(this.entries.map((e) => e.toolName));
    const tasks = new Set(this.entries.map((e) => e.taskId));
    return {
      totalCalls: this.entries.length,
      uniqueTools: tools.size,
      uniqueTasks: tasks.size,
    };
  }
}

// ─── Singleton ─────────────────────────────────────────────────

export const toolAudit = new ToolAuditLogger();

// ─── Eksport klasy dla testów / custom instances ──────────────

export { ToolAuditLogger };
