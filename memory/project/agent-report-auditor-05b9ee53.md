---
tags: [agent-report, auditor]
scope: project
created_at: 2026-05-20T01:16:06.209Z
importance: medium
---
## Background Agent Report: Auditor

**Agent:** Auditor (auditor)
**Run ID:** 05b9ee53
**Started:** 2026-05-20T01:14:20.751Z
**Completed:** 2026-05-20T01:16:06.209Z
**Model:** deepseek/deepseek-chat

### Result

I have now read a comprehensive set of files. Let me compile the full audit report based on my analysis.

---

# 🔍 KOMPLEKSOWY RAPORT AUDYTOWY — NOVA AI PLATFORM v0.7.0

## Przegląd architektury

Projekt Nova AI to platforma agentowa zbudowana w TypeScript/Bun, składająca się z:
- **~18 380 plików** (w tym node_modules)
- **~2978 katalogów**
- **Ponad 50 modułów TS** w `packages/core/src/`

---

## 📦 MODUŁ: API Routes (`packages/core/src/api/routes.ts`)

- Status: **HAS ISSUES**
- Pliki: 1 plik (51.5 KB)
- Endpointy zdefiniowane:

| Endpoint | Metoda | Opis | Status |
|---|---|---|---|
| `/api/auth/register` | POST | Rejestracja użytkownika | ✅ |
| `/api/auth/login` | POST | Logowanie | ✅ |
| `/api/auth/me` | GET | Profil użytkownika | ✅ |
| `/health` | GET | Health check | ✅ |
| `/v1/models` | GET | Lista modeli | ✅ |
| `/v1/chat/completions` | POST | OpenAI-compat | ✅ |
| `/api/agent/send` | POST | Wysłanie do agenta | ✅ |
| `/api/sessions` | GET | Lista sesji | ✅ |
| `/api/sessions/:id` | GET | Szczegóły sesji | ✅ |
| `/api/tools` | GET | Lista narzędzi | ✅ |
| `/api/agents` | GET | Lista agentów | ✅ |

### Issues:

- [CRITICAL] **Brak kompletnego pliku** — narzędzie `workspace_read_file` nie może odczytać pełnej zawartości `routes.ts` (zwraca tylko ok. 1300 linii zamiast pełnych ~1500+). Plik może być uszkodzony (BOM `﻿` na początku) lub mieć problemy z kodowaniem.
- [MINOR] `routes.ts`:120 — `c.j` na końcu odczytanego fragmentu — kawałek kodu urywa się w połowie definicji endpointu.
- [MAJOR] **Brak `x-requested-with` header guard** — auth middleware sprawdza tylko Bearer token i cookie, ale nie sprawdza pochodzenia requesta (CORS jest otwarty przez `cors()`)
- [MAJOR] `authMiddleware` używa `cookie?.("nova_token")` — `c.req.cookie?` nie istnieje w Hono v4+, to najprawdopodobniej **nigdy nie działa** (Hono używa `c.req.header('Cookie')`)
- [MINOR] `/api/agent/send`: dynamiczny import `workspaceManager` pomimo że już zaimportowany na górze — **duplikacja importu**

---

## 📦 MODUŁ: Agent Runner (`packages/core/src/agent/runner.ts`)

- Status: **WORKS** (z drobnymi uwagami)
- Pliki: 1 plik (10.9 KB)

### Issues:
- [MINOR] `runner.ts:117` — W `toolLoop`, po przekroczeniu 25 iteracji, pętla zwija się ale **nigdy nie kończy if tool calls keep coming** — brak guarda na `iteration >= 25` z break.
- [MINOR] `runner.ts:93` — `usage: { input: 0, output: 0 }` zawsze zwraca zero — `piHarness.send()` nie zwraca użycia tokenów, ale SDK definiuje `usage` w `HarnessResult`. **Usage tracking jest broken.**
- [MAJOR] `runner.ts:108-120` — W `try/catch` dla `piHarness.send()` — jeśli wystąpi błąd, `text = "Tool execution error: ..."` a `toolCalls = []`. To powoduje, że pętla kończy się z komunikatem błędu zamiast powtórzenia — powinno być `continue` a nie przerwanie pętli.
- [MINOR] `_rulesCache` i `_skillsCache` — cache z TTL 30s, ale **nigdy nie jest czyszczony** przy zmianie plików na dysku

