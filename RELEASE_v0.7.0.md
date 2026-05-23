# Release v0.7.0 — Nova AI Builder

**Date:** 2026-05-20

## 🚀 Project Rebrand
- Project name changed to **Nova AI Builder** across all packages (core, ui, root)
- All package.json `name` and `version` fields updated
- HTML title updated from "Nova Agent Platform" to "Nova AI Builder"
- Sidebar branding: `NOVA AI` → `NOVA AI BUILDER`
- Status bar model selector updated
- Terminal hostname updated: `core@nova.ai` → `core@nova-ai-builder`

## 💄 New UI Design (HTML → Svelte 5)
Complete redesign matching the provided HTML spec 1:1 with dark glassmorphism theme:

### Global & Layout
- `app.css` — dark theme `#05070c`→`#0a0e17`, glassmorphism panels, `glass-panel` class
- `App.svelte` — sidebar router with group-based navigation
- `Sidebar.svelte` — collapsible groups (Chat, Workspace, Integrations, Tools), active state, user profile
- `StatusBar.svelte` — workspace picker, WS connection indicator, model selector, uptime

### Pages (24 pages redesigned)
- **ChatPage** — welcome screen with animated gradient sparkles icon, available command badges (grid), message history with glass panels, streaming indicator, clean input bar
- **WorkspacePage** — directory picker modal (native `showDirectoryPicker` + fallback), file tree preview, code viewer
- **PluginsPage** — plugin cards (MCP Servers Hub, Crawl4AI, Browser Use) with install/remove/configure actions
- **ChannelsPage** — Telegram, Discord, Ntfy cards with status badges and configuration
- **CryptoPage** — 4 stat cards (Active Ecosystem, BaseCred Score, Total TX, Gas Level) + 2 tool panels
- **ShoppingPage** — search form with filters, scrollable result list (max-height), product cards
- **TerminalPage** — macOS-style window controls, systemd status mock output
- **EditorPage** — placeholder for autonomous AI editor
- Plus SkillsPage, SessionsPage, MemoryPage, AnalyticsPage, EnvPage, ConfigPage, LogsPage, ModelsPage, CronPage, ProfilesPage, DocsPage, VideoPage, VideoEditorPage, WorkerPage — all updated to new visual style

### Design System
- `btn-premium` gradient buttons (`#00f2fe`→`#6366f1`)
- `glass-panel` — `backdrop-blur`, `rgba(11,15,25,0.6)`, subtle borders
- Consistent `max-w-5xl mx-auto` page layout
- Lucide icons throughout
- `custom-badge` for command chips

## 🐛 Bug Fixes
- Fixed WorkspacePage.svelte JSX parsing issue in `<pre>` tag (used `{@html}`)
- Fixed esbuild build script approval for pnpm
- Fixed Svelte 5 deprecation warnings (`context="module"` → `module`)

## 🧹 Technical Debt
- Upgraded all dependencies via pnpm install
- Added `pnpm.onlyBuiltDependencies` config for esbuild
- Build output: 1.15MB JS (368KB gzip), 56KB CSS (10.7KB gzip)

## 📦 Packages
| Package | Version |
|---|---|
| `nova-ai-builder` (root) | 0.7.0 |
| `nova-ai-builder-core` | 0.7.0 |
| `nova-ai-builder-ui` | 0.7.0 |
