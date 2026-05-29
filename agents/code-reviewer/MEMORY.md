# Agent Memory

Last consolidated: 2026-05-28T17:41:38.302Z
Total memories: 10

## Key Learnings

- ★★★★★ 🔴 CRITICAL — Brak `beforeCall` w plugin/tools.
- ★★★★★ Let me know if you want me to implement the two critical fixes directly.
- ★★★★★ If someone changes `maxToolCallsPerTask` to 100 but the loop bound stays at 50, the breaker never fires.
- ★★★★★ runRoom()` and `spawnSubAgent()` call `runAgent()` directly — but they **never initialize or check** the `toolBreaker`.
- ★★★★★ record()` **never calls `ledger.
- ★★★★★ #### 🔴 **CRITICAL #2: Loop detection in runner.
- ★★★★★ #### 🔴 **CRITICAL #1: `toolBreaker.
- ★★★★★ ts` `toolLoop()` never calls it.
- ★★★★★ beforeCall(ctx)` but never calls `toolAudit.
- ★★★★★ **🔴 CRITICAL — Issue #1: `toolAudit.