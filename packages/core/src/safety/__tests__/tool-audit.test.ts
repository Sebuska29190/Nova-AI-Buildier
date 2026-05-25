/**
 * Testy jednostkowe dla ToolAuditLogger
 * 
 * Testujemy rejestrowanie, wyszukiwanie i statystyki audytu.
 * Bez LLM, bez tooli — czysta logika.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { ToolAuditLogger } from "../tool-audit.ts";

describe("ToolAuditLogger", () => {
  let audit: ToolAuditLogger;

  beforeEach(() => {
    audit = new ToolAuditLogger({ emitEvents: false, consoleLog: false, maxEntries: 100 });
  });

  it("should record a tool call and return callId", () => {
    const callId = audit.record({
      taskId: "task-1",
      agentId: "agent-1",
      toolName: "web_search",
      paramsHash: "abc123",
      resultPreview: "Result: ...",
      durationMs: 150,
      success: true,
      iteration: 0,
    });
    
    expect(callId).toMatch(/^call_\d+_\d+$/);
  });

  it("should store recorded entries", () => {
    audit.record({
      taskId: "task-1",
      agentId: "agent-1",
      toolName: "web_search",
      paramsHash: "abc123",
      resultPreview: "Results found",
      durationMs: 200,
      success: true,
      iteration: 0,
    });
    
    const entries = audit.getEntries("task-1");
    expect(entries).toHaveLength(1);
    expect(entries[0].toolName).toBe("web_search");
    expect(entries[0].durationMs).toBe(200);
    expect(entries[0].success).toBe(true);
  });

  it("should filter entries by taskId", () => {
    audit.record({ taskId: "task-1", agentId: "a1", toolName: "search", paramsHash: "h1", resultPreview: "", durationMs: 10, success: true, iteration: 0 });
    audit.record({ taskId: "task-1", agentId: "a1", toolName: "read", paramsHash: "h2", resultPreview: "", durationMs: 20, success: true, iteration: 1 });
    audit.record({ taskId: "task-2", agentId: "a2", toolName: "search", paramsHash: "h3", resultPreview: "", durationMs: 30, success: false, iteration: 0 });
    
    expect(audit.getEntries("task-1")).toHaveLength(2);
    expect(audit.getEntries("task-2")).toHaveLength(1);
    expect(audit.getEntries("task-3")).toHaveLength(0);
  });

  it("should hash params deterministically", () => {
    const hash1 = audit.hashParams({ query: "test", limit: 10 });
    const hash2 = audit.hashParams({ limit: 10, query: "test" }); // different order
    
    // Same params should produce same hash regardless of key order
    expect(hash1).toBe(hash2);
  });

  it("should produce different hashes for different params", () => {
    const hash1 = audit.hashParams({ query: "hello" });
    const hash2 = audit.hashParams({ query: "world" });
    
    expect(hash1).not.toBe(hash2);
  });

  it("should count hash occurrences in a task", () => {
    audit.record({ taskId: "task-1", agentId: "a1", toolName: "search", paramsHash: "same", resultPreview: "", durationMs: 10, success: true, iteration: 0 });
    audit.record({ taskId: "task-1", agentId: "a1", toolName: "search", paramsHash: "same", resultPreview: "", durationMs: 10, success: true, iteration: 1 });
    audit.record({ taskId: "task-1", agentId: "a1", toolName: "read", paramsHash: "other", resultPreview: "", durationMs: 10, success: true, iteration: 2 });
    
    expect(audit.countHashInTask("task-1", "same")).toBe(2);
    expect(audit.countHashInTask("task-1", "other")).toBe(1);
    expect(audit.countHashInTask("task-1", "nonexistent")).toBe(0);
  });

  it("should respect maxEntries limit", () => {
    audit = new ToolAuditLogger({ emitEvents: false, consoleLog: false, maxEntries: 3 });
    
    // Add 5 entries — only last 3 should be kept
    for (let i = 0; i < 5; i++) {
      audit.record({ taskId: `task-${i}`, agentId: "a1", toolName: "t", paramsHash: `h${i}`, resultPreview: "", durationMs: i, success: true, iteration: i });
    }
    
    const stats = audit.getStats();
    expect(stats.totalCalls).toBe(3); // only 3 kept
  });

  it("should get recent entries", () => {
    for (let i = 0; i < 10; i++) {
      audit.record({ taskId: "task-1", agentId: "a1", toolName: `tool-${i}`, paramsHash: `h${i}`, resultPreview: "", durationMs: i, success: true, iteration: i });
    }
    
    const recent = audit.getRecent(3);
    expect(recent).toHaveLength(3);
    expect(recent[0].toolName).toBe("tool-7");
    expect(recent[2].toolName).toBe("tool-9");
  });

  it("should clear all entries", () => {
    audit.record({ taskId: "task-1", agentId: "a1", toolName: "search", paramsHash: "h1", resultPreview: "", durationMs: 10, success: true, iteration: 0 });
    audit.record({ taskId: "task-2", agentId: "a1", toolName: "read", paramsHash: "h2", resultPreview: "", durationMs: 20, success: true, iteration: 0 });
    
    expect(audit.getStats().totalCalls).toBe(2);
    
    audit.clear();
    
    expect(audit.getStats().totalCalls).toBe(0);
  });

  it("should compute correct stats", () => {
    audit.record({ taskId: "task-1", agentId: "a1", toolName: "search", paramsHash: "h1", resultPreview: "", durationMs: 10, success: true, iteration: 0 });
    audit.record({ taskId: "task-1", agentId: "a1", toolName: "search", paramsHash: "h2", resultPreview: "", durationMs: 10, success: true, iteration: 1 });
    audit.record({ taskId: "task-1", agentId: "a1", toolName: "read", paramsHash: "h3", resultPreview: "", durationMs: 10, success: true, iteration: 2 });
    audit.record({ taskId: "task-2", agentId: "a2", toolName: "write", paramsHash: "h4", resultPreview: "", durationMs: 10, success: false, iteration: 0 });
    
    const stats = audit.getStats();
    expect(stats.totalCalls).toBe(4);
    expect(stats.uniqueTools).toBe(3); // search, read, write
    expect(stats.uniqueTasks).toBe(2); // task-1, task-2
  });
});
