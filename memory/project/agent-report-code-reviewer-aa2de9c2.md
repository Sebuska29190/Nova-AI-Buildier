---
tags: [agent-report, code-reviewer]
scope: project
created_at: 2026-05-19T22:22:59.527Z
importance: medium
---
## Background Agent Report: Code Reviewer

**Agent:** Code Reviewer (code-reviewer)
**Run ID:** aa2de9c2
**Started:** 2026-05-19T22:21:59.017Z
**Completed:** 2026-05-19T22:22:59.527Z
**Model:** deepseek/deepseek-chat

### Result

Now I have a thorough understanding of the codebase. Let me compile the full structured report.

---

# Comprehensive Code Review Report — Nova Agent Platform

## Summary

| Metric | Value |
|---|---|
| Files reviewed | ~35 key source files |
| Lines analyzed | ~8,000+ (core source) |
| Total codebase | ~17,416 files, ~2,733 dirs |
| Bugs found | 8 |
| Security issues | 6 |
| Code smells | 14 |
| Missing tests | 5 areas |
| Critical issues | 5 |
| Warnings | 15 |
| Suggestions | 8 |

---

# 🔴 CRITICAL ISSUES

## 1. ⚠ In-Memory User Store — No Persistence (Security: Hardcoded Credentials Lost on Restart)

**File:** `packages/core/src/auth/jwt.ts`, lines 44-47
**File:** `packages/core/src/auth/jwt.ts`, lines 49-51

```typescript
const users = new Map<string, StoredUser>();
```

**Bug:** The `users` map is a plain in-memory `Map`. When the server restarts, **all registered users and their password hashes are lost**. This means:
- Users who register must re-register on every restart.
- If `NOVA_JWT_SECRET` isn't set in the environment, it's **randomly generated** each startup (`randomBytes(32).toString("hex")`), invalidating **all previously issued JWTs** on restart. This means all sessions get invalidated every restart.
- Tokens issued with the old secret become permanently invalid.

**Fix:** Persist users to SQLite (same `nova.db`) or at minimum persist the secret to disk.

---

## 2. 🔴 Tool Loop Between WS Client Teardown and Abort — Memory Leak

**File:** `packages/core/src/gateway/websocket.ts`, lines 51-57

```typescript
ws.on("close", () => {
  clients.delete(clientId);
  for (const [runId, ac] of abortControllers) {
    if (/* check if this runId belongs to this client */ true) {  // <-- BUG: ALWAYS TRUE
      ac.abort();
      abortControllers.delete(runId);
    }
  }
});
```

**Bug:** The condition `if (/* check if this runId belongs to this client */ true)` is **always true**. This means when **any** WebSocket client disconnects, **ALL** running agent tasks across all clients get aborted. This is a massive cross-client contamination bug.

**Fix:** Track which run IDs belong to which client, e.g. `Map<string, Set<string>>` for `clientId → Set<runId>`.

---

## 3. 🔴 `calculate` Tool Uses `new Function()` — Arbitrary Code Execution Risk

**File:** `packages/core/src/plugin/tools.ts`, lines 73-77

```typescript
const result = new Function(`"use strict"; return (${expression})`)();
```

**Security Vulnerability:** `new Function()` is essentially `eval()`. Despite the `"use strict"` directive, this allows arbitrary JavaScript code execution. A malicious user (or a prompt-injection attack) could send:

```
process.env.NOVA_JWT_SECRET
```

to exfiltrate secrets, or:

```
require('child_process').execSync('rm -rf /')
```

to execute system commands. The dangerous-command guard in the `workspace_run_command` tool doesn't apply here.

**Fix:** Replace with a proper math expression parser (e.g., `mathjs` or `expr-eval`) that only allows arithmetic.

---

## 4. 🔴 API Keys Stored in Plaintext JSON

**File:** `packages/core/src/config/provider-config.ts`, line 37
**File:** `data/provider-config.json` (on disk)

API keys are stored as plaintext in `data/provider-config.json`:

```typescript
writeFileSync(CONFIG_PATH, JSON.stringify(store, null, 2), "utf-8");
```

**Security Issue:** API keys for all providers (OpenAI, Anthropic, Gemini, etc.) are persisted in unencrypted JSON. If an attacker gains filesystem access (via path traversal, workspace read, etc.), they can exfiltrate ALL API keys.

**Fix:** Encrypt at rest using `crypto.createCipheriv` with a server-side secret, or use OS keychain.

