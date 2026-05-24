/**
 * Gateway Hooks — event hooks for the messaging gateway.
 * Plugins can register hooks for: message received, message sent, channel connected, channel disconnected, error.
 * Hooks run in order of priority (lower number = runs first).
 */
import { safeMessage } from "./errors.ts";

export type HookEvent =
  | "message_received"
  | "message_sent"
  | "channel_connected"
  | "channel_disconnected"
  | "error";

export interface HookContext {
  channelId: string;
  message?: string;
  target?: string;
  error?: string;
  userId?: string;
  timestamp: string;
}

export interface HookHandler {
  name: string;
  priority: number;
  handler: (event: HookEvent, ctx: HookContext) => Promise<void>;
}

const hooks: HookHandler[] = [];

/**
 * Register a gateway hook handler.
 * @param name Unique hook name
 * @param priority Lower number = runs first (default: 100)
 * @param handler Async handler function
 */
export function registerHook(
  name: string,
  priority: number,
  handler: (event: HookEvent, ctx: HookContext) => Promise<void>,
): void {
  // Remove existing hook with same name
  const existing = hooks.findIndex(h => h.name === name);
  if (existing >= 0) hooks.splice(existing, 1);

  hooks.push({ name, priority, handler });
  hooks.sort((a, b) => a.priority - b.priority);
}

/**
 * Remove a hook by name.
 */
export function unregisterHook(name: string): boolean {
  const idx = hooks.findIndex(h => h.name === name);
  if (idx >= 0) { hooks.splice(idx, 1); return true; }
  return false;
}

/**
 * List all registered hooks.
 */
export function listHooks(): HookHandler[] {
  return [...hooks];
}

/**
 * Fire a gateway event to all registered hooks.
 * Hooks run sequentially in priority order. Failures are logged but don't block.
 */
export async function fireEvent(event: HookEvent, ctx: Partial<HookContext>): Promise<void> {
  const fullCtx: HookContext = {
    channelId: ctx.channelId || "unknown",
    message: ctx.message,
    target: ctx.target,
    error: ctx.error,
    userId: ctx.userId,
    timestamp: new Date().toISOString(),
  };

  for (const hook of hooks) {
    try {
      await hook.handler(event, fullCtx);
    } catch (e) {
      console.warn(`[Hook] "${hook.name}" failed on ${event}: ${safeMessage(e)}`);
    }
  }
}

/**
 * Create a simple logging hook that prints gateway events to console.
 * Priority 999 = runs last.
 */
export function createLoggingHook(): HookHandler {
  return {
    name: "console-logger",
    priority: 999,
    async handler(event, ctx) {
      const icon = event === "channel_connected" ? "🔌" :
        event === "channel_disconnected" ? "🔌" :
        event === "message_received" ? "📩" :
        event === "message_sent" ? "📤" : "⚠️";
      const msg = ctx.message ? `: ${ctx.message.slice(0, 100)}` : "";
      console.log(`[Gateway Hook] ${icon} ${event} [${ctx.channelId}]${msg}`);
    },
  };
}

/**
 * Built-in analytics hook — counts events per channel.
 */
export function createAnalyticsHook(): HookHandler {
  const counts: Record<string, Record<string, number>> = {};
  return {
    name: "analytics-collector",
    priority: 50,
    async handler(event, ctx) {
      if (!counts[ctx.channelId]) counts[ctx.channelId] = {};
      counts[ctx.channelId][event] = (counts[ctx.channelId][event] || 0) + 1;
    },
    getStats: () => ({ ...counts }),
  } as any;
}
