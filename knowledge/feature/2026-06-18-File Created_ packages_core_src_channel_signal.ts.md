---
id: feature-1781746038427-f7f35e
title: File Created: packages/core/src/channel/signal.ts
category: feature
created_at: 2026-06-18T01:27:18.427Z
source: workspace
tags: [workspace, file-created, ts]
---

Created file `packages/core/src/channel/signal.ts` in workspace

```
/**
 * Nexus AI Signal Bridge — signal-cli integration
 *
 * Uses signal-cli (Java CLI daemon) for Signal messaging.
 * First-time setup requires phone number verification via SMS/call.
 *
 * Setup:
 *   1. Download signal-cli: https://github.com/AsamK/signal-cli/releases
 *   2. Register: signal-cli -u +1234567890 register
 *   3. Verify:  signal-cli -u +1234567890 verify <CODE>
 *
 * Config:
 *   SIGNAL_PHONE — registered phone number (+1234567890)
 *   SIGNAL_CLI_PATH — path to signal-cli bin
```
