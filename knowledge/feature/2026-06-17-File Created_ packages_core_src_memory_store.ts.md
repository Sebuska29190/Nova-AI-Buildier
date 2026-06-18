---
id: feature-1781739410725-51b1a0
title: File Created: packages/core/src/memory/store.ts
category: feature
created_at: 2026-06-17T23:36:50.725Z
source: workspace
tags: [workspace, file-created, ts]
---

Created file `packages/core/src/memory/store.ts` in workspace

```
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export interface MemoryEntry {
  id: string;
  name: string;
  content: string;
  tags: string[];
  scope: "user" | "project";
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string;
  importance: "low" | "medium" | "high";
}

class MemoryStore {
  private baseDir = "";
  private cache = new Map<string, MemoryE
```
