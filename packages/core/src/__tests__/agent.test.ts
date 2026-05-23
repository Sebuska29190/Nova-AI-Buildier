// Agent store tests
import { describe, it, expect, beforeAll } from "bun:test";
import { agentStore } from "../agent/store.ts";

beforeAll(() => {
  agentStore.init(":memory:");
});

describe("Agent Store", () => {
  it("creates agents", () => {
    const agent = agentStore.create({
      name: "test-agent",
      description: "Test agent",
      modelRef: "deepseek/deepseek-chat",
      emoji: "🤖",
    });
    expect(agent.id).toBeTruthy();
    expect(agent.name).toBe("test-agent");
  });

  it("lists agents", () => {
    const agents = agentStore.list();
    expect(agents.length).toBeGreaterThanOrEqual(1);
  });

  it("gets agent by id", () => {
    const agents = agentStore.list();
    const agent = agentStore.get(agents[0].id);
    expect(agent).toBeTruthy();
    expect(agent!.name).toBeTruthy();
  });

  it("updates agents", () => {
    const agents = agentStore.list();
    const updated = agentStore.update(agents[0].id, { description: "Updated description" });
    expect(updated).toBeTruthy();
    expect(updated!.description).toBe("Updated description");
  });

  it("lists agent workspace files", () => {
    const agents = agentStore.list();
    const files = agentStore.listFiles(agents[0].id);
    expect(files.length).toBeGreaterThan(0);
  });

  it("deletes agents", () => {
    const agent = agentStore.create({ name: "delete-me", modelRef: "deepseek/deepseek-chat" });
    const deleted = agentStore.delete(agent.id);
    expect(deleted).toBe(true);
  });
});