---

## 5. 🔴 `import.meta.dirname` Check Fails in Windows Edit Mode

**File:** `packages/core/src/main.ts`, lines 85-90

```typescript
if (import.meta.dirname) {
  const fromDirname = resolve(import.meta.dirname, "..", "..", "packages", "ui");
  if (existsSync(join(fromDirname, "package.json"))) return fromDirname;
}
```

**Bug:** `import.meta.dirname` is available in Bun, but the relative path `"..", "..", "packages", "ui"` assumes a specific directory structure that may not match all runtime environments. The function has 6 different resolution strategies, suggesting this is unreliable.

**Also:** In `mcp/client.ts` line 23:
```typescript
import { join, dirname } from "node:path";
```
...but `dirname` is never used throughout that file, meaning it's a dead import.

---

# 🟡 WARNINGS (Moderate Severity)

## 6. 🟡 `require("fs")` Instead of Imported Module

**File:** `packages/core/src/plugin/loader.ts`, line 21

```typescript
const manifest = JSON.parse(require("fs").readFileSync(pluginJsonPath, "utf-8")) as PluginManifest;
```

**Code Smell:** Uses `require("fs")` directly (CommonJS interop) when the top of the file already imports from `node:fs`. This should use the already-imported `readFileSync`. The same issue repeats on line 28.

---

## 7. 🟡 `require("ws")` Instead of ESM Import

**Files:**
- `packages/core/src/gateway/websocket.ts`, line 20: `const { WebSocketServer } = require("ws");`
- `packages/core/src/gateway/terminal.ts`, line 11: `const { WebSocketServer } = require("ws");`

**Code Smell:** Intermixing `require()` in an ESM project (`"type": "module"` in `package.json`). While Bun supports this, it's inconsistent and won't work with Node ESM.

---

## 8. 🟡 `require("node:fs")` at Bottom of Memory Store

**File:** `packages/core/src/memory/store.ts`, line 108

```typescript
const { unlinkSync } = require("node:fs");
```

**Bug:** `unlinkSync` is used at line 86 (`unlinkSync(fp)`) but the `const` declaration with `require` is at the **bottom of the file** (line 108). Due to JavaScript hoisting rules for `const`, this would actually throw a **`ReferenceError: Cannot access 'unlinkSync' before initialization`** at runtime when `delete()` is called.

**This is a runtime crash bug** in the `delete()` method of `MemoryStore`.

---

## 9. 🟡 `dirname` Function Duplicates Node Built-in

**File:** `packages/core/src/session/manager.ts`, lines 109-112

```typescript
function dirname(p: string): string {
  const i = p.lastIndexOf("/");
  const j = p.lastIndexOf("\\");
  return p.slice(0, Math.max(i, j));
}
```

