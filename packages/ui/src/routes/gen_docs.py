#!/usr/bin/env python3
"""Generate DocsPage.svelte — no backticks in content strings."""
import sys, json, textwrap
sys.stdout.reconfigure(encoding='utf-8')

CONTENTS = {
    "overview": {
        "title": "Overview", "icon": "\\u{1F3E0}",
        "content": "# Nova AI Platform\\n\\nNova is a unified AI agent platform \\u2014 a self-hosted alternative to proprietary AI coding assistants, chat UIs, and agent frameworks. It runs **entirely on your machine** and provides:\\n\\n- **Multi-LLM Chat** \\u2014 talk to 12+ providers (DeepSeek, OpenAI, Anthropic, Gemini, Grok, Kimi, Qwen, Zhipu, LM Studio, Ollama, Custom)\\n- **Autonomous Agents** \\u2014 configurable agents with tools, skills, workspace, and scheduling\\n- **Video Generation** \\u2014 AI-powered text-to-video pipeline with TTS narration and image generation\\n- **Video Editor (Kimu)** \\u2014 browser-based timeline video editor running in Docker\\n- **Crypto Trading Bot** \\u2014 automated trading with ML analysis and portfolio management\\n- **Shopping Agent** \\u2014 cross-platform product search (Amazon, eBay, AliExpress, Etsy, etc.)\\n- **Channel Bridges** \\u2014 connect to Telegram, Discord, Slack, and WeChat\\n- **Plugin System** \\u2014 extensible via MCP, custom tools, and community plugins\\n- **Workspace Management** \\u2014 file browser and editor for project files\\n- **Persistent Memory** \\u2014 searchable memory with confidence scoring and conflict resolution\\n- **Task Management** \\u2014 structured task tracking with dependency chains\\n- **Real-time Streaming** \\u2014 SSE-based agent responses throughout\\n\\n---\\n\\n## Getting Started\\n\\n1. Make sure the Nova server is running (`bun run dev`)\\n2. Open this dashboard (default: `http://localhost:4123`)\\n3. Go to **Config \\u2014 Providers and Keys** to verify your API keys\\n4. Start a conversation in **Chat**, create an **Agent**, or explore the other tools\\n\\n> All data stays local. No cloud dependencies except model API calls."
    },
    "chat": {
        "title": "Chat", "icon": "\\u{1F4AC}",
        "content": "# Chat Interface\\n\\nThe Chat page lets you talk to any model available through Nova's provider system.\\n\\n### Features\\n\\n- **Streaming responses** \\u2014 see output token by token (SSE-based)\\n- **Session persistence** \\u2014 conversations are saved and can be resumed\\n- **Model switching** \\u2014 pick any model from the dropdown (provider/model format)\\n- **Tool integration** \\u2014 agents can call tools during conversation\\n- **Thinking levels** \\u2014 supported on reasoning models (off/low/medium/high)\\n\\n### Available Tools\\n\\n| Tool | Description |\\n|------|-------------|\\n| workspace_read_file | Read file contents from workspace |\\n| workspace_write_file | Write content to a file |\\n| workspace_list_files | List files in workspace directory |\\n| workspace_browse | Browse file system |\\n| web_fetch | Fetch URL content |\\n| web_search | Search the web |\\n| web_browse | Browse with headless browser |\\n| image_generate | Generate images via AI |\\n| tts_generate | Text-to-speech audio generation |\\n| video_generate | Generate video from text prompt |\\n| shopping_search | Search products across e-commerce sites |\\n| email_send | Send email |\\n| task_create | Create a task |\\n| task_list | List tasks |\\n\\n### Tips\\n\\n- Use Shift+Enter for newlines, Enter to send\\n- Sessions are auto-saved and available in the Sessions page\\n- You can resume past sessions with all history intact\\n- Use /help in the terminal for all slash commands"
    },
    "agents": {
        "title": "Agents", "icon": "\\u{1F916}",
        "content": "# Agent System\\n\\nCreate autonomous agents with custom personalities, model routing, and tool sets.\\n\\n### Creating an Agent\\n\\n1. Go to the **Agents** page\\n2. Click **+ Create Agent**\\n3. Fill in:\\n   \\u2014 **Name** \\u2014 unique identifier\\n   \\u2014 **Description** \\u2014 what this agent does\\n   \\u2014 **Model** \\u2014 which LLM to use (provider/model-id)\\n   \\u2014 **Tools** \\u2014 enable/disable tool calling\\n   \\u2014 **System Prompt** \\u2014 personality and behavior instructions\\n   \\u2014 **Thinking Level** \\u2014 reasoning depth for compatible models\\n   \\u2014 **Workspace** \\u2014 optional workspace root for file access\\n\\n### Agent Types\\n\\n- **Chat Agent** \\u2014 interactive conversation with LLM, tool calling, session history\\n- **Autonomous Agent** \\u2014 runs independently on a cron schedule, has its own workspace\\n- **Sub-Agent** \\u2014 one-shot isolated task via POST /api/subagent\\n- **Brainstorm Agent** \\u2014 multi-persona AI debate that generates task lists\\n\\n### Agent Lifecycle\\n\\n- **Created** \\u2014 agent is registered but idle\\n- **Start** \\u2014 agent begins listening for tasks\\n- **Running** \\u2014 agent is actively processing\\n- **Stop** \\u2014 agent is paused\\n- **Error** \\u2014 agent encountered an issue\\n\\n### Task Execution\\n\\nYou can send tasks to a running agent directly. The agent processes the task using its configured model and tools, then returns the result.\\n\\n### Real-Time Monitoring\\n\\nAgent logs stream via SSE. The Agents page shows live status updates and log output."
    },
    "video": {
        "title": "Video", "icon": "\\u{1F3AC}",
        "content": "# Video Generation and Editing\\n\\nNova includes an AI-powered video factory and a Docker-based video editor.\\n\\n### Video Pipeline\\n\\nThe Video page lets you generate videos from text prompts:\\n\\n1. **Script** \\u2014 LLM generates a structured video script (scenes, narration, image prompts, transitions)\\n2. **Voice** \\u2014 TTS engine converts narration to audio (OpenAI TTS, ElevenLabs, Edge TTS)\\n3. **Images** \\u2014 generates scene images via Pexels/Unsplash API or AI generation\\n4. **Assembly** \\u2014 FFmpeg stitches images + audio + transitions + subtitles into final MP4\\n\\n### Supported Parameters\\n\\n| Parameter | Values | Default |\\n|-----------|--------|---------|\\n| style | realistic, anime, cinematic, sketch, 3d-render | realistic |\\n| quality | low, medium, high | medium |\\n| resolution | 720p, 1080p | 1080p |\\n| imageStyle | detail/style prompt for image gen | \\u2014 |\\n| animationStyle | transition style between scenes | \\u2014 |\\n| effects | visual effects per scene | \\u2014 |\\n| imageCount | images per scene | 1 |\\n\\n### Video Editor (Kimu)\\n\\nThe Editor page provides a browser-based timeline editor running in Docker:\\n\\n- **Timeline editing** \\u2014 drag and drop, cut, trim\\n- **AI editing** \\u2014 text-to-project via API\\n- **Project import/export** \\u2014 bring Nova-generated videos into Kimu\\n- **Subtitle editing** \\u2014 SRT import, font styling, positioning\\n\\n### Workflow\\n\\n1. Start with a text description in Video \\u2014 Generate\\n2. Choose style, quality, resolution\\n3. Monitor job progress in the jobs list\\n4. Download the result or open in Kimu Editor for refinement"
    },
    "trading": {
        "title": "Trading", "icon": "\\u{1F4C8}",
        "content": "# Crypto Trading Bot\\n\\nThe Trading page provides an automated cryptocurrency trading bot with ML-powered analysis.\\n\\n### Features\\n\\n- **Market Monitor** \\u2014 live price tracking with configurable watchlist\\n- **Technical Indicators** \\u2014 RSI, MACD, SMA, Bollinger Bands\\n- **Anomaly Detection** \\u2014 identify unusual market movements\\n- **Portfolio Management** \\u2014 track positions and P&L with paper trading\\n- **Backtesting** \\u2014 test strategies against historical data\\n- **Walk-Forward Optimization** \\u2014 out-of-sample strategy validation\\n- **ML Models** \\u2014 stacking classifiers for price prediction\\n- **Sentiment Analysis** \\u2014 news and social sentiment scoring\\n- **Base Node** \\u2014 on-chain operations support\\n\\n### API Endpoints\\n\\n| Method | Path | Description |\\n|--------|------|-------------|\\n| POST | /api/crypto/start | Start trading bot |\\n| POST | /api/crypto/stop | Stop trading bot |\\n| POST | /api/crypto/now | Force immediate analysis |\\n| GET | /api/crypto/history | Trade history |\\n| GET | /api/crypto/status | Bot status |\\n| GET | /api/crypto/config | Current configuration |\\n| GET | /api/crypto/portfolio | Portfolio snapshot |\\n| POST | /api/crypto/analyze | AI market analysis |\\n\\n### CLI Commands\\n\\n/trading start \\u2014 Start the bot\\n/trading status \\u2014 Current status\\n/trading portfolio \\u2014 View portfolio\\n/trading history \\u2014 Trade history\\n/trading analyze \\u2014 AI market analysis\\n/trading paper \\u2014 Paper trade tracker"
    },
    "plugins": {
        "title": "Plugins", "icon": "\\u{1F50C}",
        "content": "# Plugin System\\n\\nExtend Nova's capabilities with community and custom plugins.\\n\\n### Managing Plugins\\n\\n- **List** \\u2014 see available plugins and their status (/plugin)\\n- **Install** \\u2014 add new plugins from the registry\\n- **Enable/Disable** \\u2014 toggle plugins on/off without uninstalling\\n- **Update** \\u2014 update installed plugins\\n- **Remove** \\u2014 uninstall plugins completely\\n\\n### Plugin Types\\n\\n- **Tools** \\u2014 add new functions agents can call\\n- **Skills** \\u2014 reusable prompt templates and workflows\\n- **Channels** \\u2014 communication integrations (Telegram, Discord, Slack, WeChat)\\n- **Data Sources** \\u2014 connect to external APIs and databases\\n\\n### Built-in Plugins\\n\\n| Plugin | Description |\\n|--------|-------------|\\n| autogen | Microsoft AutoGen integration |\\n| browser-use | Browser automation tools |\\n| chromadb | Vector database |\\n| composio | External tool integrations |\\n| continue-dev | Continue.dev IDE integration |\\n| open-webui | Open WebUI compatibility |\\n\\n### MCP Integration\\n\\nNova supports the Model Context Protocol (MCP) allowing LLMs to interact with external tools.\\n\\nConfigure MCP servers in .nova/mcp.json:\\n\\n### Plugin Structure\\n\\nplugins/my-plugin/\\n  manifest.json     # Plugin metadata\\n  index.ts          # Entry point\\n  nova.plugin.json  # Plugin configuration"
    },
    "channels": {
        "title": "Channels", "icon": "\\u{1F4E1}",
        "content": "# Communication Channels\\n\\nNova supports multiple communication channels for agent interaction.\\n\\n### Available Channels\\n\\n- **Telegram** \\u2014 chat with agents via Telegram bot (Bot API polling)\\n- **Discord** \\u2014 agent integration in Discord servers (Discord.js)\\n- **Slack** \\u2014 agent integration in Slack workspaces (Web API)\\n- **WeChat** \\u2014 WeChat bridge (iLink Bot API)\\n\\n### Starting a Channel\\n\\nVia API:\\n\\ncurl -X POST http://localhost:4123/api/channels/telegram/start\\n  -H \\\"Content-Type: application/json\\\"\\n  -d '{\\\"token\\\": \\\"YOUR_BOT_TOKEN\\\"}'\\n\\nVia CLI:\\n\\n/channel telegram start token=YOUR_BOT_TOKEN\\n\\n### Configuration\\n\\nEach channel requires:\\n1. **API credentials** (bot token, webhook URL, etc.)\\n2. **Channel enablement** in the Channels page or via API\\n3. **Agent routing** \\u2014 messages route to configured agent\\n\\n### Channel Status\\n\\nChannels show connection status (connected/disconnected) and provide controls to start/stop the bridge at any time."
    },
    "workspace": {
        "title": "Workspace", "icon": "\\u{1F4C1}",
        "content": "# Workspace Management\\n\\nThe Workspace page provides a file browser and editor for managing project files.\\n\\n### Features\\n\\n- **File browser** \\u2014 navigate directories and select files\\n- **Code editor** \\u2014 built-in editor with syntax highlighting\\n- **File operations** \\u2014 read, write, create files\\n- **Path management** \\u2014 set custom workspace roots (multiple folders supported)\\n- **Agent integration** \\u2014 agents can read/write workspace files\\n\\n### Usage\\n\\n1. Set a workspace root path\\n2. Browse files in the sidebar\\n3. Click to open and edit files\\n4. Save changes directly to disk\\n\\nWorkspaces are essential for agents that need to read or write project code."
    },
    "cron": {
        "title": "Cron / Worker", "icon": "\\u{1F50C}",
        "content": "# Cron Jobs and Worker\\n\\nSchedule recurring agent tasks and manage background jobs.\\n\\n### Creating a Job\\n\\n1. Go to the **Worker** page\\n2. Click **+ Create Job**\\n3. Configure:\\n   \\u2014 **Name** \\u2014 job identifier\\n   \\u2014 **Schedule** \\u2014 cron expression (e.g. 0 */6 * * *)\\n   \\u2014 **Task** \\u2014 what the agent should do\\n\\n### Schedule Examples\\n\\n| Expression | Description |\\n|------------|-------------|\\n| 0 */6 * * * | Every 6 hours |\\n| 0 9 * * 1-5 | Weekdays at 9 AM |\\n| */30 * * * * | Every 30 minutes |\\n| 0 0 * * * | Daily at midnight |\\n\\n### Worker API\\n\\n| Method | Path | Description |\\n|--------|------|-------------|\\n| GET | /api/worker/jobs | List worker jobs |\\n| POST | /api/worker/jobs | Create worker job |\\n| GET | /api/worker/jobs/:id | Get job status |\\n| POST | /api/worker/jobs/:id/cancel | Cancel job |\\n| DELETE | /api/worker/jobs/:id | Delete job |\\n| GET | /api/worker/events | SSE worker event stream |\\n\\n### Management\\n\\n- **Enable/Disable** \\u2014 toggle jobs on/off\\n- **Delete** \\u2014 remove scheduled jobs\\n- **View status** \\u2014 see last run time and next scheduled run"
    },
    "memory": {
        "title": "Memory", "icon": "\\u{1F9E0}",
        "content": "# Memory System\\n\\nNova provides persistent memory storage for agents and conversations.\\n\\n### Memory Types\\n\\n- **User memories** \\u2014 shared across projects, stored in ~/.cheetahclaws/memory/\\n- **Project memories** \\u2014 local to the current project in .cheetahclaws/memory/\\n- **Session memories** \\u2014 scoped to individual chat sessions\\n\\n### Memory Operations\\n\\n- **Save** \\u2014 persist important facts and context\\n- **Search** \\u2014 query by keywords or AI-powered relevance\\n- **Delete** \\u2014 remove outdated or incorrect entries\\n- **List** \\u2014 browse all stored memories\\n- **Consolidate** \\u2014 automatic merging of related memories\\n\\n### Memory Features\\n\\n- **Conflict resolution** \\u2014 detects and resolves conflicting entries\\n- **Confidence scoring** \\u2014 ranks memory reliability (0.0-1.0)\\n- **Automatic consolidation** \\u2014 merges related memories with staleness tracking\\n- **Scoped storage** \\u2014 user-level vs project-level isolation"
    },
    "config": {
        "title": "Configuration", "icon": "\\u2699\\uFE0F",
        "content": "# Configuration Dashboard\\n\\nThe Configuration page is your control center for managing Nova settings.\\n\\n## Providers and Keys\\n\\nEach LLM provider shows its status:\\n- **.env** (green) \\u2014 API key loaded from environment variables\\n- **saved** (amber) \\u2014 API key stored in encrypted config\\n- **no key** (gray) \\u2014 provider not configured\\n\\nFor each provider you can:\\n- Set or override the API key\\n- Configure base URL (for custom/self-hosted endpoints)\\n- Set max tokens limit\\n- Configure thinking level (off/low/medium/high)\\n- Test connection\\n- Enable/disable the provider\\n\\n## System Rules\\n\\nEdit global system prompt rules that are injected into every agent session. These rules define:\\n- Default behavior for all agents\\n- Safety guidelines\\n- Format preferences\\n- Custom instructions\\n\\n## Defaults\\n\\nSet global defaults for:\\n- **TTS Engine** \\u2014 auto, openai, elevenlabs, edge\\n- **Image Engine** \\u2014 auto, dall-e, stable-diffusion, pexels, unsplash\\n- **Video Quality** \\u2014 low, medium, high"
    },
    "terminal": {
        "title": "Terminal", "icon": "\\u{1F5A5}\\uFE0F",
        "content": "# Terminal / CLI\\n\\nNova includes a built-in web terminal with full CLI access.\\n\\n### Features\\n\\n- **Shell access** \\u2014 execute commands on the server\\n- **Slash commands** \\u2014 all Nova commands available\\n- **File editing** \\u2014 edit files directly in the terminal\\n- **SSE events** \\u2014 real-time terminal output\\n\\n### Key Slash Commands\\n\\n| Command | Description |\\n|---------|-------------|\\n| /help | Show all commands |\\n| /config | View/set configuration |\\n| /model | View/change active model |\\n| /agent | Manage autonomous agents |\\n| /task | Manage tasks |\\n| /memory | Manage persistent memory |\\n| /plugin | Manage plugins |\\n| /mcp | Manage MCP servers |\\n| /trading | Crypto trading operations |\\n| /video | Video generation |\\n| /tts | Text-to-speech generation |\\n| /web | Start/kill web UI |\\n| /clear | Clear conversation |\\n| /save | Save session |\\n| /load | Load session |\\n| /doctor | System diagnostics |\\n| /plan | Enter/exit plan mode |\\n| /thinking | Toggle extended thinking |\\n| /theme | Set console color theme |\\n| /permissions | Set permission mode |\\n| /cost | Show cost estimate |\\n\\n### Security\\n\\nTerminal access requires authentication (JWT token via ?token= parameter). Unauthorized connections are rejected."
    },
    "tasks": {
        "title": "Tasks", "icon": "\\u{1F4CB}",
        "content": "# Task Management\\n\\nNova includes a structured task tracking system with dependency chains.\\n\\n### Task States\\n\\n- **Pending** \\u2014 task created, waiting to start\\n- **In Progress** \\u2014 task is being worked on\\n- **Completed** \\u2014 task finished successfully\\n- **Cancelled** \\u2014 task was cancelled\\n- **Blocked** \\u2014 task is blocked by another task\\n\\n### Dependencies\\n\\nTasks can have dependencies:\\n- **Blocks** \\u2014 this task prevents another from starting\\n- **Blocked By** \\u2014 this task waits for another to complete\\n\\n### Task API\\n\\n| Method | Path | Description |\\n|--------|------|-------------|\\n| GET | /api/tasks | List all tasks |\\n| POST | /api/tasks | Create a task |\\n| DELETE | /api/tasks/:id | Delete a task |\\n\\n### CLI Usage\\n\\n/task create <subject> \\u2014 Create task\\n/task list \\u2014 List all tasks\\n/task todo \\u2014 Pending tasks\\n/task in-progress \\u2014 Active tasks\\n/task done \\u2014 Completed tasks\\n/task blocked \\u2014 Blocked tasks"
    },
    "shopping": {
        "title": "Shopping", "icon": "\\u{1F6D2}",
        "content": "# Shopping Agent\\n\\nNova includes a cross-platform product search engine that aggregates results from multiple e-commerce sites.\\n\\n### Supported Sites\\n\\n| Site | Status | Description |\\n|------|--------|-------------|\\n| Amazon | Y | Product search, prices, ratings |\\n| eBay | Y | Listings, auctions, prices |\\n| AliExpress | Y | International shipping |\\n| Etsy | Y | Handmade, vintage items |\\n| BestBuy | Y | Electronics |\\n| Walmart | Y | General retail |\\n| Target | Y | General retail |\\n| Google Shopping | Y | Aggregated results |\\n\\n### API Usage\\n\\ncurl \\\"http://localhost:4123/api/shopping/products?query=AI+book&category=books&site=amazon\\\"\\n\\n### Parameters\\n\\n| Parameter | Description |\\n|-----------|-------------|\\n| query | Search term |\\n| category | Product category filter |\\n| site | Specific site (or all if omitted) |\\n| limit | Max results per site |\\n\\n### CLI\\n\\n/shopping search \\\"AI book\\\" category=books"
    },
    "auth": {
        "title": "Authentication", "icon": "\\u{1F510}",
        "content": "# Authentication and Security\\n\\n## Auth Layer\\n\\n- **JWT tokens** \\u2014 signed user sessions with configurable expiry\\n- **API auth** \\u2014 optional NOVA_AUTH_TOKEN for Bearer token auth\\n- **WebSocket auth** \\u2014 terminal and event streams verified via ?token=\\n- **Circuit breakers** \\u2014 per-provider, per-endpoint rate limiting and error classification\\n\\n## Key Storage\\n\\n- API keys in the database are encrypted with AES-256-GCM\\n- Encryption key is derived from NOVA_ENCRYPTION_KEY or auto-generated\\n- Keys are never sent back to the client after save\\n\\n## Sandboxing\\n\\n- Agent workspace is restricted to configured paths\\n- Shell commands execute in the server's process (terminal access requires auth)\\n- MCP servers run as subprocesses with environment isolation\\n\\n## Environment Security\\n\\n# In .env:\\nNOVA_AUTH_TOKEN=nv-your-secret-token     # Enables API auth\\nNOVA_JWT_SECRET=...                       # JWT signing (auto-generated if unset)\\nNOVA_ENCRYPTION_KEY=...                   # Key encryption (auto-generated if unset)"
    },
    "api": {
        "title": "API Reference", "icon": "\\u{1F50C}",
        "content": "# REST API Reference\\n\\nBase URL: http://localhost:4123\\n\\n## OpenAI-Compatible Endpoints\\n\\n| Method | Path | Description |\\n|--------|------|-------------|\\n| GET | /v1/models | List available models |\\n| POST | /v1/chat/completions | Chat completion |\\n\\n## Agent and Chat\\n\\n| Method | Path | Description |\\n|--------|------|-------------|\\n| POST | /api/agent/send | Send message to agent (SSE stream) |\\n| GET | /api/agents | List configured agents |\\n| POST | /api/agents | Create custom agent |\\n| POST | /api/agents/ai-create | AI-assisted agent creation |\\n| PUT | /api/agents/:id | Update agent config |\\n| DELETE | /api/agents/:id | Delete agent |\\n| POST | /api/agents/:id/start | Start autonomous agent |\\n| POST | /api/agents/:id/stop | Stop autonomous agent |\\n| GET | /api/agents/:id/files | List agent workspace files |\\n| PUT | /api/agents/:id/files/:fileName | Write agent workspace file |\\n| POST | /api/agents/:id/task | Add task to agent |\\n| GET | /api/agents/jobs | List agent scheduler jobs |\\n| POST | /api/subagent | Run one-shot subagent |\\n\\n## Sessions\\n\\n| Method | Path | Description |\\n|--------|------|-------------|\\n| GET | /api/sessions | List recent sessions |\\n| GET | /api/sessions/:id | Get session detail + transcript |\\n\\n## Video\\n\\n| Method | Path | Description |\\n|--------|------|-------------|\\n| GET | /api/video/jobs | List video jobs |\\n| GET | /api/video/jobs/:id | Get job status |\\n| POST | /api/video/generate | Start video generation |\\n| POST | /api/video/jobs/:id/cancel | Cancel job |\\n| DELETE | /api/video/jobs/:id | Delete job |\\n| GET | /api/video/jobs/:id/download | Download video |\\n\\n## Config\\n\\n| Method | Path | Description |\\n|--------|------|-------------|\\n| GET | /api/config/providers | List providers with key status |\\n| POST | /api/config/providers/:id | Save provider key and settings |\\n| POST | /api/config/providers/:id/test | Test provider connection |\\n| POST | /api/config/providers/refresh-models | Refresh models (local providers) |\\n| GET | /api/config/rules | Get system rules |\\n| POST | /api/config/rules | Save system rules |\\n| POST | /api/config/settings | Save defaults |\\n\\n## Workspace\\n\\n| Method | Path | Description |\\n|--------|------|-------------|\\n| GET | /api/workspace | List workspace root |\\n| POST | /api/workspace/set | Set workspace root |\\n| POST | /api/workspace/add-folder | Add workspace folder |\\n| POST | /api/workspace/remove-folder | Remove workspace folder |\\n| GET | /api/workspace/folders | List workspace folders |\\n| POST | /api/workspace/browse | Browse path contents |\\n\\n## Memory and Tasks\\n\\n| Method | Path | Description |\\n|--------|------|-------------|\\n| GET | /api/memory | List memories |\\n| GET | /api/memory/search | Search memories |\\n| POST | /api/memory | Save memory |\\n| DELETE | /api/memory/:id | Delete memory |\\n| GET | /api/tasks | List tasks |\\n| POST | /api/tasks | Create task |\\n\\n## Shopping and Crypto\\n\\n| Method | Path | Description |\\n|--------|------|-------------|\\n| GET | /api/shopping/products | Search products |\\n| GET | /api/shopping/sites | List supported sites |\\n| POST | /api/crypto/start | Start trading bot |\\n| POST | /api/crypto/stop | Stop trading bot |\\n| GET | /api/crypto/status | Bot status |\\n| GET | /api/crypto/portfolio | Portfolio state |\\n| POST | /api/crypto/analyze | AI analysis |\\n| GET | /api/crypto/history | Trade history |\\n\\n## System\\n\\n| Method | Path | Description |\\n|--------|------|-------------|\\n| GET | /health | Health check |\\n| POST | /api/auth/register | Register user |\\n| POST | /api/auth/login | Login (returns JWT) |\\n| GET | /api/auth/me | Current user info |\\n| GET | /api/channels | List channels |\\n| POST | /api/channels/:id/start | Start channel |\\n| POST | /api/channels/:id/stop | Stop channel |\\n| GET | /api/tools | List tools |\\n| GET | /api/skills | List skills |\\n| GET | /api/checkpoints | List checkpoints |"
    }
}

