import { EventEmitter } from "node:events";

export type BusEvent =
  | { type: "event"; kind: "message"|"assistant"|"thinking"|"tool_call"|"tool_result"|"fallback"|"session"; sessionId: string; runId?: string; data: Record<string, unknown> }
  | { type: "result"; kind: string; sessionId: string; runId?: string; data: Record<string, unknown> }
  | { type: "done"; sessionId: string; runId?: string }
  | { type: "error"; sessionId: string; runId?: string; message: string }
  | { type: "job_done"; agentId: string; runId: string; sessionId: string; status: string; text?: string; error?: string };

const ee = new EventEmitter();
ee.setMaxListeners(200);

export function emitEvent(e: BusEvent): void {
  ee.emit(e.type, e);
}

export function onEvent(
  type: BusEvent["type"],
  fn: (e: BusEvent) => void,
): () => void {
  ee.on(type, fn);
  return () => ee.off(type, fn);
}

export function onEventKind(
  kind: string,
  fn: (e: BusEvent) => void,
): () => void {
  const handler = (e: BusEvent) => {
    if (e.type === "event" && (e as any).kind === kind) fn(e);
  };
  ee.on("event", handler);
  return () => ee.off("event", handler);
}
