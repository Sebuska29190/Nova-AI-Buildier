# Agent Memory

Last consolidated: 2026-06-18T13:30:49.093Z
Total memories: 43

## Key Learnings

- ★★★★★ record()` never called from runner | 🟡 Medium | `runner.
- ★★★★★ | 3 | `maybeCreateSkill()` undefined — crash on success | 🔴 Critical | `runner.
- ★★★★★ append()` never called | 🔴 Critical | `runner.
- ★★★★★ | 1 | `toolLoop()` body truncated — safety layer dead | 🔴 Critical | `runner.
- ★★★★★ **Impact:** Tool audit logging (hash-based loop detection, call logging, event emission) is fully implemented but **never wired into the tool execution loop**.
- ★★★★★ ts:16` | `workspace_read_file` | `toolAudit` imported but NEVER called | `import { toolAudit } from ".
- ★★★★★ ts:15` | `workspace_read_file` | `workspaceManager` imported but NEVER called | `import { workspaceManager } from ".
- ★★★★★ ts:14` | `workspace_read_file` | `usageTracker` imported but NEVER called | `import { usageTracker } from ".
- ★★★★★ But even more concerning: the function might have been planned but never implemented.
- ★★★★★ | 2 | Entire project | `workspace_search_files("maybeCreateSkill")` | Function `maybeCreateSkill` is NEVER defined | **0 results** — not in `runner.
- ★★★★★ — is **never invoked**.
- ★★★★★ ts:17` | `workspace_read_file` | `toolBreaker` IS imported but NEVER called | `import { toolBreaker } from ".
- ★★★★★ This is the most critical finding — the entire safety layer is **dead code**.
- ★★★★★ The imports exist, the classes are defined, but `beforeCall`, `initTask`, `record()`, and `append()` are never invoked.
- ★★★★★ recordFailure()` but never `toolBreaker.
- ★★★★★ **Detail:** The config default says `maxToolCallsPerTask: 50` but since `beforeCall` is never invoked, this value is purely decorative.
- ★★★★★ ts:67` | `workspace_read_file` | `maxToolCallsPerTask: 50` defined but bound never checked | `maxToolCallsPerTask: 50` — no loop in runner.
- ★★★★★ **Detail:** The multi-agent chamber system (`runRoom` and `spawnSubAgent` patterns) call `runAgent()` but never pass or initialize `toolBreaker` context.
- ★★★★★ ts` but never invoked.
- ★★★★★ record()` is never called.