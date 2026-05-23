---
tags: [agent-report, code-reviewer]
scope: project
created_at: 2026-05-19T23:15:08.928Z
importance: medium
---
## Background Agent Report: Code Reviewer

**Agent:** Code Reviewer (code-reviewer)
**Run ID:** 9e7ad080
**Started:** 2026-05-19T23:14:34.553Z
**Completed:** 2026-05-19T23:15:08.928Z
**Model:** deepseek/deepseek-chat

### Result

Dobra, mam już pełny obraz. Przeanalizowałem wszystkie 4 fixy i dodatkowo znalazłem **3 nowe problemy** (jeden krytyczny) oraz **2 potencjalne usprawnienia**. Oto kompletna analiza:

---

## ✅ Weryfikacja fixów #6-#9

| # | Fix | Status | Uwagi |
|---|-----|--------|-------|
| **#6** | `unlinkSync` w importach + usunięty `require` na końcu | ✅ **OK** | `memory/store.ts` — import `unlinkSync` na górze, żadnego `require` w kodzie. |
| **#7** | `dirname` z `node:path` zamiast własnej funkcji | ✅ **OK** | `session/manager.ts` — `import { join, dirname } from "node:path"` na górze. |
| **#8** | onMessage z `wrappedHandler` zamiast `(h) => {}` | ✅ **OK** | `channel/manager.ts` — Telegram i Discord `onMessage` przekazują `wrappedHandler`. Slack i WeChat też mają faktyczny `onMessage`. |
| **#9** | `breaker.recordSuccess()` po udanym `toolLoop()` | ✅ **OK** | `agent/runner.ts` — linijka 135: `breaker.recordSuccess()` zaraz po `const result = await toolLoop(params, ctx);`. |

---

## 🚨 Dodatkowe błędy — do poprawy

### 🔴 BŁĄD #10 — Slack `onMessage` tworzy handler ale go nie wywołuje przez agenta (krytyczny)

**Plik:** `packages/core/src/channel/manager.ts`, sekcja `slack` (~linia 167)

**Problem:** Slack w `channel/manager.ts` robi:
```ts
onMessage: (handler: (msg: ChannelMessage) => Promise<void>) => {
  plugin.start({ ...bot, onMessage: handler }).then(() => {});
},
```
Ale w `packages/channel-slack/src/index.ts` poll loop robi:
```ts
await bot.onMessage(async (m: any) => {
  // Process through agent
});
```
To jest **pusty handler** — agent nigdy nie przetwarza wiadomości z Slacka. Powinno być tak samo jak w Telegram/Discord, czyli z `wrappedHandler` tworzącym sesję i wołającym `runAgent`.

### 🔴 BŁĄD #11 — WeChat `onMessage` też nie przetwarza wiadomości przez agenta

**Plik:** `packages/core/src/channel/manager.ts`, sekcja `wechat` (~linia 183)

**Problem:** Analogicznie do Slack — WeChat w `channel/manager.ts` przekazuje handler do pluginu, ale plugin WeChat (`packages/channel-wechat/src/index.ts`) ma pusty `pollTimer`:
```ts
pollTimer = setInterval(async () => {}, 5000);
```
Nigdy nie czyta wiadomości, nie woła `bot.onMessage`. Funkcjonalność WeChat jest martwa.

### 🔴 BŁĄD #12 — Telegram plugin: `msgHandler` ma nieskończoną rekurencję

**Plik:** `packages/channel-telegram/src/index.ts`, linia ~37

**Problem:**
```ts
msgHandler = async (m) => { 
  await bot.onMessage(async (msg) => { if (msgHandler) await msgHandler(msg); }); 
};
```
To tworzy nieskończoną pętlę rekurencyjną! `msgHandler` woła `bot.onMessage()` który dostaje callback, który woła `msgHandler` znowu... Powinno być:
```ts
msgHandler = async (m) => {
  // bezpośrednio przetwarzaj m, bez rekurencji
};
```
W praktyce to nie wybucha bo handler z `channel/manager.ts` nadpisuje `onMessage`, ale to kod jest mylący i potencjalnie niebezpieczny.

### 🟡 BUG #13 — `toolLoop` zwraca, ale `breaker.recordSuccess()` jest tylko w `runAgent`

**Plik:** `packages/core/src/agent/runner.ts`

**Problem:** `breaker.recordSuccess()` jest wołane tylko gdy `toolLoop` rzuci wyjątkiem (w `catch`). Jeśli `toolLoop` zakończy się sukcesem (zwróci `RunResult`), to `recordSuccess()` jest na linii 135 — **dobrze**. Ale:
- Jeśli `toolLoop` rzuci wyjątkiem (linia 138), to lecimy do `catch` gdzie jest `breaker.recordFailure()`
- Jeśli `toolLoop` zwróci poprawnie wynik — **OK**, fix #9 działa.

✅ Właściwie to jest OK, fix #9 działa poprawnie.

---

## 🟡 Potencjalne problemy (niższy priorytet)

### 🟡 #14 — Telegram plugin: `AbortSignal.timeout(30000)` przestarzałe w Bun

**Plik:** `packages/channel-telegram/src/index.ts`, linia 22

```ts
signal: AbortSignal.timeout(30000),
```
`AbortSignal.timeout()` nie jest wspierane we wszystkich wersjach Buna. Bezpieczniej użyć `AbortSignal.timeout(30000)` tylko jeśli runtime to wspiera, albo zrobić własny timeout.

### 🟡 #15 — Discord plugin: `sendMessage` nie jest zapisane do `inst.sendMessage`

**Plik:** `packages/core/src/channel/manager.ts`, sekcja `discord` (~linia 129)

W sekcji Telegram jest: `inst.sendMessage = bot.sendMessage.bind(bot);`
W sekcji Discord **brakuje** `inst.sendMessage` i `inst.sendThinking`. To znaczy, że `channelManager.send("discord", ...)` nie zadziała — `inst.sendMessage` będzie `undefined`.

### 🟡 #16 — `channel/manager.ts` reszta pliku ucięta

Plik `channel/manager.ts` przeczytałem tylko do sekcji `email` — jest więcej kodu poniżej (obsługa `email`, `webhook`, itd.). Nie widziałem reszty — mogą tam być dalsze problemy.

---

## 📋 Podsumowanie — priorytety do fixu

| Priorytet | # | Opis | Plik |
|-----------|---|------|------|
| 🔴 Krytyczny | **#10** | Slack `onMessage` — pusty handler, agent nie przetwarza wiadomości | `channel/manager.ts` + `channel-slack/src/index.ts` |
| 🔴 Krytyczny | **#11** | WeChat — zupełnie martwy, nie czyta wiadomości | `channel/manager.ts` + `channel-wechat/src/index.ts` |
| 🔴 Krytyczny | **#12** | Telegram plugin — `msgHandler` ma nieskończoną rekurencję | `channel-telegram/src/index.ts` |
| 🟡 Średni | **#15** | Discord — brak `inst.sendMessage`, `send()` nie zadziała | `channel/manager.ts` |

Chcesz żebym naprawił te dodatkowe błędy?

### Session

Session ID: 032ee104-cebf-48dd-a2d6-6de0719bd40b