STYLE_BLOCK = r"""<style>
  :global(body) {
    @apply bg-[#020408] text-slate-300;
  }
  .glass-panel {
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(51, 65, 85, 0.3);
  }
  .prose :global(code) {
    color: #a5b4fc;
    font-size: 0.75rem;
    padding: 0.1rem 0.3rem;
    background: rgba(30, 41, 59, 0.5);
    border-radius: 4px;
  }
  .prose :global(a) {
    color: #818cf8;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .prose :global(strong) {
    color: #e2e8f0;
  }
</style>
"""

HTML_PART = r"""<svelte:window on:hashchange={() => {
  const hash = window.location.hash.slice(1);
  if (hash && sections[hash]) activeSection = hash;
}} />

<div class="flex h-full">
  <!-- Sidebar -->
  <div class="w-56 shrink-0 border-r border-slate-800 overflow-y-auto p-3 hidden md:block">
    <div class="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3 px-2">Documentation</div>
    {#each Object.entries(sections) as [key, section]}
      <button
        onclick={() => { activeSection = key; window.location.hash = key; }}
        class="w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all mb-0.5 {activeSection === key ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'}"
      >
        <span class="mr-2">{section.icon}</span>
        {section.title}
      </button>
    {/each}
  </div>

  <!-- Mobile menu button -->
  <button
    onclick={() => menuOpen = !menuOpen}
    class="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-slate-900 border border-slate-700"
  >
    <i data-lucide={menuOpen ? 'x' : 'menu'} class="w-4 h-4 text-slate-300"></i>
  </button>

  <!-- Mobile overlay -->
  {#if menuOpen}
    <div class="md:hidden fixed inset-0 z-40 bg-black/60" onclick={() => menuOpen = false}></div>
    <div class="md:hidden fixed left-0 top-0 z-40 h-full w-56 bg-slate-900 border-r border-slate-800 p-3 pt-16 overflow-y-auto">
      {#each Object.entries(sections) as [key, section]}
        <button
          onclick={() => { activeSection = key; menuOpen = false; window.location.hash = key; }}
          class="w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all mb-0.5 {activeSection === key ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'}"
        >
          <span class="mr-2">{section.icon}</span>
          {section.title}
        </button>
      {/each}
    </div>
  {/if}

  <!-- Content -->
  <div class="flex-1 overflow-y-auto p-4 md:p-8">
    <div class="max-w-3xl mx-auto">
      {#if activeSection && sections[activeSection]}
        <div class="mb-6 md:hidden">
          <h1 class="text-lg font-bold text-white">{sections[activeSection].title}</h1>
        </div>
        <div class="glass-panel rounded-xl p-5 md:p-8">
          <div class="prose prose-invert prose-xs max-w-none">
            {#each sections[activeSection].content.split('\\n') as line}
              {#if line.startsWith('# ')}
                <h1 class="text-xl font-bold text-white mb-4 mt-2">{line.slice(2)}</h1>
              {:else if line.startsWith('## ')}
                <h2 class="text-lg font-semibold text-white mb-3 mt-6 border-b border-slate-800 pb-2">{line.slice(3)}</h2>
              {:else if line.startsWith('### ')}
                <h3 class="text-sm font-semibold text-indigo-300 mb-2 mt-5">{line.slice(4)}</h3>
              {:else if line.startsWith('|') && line.endsWith('|')}
                {#if !line.includes('---')}
                  {@const cells = line.slice(1, -1).split('|').map(c => c.trim())}
                  <div class="text-xs text-slate-400 font-mono border-b border-slate-800 py-1.5 flex">
                    {#each cells as cell}
                      <span class="flex-1 px-1">{cell}</span>
                    {/each}
                  </div>
                {/if}
              {:else if line.startsWith('> ')}
                <blockquote class="text-xs text-slate-400 italic border-l-2 border-indigo-500/30 pl-3 my-2">{line.slice(2)}</blockquote>
              {:else if line.startsWith('- **')}
                <div class="text-xs text-slate-300 ml-4 my-1">{line}</div>
              {:else if line.startsWith('- ') || line.startsWith('* ')}
                <div class="text-xs text-slate-400 ml-4 my-0.5">{line.slice(2)}</div>
              {:else if line.trim() === ''}
                <div class="h-2"></div>
              {:else}
                <p class="text-xs text-slate-400 leading-relaxed">{line}</p>
              {/if}
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>"""

