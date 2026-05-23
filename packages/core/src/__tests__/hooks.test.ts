// Hooks registry tests
import { describe, it, expect } from "bun:test";
import { registerHook, runHooks } from "../hooks/registry.ts";

describe("Hooks Registry", () => {
  it("registers and runs hooks", async () => {
    let ran = false;
    registerHook("test-hook", async () => { ran = true; });
    await runHooks("test-hook");
    expect(ran).toBe(true);
  });

  it("passes context to hooks", async () => {
    let ctxValue: any = null;
    registerHook("ctx-hook", async (ctx) => { ctxValue = ctx; });
    await runHooks("ctx-hook", { key: "value" });
    expect(ctxValue).toBeTruthy();
    expect(ctxValue!.key).toBe("value");
  });
});
