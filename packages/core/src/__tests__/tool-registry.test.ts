// Tool registry tests
import { describe, it, expect } from "bun:test";
import { listTools, getTool, registerTool } from "../plugin/tools.ts";

describe("Tool Registry", () => {
  it("lists built-in tools", () => {
    const tools = listTools();
    expect(tools.length).toBeGreaterThanOrEqual(3);
  });

  it("finds tools by name", () => {
    const tool = getTool("get_current_time");
    expect(tool).toBeTruthy();
    expect(tool!.name).toBe("get_current_time");
  });

  it("finds calculate tool", () => {
    const tool = getTool("calculate");
    expect(tool).toBeTruthy();
    expect(tool!.parameters).toBeTruthy();
  });

  it("finds web_fetch tool", () => {
    const tool = getTool("web_fetch");
    expect(tool).toBeTruthy();
    expect(tool!.description).toBeTruthy();
  });

  it("registers custom tools", () => {
    registerTool({
      name: "test_tool",
      description: "A test tool",
      parameters: { type: "object", properties: {}, additionalProperties: false },
      async execute() { return "test result"; },
    });
    const tool = getTool("test_tool");
    expect(tool).toBeTruthy();
  });
});
