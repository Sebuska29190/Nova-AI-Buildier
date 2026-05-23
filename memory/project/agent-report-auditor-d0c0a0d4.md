---
tags: [agent-report, auditor]
scope: project
created_at: 2026-05-20T01:09:50.033Z
importance: medium
---
## Background Agent Report: Auditor

**Agent:** Auditor (auditor)
**Run ID:** d0c0a0d4
**Started:** 2026-05-20T01:08:28.405Z
**Completed:** 2026-05-20T01:09:50.033Z
**Model:** deepseek/deepseek-chat

### Result

Now I have enough data. Let me compile the comprehensive audit report.

---

# 📋 RAPORT AUDYTU — NOVA AI PLATFORM

## 📊 Podsumowanie ogólne

| Moduł | Status | Pliki | Linie |
|-------|--------|-------|-------|
| **Video** | **MA WIELE BŁĘDÓW** | 10 + 1 .py | ~90 KB |
| API/Routes | MA PROBLEMY | 1 | 51.5 KB |
| Main/Launcher | DZIAŁA | 2 | 13.6 KB |
| Agent | DZIAŁA | 5 | 51.4 KB |
| Plugin/Tools | DZIAŁA | 5 | 140 KB |
| Worker | DZIAŁA | 1 | 7.2 KB |
| Assembly (video) | **MA BŁĘDY** | 2 | 22.7 KB |
| Infrastruktura | DZIAŁA | ~30 | ~200 KB |

---

## 🚨 MODUŁ VIDEO — DOKŁADNA ANALIZA

### MODUŁ: video/assembly.ts
**Status: BROKEN** (2 błędy krytyczne, 2 poważne)

#### Pliki:
- `assembly.ts` (14.4 KB)
- `burn_subs.py` (8.3 KB)

#### [CRITICAL] assembly.ts:580 — **Brak funkcji `burnSubtitles`**
Funkcja `burnSubtitles()` jest wywoływana w linii `await burnSubtitles(tmpVideo, outputFile, srtFile!, isShort, quality);` ale **NIE JEST ZDEFINIOWANA** w żadnym pliku .ts. Nie ma importu, nie ma deklaracji, nie ma implementacji. Kod zawsze rzuci `ReferenceError: burnSubtitles is not defined` przy próbie wypalenia napisów.

**Dlaczego to krytyczne:** Subtitling w ogóle nie działa. Każde video z napisami wywali błąd. Python script `burn_subs.py` istnieje, ale nie ma TypeScript wrappera który by go wywołał.

**Fix:** Dodać funkcję w assembly.ts:
```typescript
export async function burnSubtitles(
  inputVideo: string, outputVideo: string, srtFile: string, isShort: boolean, quality: string
): Promise<void> {
  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  const args = [join(__SDIR, "burn_subs.py"), inputVideo, srtFile, outputVideo];
  if (isShort) args.push("--short");
  args.push(`--quality=${quality}`);
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(pythonCmd, args);
    let stderr = "";
    proc.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`burn_subs.py exit ${code}: ${stderr.slice(-200)}`)));
    proc.on("error", reject);
  });
}
```

#### [CRITICAL] assembly.ts:620 — **Brak funkcji `buildEffectsFilter`**
Funkcja `buildEffectsFilter()` jest wywoływana w linii `const fxFilters = buildEffectsFilter(effectList, isShort);` ale **NIE JEST ZDEFINIOWANA**. Efekty wizualne (vignette, glitch, vhs, grain, bloom) w ogóle nie działają.

**Fix:** Dodać implementację:
```typescript
function buildEffectsFilter(effects: string[], isShort: boolean): string | null {
  const filters: string[] = [];
  for (const effect of effects) {
    switch (effect) {
      case "vignette": filters.push("vignette=PI/4"); break;
      case "grayscale": filters.push("colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3"); break;
      case "sepia": filters.push("colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131"); break;
      case "blur": filters.push("boxblur=5:1"); break;
      case "bloom": filters.push("avgblur=3:3:enable='between(t,0,10)'"); break;
      case "vhs": filters.push("hue=H=20*sin(2*PI*t/5):s=1"); break;
      case "grain": filters.push("noise=alls=10:allf=t+u"); break;
      case "glitch": filters.push("geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)'"); break; // simplified
    }
  }
  return filters.length > 0 ? filters.join(",") : null;
}
```