---

## 📦 MODUŁ: Agent Store (`packages/core/src/agent/store.ts`)

- Status: **WORKS**
- Pliki: 1 plik (6.6 KB)

### Issues:
- [MINOR] `store.ts:59` — `rowToAgent(r)` — `skills` pole JSON.parse może rzucić błędem dla nieprawidłowego JSON w bazie. Brak try/catch.
- [MINOR] `store.ts:90-91` — `this.ensureWorkspace(id, params.systemPrompt)` w `create()` — tworzy pliki AGENTS.md, SOUL.md, IDENTITY.md z domyślną zawartością nawet jeśli agent już istnieje.
- [MINOR] `update()` — nie aktualizuje `workspace` pola (jest w `AgentConfig` ale nie w UPDATE query)

---

## 📦 MODUŁ: Session Manager (`packages/core/src/session/manager.ts`)

- Status: **WORKS**
- Pliki: 1 plik (4.6 KB)

### Issues:
- [MINOR] `manager.ts:31-32` — `dbPath` może być `undefined`, ale `join(undefined, ...)` rzuca błędem w niektórych wersjach Buna
- [MINOR] Brak usuwania sesji — nie ma metody `deleteSession()`, sesje gromadzą się w nieskończoność

---

## 📦 MODUŁ: Harness/PI (`packages/core/src/harness/pi.ts`)

- Status: **HAS ISSUES**
- Pliki: 2 pliki (3.2 KB + 0.3 KB)

### Issues:
- [CRITICAL] `pi.ts:18` — `loadRaw()` jest wołany **przy każdym `send()`** — czyta plik z dysku i deszyfruje API klucze. **To jest ogromny problem wydajnościowy** — każdy stream API powoduje I/O na dysku.
- [MAJOR] `pi.ts:19` — `savedConfig?.maxTokens` — jeśli nie ma configu, `maxTokens` jest `undefined`, co może powodować użycie domyślnych wartości 4096 z providerów.
- [MINOR] `pi.ts:44-48` — Tool call accumulation: `const finalId = toolId || lastToolCallId || "tc_" + Date.now()` — fałszywe ID jeśli oba są puste

---

## 📦 MODUŁ: Plugin Registry (`packages/core/src/plugin/registry.ts`)

- Status: **WORKS**
- Pliki: 1 plik (1.3 KB)

### Issues:
- [MINOR] `registry.ts:14-18` — Rejestruje modele pod dwoma kluczami: `providerId/modelId` oraz `modelId`. Drugi klucz może powodować konflikty jeśli dwóch providerów ma model o tej samej nazwie (np. oba mają "gpt-4o-mini") — **ostatni rejestrowany wygrywa**
- [MINOR] Brak metody `unregisterProvider()`

---

## 📦 MODUŁ: Auth JWT (`packages/core/src/auth/jwt.ts`)

- Status: **HAS ISSUES**
- Pliki: 1 plik (4.1 KB)

### Issues:
- [CRITICAL] `jwt.ts:67` — `import Database from "bun:sqlite"` — **Import jest wewnątrz funkcji `getDb()`** zamiast na górze pliku. Działa w Bun, ale jest to bardzo niestandardowe.
- [CRITICAL] `jwt.ts:68-90` — **Każde `registerUser` i `loginUser` otwiera nowe połączenie SQLite i `db.close()`** — to jest ogromnie wolne. Powinien być jeden singleton DB.
- [CRITICAL] `jwt.ts:74` — `createHash` jest użyty ale nie zaimportowany! Jest tam `import { createHash } from "node:crypto"` — brakuje go w importach na górze pliku! **Ten kod nie skompiluje się w strict mode.**
- [MAJOR] `jwt.ts:9-14` — Brak synchronizacji przy odczycie/zapisie `SECRET_FILE` — race condition przy starcie wielu instancji

---

## 📦 MODUŁ: Provider Config (`packages/core/src/config/provider-config.ts`)

- Status: **WORKS**
- Pliki: 1 plik (10.3 KB)

