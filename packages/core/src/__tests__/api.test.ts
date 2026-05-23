// API tests — using Bun built-in test runner
import { describe, it, expect, beforeAll } from "bun:test";
import { registry } from "../plugin/registry.ts";
import { sessionManager } from "../session/manager.ts";
import { memoryStore } from "../memory/store.ts";
import { createTask, listTasks } from "../task/store.ts";
import { makeSnapshot, listSnapshots } from "../checkpoint/store.ts";
import { subscribe } from "../monitor/scheduler.ts";
import { classifyError } from "../error-classifier.ts";
import { getBreaker } from "../circuit-breaker.ts";

beforeAll(() => {
  sessionManager.init(process.cwd() + "/test_memory.db");
  memoryStore.init();
});

describe("Session", () => {
  it("creates and retrieves sessions", () => {
    const s = sessionManager.createSession("deepseek/deepseek-chat");
    expect(s.id).toBeTruthy();
    const got = sessionManager.getSession(s.id);
    expect(got).toBeTruthy();
  });
});

describe("Memory", () => {
  it("saves and searches memory", () => {
    const entry = memoryStore.save("test", "test content", ["test"]);
    expect(entry.id).toBeTruthy();
    const results = memoryStore.search("test");
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Tasks", () => {
  it("creates and lists tasks", () => {
    const task = createTask("Test task", "Description", "high");
    expect(task.title).toBe("Test task");
    expect(listTasks().length).toBeGreaterThanOrEqual(1);
  });
});

describe("Error Classifier", () => {
  it("classifies auth errors", () => {
    const result = classifyError(new Error("401 Unauthorized: API key invalid"));
    expect(result.category).toBe("AUTH_ERROR");
    expect(result.retryable).toBe(false);
  });

  it("classifies rate limits", () => {
    const result = classifyError(new Error("429 Too Many Requests: rate limit exceeded"));
    expect(result.category).toBe("RATE_LIMIT");
    expect(result.retryable).toBe(true);
  });
});

describe("Circuit Breaker", () => {
  it("starts CLOSED and transitions to OPEN", () => {
    const cb = getBreaker("test-provider");
    expect(cb.allowRequest()).toBe(true);
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.allowRequest()).toBe(false);
  });
});

describe("Checkpoints", () => {
  it("creates snapshots", () => {
    const snap = makeSnapshot("test snapshot", []);
    expect(snap.id).toBeTruthy();
    expect(listSnapshots().length).toBeGreaterThanOrEqual(1);
  });
});

describe("Monitor", () => {
  it("subscribes to topics", () => {
    const sub = subscribe("AI news", ["arxiv"], 60);
    expect(sub.topic).toBe("AI news");
  });
});
