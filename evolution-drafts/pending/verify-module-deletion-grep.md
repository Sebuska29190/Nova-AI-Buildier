# Verify Module Deletion — Grep Entire Codebase Before Declaring Done

## Rule

**When deleting a module, directory, or feature, run a recursive grep across the entire codebase for every removed name (module paths, export names, function names, string identifiers) before considering the task complete.** Do not stop at deleting the main file and obvious imports.

## Why

Incomplete deletions cause runtime errors that only surface later — broken imports, dangling tool registrations, and orphaned dynamic references that fail at startup or when the feature is invoked.

Real examples from 2026-06-18:
- **Browser module cleanup:** deleted the main module file but missed tool registrations in `community-skills.ts` → runtime error
- **Computer-use module cleanup:** deleted `computer-use.ts` but missed 6 tool registrations in `tools.ts` AND a dynamic import in `community-skills.ts` → another runtime error

Both times the same mistake: "file deleted, looks clean" without verifying the full reference graph.

## Verification Procedure

After removing module files, run these REQUIRED checks before declaring done:

```powershell
# 1. Grep for the module path/name
rg -i "module-name" --type ts --type tsx .

# 2. Grep for every exported function/tool name
rg -i "computer_type|computer_key_press|computer_cursor_pos" --type ts --type tsx .

# 3. Check dynamic imports and lazy loads
rg "import\(" --type ts --type tsx . | rg "module-name"

# 4. Check tool registrations, config maps, plugin lists
rg "registerTool|tools\.push|toolMap" --type ts --type tsx . | rg "module-name"
```

**If any grep returns results** → the deletion is incomplete. Remove those references before declaring done.

## Key Principle

"File deleted" ≠ "module deleted." A module is only truly deleted when ZERO references exist anywhere in the codebase. A single leftover import or string reference is a future runtime error waiting to happen.

## Source

Two runtime errors on 2026-06-18 during Phase 0 cleanup: browser module references left in community-skills.ts, and computer-use module references left in both tools.ts and community-skills.ts.

---

*Proposed for: AGENTS.md — Behavior/process rules (Development section)*
