---
tags: [agent-report, code-reviewer]
scope: project
created_at: 2026-05-19T23:06:37.268Z
importance: medium
---
## Background Agent Report: Code Reviewer

**Agent:** Code Reviewer (code-reviewer)
**Run ID:** a20a6e2a
**Started:** 2026-05-19T23:06:03.910Z
**Completed:** 2026-05-19T23:06:37.268Z
**Model:** deepseek/deepseek-chat

### Result

Teraz mam pełny obraz. Przeanalizuję stan każdego z 5 krytycznych błędów z poprzedniego raportu i sprawdzę, czy zostały naprawione. Oto moja analiza:

---

# 🔴 Analiza 5 krytycznych błędów — status po ostatnich naprawach

## Błąd #1: In-Memory User Store — Brak Persistencji

**Poprzednio:** `users = new Map<string, StoredUser>()` w pamięci — dane ginęły po restarcie.

**Stan obecny w `packages/core/src/auth/jwt.ts`:** ✅ NAPRAWIONY!

- ✅ Zastąpiono `Map` przez **SQLite** (`bun:sqlite`) — baza `data/nova.db` z tabelą `users`
- ✅ **JWT secret jest trwale zapisywany** do pliku `data/jwt_secret.txt` — nie ginie po restarcie
- ✅ Użyto `timingSafeEqual` do porównania sygnatur JWT
- ✅ Hashe haseł z solą (`salt:hash` z SHA-256)

> **Werdykt: NAPRAWIONY — błąd krytyczny usunięty**

---

## Błąd #2: Tool Loop — WS Client Teardown Abortował WSZYSTKIE zadania

**Poprzednio:** W `websocket.ts` warunek `/* check if this runId belongs to this client */ true` był **zawsze true** — rozłączenie jednego klienta abortowało WSZYSTKIE taski.

**Stan obecny w `packages/core/src/gateway/websocket.ts`:** ✅ NAPRAWIONY!

- ✅ Dodano `clientRunIds = new Map<string, Set<string>>()` — mapa: `clientId → Set<runId>`
- ✅ Przy `handleChatSend`: `clientRunIds.get(client.id)!.add(runId)`
- ✅ Przy `ws.on("close")`: iteruje tylko po `runIds` należących do tego konkretnego klienta
- ✅ W `finally`: `clientRunIds.get(client.id)?.delete(runId)` — cleanup

> **Werdykt: NAPRAWIONY — błąd krytyczny usunięty**

---

## Błąd #3: `calculate` używał `new Function()` — Ryzyko Arbitralnego Wykonania Kodu

**Poprzednio:** `new Function(`"use strict"; return (${expression})`)()` — pełne RCE.

**Stan obecny w `packages/core/src/plugin/tools.ts`:** ✅ NAPRAWIONY!

- ✅ Całkowicie usunięto `new Function()` i `eval()`
- ✅ Zastąpiono własnym **safeMathEval** — recursive descent parser (Shunting-yard)
- ✅ Regex `allowed = /^[\d.+\-*\/()%\s pie]+$/` — tylko dozwolone znaki
- ✅ Blokada identyfikatorów innych niż `pi` i `e`
- ✅ Obsługa dzielenia przez zero

> **Werdykt: NAPRAWIONY — błąd krytyczny usunięty**

---

## Błąd #4: API Keys w Plaintext JSON

**Poprzednio:** `writeFileSync(CONFIG_PATH, JSON.stringify(store, null, 2))` — klucze jawnym tekstem.

**Stan obecny w `packages/core/src/config/provider-config.ts`:** ✅ NAPRAWIONY!

- ✅ **Szyfrowanie AES-256-GCM** — każde API key jest szyfrowane przed zapisem
- ✅ Klucz szyfrowania: z `NOVA_ENCRYPTION_KEY` → `NOVA_JWT_SECRET` → auto-generowany do `data/.encryption_key`
- ✅ Format: `iv:tag:ciphertext` (hex)
- ✅ `.gitignore` z `.encryption_key` dla klucza
- ✅ Deszyfrowanie przy odczycie, szyfrowanie przy zapisie
- ✅ Obsługa błędów deszyfrowania (korupcja danych)

**UWAGA:** Plik `data/provider-config.json` który odczytałem zawiera **nadal jawny klucz** (`sk-5cbec...`). To dlatego, że został zapisany *przed* wprowadzeniem szyfrowania — po nowym zapisie przez `saveProviderConfig` będzie już szyfrowany.

> **Werdykt: NAPRAWIONY w kodzie — istniejące dane w pliku mogą być jeszcze niezaszyfrowane (zależą od tego, czy już wywołano saveProviderConfig od czasu aktualizacji kodu)**

---

## Błąd #5: `import.meta.dirname` + nieużywany import `dirname` w MCP

**Poprzednio:** `resolve(import.meta.dirname, "..", "..", "packages", "ui")` — kruche ścieżki + dead import `dirname` w `mcp/client.ts`.

**Stan obecny w `packages/core/src/main.ts`:** ✅ NAPRAWIONY!

