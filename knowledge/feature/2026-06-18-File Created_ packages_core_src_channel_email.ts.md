---
id: feature-1781746043112-fd1fc0
title: File Created: packages/core/src/channel/email.ts
category: feature
created_at: 2026-06-18T01:27:23.112Z
source: workspace
tags: [workspace, file-created, ts]
---

Created file `packages/core/src/channel/email.ts` in workspace

```
/**
 * Nexus AI Email Bridge — IMAP polling + SMTP send
 * Ported from Hermes Agent email_tool.py + send_message_tool.py
 *
 * Supports: send, list, read (full), reply, search, list_folders
 * Config: EMAIL_IMAP_HOST, EMAIL_IMAP_PORT, EMAIL_IMAP_USER, EMAIL_IMAP_PASS
 *         EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, EMAIL_SMTP_USER, EMAIL_SMTP_PASS
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

```
