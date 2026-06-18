# PowerShell: No `&&` for Command Chaining

## What
PowerShell does **not** support `&&` for command chaining. Use `;` instead.

## Why
The `&&` operator is a Unix shell / bash-ism. PowerShell treats it as a literal string or causes parse errors. This has caused multiple command failures on this Windows machine.

## Correct Patterns

```powershell
# ❌ WRONG — will fail or behave unexpectedly
cd D:\path && npx vite build
cd D:\path && bun install

# ✅ CORRECT — use semicolons
cd D:\path; npx vite build
cd D:\path; bun install

# ✅ ALSO CORRECT — use native PowerShell patterns
Set-Location D:\path; npx vite build
Push-Location D:\path; npx vite build; Pop-Location
```

## When Does This Matter
- Any chained command in PowerShell
- Background exec calls that chain multiple commands
- Build/deploy/install sequences

## Edge Cases
- `||` (OR) also doesn't work in PowerShell — use `if ($LASTEXITCODE -ne 0) { ... }` instead
- `&&` and `||` DO work in `cmd.exe` and `bash` (Git Bash, WSL), so be aware of which shell you're targeting

## Source
Repeated command failures during Nexus AI rebranding (2026-06-17), where `&&` chains silently failed in PowerShell exec calls.

---

*Proposed for: TOOLS.md — Environment-specific shell notes*