#### [MAJOR] pipeline.ts:1 — **Moduł pipeline.ts ma 280+ linii powtórzonego kodu**
Wszystkie 3 segmenty pliku (linie 1-140, 140-280, 280-420) są IDENTYCZNE. Kod źródłowy jest 3-krotnie powielony. To oznacza, że:
- Funkcje `getVideoJobs`, `getVideoJob`, `startVideoGeneration`, `cancelVideoJob`, `deleteVideoJob`, `runPipeline` są zadeklarowane 3 razy
- Przy próbie uruchomienia TypeScript/JavaScript zgłosi błąd **"Identifier has already been declared"**

**Fix:** Usunąć duplikaty — pozostawić tylko JEDNĄ kopię pipeline.ts.

#### [MAJOR] assembly.ts:250 — **Ciche połykanie błędów FFmpeg dla każdego klipa**
```typescript
try {
  await runFFmpeg([...]); 
  clipFiles.push(clipPath);
} catch {} // 🚫 Błąd ZJEDZONY - cisza
```
Jeśli którykolwiek klip się nie wygeneruje (np. brak ffmpeg, zła ścieżka), błąd jest całkowicie połykany. Prowadzi do sytuacji gdzie `clipFiles` jest puste, a funkcja zwraca `false`, co pipeline zgłasza jako "success" ale z zerowym wynikiem.

Fix: Zalogować błąd przed catch:
```typescript
catch (e) { console.warn(`[clip ${i}] failed: ${safeMessage(e)}`); }
```

#### [MAJOR] assembly.ts:222-250 — **Nieprawidłowa synchronizacja czasów klipów**
Gdy `imageTimestamps` nie pasują do liczby obrazów, algorytm dzieli duration proporcjonalnie. Ale gdy timestamps są, logika skalowania jest błędna:
```typescript
if (maxTs > duration * 0.9 || maxTs < duration * 0.5) {
  const scale = (duration * 0.85) / maxTs;
```
To wymusza sztuczne skalowanie jeśli czasy nie mieszczą się w przedziale 50-90% duration. Powoduje to, że **ustawienia użytkownika dotyczące czasu wyświetlania obrazów są ignorowane** — system nadpisuje timestamps użytkownika.

---

### MODUŁ: video/pipeline.ts
**Status: BROKEN** (kod powielony 3x, brak przekazania ustawień użytkownika)

#### [CRITICAL] pipeline.ts (całość) — **Potrójna duplikacja kodu**
Plik ma ~13 KB ale ~10 KB to duplikaty. TypeScript przy kompilacji zgłosi błędy redeklaracji.

#### [CRITICAL] pipeline.ts — **Ustawienia użytkownika NIE są przekazywane do createVideo**
W pipeline.ts, przy wywołaniu `createVideo()` (linia ~275):
```typescript
const ok = await createVideo(imagesDir, audioPath, outputPath, srtPath, imageTimestamps, isShort, quality);
```
Brak przekazania:
- `params.animationStyle` — styl animacji (**ZIGNOROWANY**)
- `params.effects` — efekty wizualne (**ZIGNOROWANE**)
- `params.imageCount` — liczba obrazów (**ZIGNOROWANA** przez pominięcie lub zapomnienie)

**Użytkownik ustawia animationStyle i effects, ale system ich nie używa!**

#### [MAJOR] pipeline.ts — **`params.imageCount` jest przekazany do `generateImages` ale nie jest przekazany w wywołaniu**
Linia wywołania:
```typescript
const imgCount = await generateImages(imagePrompts.map(...), imagesDir, params.imageEngine || "auto", isShort);
```
Brakuje 5. parametru `imageCount`!

A w `images.ts` funkcja `generateImages` faktycznie go obsługuje:
```typescript
export async function generateImages(prompts: ImagePrompt[], outputDir: string, engine: string, isShort = false, imageCount?: number): Promise<number> {
  const targetCount = Math.max(1, Math.min(20, imageCount ?? 6));
```

**Fix:** Dodać `params.imageCount` do wywołania:
```typescript
const imgCount = await generateImages(..., params.imageEngine || "auto", isShort, params.imageCount);
```

#### [MAJOR] pipeline.ts — **`animationStyle` i `effects` nie są przekazane do createVideo**
Obecne wywołanie:
```typescript
const ok = await createVideo(imagesDir, audioPath, outputPath, srtPath, imageTimestamps, isShort, quality);
```
Powinno być:
```typescript
const ok = await createVideo(imagesDir, audioPath, outputPath, srtPath, imageTimestamps, isShort, quality, params.animationStyle || "ken-burns", params.effects);
```

