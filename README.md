<p align="center">
  <img src="https://img.shields.io/badge/version-0.7.0-blue" alt="version">
  <img src="https://img.shields.io/badge/version-0.8.0-blue" alt="version">
  <img src="https://img.shields.io/badge/tools-130+-orange" alt="tools">
  <img src="https://img.shields.io/badge/plugins-26-blueviolet" alt="plugins">
  <img src="https://img.shields.io/badge/skills-64-yellow" alt="skills">
  <img src="https://img.shields.io/badge/providers-12-purple" alt="providers">
  <img src="https://img.shields.io/badge/platforms-9-cyan" alt="platforms">
</p>

---

## What is Nova AI Builder?

Nova AI Builder is a self-hosted platform for building, training, and deploying autonomous AI agents. It connects any LLM provider (DeepSeek, OpenAI, Anthropic, Gemini, Grok, Qwen, Kimi, and more) with a rich set of **120+ tools**, **26 reusable plugins**, **26+ skills**, and **5 messaging platforms**. Everything runs locally — your API keys never leave your machine.

### Why Nova?

| Feature | Nova | LangChain | AutoGPT | CrewAI |
|---------|------|-----------|---------|--------|
| **Web UI + Terminal** | ✅ Built-in | ❌ Need separate | ❌ CLI only | ❌ |
| **Tool count** | 120+ | Manual build | ~20 | ~15 |
| **Plugin system** | ✅ 26 plugins with schema-driven config | ❌ | ❌ | ❌ |
| **Agent Persistent Memory** | ✅ Auto-learns from runs | ❌ | ❌ | ❌ |
| **Agent Chambers** | ✅ Multi-agent teams with shared chat | ❌ | ❌ | Limited |
| **Workflow Builder** | ✅ Chain agents, tools, conditions | ❌ | ❌ | ❌ |
| **Tool Audit & Monitoring** | ✅ Full call logging + cost tracking | ❌ | ❌ | ❌ |
| **Self-improving skills** | ✅ AI creates skills from sessions | ❌ | ❌ | ❌ |
| **Video dubbing (AI)** | ✅ Transcribe → Translate → TTS → SRT | ❌ | ❌ | ❌ |
| **Natural-language cron** | ✅ | ❌ | ❌ | ❌ |
| **FTS5 transcript search** | ✅ SQLite FTS5 | ❌ | ❌ | ❌ |
| **Parallel subagents** | ✅ spawn_parallel + merge | ❌ | ❌ | Limited |
| **Skill Hub (agentskills.io)** | ✅ | ❌ | ❌ | ❌ |
| **Video generation** | ✅ FFmpeg pipeline | ❌ | ❌ | ❌ |
| **AI Dubbing** | ✅ Whisper + Edge TTS | ❌ | ❌ | ❌ |
| **Crypto trading agent** | ✅ Built-in | ❌ | ❌ | ❌ |
| **RAG Knowledge Base** | ✅ FTS5 + LLM answers | ❌ | ❌ | ❌ |
| **Tool Analytics Dashboard** | ✅ Usage + audit metrics | ❌ | ❌ | ❌ |
| **Integrations Hub** | ✅ 30+ services | ❌ | ❌ | ❌ |
| **Social Media** | ✅ Bluesky, X/Twitter | ❌ | ❌ | ❌ |
| **API Key Auth** | ✅ Optional Bearer token | ❌ | ❌ | ❌ |
| **Messaging platforms** | 5 | Plugin | ❌ | ❌ |

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Complete Feature List](#complete-feature-list)
  - [Autonomous Agents](#1-autonomous-agents)
  - [Self-Improving Skills](#2-self-improving-skills)
  - [Session Search (FTS5)](#3-session-search-fts5)
  - [Natural-Language Cron Scheduler](#4-natural-language-cron-scheduler)
  - [Parallel Subagent Delegation](#5-parallel-subagent-delegation)
  - [Skill Hub (agentskills.io)](#6-skill-hub-agentskillsio)
  - [Plugin System](#7-plugin-system)
  - [Agent Persistent Memory](#8-agent-persistent-memory)
  - [Agent Chambers](#9-agent-chambers)
  - [Workflow Builder](#10-workflow-builder)
  - [Monitoring & Audit](#11-monitoring--audit)
  - [File System & Workspace](#12-file-system--workspace)
  - [Web Browser Automation](#13-web-browser-automation)
  - [Web Search & Fetch](#14-web-search--fetch)
  - [Video Generator & Editor](#15-video-generator--editor)
  - [AI Video Dubbing](#16-ai-video-dubbing)
  - [Crypto Trading Agent](#17-crypto-trading-agent)
  - [RAG Knowledge Base](#18-rag-knowledge-base)
  - [Integrations Hub](#19-integrations-hub)
  - [Social Media](#20-social-media)
  - [Shopping Agent](#21-shopping-agent)
  - [Messaging Platforms](#22-messaging-platforms)
  - [Email Integration](#23-email-integration)
  - [Computer Use (Mouse/Keyboard)](#24-computer-use-mousekeyboard)
  - [Diagram & Wiki Generation](#25-diagram--wiki-generation)
  - [Memory & Knowledge Base](#26-memory--knowledge-base)
  - [Code Execution](#27-code-execution)
  - [Canvas & Excalidraw](#28-canvas--excalidraw)
- [All 120+ Tools](#all-120-tools)
- [Supported LLM Providers](#supported-llm-providers)
- [UI Pages](#ui-pages)
- [API Endpoints](#api-endpoints)
- [Configuration](#configuration)
- [Running as a Service](#running-as-a-service)
- [Security](#security)
- [License](#license)

---

## Installation

### Prerequisites

- **Bun** >= 1.1.0 ([install guide](https://bun.sh/docs/installation))
- **Windows** 10/11, **Linux** (x86_64), or **macOS**
- **Node.js** >= 18 (optional, only if you prefer npm)
- **FFmpeg** (required for video generation and dubbing — download from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/))
- **Python** >= 3.10 (required for Whisper speech-to-text in dubbing, optional otherwise)
- **Git** (optional, required for fetching community skills)

### Step-by-Step

```bash
# 1. Clone the repository
git clone https://github.com/Sebuska29190/Nova-AI-Buildier.git
cd Nova-AI-Buildier

# 2. Install dependencies (uses bun)
bun install

# 3. Create your environment file
cp .env.example .env

# 4. Edit .env — add at least one API key
#    DEEPSEEK_API_KEY=***
#    (DeepSeek is the recommended default — cheapest and most reliable)
notepad .env       # Windows
nano .env           # Linux/macOS

# 5. Install FFmpeg for video generation & dubbing
# Windows: download from https://www.gyan.dev/ffmpeg/builds/ and add to PATH
#          or set FFMPEG_PATH=C:\Windows\system32\ffmpeg.exe in environment variables
# Linux: sudo apt install ffmpeg
# macOS: brew install ffmpeg

# 6. Optional: install Whisper for AI speech-to-text (dubbing)
pip install openai-whisper

# 7. Optional: configure messaging platforms
#    See "Configuration" section for Telegram, Discord, Slack, WhatsApp setup
```

### Verify Installation

```bash
# Start the server
bun run packages/core/src/main.ts

# You should see:
#   Server:       http://0.0.0.0:4123
#   UI:           http://localhost:4123/
#   Chat API:     POST /v1/chat/completions
#   Agent API:    POST /api/agent/send

# Check health
curl http://localhost:4123/healthz
# {"status":"ok","version":"0.7.0","uptime":5,...}
```

---

## Quick Start

### 1. Open the Web UI

Navigate to **http://localhost:4123** in your browser.

### 2. Chat with the Assistant

Click **Chat Assistant** in the sidebar. Type your message and press Enter. The assistant has access to 120+ tools.

### 3. Create Your First Agent

1. Go to **Agents** page
2. Click **New Agent**
3. Name it, pick a model, write a system prompt
4. Click **Create**
5. Click **▶ Start** to run the agent
6. Configure schedule (e.g., "every 6 hours") if you want it to run periodically

### 4. Dub a Video (new!)

1. Go to **Video Editor** page
2. Upload an MP4 file
3. Select source language (or Auto-detect) and target language
4. Click **Start Dubbing**
5. The pipeline: transcribe (Whisper) → translate (LLM) → TTS (Edge) → assemble → SRT subtitles
6. Download the dubbed MP4 + SRT file

### 5. Schedule a Cron Job

1. Go to **Cron** page
2. Click **New Cron Job**
3. Type: `summarize crypto news every morning at 8am`
4. Click **Create**

### 8. Search Your Conversations

1. Go to **Sessions** page
2. Type a query in the search bar
3. Results show highlight snippets from all past transcripts

### 9. Install Skills from the Hub

1. Go to **Skills** page
2. In the "agentskills.io Hub" section, search for a skill
3. Click **Download** on any skill
4. Filter by "🤖 Auto-created" to see skills the AI learned from your sessions

---

## Architecture

```
nova-ai-builder/
│
├── packages/
│   ├── core/src/                   # Main server — Bun + Hono
│   │   ├── agent/                  # Agent lifecycle
│   │   │   ├── runner.ts           #   Main agent loop (tool execution, iteration limit)
│   │   │   ├── scheduler.ts        #   Background agent scheduler
│   │   │   └── store.ts            #   Agent CRUD + file store
│   │   │
│   │   ├── plugin/                 # Tool & plugin registration system
│   │   │   ├── tools.ts            #   Core tools
│   │   │   ├── community-skills.ts #   Community skill tools
│   │   │   ├── community-plugins.ts #   26 plugins with configSchema
│   │   │   ├── integrations.ts     #   30+ service integrations manager
│   │   │   ├── social.ts           #   Social media posting tools
│   │   │   └── tools_session_search.ts  #   FTS5 session search tools
│   │   │
│   │   ├── skill/                  # Skills subsystem
│   │   │   ├── loader.ts           #   Load skills from disk
│   │   │   ├── self-improve.ts     #   AI auto-creates skills from sessions
│   │   │   └── hub.ts              #   agentskills.io integration
│   │   │
│   │   ├── session/                # Session & transcript management
│   │   │   └── manager.ts          #   SQLite + FTS5 full-text search
│   │   │
│   │   ├── cron/                   # Natural-language cron scheduler
│   │   │   └── manager.ts          #   Parse NL → cron expression → execute via agents
│   │   │
│   │   ├── multi-agent/            # Parallel subagent + chambers
│   │   │   ├── subagent.ts         #   spawnSubAgent, spawnParallel, mergeResults
│   │   │   ├── chamber.ts          #   Agent Chamber — multi-team discussion
│   │   │   └── tools_parallel.ts   #   spawn_parallel tool registration
│   │   │
│   │   ├── workflow/               # Workflow builder
│   │   │   └── engine.ts           #   Chain agents, tools, conditions
│   │   │
│   │   ├── monitor/                # Usage tracking & monitoring
│   │   │   └── usage.ts            #   Cost tracking, tool audit logging
│   │   │
│   │   ├── auth/                   # API authentication
│   │   │   └── manager.ts          #   Bearer token auth middleware
│   │   │
│   │   ├── safety/                 # Safety & audit
│   │   │   ├── circuit-breaker-tools.ts
│   │   │   └── tool-audit.ts       #   Real-time tool call audit logger
│   │   │
│   │   ├── crypto-hub/             # Crypto Hub V2 — dashboard, signals, alerts, portfolio
│   │   ├── trading/                # Trading analysis pipeline
│   │   ├── video/                  # FFmpeg video generation + dubbing
│   │   │   ├── pipeline.ts         #   Video generation pipeline
│   │   │   ├── tts.ts              #   Edge TTS engine (voice synthesis)
│   │   │   ├── subtitles.ts        #   SRT subtitle generation
│   │   │   ├── dubbing-service.ts  #   Full dubbing pipeline
│   │   │   ├── assembly.ts         #   Clip assembly
│   │   │   ├── story.ts            #   Storyboard generation
│   │   │   ├── editor-tools.ts     #   Editing utilities
│   │   │   ├── burn_subs.py        #   Python subtitle burning script
│   │   │   └── types.ts            #   Shared types
│   │   ├── rag/                    # RAG Knowledge Base
│   │   │   └── manager.ts          #   FTS5 indexing + LLM-powered Q&A
│   │   ├── shopping/               # EU e-commerce product search
│   │   ├── gateway/                # Platform adapters
│   │   ├── api/                    # REST API (Hono routes — 200+ endpoints)
│   │   ├── terminal/               # WebSocket PTY terminal
│   │   └── memory/                 # Memory store (markdown files + cache)
│   │
│   ├── ui/                         # React 19 + Vite 6 frontend (migrated from Svelte 5)
│   │   └── src/routes/             #   26 pages, each = one .tsx component
│   │
│   ├── provider-deepseek/          # LLM provider plugins (pluggable, 12 total)
│   ├── provider-anthropic/
│   ├── provider-openai/
│   ├── provider-gemini/
│   ├── provider-grok/
│   ├── provider-qwen/
│   ├── provider-zhipu/
│   ├── provider-kimi/
│   ├── provider-minimax/
│   ├── provider-custom/
│   ├── provider-ollama-v2/
│   └── provider-lmstudio/
│
├── skills/                         # User skills (26+ local skills on disk)
│   ├── blockchain/
│   ├── community/
│   ├── creative/
│   ├── data-science/
│   ├── devops/
│   ├── finance/
│   ├── github/
│   ├── media/
│   ├── research/
│   └── ...                         # More categories
│
├── data/                           # Runtime data (gitignored)
│   ├── dubbing/                    # Dubbing job outputs + persistence
│   │   └── jobs.json               #   Persistent job history
│   └── ...                         # DBs, configs
│
├── .env.example                    # Template — copy to .env and fill keys
├── .gitignore                      # Protects .env, data/, skills/, logs/
├── LICENSE                         # MIT + Attribution
├── README.md                       # You are here
├── package.json                    # Workspace root
└── bun.lock                        # Lockfile
```

---

## Complete Feature List

### 1. Autonomous Agents

Agents run in the background with their own system prompt, model, skills, and optional schedule. Each run creates a session with a full transcript.

**How it works:**
- Agent is defined with: name, model, system prompt, enabled skills
- Can be triggered manually (▶ Start) or on a cron schedule
- Each execution: system prompt → task message → LLM loop with tools → save report

**UI page:** `Agents` — list, create, start/stop, delete, view reports

**Related tools:** `spawn_sub_agent`, `spawn_parallel`

---

### 2. Self-Improving Skills

When an agent successfully completes a complex task (4+ tool calls), the system analyzes the transcript and automatically creates a reusable `SKILL.md` file. This skill becomes available in future conversations.

**How it works:**
1. Agent finishes a task
2. System counts tool calls in the transcript
3. If ≥ 4, the LLM analyzes: "is this pattern worth saving?"
4. If yes, a new SKILL.md is created in `skills/<name>/`
5. Skill appears in the Skills page under "🤖 Auto-created" filter

**Related tools:** `skill_analyze_and_create`, `skill_delete`

---

### 3. Session Search (FTS5)

All conversation transcripts are indexed in SQLite FTS5 (full-text search). You can search across thousands of past messages in milliseconds.

**How it works:**
- Every message appended to a session → inserted into FTS5 index
- Search supports: words, phrases, Boolean operators, prefix queries
- Results show relevance score + highlighted snippet

**Endpoint:** `GET /api/sessions/search?q=your+query&limit=10`

**UI page:** `Sessions` — search bar at top

**Related tools:** `session_search`

---

### 4. Natural-Language Cron Scheduler

Schedule recurring tasks using plain English. No cron syntax required.

**Supported patterns:**
- `"every 30 minutes"` → `*/30 * * * *`
- `"every 6 hours"` → `0 */6 * * *`
- `"daily at 8am"` → cron for 8:00 every day
- `"check weather every day at 9:00"`
- `"run healthcheck every 15 minutes"`

**How it works:**
1. User types natural-language description
2. System parses interval → cron expression
3. Job is stored in SQLite
4. On each tick (every 10s), due jobs are executed via background agents

**Related tools:** `cron_create`, `cron_list`, `cron_delete`

---

### 5. Parallel Subagent Delegation

Spawn multiple sub-agents simultaneously for divide-and-conquer tasks. Each gets the same system prompt but a different subtask. Results are merged by a dedicated summarizer agent.

**Example use case:**
- Task 1: "Research React 19 features"
- Task 2: "Research Vue 4 features"
- Task 3: "Research Svelte 5 features"
- Task 4: "Research Angular 18 features"
→ All 4 run in parallel, then results are merged into one report.

**How it works:**
1. User provides: worker name, system prompt, array of tasks
2. Up to 4 workers run concurrently
3. Each worker: create session → runAgent → return text
4. Optional merge step: LLM summarizes all results into one

**UI page:** `Agents` → "Parallel Workers" panel at bottom

**Related tools:** `spawn_sub_agent`, `spawn_parallel`

---

### 6. Skill Hub (agentskills.io)

The open standard skill registry. Search, download, and publish reusable skills globally.

**Available actions:**
- **Search:** Find skills by keyword
- **Download:** Install a skill from the hub to your local `skills/` directory
- **Publish:** Upload your own skill to the global registry
- **List:** Show all local skills

**Related tools:** `skill_hub_search`, `skill_hub_download`, `skill_hub_publish`, `skill_hub_list`

---

### 7. Plugin System

Extend Nova with 26 community plugins from the GitHub ecosystem — tools, agents, channels, providers, skills, and UI. One-click install from the Plugins page.

**Supported plugin types:**
| Type | Examples |
|------|----------|
| **Tool** | MCP Servers Hub, Browser Use, Crawl4AI, Composio, ScreenPipe |
| **Agent** | Open Interpreter, GPT Engineer, CrewAI, AutoGen, Smolagents |
| **Channel** | Discord.py, Telegram Bot, Slack SDK |
| **Provider** | LiteLLM, Ollama, vLLM |
| **Skill** | LangChain, LlamaIndex, ChromaDB, Whisper, Tesseract OCR |
| **UI** | Open WebUI, Flowise, Dify |

**Schema-driven configuration:**
Each plugin defines its own `configSchema` — required fields, types (text/password/url/select/number), help text, and defaults. When you click **Configure** on a plugin, you get a proper form with labels, placeholders, and links — no raw JSON editing required.

**How it works:**
1. Browse available plugins on the **Plugins** page
2. Click **Install** — Nova clones the repo, detects the project type, and runs setup
3. Click **Configure** to fill in API keys, tokens, and settings
4. The plugin becomes available in the agent's toolset

**Key tools:** `getPluginConfig`, `savePluginConfig` (backend API)

**UI page:** `Plugins`

---



### 8. Agent Persistent Memory

Every agent has its own persistent memory store that grows with each run. Memories are automatically injected into the agent's system prompt before execution, and consolidated after each run.

**How it works:**
- **Types:** `episodic` (what happened) and `semantic` (what was learned)
- **Importance:** 1-5 scale — high-importance memories are always shown
- **Auto-consolidation:** After each run, key learnings are extracted from the output (sentences containing "learned", "discovered", "important", etc.)
- **Deduplication:** Similar memories are not duplicated (70% similarity threshold)
- **Workspace sync:** MEMORY.md is updated in the agent's workspace files

**Agent tools (use in chat):**
| Tool | Description |
|------|-------------|
| `agent_memory_save` | Save a fact or learning (specify type, importance, tags) |
| `agent_memory_search` | Search past memories by keyword or importance |
| `agent_memory_forget` | Remove a specific memory or clear all |
| `agent_memory_summarize` | Get a summary of what this agent remembers |

**Example:**
```
User: "Research API authentication patterns"
Agent (run 1): finds that "API key expires every 24h"
               → auto-saved as semantic memory (importance 4)
Agent (run 2): before starting, sees "★★★★ API key expires every 24h"
               → knows this without being told again
```

**UI page:** Agent details → Memory tab (planned)
**API endpoints:** `GET/POST/DELETE /api/agents/:id/memory`

---

### 9. Agent Chambers

Multi-agent teams that collaborate on tasks through shared discussion. Each agent takes turns contributing, can delegate subtasks to others, and the team reaches consensus before completing.

**Architecture:**
```
┌──────────────────────────────────────────┐
│           Agent Chamber                   │
│                                           │
│  Shared transcript (all agents see it)    │
│                                           │
│  Round 1: Researcher finds info           │
│  Round 1: Writer drafts based on research │
│  Round 2: Reviewer critiques draft        │
│  Round 2: Writer revises                  │
│  → Consensus: "Task complete"             │
└──────────────────────────────────────────┘
```

**Key features:**
- **Round-robin execution:** Each agent speaks in order, sees the full transcript
- **Delegation:** `@researcher: investigate X` — target agent picks it up on their next turn
- **Consensus detection:** Automatically ends when 2/3 of agents signal "[done]"
- **Shared context:** All agents see the full discussion history
- **Persistent memory:** Each agent's personal memory is injected alongside shared context

**Agent tools (use in chat):**
| Tool | Description |
|------|-------------|
| `chamber_list` | List all chambers with status |
| `chamber_status` | View chamber details, agents, recent messages |
| `chamber_run` | Start or resume a chamber discussion |

**UI page:** `/chambers` — create, run, view full discussion
**API endpoints:** CRUD + run/stop

---

### 10. Workflow Builder

Chain agents, tools, and conditions into repeatable workflows with variable passing and branching.

**Step types:**
| Type | Description | Config |
|------|-------------|--------|
| **agent** | Run an agent with a message | agentId, message (supports `{{variables}}`) |
| **tool** | Call any registered tool | toolName, arguments |
| **condition** | Branch based on previous step output | variable, operator (equals/contains/gt/lt/exists), value |
| **delay** | Wait before next step | ms |
| **notify** | Log a message | message |

**Variable passing:** Steps can reference previous results with `{{stepId}}` syntax in messages and arguments.

**Branching:** Each step has `nextOnSuccess` and `nextOnFailure` — go to different steps based on outcome.

**Agent tool:**
| Tool | Description |
|------|-------------|
| `workflow_run` | Execute a workflow by ID |

**UI page:** `/workflows` — create, edit, run workflows
**API endpoints:** CRUD + execute

---

### 11. Monitoring & Audit

Complete visibility into what agents are doing — every tool call is logged, usage is tracked, and cost data is collected.

**Tool Audit (in-memory real-time):**
Every tool call is recorded with: agent ID, tool name, parameter hash, result preview, success/failure, iteration number. Use `GET /api/usage/audit` to inspect.

**Usage Tracker (persistent SQLite):**
Long-term storage of API calls, tool calls, and agent runs with token counts and cost estimates. Query by date range and agent.

**API endpoints:**
| Endpoint | Description |
|----------|-------------|
| `GET /api/usage` | Summary stats (total calls, cost, tokens) with optional `?since=ISO&agentId=X` |
| `GET /api/usage/top` | Top 5 agents by cost |
| `GET /api/usage/audit` | Recent tool calls with optional `?taskId=X` or `?n=20` |

**Security:** Optional `NOVA_AUTH_TOKEN` env var enables Bearer token authentication for all API endpoints.

### 12. File System & Workspace

Agents have full file system access within a configurable workspace root. Multi-folder support allows referencing multiple directories.

**Key tools:**
| Tool | Description |
|------|-------------|
| `workspace_set_root` | Set primary workspace folder |
| `workspace_add_folder` | Add additional folders to workspace |
| `workspace_read_file` | Read file contents (max 1 MB) |
| `workspace_write_file` | Create or overwrite files |
| `workspace_edit_file` | Find-and-replace surgical edits |
| `workspace_delete_file` | Delete files or empty directories |
| `workspace_list_files` | List files with optional depth/extension filter |
| `workspace_list_folders` | List directories in workspace |
| `workspace_search_files` | Search files by name pattern |
| `workspace_run_command` | Execute shell commands in workspace root |
| `workspace_get_state` | Show current workspace status |
| `workspace_remove_folder` | Remove a secondary folder from workspace |

---

### 13. Web Browser Automation

Stealth browser (Chromium) with fingerprint spoofing. Navigate, extract, screenshot, click, type — all through a headless browser.

**Key tools:** `browser_launch`, `browser_navigate`, `browser_extract`, `browser_click`, `browser_type`, `browser_screenshot`, `browser_evaluate`, `browser_close`

---

### 14. Web Search & Fetch

Multiple search backends: Brave Search API, DuckDuckGo, Google Custom Search, arXiv, YouTube.

**Key tools:**
- `web_search` — general web search
- `web_fetch` — fetch a single URL and extract text
- `arxiv_search` — search academic papers
- `youtube_search` — search YouTube videos

---

### 15. Video Generator & Editor

Full FFmpeg-based pipeline for automated video creation and editing. Generates complete videos from text prompts or custom scripts with AI-powered story generation, TTS voiceover, image generation, subtitles, and visual effects.

**Pipeline:** Story (LLM) → TTS Audio → Subtitles (SRT) → AI Images → Transitions → Effects → Composition → Subtitle Burn → Output MP4

**Animation Styles (16):**
| Style | Description |
|-------|-------------|
| `ken-burns` | Classic pan + zoom on still images |
| `zoom-in` / `zoom-out` | Continuous zoom |
| `fade` | Fade in/out between clips |
| `slide-left` / `slide-right` | Horizontal slide transitions |
| `slide-up` / `slide-down` | Vertical slide transitions |
| `rotate` | Slow rotation with zoom |
| `random` | Randomly picks a style per clip |
| `dolly-zoom` | Hitchcock effect — zoom in + pull back |
| `sway` | Gentle handheld camera sway |
| `parallax-deep` | Deep parallax with foreground/background shift |
| `pulse` | Pulsating zoom synced to rhythm |
| `rotate-zoom` | Spiral rotation zoom |
| `shake` | Camera shake simulation |
| `cinematic-pan` | Slow cinematic pan L→R |

**Transitions (13):**
| Transition | Description |
|------------|-------------|
| `cut` | Hard cut (default, fastest) |
| `fade` | Cross-fade |
| `dissolve` | Dissolve blend |
| `wipe-left` / `wipe-right` | Horizontal wipe |
| `wipe-up` / `wipe-down` | Vertical wipe |
| `zoom-in` / `zoom-out` | Zoom transition |
| `blur` | Blur transition |
| `glitch-cut` | Glitch-style cut |
| `light-leak` | Light leak overlay |
| `random` | Random per clip pair |

*Note: Transitions are applied for ≤4 clips. With more clips, falls back to hard cut for performance.*

**Visual Effects (18):**
`vignette`, `glitch`, `vhs`, `noise`, `blur_bg`, `sharpen`, `color_boost`, `cinematic_grade`, `lut_orange_teal`, `lens_flare`, `light_leak`, `bokeh`, `chromatic_aberration`, `film_burn`, `speed_ramp`, `mirror`, `thermal`, `neon_glow`

**Subtitle Animations (5):**
| Animation | Description |
|-----------|-------------|
| `static` | Standard subtitle burn (default) |
| `typewriter` | Words appear one by one |
| `word-fade` | Each word fades in sequentially |
| `bounce-in` | Words slide up from below |
| `highlight` | Words appear with highlight background |

**Composition Modes (4):**
| Mode | Description |
|------|-------------|
| `single` | Single video output (default) |
| `picture-in-picture` | Main video + small inset overlay |
| `split-screen` | Two videos side-by-side |
| `grid` | 2×2 or 3×3 grid of video clips |

**Key tools:** `video_generate`, `execute_video_plan`, `video_rename`, `analyze_video_clips`

**UI page:** `Video` — preset-based video generation with animation, transition, effects, subtitle, and composition controls
**UI page:** `Video Editor` — advanced scene-by-scene editing

---

### 16. AI Video Dubbing

Translate and re-voice any MP4 video with AI. Full 6-step pipeline:

1. **Extract audio** — FFmpeg, 16kHz WAV
2. **Transcribe** — OpenAI Whisper (speech-to-text, auto language detection)
3. **Translate** — LLM translates to target language
4. **TTS** — Edge TTS generates natural voiceover in target language (20+ voices)
5. **Time-stretch** — Match original video duration (FFmpeg atempo)
6. **Assemble** — Replace audio track, output MP4 + SRT subtitles

**Key features:**
- 20+ Edge TTS voices (French, German, Polish, Spanish, Italian, Japanese, etc.)
- SRT subtitles generated and saved alongside video
- Whisper auto-detects source language
- Original video duration preserved (no speed-up/slow-down artifacts)
- Full job history persisted to disk (survives server restarts)

**Requirements:**
- FFmpeg (with libx264 + aac encoders)
- Python + openai-whisper (`pip install openai-whisper`)
- Edge TTS (auto-detected: CLI, Python module, or inline)

**UI page:** `Video Editor` — dubbing tab with job list, progress, logs, download

**API endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/dub/start` | Start dubbing job (multipart: video + language) |
| GET | `/api/dub/jobs` | List all dubbing jobs with status |
| GET | `/api/dub/jobs/:id` | Get single job details |
| GET | `/api/dub/download/:id` | Download dubbed MP4 |

---

### 17. Crypto Trading Agent

Real-time crypto market analysis and signal generation.

**Capabilities:**
- Fetch live prices (CoinGecko)
- Scrape news from CoinDesk, CoinTelegraph, The Block, Decrypt, CryptoSlate
- Score and rank news by relevance and sentiment
- Generate trading signals with reasoning
- Daily digest automation
- Support/resistance analysis
- Multi-timeframe indicators (RSI, MACD, EMA, volume)

**Key tools:** `coingecko_price`, `fetch_crypto_news`, `curate_crypto_news`, `crypto_status`, `send_crypto_digest`, `start_crypto_digest`, `trading_analyze`, `trading_indicators`, `trading_price`

**UI page:** `Trading` — live dashboard

---

---

### 18. RAG Knowledge Base

Upload documents (TXT, MD, CSV, JSON, PDF) and query them with natural language. Nova indexes content with FTS5 full-text search and uses an LLM to generate answers from relevant documents.

**Capabilities:**
- **File types:** TXT, Markdown, CSV, JSON, text-based PDFs
- **FTS5 full-text search** — fast keyword matching across all documents
- **LLM-powered answers** — combines retrieved chunks with context for human-like responses
- **Automatic chunking** — splits large documents into searchable pieces
- **Per-document management** — upload, list, delete individual documents

**How it works:**
1. Upload a document via the **RAG** page or API
2. Nova splits it into chunks and indexes them in SQLite FTS5
3. Query with natural language — Nova finds relevant chunks and synthesizes an answer
4. Sources are shown alongside answers for verification

**Key tools:** `rag_query`, `rag_upload`, `rag_list`, `rag_delete`

**UI page:** `RAG`

---

### 19. Integrations Hub

Centralized credential manager for 30+ external services. Store API keys, tokens, and webhook URLs in one place, test connections, and execute basic actions through the AI agent.

**What it does:**
| Capability | Details |
|------------|---------|
| **Credential vault** | Store API keys, tokens, webhooks for 30+ services in SQLite |
| **Connection test** | Verify credentials work (GitHub auth, Slack/Discord test webhook, Telegram getMe) |
| **Action execution** | Send messages (Slack/Discord/Telegram), create GitHub issues |
| **Agent tools** | 6 registered tools the AI can call directly |

**Supported services (credentials only for most):**
| Category | Services |
|----------|----------|
| **Communication** | Slack (send), Discord (send), Telegram (send) |
| **Developer** | GitHub (create issue), GitLab, Linear, Jira, Bitbucket, Supabase |
| **Productivity** | Notion, Trello, Asana, Google Calendar, Google Drive, Gmail |
| **DevOps** | Datadog, Sentry, PagerDuty, AWS |
| **AI** | OpenAI, Anthropic, Stability AI, ElevenLabs, Pinecone |
| **Business** | Shopify, Stripe, HubSpot |
| **Social** | Reddit, Twitter/X, YouTube |
| **Design** | Figma |

**Agent tools (use in chat):**
| Tool | What it does |
|------|-------------|
| `integration_list` | List all available services you can connect |
| `integration_add` | Connect a service (provide API key/webhook) |
| `integration_list_accounts` | Show your connected accounts |
| `integration_remove` | Disconnect an account |
| `integration_test` | Test if credentials are valid |
| `integration_execute` | Execute action: send message (Slack/Discord/Telegram) or create GitHub issue |

**Example agent usage:**
```
User: "Connect to my Slack workspace"
Agent: calls integration_add(slack, "My Slack", { webhook_url: "..." })
       → "✅ Connected slack: My Slack"

User: "Send a message to #general saying the deploy is done"
Agent: calls integration_list_accounts → finds Slack account ID
       calls integration_execute(accountId, "send_message", { text: "🚀 Deploy done!" })
       → "✅ slack: send_message succeeded"
```

**UI page:** `Integrations` — browse, connect, test, toggle, remove

---

### 20. Social Media

Multi-platform social media management — compose, publish, and manage accounts. Supports two auth methods: **API credentials** (Bluesky, X/Twitter) and **browser automation** (TikTok, Instagram, YouTube, LinkedIn, Facebook, Reddit, Threads).

**Capabilities:**
- **Compose & Publish** — write once, post to multiple platforms simultaneously
- **Bluesky API** — post via App Password (no browser needed) with cron-scheduled news automation
- **X/Twitter API** — post via Bearer Token
- **Browser platforms** — login once via Chrome profile, cookies saved for future posts
- **Account status tracking** — see pending / connected / error per account
- **Post history** — local log of all published posts with status per platform

**Auth methods:**
| Method | Platforms |
|--------|-----------|
| **🔑 API Key** | Bluesky (handle + app password), X/Twitter (bearer token) |
| **🌐 Browser** | TikTok, Instagram, YouTube, LinkedIn, Facebook, Reddit, Threads |

**Key tools:** `social_list_accounts`, `social_add_account`, `social_post`, `social_upload_video`, `social_remove_account`, `integration_execute` (Bluesky posting)

**UI page:** `Social` — compose panel, account management, post history

---

### 21. Shopping Agent

Search for products across European e-commerce sites.

**Supported sites:** adidas.fr, zalando.fr, amazon.fr, and more.

**Capabilities:**
- Multi-site product search
- Price filtering (min/max)
- Returns: title, price, availability, source, URL, image URL
- 5-minute result caching

**Key tool:** `search_products`

**UI page:** `Shopping`

---

### 22. Messaging Platforms

Nova connects to 5 messaging platforms as a bot. It can receive messages as agent prompts and send responses back.

| Platform | Setup | Key Tools |
|----------|-------|-----------|
| **Telegram** | Bot token from @BotFather | `telegram_connect`, `telegram_send` |
| **Discord** | Bot token + guild ID | `discord_connect`, `discord_send`, `discord_get_messages`, `discord_list_channels` |
| **Slack** | App token + signing secret | `slack_connect`, `slack_send` |
| **WhatsApp** | QR code scan (Baileys) | `whatsapp_connect`, `whatsapp_send`, `whatsapp_send_image`, `whatsapp_get_messages`, `whatsapp_list_chats` |
| **WeChat** | Official account | `wechat_connect`, `wechat_send` |

**UI page:** `Channels` — view and control active connections

---

### 23. Email Integration

Full IMAP/SMTP email capabilities.

**Key tools:** `email_list`, `email_search`, `email_read`, `email_reply`, `email_send`, `email_list_folders`

**Configuration:** Set `EMAIL_IMAP_HOST`, `EMAIL_IMAP_USER`, `EMAIL_IMAP_PASS` in `.env`

---

### 24. Computer Use (Mouse/Keyboard)

Direct mouse and keyboard control (requires running on a real desktop).

**Key tools:** `computer_mouse_move`, `computer_mouse_click`, `computer_mouse_position`, `computer_keyboard_type`, `computer_keyboard_press`, `computer_screenshot`, `computer_shell`

---

### 25. Diagram & Wiki Generation

Generate architecture diagrams and project wikis.

**Key tools:** `diagram_architecture`, `excalidraw_generate`, `wiki_build`, `wiki_search`

---

### 26. Memory & Knowledge Base

Persistent storage across sessions. Agents save reports, users save notes.

- **Memory Store:** Markdown files with tags and search
- **Knowledge Base:** Vector-friendly document store
- **Obsidian:** Create notes in Obsidian vault

**Key tools:** `memory_save`, `memory_search`, `memory_list`, `obsidian_create_note`

**UI page:** `Memory DB`

---

### 27. Code Execution

Safe code execution in isolated environments.

**Key tools:** `code_execute_python`, `code_execute_javascript`, `jupyter_list_kernels`

---

### 28. Canvas & Excalidraw

Generate design mockups, wireframes, and Excalidraw diagrams.

**Key tools:** `canvas_generate`, `excalidraw_generate`

---


## All 120+ Tools

| # | Tool Name | Description |
|---|-----------|-------------|
| 1 | `analyze_video_clips` | Analyze video clips: duration, resolution, file size |
| 2 | `arxiv_search` | Search arXiv for academic papers |
| 3 | `browser_click` | Click element on page by CSS selector |
| 4 | `browser_close` | Close browser and release resources |
| 5 | `browser_evaluate` | Execute JavaScript in browser page |
| 6 | `browser_extract` | Extract text/HTML from page or element |
| 7 | `browser_launch` | Launch stealth browser with fingerprint spoofing |
| 8 | `browser_navigate` | Navigate browser to URL |
| 9 | `browser_screenshot` | Take screenshot of current page |
| 10 | `browser_type` | Type text into input field |
| 11 | `calculate` | Evaluate mathematical expression |
| 12 | `coingecko_price` | Get BTC, ETH, SOL prices from CoinGecko |
| 13 | `community_skills_download` | Download community skills from GitHub |
| 14-17 | `computer_*` | Mouse move/click/position, keyboard type/press, screenshot, shell |
| 18 | `cron_create` | Create recurring job in natural language |
| 19 | `cron_delete` | Delete cron job by ID |
| 20 | `cron_list` | List all active cron jobs |
| 21 | `crypto_status` | Get crypto scheduler status |
| 22 | `curate_crypto_news` | Rank raw crypto articles by importance |
| 23 | `diagram_architecture` | Generate SVG architecture diagram |
| 24-27 | `discord_*` | Connect, send messages, get messages, list channels |
| 28 | `email_list` | List recent emails from INBOX |
| 29 | `email_list_folders` | List IMAP folders |
| 30 | `email_read` | Read full email by UID |
| 31 | `email_reply` | Reply to email |
| 32 | `email_search` | Search emails by subject/sender |
| 33 | `email_send` | Send email |
| 34 | `excalidraw_generate` | Generate Excalidraw-compatible JSON |
| 35 | `execute_video_plan` | Execute video editing plan via FFmpeg |
| 36 | `fetch_crypto_news` | Fetch latest crypto news |
| 37 | `get_current_time` | Get current date and time |
| 38 | `gif_search` | Search GIFs via Tenor API |
| 39-42 | `github_*` | Create issue, list issues, create PR, review PR |
| 43 | `github_search` | Search GitHub repositories |
| 44 | `image_generate` | Generate AI images (Replicate, DALL-E, SD, Prodia) |
| 45 | `jupyter_list_kernels` | List Jupyter kernels |
| 46 | `kanban_summary` | Generate Kanban-style task summary |
| 47 | `obsidian_create_note` | Create note in Obsidian vault |
| 48 | `ocr_extract` | Extract text from image (OCR) |
| 49 | `pip_install` | Install Python package in venv |
| 50 | `read_pdf` | Extract text from PDF file |
| 51 | `read_spreadsheet` | Parse Excel/CSV/TSV files |
| 52 | `search_products` | Search products on European e-commerce sites |
| 53-54 | `send_crypto_digest` / `start_crypto_digest` | Crypto digest send/start |
| 55 | `send_image` | Send image to chat |
| 56 | `send_telegram_image` | Send image to Telegram |
| 57 | `session_search` | Full-text search across all transcripts |
| 58 | `skill_analyze_and_create` | Auto-create skill from session transcript |
| 59 | `skill_delete` | Delete auto-generated skill |
| 60 | `skill_hub_download` | Download skill from agentskills.io |
| 61 | `skill_hub_list` | List local skills |
| 62 | `skill_hub_publish` | Publish skill to agentskills.io |
| 63 | `skill_hub_search` | Search agentskills.io |
| 64-67 | `slack_*` | Connect, send/list channels/list users |
| 68 | `spawn_parallel` | Spawn multiple sub-agents in parallel |
| 69 | `spawn_sub_agent` | Spawn a single sub-agent |
| 70 | `start_crypto_digest` | Start automated crypto digest |
| 71 | `telegram_connect` | Connect to Telegram bot |
| 72 | `telegram_send` | Send Telegram message |
| 73 | `trading_analyze` | Analyze crypto pair |
| 74 | `trading_indicators` | Get technical indicators |
| 75 | `trading_price` | Get current price |
| 76 | `video_generate` | Generate video from script |
| 77 | `video_rename` | Rename output video file |
| 78 | `web_search` | Search the web |
| 79 | `web_fetch` | Fetch and extract text from URL |
| 80-84 | `whatsapp_*` | Connect, send, send image, get messages, list chats |
| 85-86 | `wiki_build` / `wiki_search` | Wiki index + search |
| 87-97 | `workspace_*` | All workspace file operations (11 tools) |
| 98 | `x_search` | Search tweets via X/Twitter API |
| 99 | `youtube_search` | Search YouTube |
| 100 | `social_post` | Post text to connected social accounts (Bluesky, X) |
| 101 | `social_upload_video` | Upload video to connected social accounts |
| 102 | `social_list_accounts` | List connected social media accounts |
| 103 | `social_add_account` | Connect a new social media account |
| 104 | `social_remove_account` | Disconnect a social media account |
| 105 | `rag_query` | Query uploaded documents with natural language |
| 106 | `rag_upload` | Upload document to RAG knowledge base |
| 107 | `rag_list` | List uploaded RAG documents |
| 108 | `rag_delete` | Delete a RAG document |
| 109 | `integration_list` | List all integrations with status |
| 110 | `integration_add` | Connect a service integration |
| 111 | `integration_list_accounts` | List connected integration accounts |
| 112 | `integration_remove` | Remove a connected integration |
| 113 | `integration_test` | Test a connected integration |
| 114 | `integration_execute` | Execute action on integration (send Slack, create GitHub issue) |
| 115 | `agent_memory_save` | Save a memory for the current agent |
| 116 | `agent_memory_search` | Search through memories from previous runs |
| 117 | `agent_memory_forget` | Remove a memory |
| 118 | `agent_memory_summarize` | Get a summary of what this agent remembers |
| 119 | `chamber_list` | List all agent chambers |
| 120 | `chamber_status` | View chamber details |
| 121 | `chamber_run` | Start a chamber discussion |
| 122 | `workflow_run` | Execute a workflow |
| 123+ | Additional community tools | (_26 plugins, community skills_) |

---

## Supported LLM Providers

| Provider | API Key Variable | Models Available |
|----------|-----------------|------------------|
| **DeepSeek** | `DEEPSEEK_API_KEY` | deepseek-chat, deepseek-reasoner |
| **OpenAI** | `OPENAI_API_KEY` | GPT-4.1, GPT-4o-mini, o3-mini |
| **Anthropic** | `ANTHROPIC_API_KEY` | Claude Sonnet 4, Haiku 4, Opus 4 |
| **Google Gemini** | `GEMINI_API_KEY` | Gemini 2.0 Flash, 2.5 Pro |
| **xAI Grok** | `XAI_API_KEY` | grok-3, grok-3-mini |
| **Moonshot Kimi** | `KIMI_API_KEY` | kimi-k2 |
| **MiniMax** | `MINIMAX_API_KEY` | MiniMax-M1 |
| **Alibaba Qwen** | `QWEN_API_KEY` | Qwen3-235B, Qwen-Coder, Qwen-VL |
| **Zhipu GLM** | `ZHIPU_API_KEY` | GLM-4.5 |
| **Ollama** | _(none — local)_ | Any pulled model |
| **LM Studio** | _(none — local)_ | Any local model |
| **Custom** | Custom URL | Any OpenAI-compatible endpoint |

Providers auto-detect: set the corresponding `API_KEY` in `.env` and the provider appears in the UI automatically.

---

## UI Pages

| Page | Route | Description |
|------|-------|-------------|
| **Chat Assistant** | `/chat` | Main chat interface with full tool access |
| **Agents** | `/agents` | Create, manage, and run autonomous agents + parallel workers |
| **Agent Chambers** | `/chambers` | Multi-agent teams that collaborate via shared discussion |
| **Workflows** | `/workflows` | Visual workflow builder — chain agents, tools, and conditions |
| **Sessions** | `/sessions` | View past conversations + FTS5 search |
| **Skills** | `/skills` | Browse, install, and publish skills (local + agentskills.io hub) |
| **Cron** | `/cron` | Schedule recurring tasks with natural language |
| **Channels** | `/channels` | Manage Telegram, Discord, Slack, WhatsApp connections |
| **Workspace** | `/workspace` | File system browser with file operations |
| **Trading** | `/trading` | Crypto Hub V2 — dashboard, signals, alerts, portfolio with P&L |
| **Video** | `/video` | Preset-based video generation |
| **Video Editor** | `/editor` | AI Dubbing — upload, transcribe, translate, re-voice |
| **Video Editor (Advanced)** | `/video-editor` | Advanced scene-by-scene video editing |
| **RAG** | `/rag` | Document upload, FTS5 search, LLM-powered Q&A |
| **Integrations** | `/integrations` | Connect 30+ external services (Bluesky, Notion, GitHub, etc.) |
| **Social** | `/social` | Multi-platform social media posting (Bluesky, X) |
| **Shopping** | `/shopping` | European e-commerce product search |
| **Memory DB** | `/memory` | Persistent memory store |
| **Tools** | `/tools` | Browse and inspect all registered tools |
| **Plugins** | `/plugins` | Discover, install, and configure 26 community plugins with schema-driven forms |
| **Worker** | `/worker` | Background worker job management |
| **Terminal** | `/terminal` | WebSocket-based terminal emulator |
| **Config** | `/config` | Server configuration management |
| **Analytics** | `/analytics` | Usage statistics, cost tracking, tool audit |
| **Tool Analytics** | `/tools-analytics` | Tool call metrics, per-tool success rates, agent leaderboard |
| **Docs** | `/docs` | Built-in documentation viewer |
| **Env** | `/env` | Environment variable manager |
| **Logs** | `/logs` | Server log viewer |
| **Models** | `/models` | Model configuration and management |
| **Profiles** | `/profiles` | User profiles and settings |

---

## API Endpoints

### Chat & Agents
```
POST /v1/chat/completions     — OpenAI-compatible chat API
POST /api/agent/send          — Send a message to an agent
POST /api/agent/:id/start     — Start background agent
GET  /api/agents              — List all agents
POST /api/agents              — Create agent
PUT  /api/agents/:id          — Update agent
DELETE /api/agents/:id        — Delete agent
```

### Sessions
```
GET  /api/sessions            — List recent sessions
GET  /api/sessions/search     — FTS5 search (query: ?q=...&limit=10)
GET  /api/sessions/:id        — Get session with transcript
DELETE /api/sessions/:id      — Delete session
```

### Tools & Skills
```
GET  /api/tools               — List all registered tools
GET  /api/skills              — List all loaded skills
GET  /api/providers           — List active LLM providers
```

### Agent Memory
```
GET  /api/agents/:id/memory        — List agent memories (optional ?type=&q=)
POST /api/agents/:id/memory        — Save a memory
DELETE /api/agents/:id/memory/:id  — Delete a specific memory
DELETE /api/agents/:id/memory      — Clear all memories for an agent
```

### Agent Chambers
```
GET  /api/chambers             — List all chambers
POST /api/chambers             — Create chamber (name, task, agents, maxRounds)
GET  /api/chambers/:id         — Get chamber details + messages
POST /api/chambers/:id/run     — Start the chamber discussion
POST /api/chambers/:id/stop    — Stop a running chamber
DELETE /api/chambers/:id       — Delete a chamber
```

### Workflows
```
GET  /api/workflows             — List all workflows
POST /api/workflows             — Create workflow (name, steps)
GET  /api/workflows/:id         — Get workflow details
PUT  /api/workflows/:id         — Update workflow
DELETE /api/workflows/:id       — Delete workflow
POST /api/workflows/:id/run     — Execute workflow
```

### Monitoring & Usage
```
GET  /api/usage                 — Usage summary (?since=&agentId=)
GET  /api/usage/top             — Top 5 agents by cost
GET  /api/usage/audit           — Tool call audit log (?taskId=&n=)
GET  /api/analytics/dashboard   — Tool analytics: top tools, agent leaderboard, recent calls
```

### Social Media
```
GET  /api/social/platforms                  — List available platforms with auth methods
GET  /api/social/accounts                   — List connected accounts
POST /api/social/accounts                   — Create account (name, platform, ?apiConfig)
DELETE /api/social/accounts/:id             — Remove account
POST /api/social/accounts/:id/connect       — Verify API credentials, update auth status
POST /api/social/accounts/:id/launch        — Open browser for login
POST /api/social/accounts/:id/verify        — Verify browser login (cookie check)
```

### Plugins
```
GET  /api/plugins             — List all community plugins with install status
GET  /api/plugins/:id         — Get single plugin details
POST /api/plugins/:id/install — Install a plugin (clone repo + setup)
POST /api/plugins/:id/uninstall — Uninstall a plugin
GET  /api/plugins/:id/config  — Get plugin configuration
POST /api/plugins/:id/config  — Save plugin configuration
```

### Integrations
```
GET  /api/integrations        — List all integrations with status
POST /api/integrations/:id/toggle — Enable/disable an integration
GET  /api/integrations/:id/config — Get integration config
POST /api/integrations/:id/config — Save integration config
```

### RAG Knowledge Base
```
GET  /api/rag/documents       — List uploaded documents
POST /api/rag/upload          — Upload document (multipart)
DELETE /api/rag/documents/:id — Delete document
POST /api/rag/query           — Query documents with natural language
```

### Channels
```
POST /api/channels/:id/start  — Connect to messaging platform
POST /api/channels/:id/stop   — Disconnect
GET  /api/channels            — List channel statuses
```

### Other
```
GET  /healthz                 — Health check
GET  /api/memory              — List memory entries
POST /api/memory              — Save memory entry
GET  /ws                      — WebSocket for chat
GET  /ws/terminal             — WebSocket for terminal
```

---

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
# ─── REQUIRED (at least one) ───────────────────────────────
DEEPSEEK_API_KEY=sk-...        # DeepSeek (recommended)

# ─── OPTIONAL LLM PROVIDERS ───────────────────────────────
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
XAI_API_KEY=...
KIMI_API_KEY=...
MINIMAX_API_KEY=...
QWEN_API_KEY=...
ZHIPU_API_KEY=...

# ─── SERVER ────────────────────────────────────────────────
NOVA_PORT=4123                  # Default port
NOVA_HOST=0.0.0.0              # Bind address
NOVA_UI_DIR=./packages/ui/dist # UI static files
NOVA_DB_PATH=./nova.db         # SQLite database path

# ─── OPTIONAL AUTH ────────────────────────────────────────
NOVA_AUTH_TOKEN=nv-...         # Require Bearer token for ALL API endpoints
#                                    When set, every API call needs:
#                                    Authorization: Bearer nv-...

# ─── MESSAGING PLATFORMS ──────────────────────────────────
TELEGRAM_BOT_TOKEN=...
DISCORD_TOKEN=...
DISCORD_GUILD_ID=...
SLACK_BOT_TOKEN=...
SLACK_SIGNING_SECRET=...

# ─── EMAIL ────────────────────────────────────────────────
EMAIL_IMAP_HOST=imap.gmail.com
EMAIL_IMAP_USER=you@gmail.com
EMAIL_IMAP_PASS=your-app-password

# ─── SOCIAL MEDIA ────────────────────────────────────
BSKY_IDENTIFIER=infonews24h.bsky.social    # Bluesky handle
BSKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx      # Bluesky app password

# ─── VIDEO DUBBING ────────────────────────────────────────
FFMPEG_PATH=C:\Windows\system32\ffmpeg.exe  # Windows: explicit FFmpeg path
PYTHON_PATH=                                # Optional: explicit Python path for Whisper

# ─── EXTERNAL APIS ────────────────────────────────────────
GOOGLE_API_KEY=...              # Google Custom Search (Shopping)
GOOGLE_CX=...                   # Custom Search Engine ID
X_BEARER_TOKEN=...              # X/Twitter API v2
```

### Provider Configuration

At runtime, you can also configure providers via the UI at `/providers` or via `GET /api/providers`. Provider API keys are stored encrypted in `data/provider-config.json` (gitignored).

---

## Running as a Service

### Windows (Task Scheduler)

```powershell
# Create a scheduled task that starts on login:
$action = New-ScheduledTaskAction -Execute "bun" -Argument "run packages/core/src/main.ts" -WorkingDirectory "D:\nova"
$trigger = New-ScheduledTaskTrigger -AtLogon
Register-ScheduledTask -TaskName "Nova AI Builder" -Action $action -Trigger $trigger -RunLevel Highest
```

### Linux (systemd)

```ini
# /etc/systemd/system/nova.service
[Unit]
Description=Nova AI Builder
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/nova
ExecStart=/usr/local/bin/bun run packages/core/src/main.ts
Restart=on-failure
RestartSec=5
EnvironmentFile=/opt/nova/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now nova
```

### macOS (launchd)

```xml
<!-- ~/Library/LaunchAgents/com.nova.builder.plist -->
<plist version="1.0">
<dict>
    <key>Label</key><string>com.nova.builder</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/bun</string>
        <string>run</string>
        <string>packages/core/src/main.ts</string>
    </array>
    <key>WorkingDirectory</key><string>/opt/nova</string>
    <key>RunAtLoad</key><true/>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.nova.builder.plist
```

---

## Security

### What is protected:
- ✅ **`.env`** — gitignored, never committed
- ✅ **`data/`** — gitignored (contains encrypted provider config, dubbing jobs)
- ✅ **`*.db`, `*.sqlite`** — gitignored (session databases)
- ✅ **`skills/`, `logs/`** — gitignored (runtime artifacts)
- ✅ **Hardcoded keys** — none in source code (verified by scan)
- ✅ **Safety Guard** — blocks dangerous shell commands (`rm -rf /`, `diskpart`, `format`, registry edits, shutdown)
- ✅ **Workspace isolation** — file operations constrained to workspace root

### What you control:
- All API keys stay on YOUR machine in `.env`
- No telemetry, no phoning home
- No cloud dependency — 100% local
- LLM providers are optional — disable any you don't use

---

## License

**MIT License with Attribution Requirement** — see [LICENSE](LICENSE).

You are free to:
- ✅ Use, copy, modify, merge, publish, distribute
- ✅ Use in commercial projects
- ✅ Use in closed-source projects

You must:
- 📝 Include the copyright notice in copies
- 📝 Mention **"Nova AI Builder"** in your project's README, description, or about page if you use or copy features from this project

---

**Built with ☕ by cheetahclaws**
