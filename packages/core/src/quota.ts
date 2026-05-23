// Quota system — per-session and per-day budget enforcement (1:1 z CheetahClaws)
interface Usage {
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

const sessionUsage = new Map<string, Usage>();
let dailyUsage: Usage = { inputTokens: 0, outputTokens: 0, cost: 0 };
let lastDayReset = Date.now();

const DEFAULT_MAX_SESSION_COST = 0.50;
const DEFAULT_MAX_DAILY_COST = 5.00;

function getDayStart(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function checkQuota(sessionId: string, config?: { maxSessionCost?: number; maxDailyCost?: number }): void {
  const now = Date.now();
  if (now - lastDayReset > 86400000) {
    dailyUsage = { inputTokens: 0, outputTokens: 0, cost: 0 };
    lastDayReset = getDayStart();
  }

  const session = sessionUsage.get(sessionId) || { inputTokens: 0, outputTokens: 0, cost: 0 };
  const maxSession = config?.maxSessionCost ?? DEFAULT_MAX_SESSION_COST;
  const maxDaily = config?.maxDailyCost ?? DEFAULT_MAX_DAILY_COST;

  if (session.cost >= maxSession) throw new Error(`Session cost limit ($${maxSession}) exceeded`);
  if (dailyUsage.cost >= maxDaily) throw new Error(`Daily cost limit ($${maxDaily}) exceeded`);
}

export function recordUsage(sessionId: string, inputTokens: number, outputTokens: number, cost: number): void {
  const session = sessionUsage.get(sessionId) || { inputTokens: 0, outputTokens: 0, cost: 0 };
  session.inputTokens += inputTokens;
  session.outputTokens += outputTokens;
  session.cost += cost;
  sessionUsage.set(sessionId, session);

  dailyUsage.inputTokens += inputTokens;
  dailyUsage.outputTokens += outputTokens;
  dailyUsage.cost += cost;
}

export function getUsage(sessionId: string): { session: Usage; daily: Usage } {
  return {
    session: sessionUsage.get(sessionId) || { inputTokens: 0, outputTokens: 0, cost: 0 },
    daily: dailyUsage,
  };
}

export function resetSession(sessionId: string): void {
  sessionUsage.delete(sessionId);
}
