// Event bus tests
import { describe, it, expect } from "bun:test";
import { emitEvent, onEvent, onEventKind } from "../event-bus/index.ts";

describe("Event Bus", () => {
  it("emits and receives events", () => {
    let received: any = null;
    const unsub = onEvent("event", (event) => { received = event; });
    emitEvent({ type: "event", kind: "message", sessionId: "test", data: { msg: "hello" } });
    expect(received).toBeTruthy();
    expect(received.kind).toBe("message");
    unsub();
  });

  it("filters by event kind", () => {
    let received = false;
    const unsub = onEventKind("message", () => { received = true; });
    emitEvent({ type: "event", kind: "message", sessionId: "test", data: { text: "hello" } });
    expect(received).toBe(true);
    unsub();
  });

  it("does not fire for different kind", () => {
    let received = false;
    const unsub = onEventKind("message", () => { received = true; });
    emitEvent({ type: "event", kind: "tool_result", sessionId: "test", data: {} });
    expect(received).toBe(false);
    unsub();
  });
});
