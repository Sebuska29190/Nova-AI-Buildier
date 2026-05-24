/**
 * Log Capture System
 *
 * Intercepts console.log/warn/error/debug, stores entries in a ring buffer,
 * and pushes new entries to SSE subscribers.
 *
 * Usage: import "./log/capture.ts"; // auto-initializes on import
 * API endpoints: GET /api/logs, GET /api/logs/stream
 */

interface LogEntry {
  level: "info" | "warn" | "error" | "debug" | "trace";
  message: string;
  component: string;
  timestamp: string;
}

const MAX_LOG_ENTRIES = 2000;
const buffer: LogEntry[] = [];
const subscribers = new Set<(entry: LogEntry) => void>();

function push(level: LogEntry["level"], message: string, component = "system") {
  const entry: LogEntry = {
    level,
    message: String(message).slice(0, 2000),
    component,
    timestamp: new Date().toISOString(),
  };
  buffer.push(entry);
  if (buffer.length > MAX_LOG_ENTRIES) buffer.shift();
  for (const sub of subscribers) {
    try { sub(entry); } catch { /* drop dead sub */ }
  }
}

// Intercept console methods
const origLog = console.log;
const origWarn = console.warn;
const origError = console.error;
const origDebug = console.debug;
const origInfo = console.info;

function extractComponent(args: unknown[]): [string, string] {
  const first = String(args[0] ?? "");
  // Detect [tag] or module: prefix
  const tagMatch = first.match(/^\s*\[([^\]]+)\]/);
  if (tagMatch) return [tagMatch[1], args.slice(1).map(String).join(" ")];
  const modMatch = first.match(/^([a-z_/\\-]+):\s*/i);
  if (modMatch) return [modMatch[1], args.slice(1).map(String).join(" ")];
  return ["system", args.map(String).join(" ")];
}

console.log = (...args: unknown[]) => {
  const [component, msg] = extractComponent(args);
  if (component !== "system" || !msg.startsWith("[cron]") === false) {
    // still capture
  }
  push("info", msg || String(args[0] ?? ""), component);
  origLog.apply(console, args);
};

console.warn = (...args: unknown[]) => {
  const [component, msg] = extractComponent(args);
  push("warn", msg || String(args[0] ?? ""), component);
  origWarn.apply(console, args);
};

console.error = (...args: unknown[]) => {
  const [component, msg] = extractComponent(args);
  push("error", msg || String(args[0] ?? ""), component);
  origError.apply(console, args);
};

console.debug = (...args: unknown[]) => {
  const [component, msg] = extractComponent(args);
  push("debug", msg || String(args[0] ?? ""), component);
  origDebug.apply(console, args);
};

console.info = (...args: unknown[]) => {
  const [component, msg] = extractComponent(args);
  push("info", msg || String(args[0] ?? ""), component);
  origInfo.apply(console, args);
};

// Public API for routes
export const logStore = {
  list(limit = 500): LogEntry[] {
    return buffer.slice(-limit);
  },

  subscribe(cb: (entry: LogEntry) => void): () => void {
    subscribers.add(cb);
    return () => { subscribers.delete(cb); };
  },

  /** Manually push a log entry (for server-originated events) */
  log(level: LogEntry["level"], message: string, component = "system") {
    push(level, message, component);
  },
};

// Seed a startup entry
push("info", "Log capture system initialized", "system");
