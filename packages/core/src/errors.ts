/**
 * Safely extract a human-readable error message from any thrown value.
 * In JavaScript/Bun, anything can be thrown (including `undefined`),
 * so accessing `.message` directly on a caught value is unsafe.
 */
export function safeMessage(e: unknown, fallback = "Unknown error"): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) return String((e as any).message);
  return fallback;
}
