# Nova AI Platform v0.4

A TypeScript/Bun monorepo AI agent platform — ported from CheetahClaws v3.05.79.

## Architecture

```
nova/
├── packages/
│   ├── core/           # Core engine: agents, sessions, tools, plugins
│   ├── sdk/            # Type definitions and interfaces
│   ├── ui/             # Svelte SPA frontend
│   ├── provider-*/     # LLM provider plugins (12+ providers)
│   └── channel-*/      # Communication channel plugins
├── demos/              # Example scripts (20+ demos)
└── docs/               # Documentation
```

## Quick Start

```bash
bun install
bun run dev
```

## Features

### Core
- **Agent System**: Multi-agent orchestration with tool-calling loop
- **Session Management**: SQLite-backed sessions with full-text search
- **Knowledge Base**: Auto-saved activity history in categorized folders
- **Kernel**: AgentFS (virtual file system) + Ledger (immutable event log)
- **Multi-Agent Collaboration**: Fan-out pattern with knowledge sharing
- **File Workspace**: User-selectable folder for agent file operations

### Providers (12)
DeepSeek, Anthropic, OpenAI, Gemini, Ollama, Qwen, Zhipu, Kimi, MiniMax, LM Studio, Grok, Custom

### Tools
- Web search (DuckDuckGo + Brave)
- Web fetch
- Terminal runner
- Tmux integration
- MCP client

### Research (22 sources)
ArXiv, Hacker News, GitHub, Reddit, Wikipedia, DuckDuckGo, Brave, PubMed, Stack Overflow, npm, PyPI, Crates.io, Docker Hub, Dev.to, Medium, CrossRef, Semantic Scholar, Open Library, Wikidata, TMDB, News, MusicBrainz

### Trading
- Real-time market analysis via Yahoo Finance
- BUY/HOLD/SELL recommendations
- Technical indicators

### Video Pipeline
- Story generation via LLM
- Image search (Wikimedia, Pexels, Unsplash)
- TTS (Edge TTS)
- FFmpeg assembly
- Subtitle generation

### Voice
- Speech-to-text (Whisper)
- Text-to-speech generation
- Real-time transcription

### Channels
- Slack, Telegram, WeChat, Discord

### Security
- JWT-based authentication
- Circuit breaker (per-provider failure isolation)
- Quota system (per-session/per-day budget)
- Error classification

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/chat/completions` | OpenAI-compatible chat |
| POST | `/api/agent/send` | Agent message |
| GET | `/api/sessions` | List sessions |
| GET | `/api/agents` | List agents |
| POST | `/api/research` | Research query |
| GET | `/api/trading/:symbol` | Market analysis |
| POST | `/api/video/generate` | Generate video |
| GET | `/api/knowledge/:category` | Knowledge base |
| GET | `/api/workspace` | Workspace status |
| GET | `/api/kernel/status` | Kernel status |
| GET | `/api/tmux/sessions` | Tmux sessions |
| GET | `/healthz` | Health check |
| GET | `/readyz` | Readiness check |
| GET | `/metrics` | Prometheus metrics |

## CLI Commands

```
/chat <message>     Chat with Nova
/model <name>       Switch model
/agents             List agents
/agent <id> <msg>   Chat with specific agent
/bug-fix [dir]      Run auto bug fixer
/research <query>   Research with 22 sources
/trading <symbol>   Market analysis
/video-gen <topic>  Generate video
/knowledge <cmd>    Knowledge base
/workspace <cmd>    File workspace
/kernel <cmd>       Kernel operations
/tmux <cmd>         Tmux control
/sources            List research sources
/tasks              List tasks
/task <title>       Create task
/terminal <cmd>     Run terminal command
/help               Show help
```
