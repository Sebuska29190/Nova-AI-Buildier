// Context compaction tests
import { describe, it, expect } from "bun:test";
import { estimateTokens, snipOldToolResults, maybeCompact } from "../compaction.ts";

describe("Context Compaction", () => {
  it("estimates tokens from messages", () => {
    const messages = [
      { role: "user", content: "Hello world" },
      { role: "assistant", content: "Hi there! How can I help?" },
    ];
    const tokens = estimateTokens(messages);
    expect(tokens).toBeGreaterThan(0);
  });

  it("snips old tool results when over limit", () => {
    const messages = [
      { role: "user", content: "Do something" },
      { role: "assistant", content: "Let me check", tool_calls: [{ function: { name: "test" } }] },
      { role: "tool", content: "Very long result ".repeat(1000), tool_call_id: "call-1" },
      { role: "assistant", content: "Done" },
    ];
    const result = snipOldToolResults(messages, 100);
    expect(result.length).toBeLessThanOrEqual(messages.length);
  });

  it("maybeCompact returns compacted flag", () => {
    const messages = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi!" },
    ];
    const result = maybeCompact(messages, "deepseek/deepseek-chat");
    expect(result.messages.length).toBeGreaterThan(0);
    expect(typeof result.compacted).toBe("boolean");
  });
});
