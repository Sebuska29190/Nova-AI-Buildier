# Agent Memory

Last consolidated: 2026-06-18T13:33:19.961Z
Total memories: 20

## Key Learnings

- ★★★★★ | 2 | **`maybeCreateSkill()` undefined** — crash on success | 🔴 Critical | `runner.
- ★★★★★ | 3 | **`ledger` never called** — no audit trail | 🔴 Critical | `runner.
- ★★★★★ | 1 | **`toolLoop()` truncated** — empty body | 🔴 Critical | `runner.
- ★★★★★ Less critical than circuit breaker/ledger but makes troubleshooting production issues much harder.
- ★★★★★ **DevOps Impact:** Tool audit logging (debuggability, loop detection, history) is fully implemented but never wired.
- ★★★★★ ts:14` | `workspace_read_file` | `workspaceManager` imported but **never called** | `import { workspaceManager } from ".
- ★★★★★ ts:13` | `workspace_read_file` | `usageTracker` imported but **never called** | `import { usageTracker } from ".
- ★★★★★ I have independently verified every critical claim by reading the **actual source files**.
- ★★★★★ The `toolLoop` truncation and `maybeCreateSkill` are the most critical from an ops perspective.
- ★★★★★ record()` never called | 🟡 Medium | `runner.
- ★★★★★ | 3 | `maybeCreateSkill()` undefined — crash on success | 🔴 Critical | `runner.
- ★★★★★ append()` never called | 🔴 Critical | `runner.
- ★★★★★ | 1 | `toolLoop()` truncated — circuit breaker dead | 🔴 Critical | `runner.
- ★★★★★ This is less critical than the circuit breaker but means **no debuggability** for tool call issues.
- ★★★★★ **DevOps Impact:** Tool audit logging (hash-based loop detection, call logging, event emission) is fully implemented but never wired into the tool execution loop.
- ★★★★★ These modules exist (both fully implemented), but the runner never initializes or uses them.
- ★★★★★ ts:14` | `workspace_search_files` | `workspaceManager` imported but never called | `import { workspaceManager } from ".
- ★★★★★ ts:13` | `workspace_search_files` | `usageTracker` imported but never called | `import { usageTracker } from ".
- ★★★★★ **🚨 DevOps Impact:** This is a **critical production risk**.
- ★★★★★ ts:17` | `workspace_read_file` | `toolBreaker` IS imported but NEVER called | `import { toolBreaker } from ".