---
tags: [agent-report, code-reviewer]
scope: project
created_at: 2026-05-20T01:47:43.016Z
importance: medium
---
## Background Agent Report: Code Reviewer

**Agent:** Code Reviewer (code-reviewer)
**Run ID:** 8989b067
**Started:** 2026-05-20T01:46:34.574Z
**Completed:** 2026-05-20T01:47:43.016Z
**Model:** deepseek/deepseek-chat

### Result

Now I have a thorough picture of the documentation across the codebase. Here is my complete analysis:

---

## 📋 Code Review Report: Bugs in Function Documentation

### Summary
| Metric | Value |
|---|---|
| Files reviewed | 32 |
| Lines analyzed | ~4,000 |
| Issues found | 18 |

---

### 🔴 **Critical Issues (3)**

---

#### 1. `packages/core/src/agent/scheduler.ts` — `scheduleRecurring()` doc contradicts implementation
**File:** `packages/core/src/agent/scheduler.ts`, line 155

```typescript
/** Schedule a recurring background task for an agent */
scheduleRecurring(agentId: string, intervalMs: number, task?: string): void {
```

**Bug:** The doc says it schedules a recurring background "task," but on line 170:

```typescript
await this.startAgent(agentId, task);  // task is a string, but startAgent expects opts?: { task?: string; workspace?: string }
```

The `startAgent()` signature is:
```typescript
async startAgent(agentId: string, opts?: { task?: string; workspace?: string })
```

So passing `task` (a `string`) directly as the second argument is a **type mismatch**. The code should be `await this.startAgent(agentId, { task })`. The documentation describes the function as fully working, but the implementation has a silent bug that would cause `task` to be treated as an options object.

---

#### 2. `packages/core/src/agent/scheduler.ts` — `stopAgent()` doc says "completed" but code contradicts
**File:** `packages/core/src/agent/scheduler.ts`, line 128

```typescript
job.status = "completed";
```

The `BackgroundJob` interface defines `status: "running" | "completed" | "error"`. When stopping an agent, the code sets `job.status = "completed"` even though the agent was **stopped/cancelled**, not completed. The doc should note this distinction — or the status should be changed to a different value (like `"cancelled"`).

---

#### 3. `packages/core/src/compaction.ts` — `snipOldToolResults()` undocumented magic number
**File:** `packages/core/src/compaction.ts`, line 26

```typescript
for (let i = 0; i < result.length - 3; i++) {
```

The `- 3` is undocumented. The function snips old tool results but **always preserves the last 3 messages**. The JSDoc says nothing about this behavior, which is a significant design detail. If someone modifies this without understanding the reasoning, they could break context ordering.

---

### 🟡 **Warnings (9)**

---

#### 4. `packages/core/src/agent/store.ts` — `syncSkills()` doc misleading: "empty" vs "different"
**File:** `packages/core/src/agent/store.ts`, line 80

```typescript
/**
 * Sync skills for an existing agent. Only updates if the agent has empty or different skills.
 */
syncSkills(id: string, skills: string[]): boolean {
```

**Bug:** The doc says "Only updates if the agent has **empty** or **different** skills." But the code actually performs a **set comparison** (`!skills.every(s => current.includes(s)) || !current.every(s => skills.includes(s))`) — this will update if there's *any* difference, not just when skills are empty. The word "empty" is misleading; even 10 skills would trigger an update if ordering differs.

---

#### 5. `packages/core/src/agent/scheduler.ts` — `listJobs()` incomplete return type in doc
**File:** `packages/core/src/agent/scheduler.ts`, line 38

```typescript
/** List all running background jobs */
listJobs(): Array<{ agentId: string; ...; status: string }> {
```

**Bug:** The doc says "all running background jobs" but the method returns **all** jobs (including completed and error ones), not just running ones. The return type in the doc says `status: string` but the actual type has only 3 valid values: `"running" | "completed" | "error"`.

---

#### 6. `packages/core/src/auto-bug-fixer.ts` — `runAutoBugFixer()` missing param/return docs
**File:** `packages/core/src/agent/auto-bug-fixer.ts`, line 90

```typescript
/**
 * Run the auto bug fixer on a given repo directory
 */
export async function runAutoBugFixer(repoDir: string, testCmd: string = "bun test"): Promise<string> {
```

No `@param repoDir`, no `@param testCmd`, no `@returns` documentation. The return value (`Promise<string>`) is not described.

---

#### 7. `packages/core/src/health.ts` — `getReadyzPayload()` docstring claims 1:1 port from `.py` file
**File:** `packages/core/src/health.ts`, line 1

```typescript
// Health check server (1:1 z CheetahClaws health.py)
```

This references a `health.py` file. But this is TypeScript, and there's no evidence of a `health.py` in the repository. The version is `0.6.1` (line 12) but `routes.ts` has version `0.3.0` (line 56) — two different version numbers with no doc explaining why.

---

#### 8. `packages/core/src/agent/community-agents.ts` — All 8 agents have zero JSDoc
**File:** `packages/core/src/agent/community-agents.ts`

The file header comment (lines 1-6) describes the module, but **none** of the community agent definitions have individual documentation. The `CommunityAgentDef` interface lacks field-level docs for `source`, `modelRef`, etc.

---

#### 9. `packages/core/src/auth/jwt.ts` — `registerUser()` and `loginUser()` missing DB lifecycle doc
**File:** `packages/core/src/auth/jwt.ts`, lines 65-90