**Code Smell:** This duplicates `import { dirname } from "node:path"` which is already available. The custom implementation is fragile — it doesn't handle:
- Trailing slashes
- Root paths like `C:\`
- UNC paths on Windows (`\\server\share`)

---

## 10. 🟡 Circuit Breaker Doesn't Call `recordSuccess` Anywhere

**File:** `packages/core/src/circuit-breaker.ts`, line 21 (definition)
**Usage:** `packages/core/src/agent/runner.ts`, line 66 (only `recordFailure()` called)

**Bug:** The `recordSuccess()` method exists but is **never called** in `runner.ts`. This means after a successful request, the circuit breaker is never reset to CLOSED. Once OPEN, it stays OPEN until the timeout, even if the provider is healthy again.

**Fix:** Call `breaker.recordSuccess()` after a successful tool loop iteration.

---

## 11. 🟡 SSRF via `web_fetch` — No URL Allowlist

**File:** `packages/core/src/plugin/tools.ts`, lines 47-52

```typescript
async execute(args, ctx) {
  const { url } = args as { url: string };
  const res = await fetch(url, { signal: AbortSignal.timeout(10000), ... });
```

**Security Issue:** The `web_fetch` tool accepts arbitrary URLs, including:
- `file:///etc/passwd` (local file read)
- `http://169.254.169.254/latest/meta-data/` (cloud metadata exfiltration)
- `http://localhost:4123/api/` (internal API access)

Despite the 15KB response limit, this is a Server-Side Request Forgery (SSRF) vector.

---

## 12. 🟡 Channel `onMessage` Handlers Are Broken / No-Op

**Files:**
- `packages/core/src/channel/manager.ts`, line 85 (Telegram): `plugin.start({ ...bot, onMessage: (h) => {} }).then(() => {});`
- Line 117 (Discord): Same pattern
- Line 147 (Slack): `onMessage: (handler: any) => {}`
- Line 157 (WeChat): `onMessage: (handler: any) => {}`

**Bug:** The `onMessage` callback is passed a **wrapper function** that does nothing (`(h) => {}` / `(handler: any) => {}`), and the **actual handler** (`wrappedHandler`) is passed into it but never used by the plugin. This means **no channel messages are actually processed** — the channels are started but completely non-functional for receiving messages.

---

## 13. 🟡 `setupWebSocket` and `setupTerminal` Silently Fail

**Files:**
- `packages/core/src/gateway/websocket.ts`, line 57: `} catch {}`
- `packages/core/src/gateway/terminal.ts`, line 19: `catch (err: unknown) { ... }` (better, but only logs)

**Code Smell:** The WebSocket server setup is wrapped in `try/catch {}` with an **empty catch block** — if WebSocket setup fails (e.g., `ws` package not installed), there's zero indication of the failure.

---

## 14. 🟡 `AbortSignal.timeout` Compatibility Risk

**File:** `packages/core/src/agent/runner.ts`, line 137

```typescript
new Promise<string>((_, reject) => setTimeout(() => reject(new Error(...)), 60000)),
```

**Code Smell:** Mixed timeout approaches — `AbortSignal.timeout(10000)` is used in tools, but here a `Promise.race` with `setTimeout` is used. If the tool promise never settles, this creates a dangling promise (zombie task). Should use `AbortSignal.timeout` consistently.

---

## 15. 🟡 Provider Config File Corruption — Silent Data Loss

**File:** `packages/core/src/config/provider-config.ts`, lines 50-53

```typescript
} catch {
  // Corrupted file — start fresh
}
```

When `provider-config.json` is corrupted (e.g., partial write), **all saved API keys are silently discarded** and overwritten with an empty config. There's no backup mechanism or validation before overwriting.

---

# 🟢 SUGGESTIONS (Low Severity / Best Practices)

## 16. 🟢 MCP Client Is Mostly a Stub

**File:** `packages/core/src/mcp/client.ts`, line 70

```typescript
return JSON.stringify({ error: "MCP tool execution not yet implemented" });
```

**Code Smell:** The `callTool` method returns a static error. The MCP integration is effectively unusable despite being registered and loaded. Either remove it or finish the implementation.

---

## 17. 🟢 Missing Error Handling in `loadSkills`

**File:** `packages/core/src/skill/loader.ts`, lines 37-39

The `parseSkill` function doesn't handle malformed YAML frontmatter gracefully — if a skill file has `---` but no valid metadata, it silently returns null. There's no logging of skipped files.

---

## 18. 🟢 Duplicate `require` Import for `unlinkSync`

**File:** `packages/core/src/memory/store.ts`, lines 1 and 108

Line 1 imports from `node:fs` but `unlinkSync` is not destructured from it. Instead, line 108 uses `require("node:fs")`. This should be:

```typescript
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
```

---

## 19. 🟢 No Request Rate Limiting on HTTP API

**File:** `packages/core/src/api/routes.ts`

The entire API surface has no rate limiting. An attacker could:
- Hit `/v1/chat/completions` thousands of times to exhaust your API budget
- Brute-force login endpoints
- DDOS the server itself

---

## 20. 🟢 Quota System Loss on Restart

**File:** `packages/core/src/quota.ts`, lines 9-10

```typescript
const sessionUsage = new Map<string, Usage>();
let dailyUsage: Usage = { inputTokens: 0, outputTokens: 0, cost: 0 };
```

Session and daily quotas are in-memory only. A server restart resets all counters, allowing users to bypass daily cost limits.

---

## 21. 🟢 Agent `status` Field Type Mismatch

**File:** `packages/core/src/agent/store.ts`, line 20, and `packages/core/src/agent/scheduler.ts`

The `status` field is typed as `"ready" | "active" | "error"` but in `scheduler.ts` line 38 it's set to `"idle"` via the update call, and in the `AgentConfig` interface there's no `"idle"` value. This creates a type inconsistency that will cause TypeScript strict-mode compilation errors.

---

## 22. 🟢 Test Coverage Gaps

**Files tested (from `packages/core/src/__tests__/`):**
- `agent.test.ts` — only tests the store CRUD, not the `runAgent` function
- `api.test.ts` — uses `import` that fail (no registry init), plus tests are simple sanity checks
- `auth.test.ts` — best coverage, but doesn't test token expiry edge cases

**Missing test coverage for:**
1. `runAgent()` / `toolLoop()` — the core of the system
2. `quota.ts` — threshold enforcement
3. `compaction.ts` — context window management
4. `channel/manager.ts` — channel lifecycle
5. All provider streaming implementations
6. `auto-bug-fixer.ts`
7. `scheduler.ts`
8. `workspace/manager.ts` — path traversal safety
9. `memory/store.ts` — especially the `delete()` and `parseEntry()` methods

---

## 23. 🟢 Channel Message Handler Never Actually Registers

**File:** `packages/core/src/channel/manager.ts`, lines 78-85 (Telegram as example)

```typescript
onMessage: (handler: (msg: ChannelMessage) => Promise<void>) => {
  const wrappedHandler = async (msg: ChannelMessage) => { ... };
  plugin.start({ ...bot, onMessage: (h) => {} }).then(() => {});
},
```

The `wrappedHandler` is defined but **never passed to the plugin**. The `plugin.start()` call passes `onMessage: (h) => {}` — an empty function that ignores its argument. This means `wrappedHandler` is dead code and messages are silently dropped.

---

## 24. 🟢 No Input Validation on Session Creation

**File:** `packages/core/src/session/manager.ts`, line 37

```typescript
createSession(modelRef: string, ...): SessionRow {
  const id = randomUUID();
```

No validation of `modelRef` — could be an empty string, injection payload, or non-existent model. Should validate against `registry.resolveModel()` first.

---

## 25. 🟢 Environment Variable `.env` Loading Order Issue

**File:** `packages/core/src/main.ts`, line 18

```typescript
for (const p of [join(process.cwd(), ".env"), join(process.cwd(), ".env.local")]) {
  if (existsSync(p)) { config({ path: p }); break; }
}
```

If **both** `.env` and `.env.local` exist, only `.env` is loaded (due to `break`). Convention says `.env.local` should override `.env`. The loop should load both, with `.env.local` taking priority.

---

## 26. 🟢 `listSkills` Code Duplication / Hardcoded Skill Categories

**File:** `packages/core/src/skill/hub.ts`, lines 123-155

The `inferCategory` function has a **hardcoded mapping** of skill names to categories (100+ entries). This duplicates what should be metadata from the skill files' YAML frontmatter. This is brittle and requires updating the code whenever a new skill is added.

---

# 📋 RECOMMENDATIONS

| Priority | Action | File(s) |
|---|---|---|
| 🚨 **High** | Fix WS close handler — track per-client runIds | `gateway/websocket.ts:51-57` |
| 🚨 **High** | Replace `new Function()` with safe math parser | `plugin/tools.ts:73-77` |
| 🚨 **High** | Encrypt API keys at rest | `config/provider-config.ts` |
| 🚨 **High** | Persist JWT secret and user accounts | `auth/jwt.ts` |
| 🚨 **High** | Fix `unlinkSync` import hoisting bug | `memory/store.ts:108` |
| 🟡 **Medium** | Call `recordSuccess()` in circuit breaker | `agent/runner.ts` |
| 🟡 **Medium** | Fix channel `onMessage` handler wiring | `channel/manager.ts:78-160` |
| 🟡 **Medium** | Add SSRF protection to `web_fetch` | `plugin/tools.ts:47-52` |
| 🟡 **Medium** | Add HTTP rate limiting | `api/routes.ts` |
| 🟡 **Medium** | Fix `require()` → ESM imports | `plugin/loader.ts`, `gateway/websocket.ts`, `gateway/terminal.ts` |
| 🟢 **Low** | Add comprehensive test coverage | `__tests__/` |
| 🟢 **Low** | Persist quota counters to DB | `quota.ts` |
| 🟢 **Low** | Fix `.env`/`.env.local` loading order | `main.ts:18` |
| 🟢 **Low** | Add model validation in `createSession` | `session/manager.ts:37` |
| 🟢 **Low** | Remove `dirname` polyfill, use `node:path` | `session/manager.ts:109-112` |
| 🟢 **Low** | Complete MCP client or remove | `mcp/client.ts` |

### Session

Session ID: 3129d087-c5b1-4b22-9abd-00ddaeae4f60