#### [MINOR] pipeline.ts — **Brak walidacji params.topic przed użyciem**
Jeśli `params.topic` jest pusty, `generateStory` dostanie pusty string. Należy sprawdzić przed rozpoczęciem.

---

### MODUŁ: video/images.ts
**Status: HAS ISSUES**

#### [MAJOR] images.ts:104 — **Używanie `require("fs")` zamiast importu**
```typescript
function getFileSize(p: string): number {
  try { return require("fs").statSync(p).size; } catch { return 0; }
}
```
W projekcie ESM/Bun `require` nie jest domyślnie dostępne. Powinno być:
```typescript
import { statSync } from "node:fs";
// ...
statSync(p).size;
```

#### [MINOR] images.ts — **Brak timeoutów na fetch do Unsplash/Pexels może wisieć**
Niektóre API calls mają `signal: AbortSignal.timeout(10000)` ale nie wszystkie.

---

### MODUŁ: video/story.ts
**Status: WORKS** (ale z problemami)

#### [MAJOR] story.ts — **`streamText` łapie wszystkie błędy i zwraca pusty string**
```typescript
try {
  await resolved.provider.stream({...});
} catch {} // 🚫 CICHY CATCH
```
Jeśli provider zwróci błąd (np. rate limit, timeout), funkcja zwróci pusty string, a pipeline zgłosi "Story generation failed" bez informacji co poszło nie tak.

---

### MODUŁ: video/tts.ts
**Status: HAS ISSUES**

#### [MINOR] tts.ts:93 — **Potencjalne XSS przez string interpolation w Python inline**
```python
script = `import asyncio, edge_tts; asyncio.run(edge_tts.Communicate("""${text.replace(/["\\]/g, '\\$&')}""", "${voice}").save(...))`
```
Tekst użytkownika (story) jest wstrzykiwany do inline Python. Jeśli story zawiera `"""` lub znaki specjalne, może to złamać składnię Pythona lub potencjalnie wykonać niechciany kod. Rzadkie, ale niebezpieczne.

---

## 🚨 MODUŁ: API/Routes

### MODUŁ: api/routes.ts
**Status: HAS ISSUES**

#### [MAJOR] routes.ts:1-51 — **Plik jest powielony (BOM + ogromny import block)**
Cały plik ma BOM (﻿) na początku i ~51 KB. Sekcja importów jest powtórzona przy każdej edycji.

#### [MAJOR] routes.ts — **Brak endpointu do pobierania gotowego video**
API ma:
- `GET /api/video/jobs` — lista
- `GET /api/video/jobs/:id` — szczegóły
- `POST /api/video/generate` — generowanie
- `POST /api/video/jobs/:id/cancel` — anulowanie
- `DELETE /api/video/jobs/:id` — usuwanie

Ale **BRAKUJE** endpointu do pobierania/outputu gotowego pliku video! `jobs.outputPath` jest przechowywany, ale nie ma jak go pobrać przez API.

#### [MAJOR] routes.ts — **Brak walidacji VideoParams przed przekazaniem do pipeline**
```typescript
app.post("/api/video/generate", async (c) => {
  const body = await c.req.json<VideoParams>();
  const job = await startVideoGeneration(body);
  return c.json(job);
});
```
Nie ma walidacji `body.topic` — jeśli jest null/undefined, pipeline i tak wystartuje i wygeneruje błąd. Należy dodać walidację przed uruchomieniem.

---

## 🚨 MODUŁ: Infrastruktura (wszystkie moduły)

### auth/jwt.ts
**Status: WORKS**

### session/manager.ts
**Status: WORKS**

### event-bus/index.ts
**Status: WORKS**

### workspace/manager.ts
**Status: WORKS**

### worker/manager.ts
**Status: WORKS**

### kernel/
**Status: WORKS**

### plugin/tools.ts
**Status: WORKS**

### plugin/registry.ts
**Status: WORKS**

### plugin/community-skills.ts
**Status: WORKS**

### plugin/community-plugins.ts
**Status: WORKS**

---

## 🔍 VIDEO — ANALIZA PRZESTRZEGANIA USTAWIEŃ UŻYTKOWNIKA