Neither `registerUser()` nor `loginUser()` documents that they **open and close a SQLite database connection** on every call. This is a significant performance detail — opening a new DB connection per auth request is expensive, and there's no pooling documented.

---

#### 10. `packages/core/src/plugin/registry.ts` — Zero documentation on entire class
**File:** `packages/core/src/plugin/registry.ts`

The entire file has **no JSDoc** on any method (`registerProvider`, `registerChannel`, `getProvider`, `resolveModel`, `listModels`). The `resolveModel` function is especially important — it's called throughout the codebase but has no documentation about how model resolution works (short name vs full `provider/model` format, priority order, etc.).

---

#### 11. `packages/core/src/knowledge/store.ts` — `saveBugFix()` doc doesn't match params
**File:** `packages/core/src/knowledge/store.ts`, line 131

```typescript
/**
 * Auto-save a bug fix record
 */
saveBugFix(description: string, rootCause: string, fixApplied: string, filesChanged: string[]): KnowledgeEntry {
```

The doc says "bug fix record" but doesn't mention the 4 parameters. The developer must infer from reading the implementation. Missing `@param` tags.

---

#### 12. `packages/core/src/task/store.ts` — `createTask()` partial doc
**File:** `packages/core/src/task/store.ts`, line 31

```typescript
export function createTask(title: string, desc?: string, priority: "low" | "medium" | "high" = "medium", tags: string[] = []): Task {
```

No JSDoc at all on this public API function. Same for `listTasks`, `updateTask`, `deleteTask`.

---

### 🟢 **Suggestions (6)**

---

#### 13. `packages/core/src/plugin/loader.ts` — No module-level or function-level docs
**File:** `packages/core/src/plugin/loader.ts`

Zero documentation. `discoverPlugins()` returns `PluginEntry[]` but there's no doc explaining:
- Where it looks for plugins (the `PLUGIN_DIRS`)
- How it discovers them (looks for `nova.plugin.json` or `package.json` with `nova.plugin`)
- What the fallback behavior is

---

#### 14. `packages/core/src/skill/loader.ts` — Incomplete parse documentation
**File:** `packages/core/src/skill/loader.ts`, `parseSkill()` function

No JSDoc on the private `parseSkill()` function. This is a complex function that:
- Parses YAML frontmatter manually (not using a YAML parser)
- Extracts `triggers`, `tools`, `description`
- Has fallback logic (`if (def.triggers.length === 0) def.triggers = [name]`)
None of this edge case behavior is documented.

---

#### 15. `packages/core/src/circuit-breaker.ts` — `resetBreaker()` has no doc
**File:** `packages/core/src/circuit-breaker.ts`, line 42

```typescript
export function resetBreaker(providerId: string): void {
```

Contrast with the well-documented `getBreaker()` which returns a full interface object. `resetBreaker()` is a public API function with zero JSDoc.

---

#### 16. `packages/core/src/error-classifier.ts` — `classifyError()` `@param provider` is misleading
**File:** `packages/core/src/error-classifier.ts`, line 22

```typescript
export function classifyError(exc: unknown, provider?: string): ClassifiedError {
```

The `provider` parameter is only **passed through** to the result but never used for classification. The documentation doesn't clarify this. The parameter exists purely for informational context, but a reader would assume it affects classification.

---

#### 17. `packages/core/src/event-bus/index.ts` — `onEventKind()` undocumented parameter quirk
**File:** `packages/core/src/event-bus/index.ts`, line 22

```typescript
export function onEventKind(
  kind: string,
  fn: (e: BusEvent) => void,
): () => void {
```

No JSDoc. The function takes a `kind` string and wraps the callback, but only fires for events of type `"event"` where `(e as any).kind === kind`. This restriction is undocumented and could confuse developers who expect it to work across all event types.

---

#### 18. `packages/core/src/hooks/registry.ts` — Built-in hook has no documentation about being a no-op
**File:** `packages/core/src/hooks/registry.ts`, line 20

```typescript
registerHook("before_agent_reply", async (ctx) => {
  // console.log(`[hook] before_agent_reply: ...`);
});
```

The built-in `before_agent_reply` hook is **commented out** (it does nothing). There's no documentation explaining that this is a placeholder/extensibility hook that does nothing by default. A developer reading this might think hook logging is broken.

---

### Recommendations

| Priority | Action |
|---|---|
| 🚨 High | Fix `scheduler.ts` — `scheduleRecurring()` passes `task` as `opts` instead of `{ task }` (this is a **runtime bug** hidden by incorrect doc) |
| 🚨 High | Add JSDoc to `registry.ts` — this is a core dependency resolution class used everywhere |
| 🟡 Medium | Fix `syncSkills()` doc in `store.ts` to accurately describe the set comparison behavior |
| 🟡 Medium | Add JSDoc to public API functions in `task/store.ts`, `plugin/loader.ts`, `auth/jwt.ts` |
| 🟡 Medium | Document the `- 3` magic number in `compaction.ts` `snipOldToolResults()` |
| 🟢 Low | Document the commented-out hook behavior in `hooks/registry.ts` |
| 🟢 Low | Document the `provider` pass-through in `error-classifier.ts` |

### Session

Session ID: c5f798ce-8233-42ca-911b-0edbdf2d09e8