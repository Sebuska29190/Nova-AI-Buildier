---
id: feature-1781738065572-44d8f9
title: File Created: packages/core/src/agent/runner.ts
category: feature
created_at: 2026-06-17T23:14:25.572Z
source: workspace
tags: [workspace, file-created, ts]
---

Created file `packages/core/src/agent/runner.ts` in workspace

```
﻿import type { AgentMessage, ToolCall } from "@nova/sdk";
import { safeMessage } from "../errors.ts";
import { registry } from "../plugin/registry.ts";
import { getTool, listTools } from "../plugin/tools.ts";
import { sessionManager } from "../session/manager.ts";
import { emitEvent } from "../event-bus/index.ts";
import { piHarness } from "../harness/pi.ts";
import { getBreaker } from "../circuit-breaker.ts";
import { classifyError } from "../error-classifier.ts";
import { checkQuota } from "..
```
