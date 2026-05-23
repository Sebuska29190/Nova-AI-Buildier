# RELEASE v0.6.1 — Workspace Picker, UI Readability, Crypto Hub, New Channels

**Date:** 2026-05-19  
**Type:** Feature + UI enhancement release

## Summary

Major UX overhaul: native folder picker for workspace selection, complete UI readability pass (depth, borders, contrast, glow effects), expanded Crypto Hub with 3 new modules (Base ecosystem tracker, multi-wallet scanner, AI token analyzer), and 4 new channel integrations (X/Twitter, Matrix, Ntfy, WhatsApp Business).

## Changes

### 🖥️ Workspace — Native Folder Picker
- **New backend endpoint** `POST /api/workspace/browse` — opens native Windows FolderBrowserDialog via PowerShell
- **`showDirectoryPicker()`** support for Chromium-based browsers (File System Access API)
- **New "Browse" button** in `WorkspacePage.svelte` — one-click folder selection, path auto-fills
- Removed friction of manual path typing; manual entry hidden as advanced option
- **Files**: `packages/core/src/api/routes.ts`, `packages/ui/src/routes/WorkspacePage.svelte`

### 🛍️ Shopping — Scroll Fix
- Added `.shopping-results-scroll` wrapper with `overflow-y: auto` and `flex: 1`
- `.shopping-page` container uses `height: 100%; overflow: hidden` — only results section scrolls, not the whole page
- **Files**: `packages/ui/src/routes/ShoppingPage.svelte`

### 🎨 UI Readability — Complete Visual Lifting
- **New color palette** in `app.css`:
  - Deeper background: `#0b0e14` (nova-bg)
  - Elevated surfaces: `#141922` (nova-surface), `#1a2030` (nova-surface-2)
  - Crisp borders: `#2a3448` (nova-border) / `#3a4660` (nova-border-2) / `#4e5c7a` (nova-border-3)
  - Better contrast: `#e8e6e3` (foreground), `#c5c2b8` (midground), `#7a8a9e` (muted)
  - Semantic colors: `#22c55e` (success), `#ef4444` (danger), `#3b82f6` (info)
- **Card component** (`Card.svelte`):
  - Default variant now uses `bg-nova-surface-2` (lighter than background) for elevation
  - Hover cards glow with teal border + `box-shadow` + translateY lift
- **Badge component** (`Badge.svelte`):
  - Color-coded 20%-fill backgrounds per variant
  - Success/accent badges get a subtle glow (`box-shadow`)
  - Neutral badges use proper `#1e293b` / `#94a3b8` palette
- **Sidebar** (`Sidebar.svelte`): distinct `#0f141c` background to separate from main content
- **PluginsPage**: full card rework — borders `#2d3748`, hover with indigo glow + translate, color-coded tags (tool=blue, agent=purple, channel=cyan, provider=orange, skill=pink, UI=turquoise)

### 🔷 Crypto Hub — Major Expansion

3 new backend modules + frontend UI:

| Module | File | Description |
|--------|------|-------------|
| **Base Ecosystem Tracker** | `packages/core/src/crypto/base-tracker.ts` | Top 30 projects on Base L2 (TVL, volume, 24h change via DeFiLlama), on-chain stats |
| **Multi-Wallet Scanner** | `packages/core/src/crypto/wallet-scanner.ts` | EVM wallet balance checker (ETH/Base/Arbitrum/Polygon) + reputation scoring (tx count, age, Whale/Active/Casual/New labels) |
| **AI Token Analyzer** | `packages/core/src/crypto/token-analyzer.ts` | CoinGecko + GitHub activity → fundamental score 1-10, technical score 1-10, risk level, sentiment, natural-language summary |

New endpoints in `routes.ts`:
- `GET /api/crypto/base/status` — Base ecosystem + on-chain stats
- `POST /api/crypto/wallet/check` — Scan up to N EVM addresses
- `POST /api/crypto/analyze` — AI analysis of any token by symbol/ID

Frontend (`CryptoPage.svelte`): 4-tab layout — 📰 Overview / ⛓️ Base Ecosystem / 👛 Wallet Scanner / 🤖 AI Analyzer

### 📨 Channels — 4 New Integrations

| Channel | ID | Description |
|---------|----|-------------|
| 🐦 **X (Twitter)** | `twitter`/`x` | Post tweets via X API v2 (Bearer token or OAuth 1.0a) |
| 🧩 **Matrix (Element)** | `matrix` | Decentralized messaging via Matrix homeserver API |
| 🔔 **Ntfy** | `ntfy` | Simple push notifications via ntfy.sh — no signup needed |
| 💚 **WhatsApp Business** | `whatsapp` | Meta Cloud API for WhatsApp messaging |

All channels implemented in `manager.ts` with `start()`, `stop()`, `sendMessage()` + full UI in `ChannelsPage.svelte` with config forms.

## Files Changed

| File | Change |
|------|--------|
| `packages/core/src/health.ts` | 0.6.0 → 0.6.1 |
| `packages/core/package.json` | 0.6.0 → 0.6.1 |
| `packages/ui/package.json` | 0.6.0 → 0.6.1 |
| `packages/core/src/main.ts` | Banner v0.4 → v0.6.1 |
| `packages/ui/src/App.svelte` | Fallback version 0.3.0 → 0.6.1 |
| `packages/core/src/api/routes.ts` | + `POST /api/workspace/browse`, +3 crypto endpoints |
| `packages/core/src/channel/manager.ts` | + X/Twitter, Matrix, Ntfy, WhatsApp integrations |
| `packages/core/src/crypto/base-tracker.ts` | **New** — Base ecosystem tracker |
| `packages/core/src/crypto/wallet-scanner.ts` | **New** — Multi-EVM wallet scanner + reputation |
| `packages/core/src/crypto/token-analyzer.ts` | **New** — AI token analysis engine |
| `packages/ui/src/routes/WorkspacePage.svelte` | + Browse button, showDirectoryPicker + backend fallback |
| `packages/ui/src/routes/CryptoPage.svelte` | Complete rewrite — 4-tab hub |
| `packages/ui/src/routes/ChannelsPage.svelte` | + X, Matrix, Ntfy, WhatsApp forms |
| `packages/ui/src/routes/ShoppingPage.svelte` | + scroll wrapper for products grid |
| `packages/ui/src/routes/PluginsPage.svelte` | Full CSS rewrite: borders, hover, badges, contrast |
| `packages/ui/src/lib/components/ui/Card.svelte` | Deeper surface-2 bg, hover glow effect |
| `packages/ui/src/lib/components/ui/Badge.svelte` | Color-coded backgrounds, glow on success/accent |
| `packages/ui/src/lib/components/Sidebar.svelte` | Distinct `#0f141c` background |
| `packages/ui/src/app.css` | Full color palette refresh + semantic colors |
