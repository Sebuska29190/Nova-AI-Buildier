<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-blue" alt="version">
  <img src="https://img.shields.io/badge/agents-126-purple" alt="agents">
  <img src="https://img.shields.io/badge/tools-66-orange" alt="tools">
  <img src="https://img.shields.io/badge/plugins-26-blueviolet" alt="plugins">
  <img src="https://img.shields.io/badge/providers-12-blue" alt="providers">
  <img src="https://img.shields.io/badge/mesh-13_agents-green" alt="mesh">
</p>

---

## What is Nexus AI?

**Nexus AI v2.0 "Aurora"** is a self-hosted, agent-first platform for orchestrating autonomous AI agents. 126 specialized agents connected via **Agent Mesh Protocol** — from code auditing to penetration testing, from API design to database administration.

Built on **Bun + Hono + React 19 + SQLite**. Every agent has persistent memory, self-learning capabilities, and a trust-based reputation system. Runs 100% locally — your API keys never leave your machine.

### Why Nexus AI?

| Feature | Nexus AI | LangChain | AutoGPT | CrewAI |
|---------|----------|-----------|---------|--------|
| **Agent count** | 126 | Manual build | ~1 | ~5 |
| **Agent Mesh Protocol** | ✅ 13 interconnected agents | ❌ | ❌ | ❌ |
| **Agent Work Viewer** | ✅ Live SSE streaming | ❌ | ❌ | ❌ |
| **Evidence Protocol** | ✅ Validates every report | ❌ | ❌ | ❌ |
| **Quality Scoring** | ✅ Trust-based reputation | ❌ | ❌ | ❌ |
| **Smart Router** | ✅ Auto-select best agent | ❌ | ❌ | ❌ |
| **Learning Loop** | ✅ Self-correcting prompts | ❌ | ❌ | ❌ |
| **Persistent Memory** | ✅ Auto-learns from runs | ❌ | ❌ | ❌ |
| **Agent Chambers** | ✅ Multi-agent teams | ❌ | ❌ | Limited |
| **Workflow Builder** | ✅ Chain agents, tools, conditions | ❌ | ❌ | ❌ |
| **Skill Hub** | ✅ agentskills.io integration | ❌ | ❌ | ❌ |
| **FTS5 Search** | ✅ Full-text transcript search | ❌ | ❌ | ❌ |
| **Plugin System** | ✅ 26 community plugins | ❌ | ❌ | ❌ |
| **RAG Knowledge Base** | ✅ FTS5 + LLM answers | ✅ | ❌ | ❌ |
| **Messaging platforms** | 5 (Telegram, Discord, Slack, WhatsApp, Signal) | Plugin | ❌ | ❌ |
| **Web UI** | ✅ Built-in (React 19 + Vite 6) | ❌ Need separate | ❌ CLI only | ❌ |

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/Sebuska29190/Nexus-AI-Buildier.git
cd Nexus-AI-Buildier

# 2. Install
bun install

# 3. Configure
cp .env.example .env
# Edit .env — add at least one API key (DeepSeek recommended)

# 4. Start
bun run dev

