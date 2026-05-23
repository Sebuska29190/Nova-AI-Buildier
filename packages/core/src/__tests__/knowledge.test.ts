// Knowledge Base tests
import { describe, it, expect, beforeAll } from "bun:test";
import { knowledgeBase } from "../knowledge/store.ts";

const TEST_DIR = process.cwd() + "/test_knowledge";

beforeAll(() => {
  knowledgeBase.init(TEST_DIR);
});

describe("Knowledge Base", () => {
  it("saves entries with auto-categorization", () => {
    const entry = knowledgeBase.save({
      title: "Test entry",
      content: "This is a test knowledge entry",
      tags: ["test"],
    });
    expect(entry.id).toBeTruthy();
    expect(entry.category).toBeTruthy();
  });

  it("saves bug fix entries", () => {
    const entry = knowledgeBase.saveBugFix(
      "Test bug fix",
      "Root cause was X",
      "Applied fix Y",
      ["file1.ts", "file2.ts"]
    );
    expect(entry.category).toBe("bug-fix");
    expect(entry.tags).toContain("bug-fix");
  });

  it("saves session entries", () => {
    const entry = knowledgeBase.saveSession(
      "test-session-id",
      [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ],
      "deepseek/deepseek-chat"
    );
    expect(entry.category).toBe("session");
  });

  it("lists entries by category", () => {
    const entries = knowledgeBase.listByCategory("bug-fix");
    expect(entries.length).toBeGreaterThanOrEqual(1);
  });

  it("returns stats", () => {
    const stats = knowledgeBase.getStats();
    expect(Object.keys(stats).length).toBeGreaterThan(0);
  });
});
