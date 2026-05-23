# RELEASE_v0.6.0 — Browser Automation, Computer Use, Email, WhatsApp, Signal

**Date:** 2026-05-19
**Type:** Major feature release

## Summary
Zamknięcie największych luk względem Hermes Agent. Nova zyskuje 5 nowych modułów: browser automation (stealth), computer use (desktop control), email bridge, WhatsApp bridge, Signal bridge. Tools: 35 → 64.

## Nowe komponenty

### 🕷️ Browser Automation (`browser/` — 8 narzędzi)
- **Stealth engine** — Playwright z fingerprint spoofingiem (user-agent, WebGL, canvas, audio, timezone, locale)
- **Full page control**: navigate, click, type, screenshot (full-page), extract (text/HTML), evaluate JS, scroll, tab management
- **8 narzędzi**: `browser_launch`, `browser_navigate`, `browser_click`, `browser_type`, `browser_screenshot`, `browser_extract`, `browser_evaluate`, `browser_close`
- Pliki: `engine.ts` (239 linii), `fingerprint.ts` (148 linii)

### 🖥️ Computer Use (`browser/computer.ts` — 8 narzędzi)
- **Desktop control** przez pyautogui (preferowany) lub PowerShell (fallback na Windows)
- **7 akcji + 1 info**: mouse move/click/drag, keyboard type/press, screenshot, shell, pozycja myszy
- **8 narzędzi**: `computer_mouse_move`, `computer_mouse_click`, `computer_keyboard_type`, `computer_keyboard_press`, `computer_screenshot`, `computer_shell`, `computer_mouse_position`
- Plik: `computer.ts` (327 linii)

### ✉️ Email Bridge (`channel/email.ts` — 6 narzędzi)
- **IMAP + SMTP** przez imapflow + nodemailer
- Pełny cykl: send, list, read (full z plain text + HTML), reply, search, list folderów
- **6 narzędzi**: `email_send`, `email_list`, `email_read`, `email_reply`, `email_search`, `email_list_folders`
- Plik: `email.ts` (297 linii)
- Config: `EMAIL_IMAP_HOST/PORT/USER/PASS`, `EMAIL_SMTP_HOST/PORT/USER/PASS`

### 💬 WhatsApp Bridge (`channel/whatsapp.ts` — 5 narzędzi)
- **whatsapp-web.js** — WhatsApp Web przez Puppeteer z LocalAuth
- Obsługa: connect (QR), send message, send image, list chats, get messages
- Auto-reconnect, event system
- **5 narzędzi**: `whatsapp_connect`, `whatsapp_send`, `whatsapp_send_image`, `whatsapp_list_chats`, `whatsapp_get_messages`
- Plik: `whatsapp.ts` (226 linii)

### 🔵 Signal Bridge (`channel/signal.ts` — 3 narzędzia)
- **signal-cli** — Java CLI daemon dla Signal Messenger
- Obsługa: send, receive, status, register, verify, list groups
- **3 narzędzia**: `signal_send`, `signal_receive`, `signal_status`
- Plik: `signal.ts` (181 linii)
- Config: `SIGNAL_PHONE`, `SIGNAL_CLI_PATH`

## Stan Nova vs Hermes — po v0.6.0

| Kategoria | Hermes | Nova v0.6.0 | Zmiana |
|-----------|--------|-------------|--------|
| Web UI (strony) | 12 | **24** | = |
| Narzędzia (tools) | ~50 | **64** | **+29 🚀** |
| Bridge/platformy | 16 | **7** | +3 (Discord, WhatsApp, Signal) |
| Skills | 50+ | **45** | = |
| MCP Protocol | ✅ | ✅ | = |
| Memory System | ✅ | ✅ | = |
| Multi-Agent | ✅ | ✅ | = |
| Browser Auto | ✅ | ✅ | **NOWY** |
| Computer Use | ✅ | ✅ | **NOWY** |
| TTS+STT | ✅ | ✅ | = |
| Image Gen | ✅ | ✅ | = |
| Email | ✅ | ✅ | **NOWY** |

## Files created (11 new files)
| Plik | Linie | Opis |
|------|-------|------|
| `browser/engine.ts` | 239 | Playwright stealth browser engine |
| `browser/fingerprint.ts` | 148 | Browser fingerprint spoofing |
| `browser/computer.ts` | 327 | Desktop control (mouse, keyboard, screenshot, shell) |
| `channel/email.ts` | 297 | Email bridge (IMAP + SMTP) |
| `channel/whatsapp.ts` | 226 | WhatsApp Web bridge |
| `channel/signal.ts` | 181 | Signal CLI bridge |
| `plans/v0.6.0-plan.md` | 244 | Plan implementacji |

## Files modified
| Plik | Zmiana |
|------|--------|
| `packages/core/package.json` | 0.5.0 → 0.6.0 |
| `packages/ui/package.json` | 0.5.0 → 0.6.0 |
| `packages/core/src/health.ts` | 0.5.0 → 0.6.0 |
| `packages/core/src/plugin/community-skills.ts` | **35 → 64 tools** (+29 nowych: browser 8 + computer 8 + email 6 + whatsapp 5 + signal 3) |

## Zależności (npm)
| Pakiet | Moduł | Instalacja |
|--------|-------|------------|
| `playwright` | Browser engine | `npm install playwright && npx playwright install chromium` |
| `imapflow` | Email (IMAP) | `npm install imapflow` |
| `nodemailer` | Email (SMTP) | `npm install nodemailer` |
| `whatsapp-web.js` | WhatsApp | `npm install whatsapp-web.js` |
| `pyautogui` (Python) | Computer use | `pip install pyautogui` |
| signal-cli (Java) | Signal | https://github.com/AsamK/signal-cli |

## Wymagane API keys / config
| Zmienna | Wymagana dla |
|---------|--------------|
| `EMAIL_IMAP_HOST/USER/PASS` | Email (send+receive) |
| `EMAIL_SMTP_HOST/USER/PASS` | Email (send only; fallback to IMAP) |
| `SIGNAL_PHONE` | Signal |

## Breaking changes
- Brak. Wszystkie nowe narzędzia addytywne.

## Next (v0.7.0+)
- UI improvements: lepszy design system
- HomeAssistant bridge
- Webhook bridge
- Matrix / Mattermost bridges
- Browser Computer Use z vision (AI-driven clicks)
