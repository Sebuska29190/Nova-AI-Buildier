# RELEASE_v0.5.0 — Skills Hub, Discord, TTS, Image Generation

**Date:** 2026-05-19
**Type:** Feature release (major)

## Summary
Dodanie 4 kluczowych brakujących komponentów z roadmapy Hermes Agent: Discord bridge, TTS engine, Skills Hub, Image Generation. Nova przechodzi z 35 → 44 narzędzi.

## Nowe komponenty

### 🌉 Discord Bridge (`channel/discord.ts`)
- **Pełny WebSocket gateway** — łączy się przez Discord API v10 z intents (GUILDS, GUILD_MESSAGES, MESSAGE_CONTENT)
- Auto-reconnect z heartbeat interval
- Obsługa: wysyłanie wiadomości, odbieranie, lista kanałów, pobieranie historii
- 4 narzędzia: `discord_connect`, `discord_send`, `discord_list_channels`, `discord_get_messages`

### 🎤 TTS Engine (`voice/tts.ts`)
- **4 providerów**: Edge TTS (domyślnie, darmowy), OpenAI TTS, ElevenLabs, gTTS (fallback)
- Obsługa wielu języków z głosami native: EN, PL, DE, FR, JP, ZH, KO
- Regulacja prędkości mowy (0.5x–2.0x)
- 2 narzędzia: `tts_speak`, `tts_list_voices`
- `/tts` command w CLI — już istniał, teraz podpięty pod proper engine

### 🖼️ Image Generation (`media/image-generation.ts`)
- **4 providerów**: Replicate (SDXL, SD3, Flux), OpenAI DALL-E 3/2, Stable Diffusion (local API), Prodia
- Obsługa: prompt, negative prompt, rozdzielczość, model
- 1 narzędzie: `image_generate`
- Lista modeli: `listImageModels()`

### 📦 Skills Hub (`skill/hub.ts`)
- **Centralne repozytorium** — domyślnie `cheetahclaws/skills` na GitHub
- Pobieranie pojedynczych skilli lub pełna synchronizacja (mirror)
- Automatyczne kategoryzowanie przy imporcie
- Obsługa instalacji z dowolnego URL
- 3 narzędzia: `skills_hub_list`, `skills_hub_download`, `skills_hub_sync`

## Stan Nova vs Hermes — po v0.5.0

| Kategoria | Hermes | Nova v0.5.0 | 
|-----------|--------|-------------|
| Web UI (strony) | 12 | **24** |
| Bridge/platformy | Telegram, Discord, Slack, WhatsApp, Signal, Email, Feishu, DingTalk, Matrix, Mattermost, QQ, WeChat, iMessage, SMS, Webhook, HomeAssistant | **Telegram, WeChat, Slack, Discord** |
| Narzędzia (tools) | ~50 | **44** |
| Skills | 50+ | **45** |
| MCP Protocol | ✅ | ✅ |
| Memory System | ✅ | ✅ |
| Multi-Agent | ✅ | ✅ |
| Voice/TTS | ✅ TTS+STT | ✅ **TTS+STT** |

## Files changed (new)
| Plik | Opis |
|------|------|
| `packages/core/src/channel/discord.ts` | **New** — Discord WebSocket bridge |
| `packages/core/src/voice/tts.ts` | **New** — Multi-provider TTS engine |
| `packages/core/src/media/image-generation.ts` | **New** — AI image generation |
| `packages/core/src/skill/hub.ts` | **New** — Skills hub + sync engine |
| `plans/v0.5.0-analysis.md` | **New** — Nova vs Hermes gap analysis |

## Files changed (modified)
| Plik | Zmiana |
|------|--------|
| `packages/core/package.json` | Version 0.4.2 → 0.5.0 |
| `packages/ui/package.json` | Version 0.4.2 → 0.5.0 |
| `packages/core/src/health.ts` | Version 0.4.2 → 0.5.0 |
| `packages/core/src/plugin/community-skills.ts` | 35 → **44 tools** (+TTS, +Image, +Discord, +Hub) |

## Wymagane API keys
| Provider | Env var | Wymagany |
|----------|---------|----------|
| Edge TTS | — | ❌ (darmowy, działa bez klucza) |
| gTTS | — | ❌ (darmowy fallback) |
| OpenAI TTS | `OPENAI_API_KEY` | ✅ do OpenAI TTS |
| ElevenLabs | `ELEVENLABS_API_KEY` | ✅ do ElevenLabs |
| Replicate | `REPLICATE_API_KEY` | ✅ do Replicate |
| OpenAI DALL-E | `OPENAI_API_KEY` | ✅ do DALL-E |
| Discord | `DISCORD_TOKEN` | ✅ do Discorda |

## Breaking changes
- Brak. Nowe narzędzia są addytywne, nie zmieniają istniejących interfejsów.

## Next (v0.6.0+)
- Browser automation (Playwright z fingerprinting)
- Computer use (desktop control)
- Email bridge (IMAP/SMTP as channel)
- WhatsApp / Signal bridges
- HomeAssistant integration
