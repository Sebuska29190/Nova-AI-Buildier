# Plan Naprawczy v0.7.1 — Nova AI Builder

## Status napraw

| # | Bug | Plik | Przyczyna | Fix | Status |
|---|---|---|---|---|---|
| 1 | `api.sendMessage is not a function` | `ChatPage.svelte` | Frontend woła `api.sendMessage()` ale w `api.ts` jest `chatSend` | `sendMessage` → `chatSend` z poprawnymi parametrami | ✅ ZROBIONE |
| 2 | Terminal WS nie działa | `TerminalPage.svelte` | WS URL używa port 4200 zamiast 4123 | Port 4200 → 4123 | ✅ ZROBIONE |
| 3 | Agents — brak modala "Run Task" | `AgentsPage.svelte` + brak endpointu `/api/agents/:id/task` | Frontend nie ma UI wyboru zadania, backend nie ma endpointu | Dodać modal z textarea + backend route | 🔄 DO ZROBIENIA |
| 4 | Channels — Telegram brakuje chatId | `ChannelsPage.svelte` | Frontend wysyła tylko token, backend oczekuje token+chatId przez `/api/channels/:id/start` | Dodać pole chatId, zmienić endpoint na `/api/channels/:id/start` | 🔄 DO ZROBIENIA |
| 5 | Shopping — API 404 | `ShoppingPage.svelte` | Frontend woła zły endpoint | Przekierować na `/api/shopping/products?q=...` z istniejących route'ów | 🔄 DO ZROBIENIA |
| 6 | Analytics — brak danych | `AnalyticsPage.svelte` | Endpoint `/api/analytics/stats` nie istnieje w backendzie | Dodać endpoint w routes.ts lub użyć istniejących endpointów | 🔄 DO ZROBIENIA |
| 7 | Plugins — composio network | `community-plugins.ts` | Problem sieciowy, brak proxy | Dodać konfigurację proxy, poprawić error handling | 🔄 DO ZROBIENIA |
| 8 | Settings — brak funkcji | `ConfigPage.svelte`, `EnvPage.svelte` | Placeholder UI bez rzeczywistych opcji | Rozbudować o providers, API keys, rules, TTS/video defaults | 🔄 DO ZROBIENIA |

## Szczegóły napraw do zrobienia

### 3. Agents — Run Task Modal
**Frontend (AgentsPage.svelte):**
- Dodać `showTaskModal = $state(false)`, `taskInput = $state("")`
- Przycisk "Run Task" → otwiera modal z:
  - Textarea na zadanie (z placeholder np. "analyze project structure, build test suite, fix bugs in...")
  - Dropdown wybór modelu (z `availableModels`)
  - Przycisk "Execute" → woła `POST /api/agent/send` z `{ message: taskInput, model, agentId }`
  - Pole wyniku (pre formatowany tekst)

**Backend (routes.ts):** 
- Endpoint `POST /api/agents/:id/task` już nie istnieje. Trzeba go dodać lub użyć istniejącego `POST /api/agent/send` z `agentId`.

### 4. Channels — Telegram chatId
**Frontend (ChannelsPage.svelte):**
- W formularzu Telegram dodać pole `Chat ID` obok `Bot Token`
- Zmienić `connectChannel("telegram", { token })` na `connectChannel("telegram", { token, chatId })`
- Zmienić wywołanie z `/api/channels/connect` na `/api/channels/telegram/start` z body `{ token, chatId }`

### 5. Shopping — API 404
**Frontend (ShoppingPage.svelte):**
- `search()` powinno wołać `GET /api/shopping/products?q=...&minPrice=...&maxPrice=...&site=...&sortBy=...`
- Backend ma już ten endpoint (linia 1011 routes.ts): `app.get("/api/shopping/products", ...)`

### 6. Analytics — dane
**Backend (routes.ts):**
- Dodać `GET /api/analytics/stats` który zbiera: liczba sesji (GET /api/sessions), liczba agentów (GET /api/agents), liczba skilli (GET /api/skills), uptime
**Frontend (AnalyticsPage.svelte):**
- Użyć nowego endpointu zamiast mock data

### 7. Plugins — poprawa
**Backend (community-plugins.ts):**
- Dodać logowanie proxy (HTTP_PROXY, HTTPS_PROXY)
- Poprawić obsługę tar na Windows (błąd "Invalid argument" z CLAUDE.md)
- Dodać lepszy fallback download

### 8. Settings
**ConfigPage.svelte:**
- Dodać sekcje: Global Rules (textarea), TTS defaults, Video pipeline defaults, Max tokens, Thinking level
- Wczytywanie/zapisywanie przez `/api/config/rules`, `/api/config/settings`
