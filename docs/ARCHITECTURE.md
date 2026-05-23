# Nova Architecture

## Overview

Nova is a TypeScript/Bun monorepo AI agent platform. It follows a plugin-based architecture with a core engine that orchestrates agents, sessions, tools, and providers.

## Core Components

### 1. Agent System (`packages/core/src/agent/`)
- **`runner.ts`**: Agent execution loop with tool-calling (max 15 iterations), circuit breaker, quota enforcement
- **`store.ts`**: SQLite-backed agent storage with workspace files (AGENTS.md, SOUL.md, etc.)
- **`auto-bug-fixer.ts`**: Autonomous bug fixing agent (1:1 z CheetahClaws)

### 2. Session System (`packages/core/src/session/`)
- **`manager.ts`**: SQLite-backed sessions with transcripts table
- Auto-saves to Knowledge Base on session end

### 3. Plugin System (`packages/core/src/plugin/`)
- **`registry.ts`**: Provider and channel plugin registry
- **`loader.ts`**: Plugin discovery from packages directory
- **`tools.ts`**: Tool registry with built-in tools

### 4. Provider System (`packages/provider-*/`)
Each provider implements the `ProviderPlugin` interface:
- `id`, `name`, `models`, `auth`
- `stream()` — SSE streaming from LLM API
- `classifyError()` — Error classification
- `thinkingProfile()` — Optional reasoning support

12 providers: DeepSeek, Anthropic, OpenAI, Gemini, Ollama, Qwen, Zhipu, Kimi, MiniMax, LM Studio, Grok, Custom

### 5. Knowledge Base (`packages/core/src/knowledge/`)
- **`store.ts`**: File-based knowledge store with YAML frontmatter
- Categories: bug-fix, feature, research, session, decision, learning, config, trading, video, agent, skill, error
- Full-text search across all categories
- Auto-saves sessions and bug fixes

### 6. Kernel (`packages/core/src/kernel/`)
- **`agentfs.ts`**: Virtual file system for agents (private + shared global namespaces)
- **`ledger.ts`**: Immutable event log in JSONL format (one file per day)
- **`index.ts`**: Kernel initialization and orchestration

### 7. Multi-Agent (`packages/core/src/multi-agent/`)
- **`fanout.ts`**: Parallel delegation to multiple agents with knowledge sharing
- **`subagent.ts`**: Sub-agent spawning

### 8. Workspace (`packages/core/src/workspace/`)
- **`manager.ts`**: User-selectable folder for agent file operations
- Read/write/create/delete/search/tree operations

### 9. Research (`packages/core/src/research/`)
- **`engine.ts`**: 22 research sources with parallel execution
- Deduplication by URL, multi-source scoring

### 10. Trading (`packages/core/src/trading/`)
- **`analyzer.ts`**: Real-time market analysis via Yahoo Finance

### 11. Video Pipeline (`packages/core/src/video/`)
- Story generation, image search, TTS, FFmpeg assembly, subtitles

### 12. Channel System (`packages/core/src/channel/`)
- Slack, Telegram, WeChat, Discord bridges

## Data Flow

```
User Input → Agent Runner → Provider Stream → Tool Loop → Response
                ↓                ↓
          Session Store    Knowledge Base
                ↓                ↓
          SQLite DB       File System (YAML)
```

## Security

- JWT authentication
- Circuit breaker (per-provider)
- Quota system (per-session/per-day)
- Error classification
- Auth profiles with failure tracking