def make_svelte():
    """Build the full Svelte file using JSON for the sections data."""
    # Build sections as JSON-compatible dict, then embed
    sections_json = {}
    for key, val in CONTENTS.items():
        # content already has escaped \\n for JS
        sections_json[key] = {
            "title": val["title"],
            "icon": val["icon"],
            "content": val["content"]
        }
    
    js_block = json.dumps(sections_json, ensure_ascii=False, indent=2)
    # Convert JSON to JS object literal
    # JSON uses " for strings, JS is fine with that
    # But we need to ensure the output is a valid JS object
    
    script = '<script lang="ts">\n'
    script += '  import { onMount } from "svelte";\n\n'
    script += '  let activeSection = $state("overview");\n'
    script += '  let menuOpen = $state(false);\n'
    script += '  let sidebar = $state(true);\n'
    script += '  let sections: Record<string, { title: string; icon: string; content: string }> = ' + js_block + ';\n\n'
    script += '  onMount(() => {\n'
    script += '    const hash = window.location.hash.slice(1);\n'
    script += '    if (hash && sections[hash]) activeSection = hash;\n'
    script += '  });\n'
    script += '</script>\n'
    
    full = "\ufeff" + script + HTML_PART
    with open('D:/nova/packages/ui/src/routes/DocsPage.svelte', 'w', encoding='utf-8') as f:
        f.write(full)
    print(f"Written {len(full)} bytes")
    print(f"Has </script>: {'</script>' in full}")
    print(f"Backtick count in file: {full.count(chr(96))}")
    print(f"Has </style>: {'</style>' in full}")

if __name__ == '__main__':
    make_svelte()
