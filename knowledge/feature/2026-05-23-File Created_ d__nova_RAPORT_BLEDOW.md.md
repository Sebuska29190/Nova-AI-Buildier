---
id: feature-1779541088010-8ec7a4
title: File Created: d:\nova\RAPORT_BLEDOW.md
category: feature
created_at: 2026-05-23T12:58:08.010Z
source: workspace
tags: [workspace, file-created, md]
---

Created file `d:\nova\RAPORT_BLEDOW.md` in workspace

```
# 📋 RAPORT AUDYTU – Nova AI Platform v0.6.1

**Data audytu:** 2026-05-23  
**Audytor:** Auto Coder  
**Projekt:** Nova AI Builder (monorepo)

---

## 🔴 BŁĘDY KRYTYCZNE (Crashe / Blokady)

### 1. Brak pliku `bun.lock`/`node_modules` → Aplikacja nie uruchomi się

**Lokalizacja:** Root projektu  
**Problem:** W projekcie istnieje `bun.lock` ale nie ma `node_modules` ani skompilowanych zależności. Polecenie `bun run packages/core/src/main.ts` nie zadziała, ponieważ brakuje pakietów: `hono`, `@hono
```