# 5. Open http://localhost:4123
```

---

## Architecture

```
nexus-ai/
├── packages/
│   ├── core/src/                    # Server — Bun + Hono
│   │   ├── agent/                   # Agent lifecycle
│   │   │   ├── runner.ts            #   Agent execution loop
│   │   │   ├── scheduler.ts         #   Background job scheduler
│   │   │   ├── store.ts             #   Agent CRUD
│   │   │   ├── memory.ts            #   Persistent episodic + semantic memory
│   │   │   ├── validator.ts         #   Evidence Protocol — validates reports
│   │   │   ├── scoring.ts           #   Trust-based quality scoring
│   │   │   ├── router.ts            #   Smart Router — auto-select best agent
│   │   │   ├── learning.ts          #   Learning Loop — self-correcting prompts
│   │   │   ├── community-agents.ts  #   13 native agents
│   │   │   └── community-agents-voltagent.ts  # 113 imported agents
│   │   │
│   │   ├── agent-mesh/              # Agent Mesh Protocol
│   │   │   ├── bus.ts               #   Pub/sub event bus
│   │   │   ├── router.ts            #   Agent registry + routing
│   │   │   └── protocol.ts          #   Handshake + capabilities
│   │   │
│   │   ├── multi-agent/             # Team collaboration
│   │   │   ├── subagent.ts          #   Spawn sub-agents
│   │   │   ├── chamber.ts           #   Agent Chambers — round-robin teams
│   │   │   └── tools_parallel.ts    #   Parallel execution tools
│   │   │
│   │   ├── plugin/                  # Tool system
│   │   │   ├── tools.ts             #   Core workspace + security tools
│   │   │   ├── community-skills.ts  #   66 community tools
│   │   │   └── community-plugins.ts #   26 plugins
│   │   │
│   │   ├── skill/                   # Skill ecosystem
│   │   │   ├── loader.ts            #   Load skills from disk
│   │   │   ├── self-improve.ts      #   AI auto-creates skills
│   │   │   └── hub.ts               #   agentskills.io integration
│   │   │
│   │   ├── safety/                  # Security middleware
│   │   │   ├── circuit-breaker-tools.ts  # Loop detection + rate limits
│   │   │   └── tool-audit.ts        #   Real-time audit logging
│   │   │
│   │   ├── auth/                    # JWT authentication
│   │   ├── channel/                 # 5 messaging platforms
│   │   ├── cron/                    # Natural-language scheduler
│   │   ├── memory/                  # Persistent knowledge store
│   │   ├── kernel/                  # Audit ledger + AgentFS
│   │   ├── workflow/                # Workflow engine
│   │   ├── monitor/                 # Usage & cost tracking
│   │   ├── rag/                     # RAG knowledge base
│   │   └── api/                     # 200+ REST endpoints
│   │
│   └── ui/                          # Frontend — React 19 + Vite 6
│       └── src/routes/              # 30+ pages
│
├── agents/                          # 126 agent definitions (AGENTS.md + SOUL.md + MEMORY.md)
├── skills/                          # 46 community skills
├── providers/                       # 12 LLM provider plugins
└── data/                            # Runtime data (gitignored)
```

---

## Core System

### Evidence Protocol
Every agent report is validated. Claims without `file:line` references and actual tool output are **rejected**. Reports with <30% evidence get a strike. 3 strikes → agent is auto-remediated by the Learning Loop.

### Quality Scoring
Trust-based reputation system per agent: 🟢 Verified → 🟡 Neutral → 🔴 Low → ⚠️ Degraded. Score affects routing priority and user trust.

### Smart Router
Type a task → system auto-selects the best agent based on capability matching (domains + languages + keywords). Trust multiplier adjusts scores.

### Learning Loop
Degraded agents get their system prompt auto-corrected based on failure pattern analysis. Corrections persist to AGENTS.md.

### Agent Work Viewer
Live SSE streaming of agent execution: tool calls, results, thinking, progress. Stop or steer agents mid-execution.

---

## Features

### 126 Specialized Agents

| Category | Count | Examples |
|----------|-------|----------|
| **Native Nexus** | 13 | auditor, auto-coder, code-reviewer, security-auditor, tester, data-analyst, devops-engineer, documentation-writer, project-manager, research-assistant, paper-writer, auto-bug-fixer, default |
| **Core Development** | 11 | api-designer, backend-developer, frontend-developer, fullstack-developer, graphql-architect, microservices-architect, mobile-developer, ui-designer, websocket-engineer, electron-pro, design-bridge |
| **Language Specialists** | 30 | typescript-pro, python-pro, golang-pro, rust-engineer, java-architect, cpp-pro, csharp-developer, javascript-pro, sql-pro, nextjs-developer, react-specialist, vue-expert, angular-architect, node-specialist, php-pro, and more |
| **Infrastructure** | 16 | kubernetes-specialist, docker-expert, terraform-engineer, cloud-architect, sre-engineer, platform-engineer, network-engineer, windows-infra-admin, azure-infra-engineer, and more |
| **Quality & Security** | 17 | penetration-tester, chaos-engineer, compliance-auditor, gdpr-ccpa-compliance, performance-engineer, accessibility-tester, qa-expert, test-automator, debugger, error-detective, and more |
| **Data & AI** | 13 | data-scientist, data-engineer, ml-engineer, mlops-engineer, llm-architect, nlp-engineer, prompt-engineer, postgres-pro, ai-engineer, and more |
| **Developer Experience** | 15 | refactoring-specialist, build-engineer, cli-developer, git-workflow-manager, legacy-modernizer, documentation-engineer, mcp-developer, and more |
| **Meta-Orchestration** | 11 | multi-agent-coordinator, workflow-orchestrator, task-distributor, knowledge-synthesizer, context-manager, codebase-orchestrator, and more |

### Agent Chambers
Multi-agent teams collaborate on tasks through shared discussion. Round-robin execution, delegation via @mentions, consensus detection. 126 agents available as team members.

### Agent Mesh Protocol
13 core agents interconnected via pub/sub event bus. Dynamic routing, capability discovery, task delegation between agents.

### Workflow Builder
Chain agents, tools, and conditions into repeatable workflows with variable passing and branching.

### Persistent Memory
Every agent remembers across sessions. Episodic (what happened) + semantic (what was learned). Auto-consolidation after each run. Deduplication prevents redundant memories.

### Self-Improving Skills
Complex agent tasks (4+ tool calls) are auto-analyzed and converted into reusable SKILL.md files.

### Plugin Ecosystem
26 community plugins with schema-driven configuration forms. Tools, agents, channels, providers, skills, and UI components — install with one click.

---

## Tools

66 registered tools across categories:

| Category | Tools | Examples |
|----------|-------|----------|
| **Workspace** | 11 | read_file, write_file, edit_file, list_files, search_files, run_command |
| **Agent Memory** | 4 | memory_save, memory_search, memory_forget, memory_summarize |
| **Chambers** | 3 | chamber_list, chamber_status, chamber_run |
| **Search** | 3 | web_search, web_fetch, arxiv_search |
| **Code** | 3 | code_execute_python, code_execute_javascript, jupyter_list_kernels |
| **Git** | 11 | github_create_issue, github_list_issues, github_create_pr, git_commit, etc. |
| **Knowledge Graph** | 6 | kg_add_node, kg_add_edge, kg_query, kg_visualize |
| **Goal Decomposition** | 4 | goal_decompose, goal_status, goal_assign, goal_complete |
| **Analytics** | 4 | analytics_dashboard, analytics_usage, analytics_audit, analytics_tools |
| **Communication** | 20+ | discord_send, telegram_send, slack_send, whatsapp_send, email_send |
| **Integration** | 6 | integration_list, integration_add, integration_test, integration_execute |
| **Other** | 10+ | session_search, cron_create, image_generate, obsidian_create_note, etc. |

---

## LLM Providers

| Provider | Models |
|----------|--------|
| **DeepSeek** | deepseek-chat, deepseek-coder |
| **OpenAI** | GPT-5, GPT-4o, o3-mini |
| **Anthropic** | Claude Opus 4, Sonnet 4 |
| **Google Gemini** | Gemini 2.5 Pro, 2.0 Flash |
| **xAI Grok** | grok-3, grok-3-mini |
| **Qwen** | Qwen-Plus, Qwen-Max, Qwen-Coder |
| **Zhipu** | GLM-4, GLM-4-Flash |
| **Kimi** | kimi-latest |
| **MiniMax** | MiniMax-M1 |
| **Ollama** | Any local model |
| **LM Studio** | Any local model |
| **Custom** | Any OpenAI-compatible endpoint |

---

## API Highlights

```bash
# Chat
POST /v1/chat/completions

