# RELEASE_v0.4.1.md — Subtitle Burning Fix (PIL approach)

**Date:** 2026-05-19
**Type:** Bugfix patch

## Changes

### Video: Subtitle burning rewritten (`packages/core/src/video/assembly.ts` + `burn_subs.py`)
- **Root cause:** FFmpeg `drawtext` filter is unusable on Windows due to:
  - Colon (`:`) in drive letters (`D:`) breaking FFmpeg filter graph parsing
  - Apostrophes and special chars in text breaking `text='...'` syntax  
  - Batch processing workarounds hit FFmpeg argument length limits
- **Fix:** Replaced entire FFmpeg drawtext approach with **PIL + FFmpeg overlay** (same approach as CheetahClaws)
  - Python `burn_subs.py` renders each subtitle entry as a transparent RGBA PNG (Pillow)
  - Text is rendered with black outline + white fill (perfect Unicode/CJK support)
  - FFmpeg overlay filter chain composites PNGs onto video at correct timestamps
  - Zero escaping issues — all text is in PNG pixels, not FFmpeg filter strings
  - Clean up: temporary dir removed after completion

### Video: SRT timing improved (`packages/core/src/video/subtitles.ts`)
- Synchronous `ffprobe` duration check (faster, no cross-module dependency)
- Proportional timing: CJK text split by character count, Latin text by word count
- Last SRT entry extended to full audio duration

## Files changed
| File | Change |
|------|--------|
| `packages/core/src/video/assembly.ts` | Rewrote `burnSubtitles()` — calls Python PIL script instead of FFmpeg drawtext |
| `packages/core/src/video/burn_subs.py` | **New** — PIL subtitle renderer + FFmpeg overlay (Unicode-safe) |
| `packages/core/src/video/subtitles.ts` | Rewrote `textToSrt()` — sync ffprobe, CJK support, last-entry extension |
| `packages/core/src/health.ts` | Version bumped 0.4.0 → 0.4.1 |
| `packages/core/package.json` | Version bumped 0.3.0 → 0.4.1 |
| `packages/ui/package.json` | Version bumped 0.3.0 → 0.4.1 |
