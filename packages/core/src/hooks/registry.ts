// Hooks system — before/after tool calls, lifecycle events
type HookFn = (ctx: Record<string, unknown>) => Promise<void>;

const hooks = new Map<string, HookFn[]>();

export function registerHook(name: string, fn: HookFn): void {
  const list = hooks.get(name) || [];
  list.push(fn);
  hooks.set(name, list);
}

export async function runHooks(name: string, ctx: Record<string, unknown> = {}): Promise<void> {
  const list = hooks.get(name);
  if (!list) return;
  for (const fn of list) {
    try { await fn(ctx); } catch {}
  }
}

// Built-in hooks
registerHook("before_agent_reply", async (ctx) => {
  // console.log(`[hook] before_agent_reply: ${JSON.stringify(ctx).slice(0, 100)}`);
});