- ✅ Dodano **6 strategii** resolvowania ścieżki UI:
  1. `import.meta.dirname → packages/ui`
  2. `import.meta.dirname → ../packages/ui`
  3. `fileURLToPath(import.meta.url)` → `dirname` → `../../../packages/ui`
  4. `fileURLToPath` → `../../packages/ui`
  5. `process.cwd() → packages/ui`
  6. `process.cwd() → ../packages/ui`
- ✅ Każda strategia sprawdza `existsSync(join(path, "package.json"))`

**Stan obecny w `packages/core/src/mcp/client.ts`:** ✅ NAPRAWIONY!

- Usunięto `import { join, dirname } from "node:path"` — teraz tylko `import { join } from "node:path"`

> **Werdykt: NAPRAWIONY — błąd krytyczny usunięty**

---

## Bonus: Inne błędy które zauważyłem podczas tej analizy

### ⚠️ Błąd #6: `require("node:fs")` na końcu pliku `memory/store.ts` (linia 108)

```typescript
const { unlinkSync } = require("node:fs");
```

**Stan:** ❌ NIE NAPRAWIONY. `unlinkSync` jest używany w metodzie `delete()` (linia ~86), ale deklaracja z `require` jest na **końcu pliku**. W ESM, `require` jest dostępne tylko w kontekście runtime — i owszem zadziała przez hoisting `require`, ale lepiej byłoby użyć już zaimportowanego modułu. **Jednak `readFileSync, writeFileSync, existsSync` są już zaimportowane na górze pliku z `node:fs`** — wystarczy dodać `unlinkSync` do tamtego importu.

**Sugerowana łatka:**
```typescript
// Zmienić linię 1 z:
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
// na:
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
// I usunąć linię 108:
// const { unlinkSync } = require("node:fs"); // ← usunąć
```

### ⚠️ Błąd #7: `dirname()` zduplikowana funkcja w `session/manager.ts`

```typescript
function dirname(p: string): string {
  const i = p.lastIndexOf("/");
  const j = p.lastIndexOf("\\");
  return p.slice(0, Math.max(i, j));
}
```

**Stan:** ❌ Nadal obecna. Zamiast tego powinno być `import { dirname } from "node:path"` (które jest już zaimportowane w innych plikach). Ta własna implementacja nie obsługuje ścieżek UNC (`\\server\share`), korzeni (`C:\`) ani trailing slashy.

### ⚠️ Błąd #8: `onMessage` w kanałach — wciąż przekazuje pustą funkcję

**Stan:** Nadal widać ten pattern w kodzie. W `channel/manager.ts`:
```typescript
plugin.start({ ...bot, onMessage: (h) => {} }).then(() => {});
```

Funkcja `onMessage` przyjmuje handler, ale **nigdy go nie wywołuje** — przekazuje `(h) => {}` czyli pustą funkcję. Natomiast rzeczywisty handler (`wrappedHandler`) jest zdefiniowany, ale nigdzie nie przekazany do pluginu. To oznacza, że **kanały wciąż nie przetwarzają wiadomości przychodzących**.

### ⚠️ Błąd #9: Circuit Breaker — `recordSuccess()` wciąż nie jest wywoływany w `runner.ts`

W `circuit-breaker.ts` metoda `recordSuccess()` istnieje i działa (resetuje licznik błędów i zamyka obwód). W `runner.ts` — `breaker.recordFailure()` jest wywoływany przy błędzie, ale **`breaker.recordSuccess()` nigdy nie jest wołany po udanym żądaniu**. Obwód po otwarciu nie resetuje się automatycznie po udanym żądaniu (half-open działa przez timeout, ale nie ma resetu po sukcesie).

---

# 📋 Podsumowanie

| # | Błąd | Status | Uwagi |
|---|---|---|---|
| 1 | In-Memory User Store — brak persistencji | ✅ **NAPRAWIONY** | SQLite + persistent JWT secret |
| 2 | WS disconnect abortował wszystkie taski | ✅ **NAPRAWIONY** | `clientRunIds` per-klient |
| 3 | `new Function()` w `calculate` — RCE | ✅ **NAPRAWIONY** | Safe recursive descent parser |
| 4 | API Keys w plaintext | ✅ **NAPRAWIONY** | AES-256-GCM, istniejące dane mogą być jeszcze jawne |
| 5 | `import.meta.dirname` i dead import | ✅ **NAPRAWIONY** | 6 strategii resolvowania, usunięty dead import |

**Wszystkie 5 krytycznych błędów z poprzedniego audytu zostało naprawionych! 🎉**

### 🔴 Nowe krytyczne / poważne problemy znalezione:
1. **`onMessage` w kanałach Twitter/Telegram/Discord/Slack** — handler nie jest przekazywany do pluginu (kanały nie odbierają wiadomości)
2. **`require("node:fs")` na końcu `memory/store.ts`** — powinno być w importach na górze
3. **Duplikacja `dirname()` w `session/manager.ts`** — użyj `import { dirname } from "node:path"`
4. **Circuit Breaker nie woła `recordSuccess()`** — po sukcesie obwód się nie zamyka

### Session

Session ID: 13228cf9-c621-433d-84ce-fc1e3149d846