| Ustawienie | Zadeklarowane w `VideoParams` | Przekazane do pipeline | Faktycznie użyte | Status |
|-----------|------|------|------|--------|
| `topic` | ✅ | ✅ | ✅ | ✅ |
| `model` | ✅ | ✅ | ✅ | ✅ |
| `duration` | ✅ | ✅ | ✅ (pad audio) | ✅ |
| `isShort` | ✅ | ✅ | ✅ | ✅ |
| `quality` | ✅ | ✅ | ✅ | ✅ |
| `ttsEngine` | ✅ | ✅ | ✅ | ✅ |
| `imageEngine` | ✅ | ✅ | ✅ | ✅ |
| `subtitleMode` | ✅ | ✅ | ✅ | ✅ |
| `language` | ✅ | ✅ | ✅ | ✅ |
| `edgeVoice` | ✅ | ✅ | ✅ | ✅ |
| `nicheName` | ✅ | ✅ | ✅ | ✅ |
| `scriptText` | ✅ | ✅ | ✅ | ✅ |
| **`imageCount`** | ✅ | **❌ NIE** | **❌ NIE** | 🚫 **ZIGNOROWANE** |
| **`animationStyle`** | ✅ | **❌ NIE** | **❌ NIE** | 🚫 **ZIGNOROWANE** |
| **`imageStyle`** | ✅ | **❌ NIE** | **❌ NIE** | 🚫 **ZIGNOROWANE** |
| **`effects`** | ✅ | **❌ NIE** | **❌ NIE** | 🚫 **ZIGNOROWANE** |

**WNIOSEK:** 4 z 17 ustawień użytkownika są całkowicie ignorowane — system deklaruje je w `VideoParams` ale nigdy nie przekazuje do `createVideo()` ani `generateImages()`.

---

## 🔧 GRAF ZALEŻNOŚCI

```
api/routes.ts
  └─► video/pipeline.ts
        ├─► video/story.ts ──► plugin/registry.ts
        ├─► video/tts.ts
        ├─► video/subtitles.ts
        ├─► video/images.ts
        └─► video/assembly.ts (BROKEN: brak burnSubtitles, buildEffectsFilter)
              └─► video/burn_subs.py (istnieje, ale nie jest wywoływany)
```

---

## ⭐ PRIORYTETOWA KOLEJNOŚĆ NAPRAW

| Priorytet | Co naprawić | Dlaczego |
|-----------|------------|----------|
| **🔴 1** | `assembly.ts` — dodać `burnSubtitles()` | Subtitling nie działa w ogóle |
| **🔴 2** | `assembly.ts` — dodać `buildEffectsFilter()` | Efekty wizualne nie działają |
| **🔴 3** | `pipeline.ts` — usunąć 2 z 3 duplikatów | Kod się nie skompiluje |
| **🟠 4** | `pipeline.ts` — przekazać `animationStyle`, `effects`, `imageCount` do `createVideo()` i `generateImages()` | Ustawienia użytkownika ignorowane |
| **🟠 5** | `pipeline.ts` — dodać `imageCount` do wywołania `generateImages()` | Ustawienie liczby obrazów nie działa |
| **🟡 6** | `routes.ts` — dodać endpoint do pobierania gotowego video | Brak możliwości pobrania efektu |
| **🟡 7** | `images.ts` — zmienić `require("fs")` na import | Błąd w ESM/Bun |
| **🟡 8** | `assembly.ts` — usunąć ciche catch na generowaniu klipów | Debugowanie niemożliwe |
| **🟢 9** | `story.ts` — logować błędy w `streamText` | Lepsze diagnozowanie |
| **🟢 10** | `routes.ts` — dodać walidację VideoParams | Ochrona przed błędnymi danymi |

---

## 🔴 PODSUMOWANIE KRYTYCZNYCH BŁĘDÓW

1. **burnSubtitles nie istnieje** — każdy film z napisami rzuci ReferenceError
2. **buildEffectsFilter nie istnieje** — każdy film z efektami wizualnymi rzuci ReferenceError
3. **pipeline.ts powielony 3x** — TypeScript nie skompiluje kodu
4. **4 ustawienia użytkownika zignorowane** (imageCount, animationStyle, imageStyle, effects)
5. **imageCount nie przekazany** do generateImages (mimo że funkcja go obsługuje)
6. **Brak endpointu do pobierania gotowego video**

Projekt jest w stanie **niekompilowalnym** przez potrójną duplikację w pipeline.ts. Po usunięciu duplikatów, nadal 2 funkcje są brakujące (`burnSubtitles`, `buildEffectsFilter`), co powoduje ReferenceError w runtime.

### Session

Session ID: 3879110b-605d-4496-8180-66c4d493c4f0