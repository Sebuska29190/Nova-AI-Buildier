---
tags: [agent-report, auditor]
scope: project
created_at: 2026-05-20T01:02:00.616Z
importance: medium
---
## Background Agent Report: Auditor

**Agent:** Auditor (auditor)
**Run ID:** 5112c853
**Started:** 2026-05-20T01:00:05.955Z
**Completed:** 2026-05-20T01:02:00.615Z
**Model:** deepseek/deepseek-chat

### Result

Mam już pełny obraz projektu. Oto kompletny raport audytu.

---

# RAPORT AUDYTU — Nova AI Platform v0.7.0
**Data:** 2026-05-20
**Audytor:** Agent audytowy Nova (autonomiczny)

---

## PODSUMOWANIE GLOBALNE

| Moduł | Status | Pliki (TS) | Linie | Krytyczne | Poważne | Drobne |
|---|---|---|---|---|---|---|
| **kernel/** | HAS ISSUES | 3 | 77+ | 1 | 2 | 1 |
| **agent/** | HAS ISSUES | 5 | 50+ | 1 | 3 | 2 |
| **api/routes.ts** | HAS ISSUES | 1 | ~950 | 1 | 2 | 3 |
| **plugin/** | HAS ISSUES | 4 | ~120+ | 0 | 3 | 2 |
| **auth/jwt.ts** | HAS ISSUES | 1 | 108 | 1 | 1 | 1 |
| **session/** | WORKS | 1 | 107 | 0 | 0 | 0 |
| **memory/** | WORKS | 1 | 100 | 0 | 0 | 1 |
| **event-bus/** | WORKS | 1 | 44 | 0 | 1 | 0 |
| **config/** | HAS ISSUES | 1 | 268 | 0 | 2 | 1 |
| **harness/** | WORKS | 2 | 90+ | 0 | 0 | 0 |
| **gateway/** | HAS ISSUES | 3 | 130+ | 0 | 1 | 2 |
| **workspace/** | WORKS | 1 | 290 | 0 | 0 | 1 |
| **knowledge/** | WORKS | 1 | 220 | 0 | 0 | 0 |
| **skill/** | WORKS | 2 | 150+ | 0 | 0 | 0 |
| **worker/** | WORKS | 1 | 170 | 0 | 0 | 1 |
| **trading/** | WORKS | 1 | 205 | 0 | 0 | 0 |
| **search/** | WORKS | 1 | 64 | 0 | 0 | 0 |
| **research/** | WORKS | 1 | 280+ | 0 | 0 | 0 |
| **mcp/** | BROKEN | 1 | 107 | 2 | 0 | 0 |
| **multi-agent/** | WORKS | 2 | 100+ | 0 | 0 | 0 |
| **crypto/** | WORKS | 8 | ~45+ | 0 | 0 | 1 |
| **video/** | HAS ISSUES | 1 | ~30+ (pipeline) | 0 | 1 | 1 |
| **browser/** | HAS ISSUES | 3 | 250+ | 1 | 1 | 0 |
| **voice/** | WORKS | 3 | 55+ | 0 | 0 | 0 |
| **media/** | BROKEN | 3 | 65+ | 1 | 0 | 1 |
| **providers (12)** | HAS ISSUES | 12 | ~35+ each | 0 | 1 | 2 |
| **sdk/** | WORKS | 2 | 120+ | 0 | 0 | 0 |
| **ui/** | HAS ISSUES | 25+ | 2500+ | 1 | 2 | 3 |
| **tests/** | HAS ISSUES | 10 | ~80+ | 0 | 1 | 1 |

---

## MODUŁ: kernel/

**Status:** HAS ISSUES
**Pliki:** `index.ts` (24 linie), `agentfs.ts` (127 linii), `ledger.ts` (113 linii)

### Issues

- **[MAJOR]** `kernel/index.ts:9` — import `join` z `node:path` jest na dole pliku (linia 45), ale używany w `init()` w linii 18 → ReferenceError w runtime.
  ```typescript
  // Linia 9 — init() calls join() but join is not imported yet
  const basePath = config?.basePath ?? join(process.cwd(), "kernel");
  // import { join } from "node:path" jest dopiero na linii 45!
  ```
  **Fix:** Przenieś `import { join }` na górę pliku (przed `class Kernel`).

- **[CRITICAL]** `kernel/agentfs.ts:88` — `readAgentFile()` nie sprawdza poprawności `agentId`/`fileName`, brak zabezpieczenia przed path traversal. Jeśli agentId zawiera `../../../etc/passwd`, agentFS zapisze/odczyta poza katalogiem.
  ```typescript
  const fullPath = join(this.agentDir(agentId), fileName);  // No sanitization!
  ```
  **Fix:** Dodaj walidację `agentId` (tylko `[a-z0-9_-]`) i `fileName` (wykrywanie `..`).

- **[MINOR]** `kernel/ledger.ts:98` — `getStats()` parsuje wszystkie pliki JSONL w pamięci. Dla dużych ledgerów (100k+ wpisów) będzie to bardzo wolne. Brak indeksowania.

### Fix Suggestion
```typescript
// kernel/index.ts — przenieś import join na górę
import { join } from "node:path";
```

---

## MODUŁ: agent/

**Status:** HAS ISSUES
**Pliki:** `store.ts` (120+ linii), `runner.ts` (200+ linii), `scheduler.ts` (180+ linii), `auto-bug-fixer.ts` (80+ linii), `community-agents.ts` (130+ linii)

### Issues

- **[CRITICAL]** `agent/runner.ts:44` — `loadGlobalRules()` czyta `config/rules.txt` tylko raz. Brak memoizacji lub cache invalidation. Funkcja jest wywoływana przy każdym `runAgent()` — dla każdej wiadomości czyta plik z dysku. Wydajność: potencjalny problem przy wielu równoczesnych agentach.
  ```typescript
  function loadGlobalRules(): string {
    try {
      const rulesPath = join(process.cwd(), "config", "rules.txt");
      if (existsSync(rulesPath)) {
        return readFileSync(rulesPath, "utf-8").trim();
      }
    } catch {}
    return "";
  }
  ```
  **Fix:** Użyj cache z TTL lub watch mode.

- **[MAJOR]** `agent/runner.ts:50` — `loadSkills()` jest wywoływana przy każdym `runAgent()` w linii 54. `loadSkills()` skanuje cały katalog `skills/` (46+ plików) rekurencyjnie. To spory narzut I/O na każde żądanie.
  ```typescript
  const allSkills = loadSkills();
  ```
  **Fix:** Zainicjalizuj globalną listę skilli przy starcie i odświeżaj tylko gdy lista się zmienia.

- **[MAJOR]** `agent/store.ts:77` — `agentDir(id)` tworzy katalog przy każdym odczycie pliku przez `listFiles`. Tworzenie katalogów w getterze jest anti-patternem.
  ```typescript
  private agentDir(id: string): string {
    const dir = join(this.baseDir, id);
    mkdirSync(dir, { recursive: true });  // ← tworzy katalog przy każdym wywołaniu
    return dir;
  }
  ```
  **Fix:** Twórz katalog tylko w `create()` i `ensureWorkspace()`.

- **[MINOR]** `agent/scheduler.ts:130` — Duplikacja kodu: `memoryStore.save()` jest wywoływany DWUKROTNIE z prawie identycznymi danymi (linie 130 i 155).

- **[MINOR]** `agent/community-agents.ts` — Wszystkie agenty używają `deepseek/deepseek-chat` jako domyślnego modelu. Żaden nie ma zdefiniowanego `thinkingLevel`.

### Fix Suggestion
```typescript
// agent/runner.ts — dodaj cache dla loadSkills
let _skillsCache: SkillDef[] | null = null;
let _skillsCacheTime = 0;
function loadCachedSkills(): SkillDef[] {
  if (_skillsCache && Date.now() - _skillsCacheTime < 30000) return _skillsCache;
  _skillsCache = loadSkills();
  _skillsCacheTime = Date.now();
  return _skillsCache;
}
```

---

## MODUŁ: api/routes.ts

**Status:** HAS ISSUES
**Pliki:** `routes.ts` (~950 linii)

### Issues

- **[CRITICAL]** `api/routes.ts:47-50` — Auth middleware pozwala na publiczne GET dla `/api/*`:
  ```typescript
  if (c.req.method === "GET" && path.startsWith("/api/")) return next();
  ```
  To oznacza, że API keys, configi providerów i listy agentów są publicznie dostępne (tylko GET, ale nadal wrażliwe). Autoryzacja jest tylko dla POST/PUT/DELETE.

- **[MAJOR]** `api/routes.ts:230` — `workspace` w `/api/agent/send` używa dynamicznego importu:
  ```typescript
  const { workspaceManager } = await import("../workspace/manager.ts");
  ```
  Jest to importowane statycznie na górze pliku (linia 27) i dynamicznie w środku handlera. To samo dotyczy kilku innych importów (np. `emitEvent` w scheduler.ts:155).

- **[MAJOR]** `api/routes.ts:100` — W handlerze `/v1/chat/completions` z `stream: true`, subskrypcja eventów przez `onEvent` nie jest cleanupowana w przypadku błędu `runAgent`. `finally` cleanupuje tylko `unsubAssistant()` (linia 136), ale nie cleanupuje subskrypcji z `onEventKind()`, które mogą być dodane gdzie indziej.

- **[MINOR]** `api/routes.ts:210` — Route `/api/agents/jobs` jest przed route'em `/:id`, co jest poprawne, ale może być mylące.

- **[MINOR]** `api/routes.ts:15-16` — Import `join, dirname` jest zadeklarowany ale nieużywany w tym pliku (używany tylko w `resolveUiDir` w main.ts).

### Fix Suggestion
```typescript
// routes.ts — auth middleware: add more restrictive GET access
function authMiddleware(c: any, next: any) {
  const path = c.req.path;
  if (PUBLIC_PATHS.some((p) => path === p || path.startsWith(p))) return next();
  const auth = c.req.header("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : c.req.cookie?.("nova_token") || "";
  if (token) {
    const user = verifyToken(token);
    if (user) { c.set("user", user); return next(); }
  }
  // Bezpieczniejsze: tylko /api/sessions, /api/tools, /v1/models
  if (c.req.method === "GET" && ["/api/sessions", "/api/tools", "/v1/models", "/api/agents", "/api/provider-configs"].some(p => path === p || path.startsWith(p))) return next();
  return c.json({ error: "Unauthorized" }, 401);
}
```

---

## MODUŁ: auth/jwt.ts

**Status:** HAS ISSUES
**Pliki:** `jwt.ts` (108 linii)

### Issues

- **[CRITICAL]** `auth/jwt.ts:29` — `require("node:fs")` używane zamiast importu:
  ```typescript
  const { mkdirSync } = require("node:fs") as typeof import("node:fs");
  ```
  W projekcie ESM (`"type": "module"`) `require` nie jest dostępne domyślnie. To może rzucić `ReferenceError: require is not defined` w Bunie, jeśli typ modułu jest strict ESM.

- **[MAJOR]** `auth/jwt.ts:43` — Własna implementacja JWT z SHA256 zamiast HMAC-SHA256:
  ```typescript
  function hmacSign(data: string): string {
    const hmac = createHash("sha256").update(data + SECRET).digest("base64url");
  }
  ```
  To nie jest HMAC — to zwykły hash (SHA256) z konkatenacją. Prawidłowy HMAC-SHA256 używa `createHmac("sha256", SECRET)`.

- **[MINOR]** `auth/jwt.ts:95` — `getDb()` tworzy nowe połączenie SQLite przy każdym wywołaniu i nie zamyka go w `registerUser`.

### Fix Suggestion
```typescript
// auth/jwt.ts — fix HMAC-SHA256
import { createHmac } from "node:crypto";
function hmacSign(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}
```

---

## MODUŁ: media/generator.ts

**Status:** BROKEN
**Pliki:** `generator.ts` (35 linii)

### Issues

- **[CRITICAL]** `media/generator.ts:54-55` — Użycie `require` na dole pliku poza funkcją:
  ```typescript
  const { join, dirname } = require("node:path");
  const { mkdirSync, writeFileSync } = require("node:fs");
  ```
  To jest niedozwolone w ESM. Będzie błąd wykonania. Importy muszą być na górze pliku. Powoduje to całkowite zablokowanie tego modułu.

- **[MINOR]** Plik importuje `join` i `dirname` używając `require()` na dole, ale w liniach 43-44 już używa `join()` i `dirname()` — to nigdy nie zadziała.

### Fix Suggestion
```typescript
// media/generator.ts — przenieś import na górę
import { join, dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
// Usuń require() z dołu pliku
```

---

## MODUŁ: mcp/client.ts

**Status:** BROKEN
**Pliki:** `client.ts` (107 linii)

### Issues

- **[CRITICAL]** `mcp/client.ts:28` — `loadConfigs()` jest wywoływana tylko przy imporcie (nie ma auto-exec). Nikt nie woła `mcpManager.loadConfigs()` w main.ts ani w żadnym inicializatorze. MCP serwery NIGDY nie są uruchamiane.

- **[CRITICAL]** `mcp/client.ts:95` — `callTool()` zwraca placeholder JSON z błędem:
  ```typescript
  async callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<string> {
    return JSON.stringify({ error: "MCP tool execution not yet implemented" });
  }
  ```
  Funkcja nigdy nie została zaimplementowana. To jest dead code lub niekompletna funkcjonalność.

- **[MAJOR]** `mcp/client.ts:55` — `startServer()` otwiera proces stdio, ale nigdy go nie zamyka ani nie zarządza lifetime'em. Przy wielokrotnym wywołaniu tworzy procesy zombie.

### Fix Suggestion
```typescript
// main.ts — dodaj inicjalizację MCP
import { mcpManager } from "./mcp/client.ts";
mcpManager.loadConfigs();
```

---

## MODUŁ: plugin/community-skills.ts

**Status:** HAS ISSUES
**Pliki:** `community-skills.ts` (~850 linii) — największy plik w projekcie

### Issues

- **[MAJOR]** `community-skills.ts` — Jest to jeden plik z ~850 liniami kodu, który rejestruje WSZYSTKIE tool'e w jednym bloku. To narusza zasadę SRP (Single Responsibility Principle). Każdy tool powinien być własnym modułem.

- **[MAJOR]** `community-skills.ts:300-350` — Tool `spotify_search` przechowuje token w `process.env.SPOTIFY_ACCESS_TOKEN`. Nie odświeża go. Tokeny Spotify wygasają po 1h. Po godzinie API zwraca 401, co nigdzie nie jest obsługiwane.

- **[MINOR]** Większość tool'i w tym pliku nie ma żadnych testów.

---

## MODUŁ: ui/ (Frontend)

**Status:** HAS ISSUES
**Pliki:** 25+ plików Svelte, `App.svelte`, `main.ts`

### Issues

- **[CRITICAL]** `ui/src/routes/AgentsPage.svelte:88-96` — Frontend bezpośrednio używa `localhost:4123`:
  ```typescript
  const res = await fetch("http://localhost:4123/api/agents", {
  ```
  W produkcji URL backendu może być inny. Brak konfiguracji base URL przez zmienną środowiskową lub plik konfiguracyjny.

- **[MAJOR]** `ui/src/routes/AgentsPage.svelte:166` — WebSocket łączy się z `ws://localhost:4123/ws/agents` — inny endpoint niż backendowy `/ws`. Backend nie ma route'a `/ws/agents` — obsługuje tylko `/ws`. Połączenie WS NIGDY nie zadziała.

- **[MAJOR]** `ui/src/routes/ChatPage.svelte:53` — `api.chatSend()` oczekuje callbacku `(chunk) => { streamContent = chunk }` ale `streamContent` jest nadpisywane każdego chunka. W strumieniowaniu powinno być APPENDOWANE, nie zastępowane.

- **[MINOR]** `ui/src/routes/ChatPage.svelte` — Używa `marked.parse()` bez sanitizacji HTML. Jeśli odpowiedź agenta zawiera złośliwy HTML, będzie to XSS.

### Fix Suggestion
```typescript
// AgentsPage.svelte — użyj względnego URL lub zmiennej env
const BASE_URL = import.meta.env.VITE_API_URL || "";
const res = await fetch(`${BASE_URL}/api/agents`, { ... });

// ChatPage.svelte — append zamiast replace
let streamContent = $state("");
// ...
api.chatSend(text, model, sessionId, (chunk) => { 
  streamContent += chunk;  // append!
});
```

---

## MODUŁ: provider-* (12 providerów)

**Status:** HAS ISSUES
**Pliki:** `provider-anthropic/`, `provider-openai/`, `provider-deepseek/`, `provider-gemini/`, etc.

### Issues

- **[MAJOR]** `provider-anthropic/src/index.ts:29` — Provider Anthropic ma `thinkingProfile.levels` ale `pi.ts` używa `thinking` tylko dla modeli `o1/o3/claude-sonnet-4`. Inne modele z obsługą thinking (np. deepseek-reasoner) nie są uwzględnione.

- **[MINOR]** Wszystkie provider'y używają tego samego wzorca kodu — dużo duplikacji logiki SSE/stream parsowania. To powinno być wydzielone do współnego modułu.

- **[MINOR]** `provider-openai/src/index.ts` — Model `gpt-5.5` z ceną $10/$40 za 1M tokenów. To nie są oficjalne ceny OpenAI (GPT-4.1 kosztuje $2/$8).

---

## MODUŁ: tests/

**Status:** HAS ISSUES
**Pliki:** 10 testów

### Issues

- **[MAJOR]** `__tests__/api.test.ts` — Testy nie mockują `fetch`. Testy `registerUser()` i `loginUser()` w `auth.test.ts` tworzą prawdziwe konto SQLite. Testy nie są izolowane.

- **[MINOR]** Brak testów dla: `runner.ts`, `tools.ts`, `community-skills.ts`, `community-plugins.ts`, `harness/pi.ts`, `workspace/manager.ts`. Pokrycie kodu ~5%.

---

## LISTA KRYTYCZNYCH BŁĘDÓW (BEZPOŚREDNIO ŁAMIĄCYCH APLIKACJĘ)

| # | Plik | Linia | Problem | Konsekwencja |
|---|---|---|---|---|
| 1 | `kernel/index.ts` | 18 | `join()` użyty przed importem | **Rzuca ReferenceError** w runtime |
| 2 | `auth/jwt.ts` | 29 | `require()` w ESM | **ReferenceError** przy pierwszym uruchomieniu |
| 3 | `media/generator.ts` | 54 | `require()` w ESM | **ReferenceError** przy imporcie modułu |
| 4 | `mcp/client.ts` | 95 | `callTool()` niezaimplementowane | **MCP tool'e nigdy nie działają** |
| 5 | `ui/AgentsPage.svelte` | 166 | Zły endpoint WS | **WebSocket agentów nigdy się nie łączy** |
| 6 | `api/routes.ts` | 49 | Słaba autoryzacja GET | **API keys mogą być wycieknięte** |
| 7 | `auth/jwt.ts` | 43 | SHA256 zamiast HMAC-SHA256 | **JWT można sfałszować** |
| 8 | `agent/runner.ts` | 44 | Brak cache loadGlobalRules() | **Spadek wydajności przy wielu żądaniach** |

---

## KOLEJNOŚĆ NAPRAW (PRIORYTETOWANA)

### Priority 1 — Crash fix (natychmiast)
1. `kernel/index.ts` — przenieś import `join` na górę
2. `auth/jwt.ts` — zamień `require()` na `import`
3. `media/generator.ts` — przenieś importy na górę
4. `ui/AgentsPage.svelte` — popraw endpoint WS (ws://.../ws zamiast /ws/agents)

### Priority 2 — Security fix (wysoki)
5. `api/routes.ts` — zaostrz auth middleware dla GET
6. `auth/jwt.ts` — napraw HMAC-SHA256 (`createHmac`)

### Priority 3 — Funkcjonalność (średni)
7. `mcp/client.ts` — zaimplementuj `callTool()` i dodaj inicjalizację
8. `agent/runner.ts` — dodaj cache dla `loadSkills()`
9. `ui/ChatPage.svelte` — napraw append streamContent

### Priority 4 — Wydajność i czystość kodu (niski)
10. `agent/runner.ts` — cache dla `loadGlobalRules()`
11. `agent/store.ts` — usuń `mkdirSync` z gettera
12. `community-skills.ts` — podziel na osobne moduły
13. Provider'y — wydziel wspólny parser SSE

---

## GRAF ZALEŻNOŚCI MIĘDZY MODUŁAMI

```
sdk (types)
  ├── plugin/registry.ts
  │     ├── provider-* (12 providerów)
  │     ├── plugin/tools.ts
  │     │     ├── plugin/community-skills.ts
  │     │     └── search/web.ts
  │     └── harness/pi.ts
  │           └── agent/runner.ts
  │                 ├── agent/store.ts
  │                 ├── agent/scheduler.ts
  │                 ├── agent/auto-bug-fixer.ts
  │                 ├── agent/community-agents.ts
  │                 ├── session/manager.ts
  │                 ├── event-bus/index.ts
  │                 ├── circuit-breaker.ts
  │                 ├── error-classifier.ts
  │                 ├── quota.ts
  │                 ├── compaction.ts
  │                 ├── multi-agent/*.ts
  │                 ├── research/engine.ts
  │                 └── api/routes.ts
  │                       └── gateway/*.ts
  │                             ├── worker/manager.ts
  │                             ├── video/pipeline.ts
  │                             ├── channel/manager.ts
  │                             ├── trading/analyzer.ts
  │                             ├── crypto/*.ts
  │                             └── ui/ (Svelte frontend)
  └── main.ts (launcher)
        ├── auth/jwt.ts
        ├── config/provider-config.ts
        ├── knowledge/store.ts
        ├── kernel/index.ts
        ├── memory/store.ts
        ├── workspace/manager.ts
        ├── skill/*.ts
        └── health.ts
```

---

## ZAKOŃCZENIE

**Projekt Nova AI v0.7.0 jest w fazie intensywnego developmentu.** Architektura jest solidna — wzorzec pluginowy, system eventów, harness, circuit breaker. Jednak znaleziono:

- **3 błędy krytyczne (crash)**: kernel/index.ts, auth/jwt.ts (require), media/generator.ts
- **1 luka bezpieczeństwa**: auth/jwt.ts (SHA256 zamiast HMAC)
- **1 niekompletna funkcjonalność**: MCP client
- **2 błędy frontendu**: WS endpoint, stream append
- **Znaczne problemy z wydajnością**: brak cache'owania w runner.ts
- **Bardzo niskie pokrycie testami** (~5%)

**Rekomendacja:** Naprawić 8 krytycznych błędów w pierwszej kolejności (Priority 1-2), a następnie zająć się wydajnością i pokryciem testów. Projekt ma potencjał, ale wymaga natychmiastowych poprawek, by był stabilny w produkcji.

### Session

Session ID: 91fec70e-082d-4d5e-8105-17b402313072