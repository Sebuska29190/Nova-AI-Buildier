# Never Rewrite Working Code — Incremental Changes Only

## Rule

**Before rewriting any existing module, first verify whether it already works correctly.** If it does, make incremental, surgical changes instead of full rewrites.

## Why

A full rewrite of a working module (e.g., ChatPage.tsx, App.tsx) removes features, breaks imports, and destroys stable functionality. This caused:
- Broken chat (removed file upload, session loading, grouped models, keyboard shortcuts)
- Broken API connectivity (App.tsx API calls lost)
- Broken CSS (custom classes like `glass-card`, `prose-nova` removed)

## Correct Approach

1. **Read the original file first** — understand what it does
2. **Use git to see what changed** — `git diff HEAD -- <file>`
3. **Make the smallest possible change** — one feature at a time
4. **Build and test after EACH change** — not after a batch
5. **If a rewrite is truly needed** — save the original as `*.bak` first

## Emergency Rollback

When a change breaks things:

```powershell
# Restore a single file from last commit
git checkout HEAD -- path/to/file.tsx
```

This is faster than debugging a broken rewrite.

## File-Specific Conventions to Preserve

- **Export style:** All route pages use **named exports** (`export function X`), NOT default exports. Never convert between them.
- **Import style:** Sidebar/StatusBar/etc. use named exports.
- **CSS classes:** The project uses custom CSS classes (`glass-card`, `glass-input`, `prose-nova`, `nova-panel`, etc.) defined in `app.css`. Never remove these without checking all references.

## Source

Full ChatPage.tsx + App.tsx + app.css rewrite during Nexus AI rebranding (2026-06-18) that broke all chat functionality, API connectivity, and UI styling. Restoring the three files from git fixed everything.

---

*Proposed for: AGENTS.md — Behavior/process rules*