# Agents
GET    /api/agents                    # List all 126 agents
POST   /api/agents/match              # Smart Router — find best agent for task
GET    /api/agents/:id/score          # Quality score + trust badge
GET    /api/agents/:id/learning       # Learning loop history
POST   /api/agents/:id/remediate      # Force remediation
GET    /api/agents/runs/:runId/events # Live SSE agent execution stream
POST   /api/agents/runs/:runId/steer  # Steer running agent
POST   /api/agents/runs/:runId/stop   # Stop running agent

# Mesh
GET    /api/mesh/topology             # Agent interconnection graph
GET    /api/mesh/agents               # Mesh agent registry
POST   /api/mesh/send                 # Route message via mesh

# Chambers
POST   /api/chambers                  # Create team from 126 agents
POST   /api/chambers/:id/run          # Start team discussion

# Memory
GET    /api/agents/:id/memory         # Agent's learned knowledge
POST   /api/agents/:id/learn          # Manually teach an agent
```

---

## Security

- ✅ `.env` and `data/` — gitignored, never committed
- ✅ **Dangerous command blocking** — `rm -rf /`, `format`, `diskpart`, registry edits
- ✅ **Workspace path validation** — blocks system paths (`C:\Windows`, `/etc`)
- ✅ **Workspace isolation** — file operations constrained to root
- ✅ **Path traversal protection** — blocks `../` patterns
- ✅ **Circuit breaker** — loop detection, tool call limits, depth limits
- ✅ **Tool audit logging** — every tool call recorded
- ✅ **Kernel ledger** — immutable audit trail
- ✅ **Optional auth** — Bearer token for all API endpoints
- ✅ No telemetry, no cloud dependency, 100% local

---

## License

MIT with Attribution — see [LICENSE](LICENSE).

---

**Built for the agent-first era. Nexus AI v2.0 "Aurora".**