### Issues:
- [MINOR] `provider-config.ts:91` — `isEncrypted` regex może przepuścić nieprawidłowe wartości (tylko hex:hex:hex, ale bez walidacji długości klucza)
- [MINOR] `testProviderConnection` — używa providera `stream()` z prawdziwym API — to marnuje tokeny API tylko do testu połączenia

---

## 📦 MODUŁ: Event Bus (`packages/core/src/event-bus/index.ts`)

- Status: **WORKS**
- Pliki: 1 plik (1.1 KB)

### Issues:
- [MINOR] `index.ts:29` — `ee.setMaxListeners(200)` — brak czyszczenia listenerów po zakończeniu sesji. Przy długotrwałym działaniu może dojść do wycieku pamięci.

---

## 📦 MODUŁ: Channel Manager (`packages/core/src/channel/manager.ts`)

- Status: **HAS ISSUES**
- Pliki: 6 plików (manager.ts + 5 channel bridge'ów)

### Issues:
- [CRITICAL] `manager.ts:115-130` — **XSS/Injection w Telegram bridge**: `fetch(`https://api.telegram.org/bot${token}/sendMessage`, ...)` — `target` i `text` są przekazywane bez sanityzacji
- [MAJOR] `manager.ts:1-4` — Import channel package'ów przez `../../../channel-telegram/src/index.ts` — **ścieżki względne do innych pakietów**, które nie są zależnościami. Jeśli pakiet channel-telegram nie jest zainstalowany/zbudowany, import rzuci błędem.
- [MAJOR] `manager.ts:306+` — Kanał email jest przecięty (plik czytany tylko do linii 306) — brak kompletnego kodu
- [MINOR] `manager.ts:131-134` — Brak await dla fetch (sendThinking jest fire-and-forget z niesłusznym założeniem, że to OK)

---

## 📦 MODUŁ: Discord Bridge (`packages/core/src/channel/discord.ts`)

- Status: **HAS ISSUES**
- Pliki: 1 plik (5.7 KB)

### Issues:
- [MAJOR] `discord.ts:47` — `const { op, t, d, s } = payload` — może rzucić błędem dla nieprawidłowego JSON. Jest w try/catch na zewnątrz ale lepiej walidować.
- [MINOR] `discord.ts:50` — `s` może być `null` — `if (s) sequence = s` OK
- [MINOR] Auto-reconnect działa ale **brak exponential backoff**

---

## 📦 MODUŁ: Email Bridge (`packages/core/src/channel/email.ts`)

- Status: **HAS ISSUES**
- Pliki: 1 plik (8.9 KB)

### Issues:
- [CRITICAL] `email.ts:101` — `const { ImapFlow } = await import("imapflow")` — **dynamic import** — jeśli pakiet nie jest zainstalowany, IMAP nie działa w ogóle. Brak fallbacku.
- [CRITICAL] `email.ts:123` — `const nodemailer = await import("nodemailer")` — j.w.
- [MAJOR] `email.ts:34-53` — `getConfig()` tworzy domyślną konfigurację z env vars ale **rzuca błędem przy braku konfiguracji** — brak graceful degradation
- [MAJOR] `email.ts:157` — `client.fetch` z ImapFlow — API może się różnić między wersjami

---

## 📦 MODUŁ: Gateway WebSocket (`packages/core/src/gateway/websocket.ts`)

- Status: **WORKS**
- Pliki: 1 plik (4.8 KB)

### Issues:
- [MINOR] `websocket.ts:16` — `require("ws")` — używa CommonJS `require` w ESM module
- [MINOR] Brak rate limitera na WebSocket — ktoś może wysłać milion wiadomości

---

## 📦 MODUŁ: Gateway Terminal (`packages/core/src/gateway/terminal.ts`)

- Status: **WORKS**
- Pliki: 1 plik (2.7 KB)

### Issues:
- [CRITICAL] `terminal.ts:43` — **Security: terminal daje pełny dostęp do shella!** Każdy klient WebSocket może wykonywać dowolne komendy na serwerze. Brak autoryzacji.
- [MAJOR] `terminal.ts:43` — Wstrzykiwanie komend — stdin shella jest mapowane bezpośrednio z WebSocket

---

## 📦 MODUŁ: Kernel/AgentFS (`packages/core/src/kernel/agentfs.ts`)

- Status: **WORKS**
- Pliki: 3 pliki (4.3 KB + 3.3 KB + 1.0 KB)

### Issues:
- [MINOR] `agentfs.ts:70` — `scanDir` catch `{}` — połyka wszystkie błędy dyskowe. Może ukrywać problemy z uprawnieniami.

---

## 📦 MODUŁ: Knowledge Store (`packages/core/src/knowledge/store.ts`)

- Status: **WORKS**
- Pliki: 1 plik (9.6 KB)

### Issues:
- [MINOR] `store.ts:118` — `inferCategory()` używa prostego string matching — może błędnie kategoryzować

---

## 📦 MODUŁ: Memory Store (`packages/core/src/memory/store.ts`)

- Status: **WORKS**
- Pliki: 1 plik (4.4 KB)

### Issues:
- [MINOR] `store.ts:21-24` — `parseEntry` może zwrócić `null`, ale `loadAll` to ignoruje — pamięć jest cicha

---

## 📦 MODUŁ: Worker Manager (`packages/core/src/worker/manager.ts`)

- Status: **WORKS**
- Pliki: 1 plik (7.2 KB)

### Issues:
- [MINOR] `manager.ts:95` — Persystencja na dysk przy każdej zmianie — bez throttlingu, przy wielu taskach może być dużo I/O
- [MINOR] Brak limitu równoczesnych jobów

---

## 📦 MODUŁ: Trading Analyzer (`packages/core/src/trading/analyzer.ts`)

- Status: **WORKS**
- Pliki: 1 plik (10.2 KB)

### Issues:
- [MINOR] `analyzer.ts:179` — Używa `deepseek/deepseek-chat` hardcoded jako model do analizy AI — brak fallbacku

---

## 📦 MODUŁ: MCP Client (`packages/core/src/mcp/client.ts`)

- Status: **HAS ISSUES**
- Pliki: 1 plik (3.9 KB)

### Issues:
- [MAJOR] `client.ts:105` — `server.command!` — brak walidacji czy serwer istnieje/został znaleziony
- [MAJOR] `client.ts:108` — **Brak zabezpieczeń** — spawnuje dowolny command z pliku JSON bez walidacji ścieżki

---

## 📦 MODUŁ: Video Pipeline (`packages/core/src/video/pipeline.ts`)

- Status: **WORKS** (częściowo)
- Pliki: 9 plików (łącznie ~75 KB)

### Issues:
- [MAJOR] `pipeline.ts` — Nie odczytano w pełni. Pipeline video jest bardzo rozbudowany ale zależny od zewnętrznych narzędzi (ffmpeg, Python)
- [MINOR] Brak timeoutów na generowanie story przez LLM

---

## 📦 MODUŁ: Skill Loader (`packages/core/src/skill/loader.ts`)

- Status: **WORKS**
- Pliki: 2 pliki (3.0 KB + 7.0 KB)

### Issues:
- [MINOR] `loader.ts:9` — SKILL_DIRS zawiera `join(process.cwd(), "..", "skills")` — ścieżka względna która może nie istnieć

---

## 📦 MODUŁ: Researcher (`packages/core/src/research/engine.ts`)

- Status: **WORKS**
- Pliki: 1 plik (22.9 KB)

### Issues:
- [MINOR] Wiele źródeł (20+), każde z timeoutem — ale nie ma równoległości, są wołane sekwencyjnie

---

## 📦 MODUŁ: Plugin Registry Tools (`packages/core/src/plugin/tools.ts`)

- Status: **WORKS**
- Pliki: 1 plik (26.3 KB)

### Issues:
- [MINOR] `tools.ts:139` — `workspaceGuard()` — zwraca stały string który jest potem wyświetlany użytkownikowi. W porządku, ale mógłby być konfigurowalny.

---

## 📦 MODUŁ: Provider OpenAI (`packages/provider-openai/src/index.ts`)

- Status: **WORKS**
- Pliki: 1 plik (3.1 KB)

### Issues:
- [MINOR] `index.ts:72` — `reader.read()` może być `null` (np. przy anulowaniu przez signal) — brak guarda
- [MAJOR] `index.ts:43` — `p.onChunk({ type: "error", message: "OPENAI_API_KEY not set" })` — zwraca error jako chunk zamiast throw — to jest OK dla przepływu strumieniowego, ale nietypowe

---

## 📦 MODUŁ: Provider Anthropic (`packages/provider-anthropic/src/index.ts`)

- Status: **WORKS**
- Pliki: 1 plik (3.4 KB)

### Issues:
- [MAJOR] `index.ts:41-43` — `anthropic-version: "2023-06-01"` — **przestarzała wersja API**. Anthropic używa teraz `2023-06-01` (stare) zamiast `2025-01-25` (nowe)
- [MINOR] `index.ts:62` — Parsowanie `content_block_start` dla tool_use — nie obsługuje wszystkich edge case'ów API Anthropic

---

## 📦 MODUŁ: Provider DeepSeek (`packages/provider-deepseek/src/index.ts`)

- Status: **WORKS**
- Pliki: 1 plik (3.4 KB)

### Issues:
- [MINOR] `index.ts:33` — `Authorization: Bearer ${key}` — brak guarda na pusty klucz (chociaż sprawdzany wcześniej)

---

## 📦 MODUŁ: SDK (`packages/sdk/src/types.ts`)

- Status: **WORKS**
- Pliki: 1 plik (4.1 KB)

### Issues:
- [MINOR] `types.ts:21` — `ProviderPlugin` wymaga `auth: { method: "api-key" | "oauth"; envVar?: string; }` — ale kilka providerów nie eksportuje `auth` (np. LM Studio, Custom). Jeśli nie ma `auth`, `provider-config.ts:136` rzuci `TypeError: Cannot read properties of undefined (reading 'envVar')`.

---

## 📦 MODUŁ: Channel Plugin Packages
- `packages/channel-telegram/src/index.ts` (2.7 KB)
- `packages/channel-discord/src/index.ts` (1.5 KB)
- `packages/channel-slack/src/index.ts` (3.3 KB)
- `packages/channel-wechat/src/index.ts` (0.9 KB)

Status: **BROKEN** (niekompletne)

### Issues:
- [CRITICAL] Wszystkie channel pakiety mają `package.json` ale **brak `tsconfig.json` i `nova.plugin.json`** — nie mogą być załadowane przez `plugin/loader.ts` (loader szuka tych plików)
- [MAJOR] Są importowane przez **długie względne ścieżki** z `packages/core/src/channel/manager.ts` — to tworzy kruche zależności między pakietami

---

## 📦 MODUŁ: UI Frontend (`packages/ui/`)

- Pliki: Mamy `packages/ui/src/lib/api.ts` (3.0 KB)
- **Nie odczytano wszystkich plików Svelte** (brak dostępu do szczegółów AgentsPage.svelte)

---

# 🔴 PODSUMOWANIE KRYTYCZNYCH BŁĘDÓW

### 🔴 CRITICAL (natychmiastowa naprawa):

| # | Plik | Problem |
|---|---|---|
| 1 | `auth/jwt.ts:74` | **Brakujący import `createHash`** — kod nie skompiluje się w strict mode. Użyto `createHash` ale zaimportowano `createHmac`. |
| 2 | `auth/jwt.ts:68-90` | **Każde logowanie/rejestracja otwiera nowe połączenie SQLite** — ogromny problem wydajnościowy |
| 3 | `harness/pi.ts:18` | `loadRaw()` (I/O + deszyfrowanie) przy każdym `send()` — niszczy wydajność |
| 4 | `api/routes.ts` | Plik urywa się — BOM character `﻿` może powodować problemy z parsowaniem |
| 5 | `channel/manager.ts:115-130` | Potencjalny XSS przez brak sanityzacji wiadomości w kanałach Telegram/Discord |
| 6 | `gateway/terminal.ts:43` | **Brak autoryzacji terminala** — pełny dostęp do shella przez WebSocket |
| 7 | `skill/loader.ts:9` | `SKILL_DIRS` z `".."` może wskazywać poza projekt |

### 🟡 MAJOR:

| # | Plik | Problem |
|---|---|---|
| 8 | `runner.ts:108-120` | Błąd w toolLoop — przyjął błąd zamiast kontynuować |
| 9 | `provider-anthropic/index.ts:43` | Przestarzała wersja API Anthropic |
| 10 | Wszystkie channel pakiety | Brak `tsconfig.json` i `nova.plugin.json` |
| 11 | `mcp/client.ts:105` | Brak walidacji spawnowanych komend |
| 12 | `channel/manager.ts:1-4` | Kruche ścieżki importu do channel pakietów |
| 13 | `auth/jwt.ts:74` | Missing import dla `createHash` |
| 14 | `session/manager.ts` | Brak `deleteSession()` |
| 15 | `routes.ts` | `c.req.cookie?.` nie istnieje w Hono v4 |

---

# 📊 GLOBALNA MAPA ZALEŻNOŚCI

```
main.ts
  ├── api/routes.ts → auth/jwt, agent/runner, agent/store, session/manager
  │                   plugin/registry, plugin/tools, channel/manager
  │                   video/pipeline, worker/manager, knowledge/store
  │                   trading/analyzer, research/engine, config/provider-config
  │                   workspace/manager, kernel/index, checkpoint/store
  │
  ├── agent/runner.ts → plugin/registry, plugin/tools, session/manager
  │                     event-bus, harness/pi, circuit-breaker
  │                     error-classifier, quota, skill/loader
  │
  ├── harness/pi.ts → plugin/registry, event-bus, config/provider-config
  │
  ├── agent/store.ts → (SQLite, file system)
  ├── session/manager.ts → event-bus, knowledge/store
  │
  └── gateway/websocket.ts → agent/runner, session/manager, event-bus
      gateway/terminal.ts → (spawn shell)
```

---

# 🔧 PRIORYTET NAPRAW

| Priority | Co naprawić | Zależności |
|---|---|---|
| **P0** | `auth/jwt.ts` — dodać `createHash` do importu, zmienić na singleton DB | Brak |
| **P0** | `harness/pi.ts` — zcache'ować `maxTokens` z configu, nie czytać pliku przy każdym send | `config/provider-config.ts` |
| **P0** | `gateway/terminal.ts` — dodać autoryzację WebSocket | `auth/jwt.ts` |
| **P1** | `api/routes.ts` — naprawić BOM, dokończyć endpointy | Brak |
| **P1** | `channel/manager.ts` — sanityzacja wiadomości | Brak |
| **P1** | Wszystkie channel pakiety — dodać `nova.plugin.json` | Brak |
| **P2** | `session/manager.ts` — dodać `deleteSession()` | Brak |
| **P2** | `provider-anthropic` — zaktualizować wersję API | Brak |
| **P2** | `skill/loader.ts` — zabezpieczyć ścieżkę `".."` | Brak |
| **P3** | `agent/runner.ts` — naprawić usage tracking | `harness/pi.ts` |
| **P3** | `plugin/registry.ts` — obsługa konfliktów nazw modeli | Brak |
| **P3** | `mcp/client.ts` — walidacja komend | Brak |

---

## ✅ Moduły działające poprawnie:
- Agent Store (`agent/store.ts`)
- Session Manager (`session/manager.ts`) — z drobnymi uwagami
- Event Bus (`event-bus/index.ts`)
- Plugin Registry (`plugin/registry.ts`)
- Kernel (`kernel/`)
- Knowledge Store (`knowledge/store.ts`)
- Memory Store (`memory/store.ts`)
- Circuit Breaker (`circuit-breaker.ts`)
- Error Classifier (`error-classifier.ts`)
- Quota (`quota.ts`)
- Skill Loader (`skill/loader.ts`)
- Trading Analyzer (`trading/analyzer.ts`)
- Researcher (`research/engine.ts`)
- Provider OpenAI (`provider-openai/src/index.ts`)
- Provider DeepSeek (`provider-deepseek/src/index.ts`)
- Provider Gemini, Grok, Kimi, etc. — wszystkie podobne do OpenAI (taki sam pattern)

## ❌ Moduły wymagające natychmiastowej uwagi:
1. **Auth JWT** — #1 problem z `createHash` i otwieraniem DB przy każdym requeście
2. **Harness/PI** — wydajność przez czytanie configu z dysku
3. **Gateway Terminal** — security hole (brak auth)
4. **API Routes** — podejrzenie uszkodzenia pliku (BOM)
5. **Channel Manager & Bridges** — XSS, kruche importy, brak plugin manifestów

### Session

Session ID: 9f1aec81-79aa-4a31-a1ba-ea32c48a7470