/**
 * Community Plugins — GitHub ecosystem plugins with auto-install
 *
 * Each plugin has a GitHub repo URL, description, and install instructions.
 * The install process clones the repo and runs setup.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { safeMessage } from "../errors.ts";

export interface CommunityPlugin {
  id: string;
  name: string;
  description: string;
  author: string;
  repo: string;
  type: "tool" | "agent" | "channel" | "provider" | "skill" | "ui";
  tags: string[];
  stars: number;
  installed: boolean;
  installPath?: string;
  setupCmd?: string;
  icon: string;
  /** Markdown usage instructions shown in plugin detail modal */
  usage?: string;
  /** Tool names this plugin provides, shown as @toolName hints */
  toolsProvided?: string[];
  /** Python version requirement (e.g. ">=3.11,<3.13") — checked before pip install */
  pythonVersionRequirement?: string;
  /** System dependencies required (e.g. "tesseract-ocr", "docker") */
  systemDependencies?: string[];
  /** Other plugin IDs this plugin depends on */
  dependencies?: string[];
}

const PLUGINS_DIR = join(process.cwd(), "plugins");

// ─── Community Plugin Registry ─────────────────────────────────────
// These are well-known open-source plugins from the GitHub ecosystem.
// Each can be installed with one click.
const COMMUNITY_PLUGINS: CommunityPlugin[] = [
  // ── Tool Plugins ────────────────────────────────────────────────
  {
    id: "mcp-servers",
    name: "MCP Servers Hub",
    description: "Collection of Model Context Protocol servers — filesystem, GitHub, PostgreSQL, Puppeteer, SQLite, and more",
    author: "modelcontextprotocol",
    repo: "https://github.com/modelcontextprotocol/servers",
    type: "tool",
    tags: ["mcp", "filesystem", "github", "database", "browser"],
    stars: 28000,
    installed: false,
    setupCmd: "npm install && npm run build",
    icon: "🔌",
    usage: "After installing, MCP servers become available as tools in Nova's agent system.\n\n**Usage:**\n1. Restart Nova to pick up the new MCP servers\n2. Use `@` in chat to invoke MCP tools (e.g. `@filesystem`, `@github`)\n3. Configure server settings in Nova's MCP config file\n\n**Example:**\n```\n@filesystem list files in /home/project\n```",
    toolsProvided: ["filesystem", "github", "postgresql", "puppeteer", "sqlite"],
  },
  {
    id: "continue-dev",
    name: "Continue",
    description: "Open-source AI code assistant — brings Nova's agents into VS Code and JetBrains IDEs",
    author: "continuedev",
    repo: "https://github.com/continuedev/continue",
    type: "tool",
    tags: ["ide", "vscode", "jetbrains", "code"],
    stars: 24000,
    installed: false,
    setupCmd: "npm install",
    icon: "🔄",
    usage: "Continue integrates Nova's AI capabilities into your IDE.\n\n**Usage:**\n1. Open VS Code or JetBrains\n2. Install the Continue extension from the marketplace\n3. Configure Continue to use Nova as the backend provider\n4. Use `Cmd+I` (macOS) or `Ctrl+I` (Windows/Linux) to open Continue inline\n\n**Example:**\nSelect code in your editor, press `Cmd+I`, and ask Nova to refactor it.",
    toolsProvided: ["continue-edit", "continue-chat", "continue-review"],
  },
  {
    id: "browser-use",
    name: "Browser Use",
    description: "AI agent that can control a real browser — navigate, click, type, extract data from any website",
    author: "browser-use",
    repo: "https://github.com/browser-use/browser-use",
    type: "tool",
    tags: ["browser", "automation", "web", "scraping"],
    stars: 45000,
    installed: false,
    setupCmd: "pip install -e .",
    icon: "🌐",
    usage: "Browser Use gives Nova the ability to control a real browser.\n\n**Usage:**\n1. After install, the `@browser-use` tool becomes available in chat\n2. Tell Nova what to do on a website\n3. Nova will launch a browser, navigate, click, type, and extract data\n\n**Example:**\n```\n@browser-use Go to example.com and take a screenshot of the homepage\n```",
    toolsProvided: ["browser-use"],
  },
  {
    id: "crawl4ai",
    name: "Crawl4AI",
    description: "Open-source LLM-friendly web crawler and scraper — extracts clean markdown from any website",
    author: "unclecode",
    repo: "https://github.com/unclecode/crawl4ai",
    type: "tool",
    tags: ["crawler", "scraper", "web", "markdown"],
    stars: 35000,
    installed: false,
    setupCmd: "pip install -e .",
    icon: "🕷️",
    usage: "Crawl4AI extracts clean markdown content from websites for LLM consumption.\n\n**Usage:**\n1. After install, the `@crawl4ai` tool becomes available\n2. Provide a URL and optional instructions\n3. Returns clean, structured markdown content\n\n**Example:**\n```\n@crawl4ai https://docs.example.com/api extract all endpoint descriptions\n```",
    toolsProvided: ["crawl4ai"],
  },
  {
    id: "composio",
    name: "Composio",
    description: "Toolset for AI agents — 250+ integrations including GitHub, Gmail, Slack, Jira, Notion, and more",
    author: "composiohq",
    repo: "https://github.com/ComposioHQ/composio",
    type: "tool",
    tags: ["integrations", "github", "gmail", "slack", "jira"],
    stars: 18000,
    installed: false,
    setupCmd: "pip install composio-core",
    icon: "🧩",
    usage: "Composio provides 250+ third-party integrations for Nova's agents.\n\n**Usage:**\n1. After install, individual integrations appear as tools (e.g. `@github`, `@gmail`)\n2. Each integration requires authentication (OAuth or API key)\n3. Use `@` in chat to invoke any integration\n\n**Example:**\n```\n@gmail Find emails from last week about the project proposal\n```",
    toolsProvided: ["github", "gmail", "slack", "jira", "notion", "linear", "asana", "gitlab"],
  },
  {
    id: "screenpipe",
    name: "ScreenPipe",
    description: "AI-powered screen capture and recording — records screen, audio, and transcribes everything locally",
    author: "mediar-ai",
    repo: "https://github.com/mediar-ai/screenpipe",
    type: "tool",
    tags: ["screen", "recording", "ocr", "transcription"],
    stars: 15000,
    installed: false,
    setupCmd: "cargo build --release",
    icon: "📺",
    usage: "ScreenPipe records your screen and audio, then makes them searchable with AI.\n\n**Usage:**\n1. After install, ScreenPipe runs as a background service\n2. It continuously captures screen content and audio\n3. Use `@screenpipe` in chat to query what was on your screen\n4. Great for meeting notes, code references, and research recall\n\n**Example:**\n```\n@screenpipe What was that error message I saw 10 minutes ago?\n```",
    toolsProvided: ["screenpipe"],
  },

  // ── Agent Plugins ───────────────────────────────────────────────
  {
    id: "open-interpreter",
    name: "Open Interpreter",
    description: "Natural language interface for computers — run code, control the OS, browse the web, all from chat",
    author: "open-interpreter",
    repo: "https://github.com/open-interpreter/open-interpreter",
    type: "agent",
    tags: ["code-execution", "os-control", "terminal"],
    stars: 58000,
    installed: false,
    setupCmd: "pip install open-interpreter",
    icon: "💻",
    usage: "Open Interpreter lets Nova execute code and control your computer.\n\n**Usage:**\n1. After install, the `@open-interpreter` agent becomes available\n2. Ask Nova to run code, control the OS, or browse the web\n3. Open Interpreter runs Python, shell commands, and more\n\n**Example:**\n```\n@open-interpreter Create a data visualization of this CSV file\n```",
    toolsProvided: ["open-interpreter"],
  },
  {
    id: "gpt-engineer",
    name: "GPT Engineer",
    description: "AI that writes entire codebases from natural language specifications — generates full project structures",
    author: "gpt-engineer-org",
    repo: "https://github.com/gpt-engineer-org/gpt-engineer",
    type: "agent",
    tags: ["code-generation", "project-scaffolding"],
    stars: 53000,
    installed: false,
    setupCmd: "pip install -e .",
    icon: "🏗️",
    usage: "GPT Engineer generates complete project codebases from specifications.\n\n**Usage:**\n1. After install, the `@gpt-engineer` agent becomes available\n2. Describe the project you want to build in natural language\n3. GPT Engineer generates the full project structure and code\n\n**Example:**\n```\n@gpt-engineer Build a REST API for a todo app with FastAPI and SQLite\n```",
    toolsProvided: ["gpt-engineer"],
  },
  {
    id: "crewAI",
    name: "CrewAI",
    description: "Framework for orchestrating role-based AI agents — create teams of agents that collaborate on tasks",
    author: "crewAIInc",
    repo: "https://github.com/crewAIInc/crewAI",
    type: "agent",
    tags: ["multi-agent", "orchestration", "roles"],
    stars: 28000,
    installed: false,
    setupCmd: "pip install crewai",
    icon: "👥",
    usage: "CrewAI creates teams of specialized AI agents that work together.\n\n**Usage:**\n1. After install, the `@crewai` agent becomes available\n2. Define roles (researcher, writer, reviewer) and a task\n3. CrewAI orchestrates the team to complete the task collaboratively\n\n**Example:**\n```\n@crewai Research the latest AI trends and write a summary report\n```",
    toolsProvided: ["crewai"],
  },
  {
    id: "autogen",
    name: "AutoGen",
    description: "Microsoft's multi-agent conversation framework — agents that talk to each other to solve complex tasks",
    author: "microsoft",
    repo: "https://github.com/microsoft/autogen",
    type: "agent",
    tags: ["multi-agent", "microsoft", "conversation"],
    stars: 38000,
    installed: false,
    setupCmd: "pip install pyautogen",
    icon: "🤖",
    usage: "AutoGen enables multi-agent conversations to solve complex tasks.\n\n**Usage:**\n1. After install, the `@autogen` agent becomes available\n2. Describe a complex task that benefits from multiple perspectives\n3. AutoGen spawns specialized agents that converse and collaborate\n\n**Example:**\n```\n@autogen Design a microservices architecture for an e-commerce platform\n```",
    toolsProvided: ["autogen"],
  },
  {
    id: "smolagents",
    name: "Smolagents",
    description: "HuggingFace's minimalist agent framework — lightweight agents that can use tools and browse the web",
    author: "huggingface",
    repo: "https://github.com/huggingface/smolagents",
    type: "agent",
    tags: ["huggingface", "lightweight", "web-browsing"],
    stars: 16000,
    installed: false,
    setupCmd: "pip install smolagents",
    icon: "🦎",
    usage: "Smolagents provides lightweight agents that can browse the web and use tools.\n\n**Usage:**\n1. After install, the `@smolagents` agent becomes available\n2. Ask it to perform web research or use HuggingFace tools\n3. Ideal for lightweight, focused tasks\n\n**Example:**\n```\n@smolagents Find the latest papers on transformer architectures\n```",
    toolsProvided: ["smolagents"],
  },
  {
    id: "pydantic-ai",
    name: "Pydantic AI",
    description: "Agent framework by Pydantic — type-safe agents with structured outputs and dependency injection",
    author: "pydantic",
    repo: "https://github.com/pydantic/pydantic-ai",
    type: "agent",
    tags: ["pydantic", "type-safe", "structured-output"],
    stars: 9000,
    installed: false,
    setupCmd: "pip install pydantic-ai",
    icon: "✅",
    usage: "Pydantic AI provides type-safe agents with structured outputs.\n\n**Usage:**\n1. After install, the `@pydantic-ai` agent becomes available\n2. Define Pydantic models for structured output schemas\n3. Get validated, type-safe responses from the agent\n\n**Example:**\n```\n@pydantic-ai Extract structured data: name, email, phone from this text\n```",
    toolsProvided: ["pydantic-ai"],
  },

  // ── Channel Plugins ─────────────────────────────────────────────
  {
    id: "discord.py",
    name: "Discord.py Bridge",
    description: "Full Discord bot integration — send/receive messages, manage channels, voice support",
    author: "Rapptz",
    repo: "https://github.com/Rapptz/discord.py",
    type: "channel",
    tags: ["discord", "chat", "voice"],
    stars: 47000,
    installed: false,
    setupCmd: "pip install discord.py",
    icon: "💬",
    usage: "Discord.py Bridge connects Nova to Discord servers.\n\n**Usage:**\n1. After install, configure your Discord bot token in Nova settings\n2. The `@discord` channel becomes available for sending messages\n3. Nova can read messages, manage channels, and join voice\n\n**Example:**\n```\n@discord Send a welcome message to #general\n```",
    toolsProvided: ["discord"],
  },
  {
    id: "telegram-bot",
    name: "Telegram Bot API",
    description: "Advanced Telegram bot with inline keyboards, file uploads, and group management",
    author: "python-telegram-bot",
    repo: "https://github.com/python-telegram-bot/python-telegram-bot",
    type: "channel",
    tags: ["telegram", "chat", "bot"],
    stars: 27000,
    installed: false,
    setupCmd: "pip install python-telegram-bot",
    icon: "✈️",
    usage: "Telegram Bot API connects Nova to Telegram.\n\n**Usage:**\n1. After install, create a bot via @BotFather and get the token\n2. Configure the token in Nova settings\n3. The `@telegram` channel becomes available\n\n**Example:**\n```\n@telegram Send a poll to my group about meeting times\n```",
    toolsProvided: ["telegram"],
  },
  {
    id: "slack-sdk",
    name: "Slack SDK Bridge",
    description: "Full Slack integration — messages, threads, reactions, file uploads, and slash commands",
    author: "slackapi",
    repo: "https://github.com/slackapi/python-slack-sdk",
    type: "channel",
    tags: ["slack", "chat", "team"],
    stars: 4500,
    installed: false,
    setupCmd: "pip install slack-sdk",
    icon: "💼",
    usage: "Slack SDK Bridge connects Nova to Slack workspaces.\n\n**Usage:**\n1. After install, create a Slack app and get the bot token\n2. Configure the token in Nova settings\n3. The `@slack` channel becomes available\n\n**Example:**\n```\n@slack Post a message in #engineering about the deployment\n```",
    toolsProvided: ["slack"],
  },

  // ── Provider Plugins ────────────────────────────────────────────
  {
    id: "litellm",
    name: "LiteLLM",
    description: "Unified API for 100+ LLMs — OpenAI, Anthropic, Cohere, Together AI, Replicate, and more",
    author: "BerriAI",
    repo: "https://github.com/BerriAI/litellm",
    type: "provider",
    tags: ["llm", "proxy", "multi-provider"],
    stars: 18000,
    installed: false,
    setupCmd: "pip install litellm",
    icon: "⚡",
    usage: "LiteLLM adds 100+ LLM providers to Nova's model selection.\n\n**Usage:**\n1. After install, new model providers appear in the model dropdown\n2. Configure API keys in Nova settings for each provider\n3. Switch models via the dropdown or `/model <name>` command\n\n**Example:**\n```\n/model claude-3-opus-20240229\n```",
    toolsProvided: [],
  },
  {
    id: "ollama",
    name: "Ollama (Local LLMs)",
    description: "Run LLMs locally — Llama 3, Mistral, Gemma, Phi, and hundreds more models on your own hardware",
    author: "ollama",
    repo: "https://github.com/ollama/ollama",
    type: "provider",
    tags: ["local", "llm", "privacy"],
    stars: 130000,
    installed: false,
    setupCmd: "",
    icon: "🦙",
    usage: "Ollama lets you run LLMs locally on your own hardware.\n\n**Usage:**\n1. After install, ensure Ollama is running (`ollama serve`)\n2. Pull models: `ollama pull llama3`\n3. Local models appear in Nova's model dropdown\n4. Switch via `/model ollama/llama3`\n\n**Example:**\n```\n/model ollama/llama3\n```",
    toolsProvided: [],
    systemDependencies: ["ollama"],
  },
  {
    id: "vllm",
    name: "vLLM",
    description: "High-throughput LLM serving — PagedAttention for efficient inference, supports most open models",
    author: "vllm-project",
    repo: "https://github.com/vllm-project/vllm",
    type: "provider",
    tags: ["serving", "inference", "high-performance"],
    stars: 45000,
    installed: false,
    setupCmd: "pip install vllm",
    icon: "🚀",
    usage: "vLLM provides high-throughput LLM inference serving.\n\n**Usage:**\n1. After install, start a vLLM server with your model\n2. Configure the endpoint in Nova settings\n3. Use vLLM-hosted models in Nova's model dropdown\n\n**Example:**\n```\n/model vllm/mistralai/Mistral-7B-Instruct-v0.2\n```",
    toolsProvided: [],
  },

  // ── Skill Plugins ───────────────────────────────────────────────
  {
    id: "langchain",
    name: "LangChain Tools",
    description: "LangChain's tool ecosystem — document loaders, vector stores, retrievers, and chains for RAG",
    author: "langchain-ai",
    repo: "https://github.com/langchain-ai/langchain",
    type: "skill",
    tags: ["rag", "vector-store", "documents", "chains"],
    stars: 100000,
    installed: false,
    setupCmd: "pip install langchain langchain-community",
    icon: "⛓️",
    usage: "LangChain adds RAG capabilities to Nova.\n\n**Usage:**\n1. After install, LangChain tools become available in chat\n2. Use `@langchain` to load documents, query vector stores, or run chains\n3. Supports PDF, HTML, Markdown, and more document formats\n\n**Example:**\n```\n@langchain Load the PDF and answer questions about its contents\n```",
    toolsProvided: ["langchain"],
  },
  {
    id: "llama-index",
    name: "LlamaIndex",
    description: "Data framework for LLM applications — ingest, index, and query your data with advanced RAG",
    author: "run-llama",
    repo: "https://github.com/run-llama/llama_index",
    type: "skill",
    tags: ["rag", "indexing", "data-ingestion", "query"],
    stars: 38000,
    installed: false,
    setupCmd: "pip install llama-index",
    icon: "🦙",
    usage: "LlamaIndex provides advanced data indexing and RAG.\n\n**Usage:**\n1. After install, the `@llama-index` tool becomes available\n2. Ingest data from files, databases, or APIs\n3. Query your indexed data with natural language\n\n**Example:**\n```\n@llama-index Index the documentation folder and answer: what is the API key format?\n```",
    toolsProvided: ["llama-index"],
  },
  {
    id: "chromadb",
    name: "ChromaDB",
    description: "AI-native vector database — embed, store, and search documents with semantic similarity",
    author: "chroma-core",
    repo: "https://github.com/chroma-core/chroma",
    type: "skill",
    tags: ["vector-db", "embeddings", "semantic-search"],
    stars: 17000,
    installed: false,
    setupCmd: "pip install chromadb",
    icon: "🎯",
    usage: "ChromaDB provides vector storage and semantic search.\n\n**Usage:**\n1. After install, the `@chromadb` tool becomes available\n2. Store document embeddings and search by semantic similarity\n3. Great for building knowledge bases and memory\n\n**Example:**\n```\n@chromadb Search for documents related to authentication patterns\n```",
    toolsProvided: ["chromadb"],
  },
  {
    id: "whisper",
    name: "OpenAI Whisper",
    description: "State-of-the-art speech recognition — transcribe audio in 100+ languages, runs locally",
    author: "openai",
    repo: "https://github.com/openai/whisper",
    type: "skill",
    tags: ["speech", "transcription", "audio"],
    stars: 75000,
    installed: false,
    setupCmd: "pip install openai-whisper",
    icon: "🎤",
    usage: "Whisper provides speech-to-text transcription.\n\n**Usage:**\n1. After install, the `@whisper` tool becomes available\n2. Provide an audio file or recording\n3. Whisper transcribes it with high accuracy\n\n**Example:**\n```\n@whisper Transcribe this meeting recording and summarize the key points\n```",
    toolsProvided: ["whisper"],
  },
  {
    id: "tesseract",
    name: "Tesseract OCR",
    description: "Open-source OCR engine — extract text from images, scanned documents, and PDFs",
    author: "tesseract-ocr",
    repo: "https://github.com/tesseract-ocr/tesseract",
    type: "skill",
    tags: ["ocr", "image-text", "scanning"],
    stars: 65000,
    installed: false,
    setupCmd: "",
    icon: "📄",
    usage: "Tesseract OCR extracts text from images and scanned documents.\n\n**Usage:**\n1. After install, the `@tesseract` tool becomes available\n2. Provide an image or PDF with text\n3. Tesseract extracts the text content\n\n**Example:**\n```\n@tesseract Extract text from this scanned invoice\n```",
    toolsProvided: ["tesseract"],
    systemDependencies: ["tesseract-ocr"],
  },

  // ── UI Plugins ──────────────────────────────────────────────────
  {
    id: "open-webui",
    name: "Open WebUI",
    description: "Self-hosted ChatGPT-like interface — works with Ollama, OpenAI, and custom backends",
    author: "open-webui",
    repo: "https://github.com/open-webui/open-webui",
    type: "ui",
    tags: ["chat-ui", "self-hosted", "ollama"],
    stars: 70000,
    installed: false,
    setupCmd: "pip install open-webui",
    icon: "🖥️",
    usage: "Open WebUI provides a ChatGPT-like interface for Nova.\n\n**Usage:**\n1. After install, start the Open WebUI service\n2. Access the web interface at the configured port\n3. It connects to Nova's backend for AI responses\n\n**Example:**\nOpen your browser to `http://localhost:3000` to access the chat UI.",
    toolsProvided: [],
    pythonVersionRequirement: ">=3.11,<3.13",
  },
  {
    id: "flowise",
    name: "Flowise",
    description: "Drag-and-drop LLM flow builder — visually create AI workflows with LangChain components",
    author: "FlowiseAI",
    repo: "https://github.com/FlowiseAI/Flowise",
    type: "ui",
    tags: ["visual", "workflow", "no-code"],
    stars: 35000,
    installed: false,
    setupCmd: "npm install && npm run build",
    icon: "🔀",
    usage: "Flowise provides a visual drag-and-drop workflow builder.\n\n**Usage:**\n1. After install, start the Flowise service\n2. Access the flow builder at the configured port\n3. Drag and drop LangChain components to create AI workflows\n\n**Example:**\nOpen your browser to `http://localhost:3001` to build AI flows visually.",
    toolsProvided: [],
  },
  {
    id: "dify",
    name: "Dify",
    description: "Open-source LLM app development platform — build, deploy, and monitor AI applications",
    author: "langgenius",
    repo: "https://github.com/langgenius/dify",
    type: "ui",
    tags: ["platform", "app-builder", "workflow"],
    stars: 60000,
    installed: false,
    setupCmd: "docker-compose up -d",
    icon: "🧩",
    usage: "Dify provides a full LLM app development platform.\n\n**Usage:**\n1. After install, start Dify with Docker Compose\n2. Access the dashboard at the configured port\n3. Build, deploy, and monitor AI applications\n\n**Example:**\nOpen your browser to `http://localhost:3002` to access the Dify dashboard.",
    toolsProvided: [],
    systemDependencies: ["docker", "docker-compose"],
  },
];

// ─── Plugin Store (persistent state) ───────────────────────────────
const STATE_FILE = join(PLUGINS_DIR, ".plugins-state.json");

function loadState(): Record<string, boolean> {
  try {
    if (existsSync(STATE_FILE)) {
      return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    }
  } catch {}
  return {};
}

function saveState(state: Record<string, boolean>): void {
  if (!existsSync(PLUGINS_DIR)) mkdirSync(PLUGINS_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── Public API ────────────────────────────────────────────────────

/** Get all community plugins with their install status */
export function listCommunityPlugins(): CommunityPlugin[] {
  const state = loadState();
  return COMMUNITY_PLUGINS.map((p) => ({
    ...p,
    installed: state[p.id] || false,
    installPath: state[p.id] ? join(PLUGINS_DIR, p.id) : undefined,
  }));
}

/** Get a single community plugin by ID */
export function getCommunityPlugin(id: string): CommunityPlugin | undefined {
  return listCommunityPlugins().find((p) => p.id === id);
}

/**
 * Auto-detect the project type in a cloned repo directory and return
 * the best install command for it. Falls back to the plugin's setupCmd if set.
 */
function detectSetupCommand(dir: string, preferredCmd?: string): string | null {
  // If a preferred command is specified, validate its prerequisites exist
  if (preferredCmd) {
    // If it references requirements.txt, check it exists
    if (preferredCmd.includes("requirements.txt")) {
      if (existsSync(join(dir, "requirements.txt"))) return preferredCmd;
      // Fall through to auto-detection instead of using a broken command
    }
    // If it references package.json, check it exists
    else if (preferredCmd.includes("npm") || preferredCmd.includes("node")) {
      if (existsSync(join(dir, "package.json"))) return preferredCmd;
      // Fall through to auto-detection
    }
    // If it references pyproject.toml or setup.py, check they exist
    else if (preferredCmd.includes("pip") || preferredCmd.includes("python")) {
      const files = readdirSync(dir);
      if (files.includes("requirements.txt") || files.includes("pyproject.toml") || files.includes("setup.py") || files.includes("setup.cfg")) {
        return preferredCmd;
      }
      // Fall through to auto-detection
    }
    else {
      // No specific prerequisite check needed, use as-is
      return preferredCmd;
    }
  }

  // Auto-detect based on files present in the repo root
  const files = readdirSync(dir);

  // Python projects
  if (files.includes("requirements.txt")) {
    return "pip install -r requirements.txt";
  }
  if (files.includes("pyproject.toml")) {
    return "pip install -e .";
  }
  if (files.includes("setup.py")) {
    return "pip install -e .";
  }
  if (files.includes("setup.cfg")) {
    return "pip install -e .";
  }

  // Node.js projects
  if (files.includes("package.json")) {
    return "npm install";
  }
  if (files.includes("yarn.lock")) {
    return "yarn install";
  }
  if (files.includes("pnpm-lock.yaml")) {
    return "pnpm install";
  }
  if (files.includes("bun.lock") || files.includes("bun.lockb")) {
    return "bun install";
  }

  // Rust projects
  if (files.includes("Cargo.toml")) {
    return "cargo build";
  }

  // Go projects
  if (files.includes("go.mod")) {
    return "go mod download";
  }

  // Makefile
  if (files.includes("Makefile") || files.includes("makefile")) {
    return null; // Let the user know a Makefile exists but don't auto-run
  }

  return null;
}

/**
 * Remove a directory recursively using Node.js (cross-platform, no shell commands)
 */
function removeDir(dir: string): void {
  try {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  } catch {}
}

/**
 * Parse a Python version string like "3.14.0" into [3, 14, 0]
 */
function parsePythonVersion(version: string): number[] {
  return version.split(".").map((s) => parseInt(s, 10) || 0);
}

/**
 * Check if current Python version satisfies a requirement string like ">=3.11,<3.13"
 * Returns { ok: true } or { ok: false, reason: string }
 */
function checkPythonVersionRequirement(requirement: string): { ok: boolean; reason?: string } {
  try {
    const pyVersionOut = execSync("python --version", { timeout: 10000 }).toString().trim();
    const match = pyVersionOut.match(/(\d+\.\d+\.?\d*)/);
    if (!match) return { ok: false, reason: `Could not detect Python version from: ${pyVersionOut}` };
    const currentVer = parsePythonVersion(match[1]);

    // Parse requirement like ">=3.11,<3.13"
    const parts = requirement.split(",").map((s) => s.trim());
    for (const part of parts) {
      const opMatch = part.match(/^(>=|<=|>|<|==|!=)(\d+\.\d+\.?\d*)/);
      if (!opMatch) continue;
      const [, op, verStr] = opMatch;
      const ver = parsePythonVersion(verStr);
      const cmp = compareVersions(currentVer, ver);
      let ok = false;
      switch (op) {
        case ">=": ok = cmp >= 0; break;
        case "<=": ok = cmp <= 0; break;
        case ">": ok = cmp > 0; break;
        case "<": ok = cmp < 0; break;
        case "==": ok = cmp === 0; break;
        case "!=": ok = cmp !== 0; break;
      }
      if (!ok) {
        return { ok: false, reason: `Python ${match[1]} does not satisfy requirement ${part} (need ${requirement})` };
      }
    }
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, reason: `Could not check Python version: ${safeMessage(e)}` };
  }
}

function compareVersions(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

/**
 * Check if a system dependency is available (checks PATH)
 */
function checkSystemDependency(name: string): boolean {
  try {
    execSync(`where ${name}`, { timeout: 5000, stdio: "pipe" });
    return true;
  } catch {
    // Try "which" as fallback (Unix)
    try {
      execSync(`which ${name} 2>nul`, { timeout: 5000, stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Install a community plugin — clones the repo, auto-detects project type, runs setup
 * Returns { success: true, path: string } or { success: false, error: string }
 */
export async function installPlugin(id: string): Promise<{ success: boolean; path?: string; error?: string; log?: string[] }> {
  const plugin = COMMUNITY_PLUGINS.find((p) => p.id === id);
  if (!plugin) return { success: false, error: `Plugin '${id}' not found` };

  const state = loadState();
  if (state[plugin.id]) return { success: false, error: `Plugin '${plugin.name}' is already installed` };

  const targetDir = join(PLUGINS_DIR, plugin.id);
  const log: string[] = [];

  try {
    // Create plugins directory if needed
    if (!existsSync(PLUGINS_DIR)) mkdirSync(PLUGINS_DIR, { recursive: true });

    log.push(`📦 Installing ${plugin.name}...`);
    log.push(`   Repo: ${plugin.repo}`);
    log.push(`   Target: ${targetDir}`);

    // ── Pre-flight checks ──────────────────────────────────────────

    // Check Python version requirement
    if (plugin.pythonVersionRequirement) {
      log.push(`\n🔍 Checking Python version requirement: ${plugin.pythonVersionRequirement}`);
      const pyCheck = checkPythonVersionRequirement(plugin.pythonVersionRequirement);
      if (!pyCheck.ok) {
        log.push(`   ❌ ${pyCheck.reason}`);
        throw new Error(pyCheck.reason);
      }
      log.push(`   ✅ Python version OK`);
    }

    // Check system dependencies
    if (plugin.systemDependencies && plugin.systemDependencies.length > 0) {
      log.push(`\n🔍 Checking system dependencies...`);
      for (const dep of plugin.systemDependencies) {
        const found = checkSystemDependency(dep);
        if (found) {
          log.push(`   ✅ ${dep} found`);
        } else {
          log.push(`   ⚠ ${dep} not found in PATH — may need manual install`);
        }
      }
    }

    // ── Build git env with proxy support ───────────────────────────
    const proxyKey = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
    const gitEnv: Record<string, string | undefined> = {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
    };
    // Pass through proxy env vars for git
    for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "NO_PROXY", "no_proxy", "GIT_SSL_NO_VERIFY", "GIT_HTTP_PROXY_AUTHMETHOD"]) {
      if (process.env[key]) gitEnv[key] = process.env[key];
    }
    if (proxyKey) {
      log.push(`   🔌 Using proxy: ${proxyKey.replace(/\/\/.*@/, "//***@")}`);
    }

    // ── Git connectivity check ─────────────────────────────────────
    log.push(`\n🔍 Checking git connectivity to ${plugin.repo}...`);
    let gitReachable = false;
    try {
      execSync(`git ls-remote --quiet "${plugin.repo}" HEAD`, {
        timeout: 15000,
        stdio: ["ignore", "pipe", "pipe"],
        env: gitEnv as any,
      });
      log.push(`   ✅ Repository reachable`);
      gitReachable = true;
    } catch (gitCheckErr: unknown) {
      const stderr = (gitCheckErr && typeof gitCheckErr === "object" && "stderr" in gitCheckErr
        ? String((gitCheckErr as any).stderr)
        : safeMessage(gitCheckErr)).slice(0, 300);
      log.push(`   ❌ Cannot reach repository: ${stderr}`);
    }

    // ── Clone the repository (with zip fallback) ──────────────────
    let cloned = false;
    if (gitReachable) {
      log.push(`\n🔄 Cloning repository...`);
      try {
        const proxyConfig = proxyKey ? ` --config http.proxy='${proxyKey}' --config https.proxy='${proxyKey}'` : "";
        execSync(`git clone --depth 1${proxyConfig} ${plugin.repo} "${targetDir}"`, {
          timeout: 120000, // 2 minutes
          maxBuffer: 10 * 1024 * 1024,
          stdio: ["ignore", "pipe", "pipe"],
          env: gitEnv as any,
        });
        log.push(`   ✅ Repository cloned`);
        cloned = true;
      } catch (cloneErr: unknown) {
        const stderr = (cloneErr && typeof cloneErr === "object" && "stderr" in cloneErr
          ? String((cloneErr as any).stderr)
          : safeMessage(cloneErr, "unknown error")).slice(0, 500);
        log.push(`   ❌ Git clone failed: ${stderr.slice(0, 500)}`);
      }
    }

    // ── Fallback: download ZIP via fetch ───────────────────────────
    if (!cloned) {
      const zipUrl = plugin.repo
        .replace(/\.git$/, "")
        .replace(/^git@(.+):(.+)$/, "https://$1/$2")
        + "/archive/HEAD.zip";
      log.push(`\n🔄 Git unavailable — trying ZIP download from ${zipUrl}...`);
      try {
        // Use Node.js fetch (Bun/Node 18+) to download
        const response = await fetch(zipUrl, {
          signal: AbortSignal.timeout(30000),
          headers: { "User-Agent": "Nova/1.0" },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        // Import AdmZip or extract manually
        const { execSync: exec } = await import("node:child_process");
        // Save zip temporarily
        const zipPath = targetDir + ".zip";
        const { writeFileSync, mkdirSync } = await import("node:fs");
        writeFileSync(zipPath, buffer);
        mkdirSync(targetDir, { recursive: true });
        // Extract using powershell Expand-Archive (Windows) or node-tar / unzip (Unix)
        const isWindows = process.platform === "win32";
        try {
          if (isWindows) {
            // Use PowerShell with long-path support prefix (\\?\) and exclude CLAUDE.md to avoid "Invalid argument"
            const psCmd = [
              `$zip = '${zipPath.replace(/'/g, "''")}'`,
              `$dest = '${targetDir.replace(/'/g, "''")}'`,
              // Enable long path support via \\?\ prefix
              `if ($dest.Length -gt 240) { $dest = '\\\\?\\' + $dest }`,
              `if ($zip.Length -gt 240) { $zip = '\\\\?\\' + $zip }`,
              // Use .NET API directly (handles long paths better than Expand-Archive)
              `Add-Type -AssemblyName System.IO.Compression.FileSystem`,
              `try { $a = [System.IO.Compression.ZipFile]::OpenRead($zip) } catch { throw }`,
              // Check entries — warn about long paths
              `$longPaths = $a.Entries | Where-Object { $_.FullName.Length -gt 240 -or $_.Name -eq 'CLAUDE.md' }`,
              `if ($longPaths) { Write-Warning "Stripping $($longPaths.Count) problematic entries" }`,
              // Extract all entries, skipping problematic ones
              `foreach ($entry in $a.Entries) {`,
              `  if ($entry.Name -eq 'CLAUDE.md' -or $entry.FullName.Length -gt 248) { continue }`,
              `  $filePath = [System.IO.Path]::Combine($dest, $entry.FullName)`,
              `  if ($entry.FullName.EndsWith('/') -or $entry.FullName.EndsWith('\\')) {`,
              `    [System.IO.Directory]::CreateDirectory($filePath) | Out-Null`,
              `  } else {`,
              `    [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($filePath)) | Out-Null`,
              `    $entry.ExtractToFile($filePath, $true)`,
              `  }`,
              `}`,
              `$a.Dispose()`,
            ].join("; ");
            execSync(`powershell -NoProfile -Command "${psCmd}"`, { timeout: 60000 });
          } else {
            execSync(`unzip -qo "${zipPath}" -d "${targetDir}"`, { timeout: 30000 });
          }
        } catch {
          // Try tar as fallback (GitHub archive is tar.gz via alternate URL)
          const tarUrl = plugin.repo.replace(/\.git$/, "").replace(/^git@(.+):(.+)$/, "https://$1/$2") + "/archive/HEAD.tar.gz";
          const tarRes = await fetch(tarUrl, { signal: AbortSignal.timeout(30000) });
          if (!tarRes.ok) throw new Error(`ZIP and TAR both failed`);
          const tarBuffer = Buffer.from(await tarRes.arrayBuffer());
          const tarPath = zipPath.replace(".zip", ".tar.gz");
          writeFileSync(tarPath, tarBuffer);
          if (isWindows) {
            // Windows tar: use --force-local, strip trailing slash in archive name,
            // and pipe through sed to exclude CLAUDE.md and long paths
            const tarCmd = `tar --force-local -xzf '${tarPath}' -C '${targetDir}'`;
            execSync(tarCmd, { timeout: 60000, shell: true });
            // Remove any extracted CLAUDE.md files (Windows long-path issue)
            try { execSync(`powershell -NoProfile -Command "Get-ChildItem '${targetDir}' -Recurse -Filter 'CLAUDE.md' | Remove-Item -Force 2>0"`, { timeout: 10000, shell: true }); } catch {}
          } else {
            execSync(`tar -xzf '${tarPath}' -C '${targetDir}'`, { timeout: 30000 });
          }
        }
        // Clean up zip/tar files
        try { execSync(`del "${zipPath}" 2>nul`, { shell: true }); } catch {}
        try { execSync(`del "${zipPath.replace('.zip', '.tar.gz')}" 2>nul`, { shell: true }); } catch {}
        // Remove any .agents directories left behind (Windows path issue)
        try { execSync(`powershell -Command "Get-ChildItem '${targetDir}' -Recurse -Directory -Filter '.agents' | Remove-Item -Recurse -Force 2>0"`, { timeout: 10000, shell: true }); } catch {}
        // Move contents up one level (GitHub archive nests in a subfolder)
        const { readdirSync } = await import("node:fs");
        const { join } = await import("node:path");
        const items = readdirSync(targetDir);
        if (items.length === 1) {
          const nestedDir = join(targetDir, items[0]);
          const nestedItems = readdirSync(nestedDir);
          for (const item of nestedItems) {
            try { execSync(`move "${join(nestedDir, item)}" "${join(targetDir, item)}"`, { shell: true }); } catch {}
          }
          try { execSync(`rmdir "${nestedDir}"`, { shell: true }); } catch {}
        }
        log.push(`   ✅ Downloaded and extracted from ZIP`);
        cloned = true;
      } catch (zipErr: unknown) {
        log.push(`   ❌ ZIP download also failed: ${safeMessage(zipErr)}`);
        // Clean up partial targetDir
        try { execSync(`rmdir /s /q "${targetDir}" 2>nul`, { shell: true }); } catch {}
      }
    }

    // If both methods failed, throw with diagnostics
    if (!cloned) {
      // Network diagnostics
      const networkHints: string[] = [];
      // Proxy status
      if (proxyKey) {
        networkHints.push(`✅ Proxy configured: ${proxyKey.replace(/\/\/.*@/, "//***@")}`);
        // Test proxy connectivity
        try {
          const proxyHost = proxyKey.replace(/^https?:\/\//, "").split("/")[0].split("@").pop() || "";
          const proxyPing = execSync(`ping -n 1 -w 2000 ${proxyHost.split(":")[0]} 2>nul || ping -c 1 -W 2 ${proxyHost.split(":")[0]} 2>/dev/null`, { timeout: 5000, stdio: "pipe" }).toString().trim();
          networkHints.push(`   Proxy host reachable: ${proxyHost}`);
        } catch {
          networkHints.push(`   ❌ Proxy host unreachable — check proxy address and port`);
        }
      } else {
        networkHints.push(`❌ No proxy configured. If behind a corporate firewall, set:`);
        networkHints.push(`   set HTTP_PROXY=http://your-proxy:port`);
        networkHints.push(`   set HTTPS_PROXY=http://your-proxy:port`);
        networkHints.push(`   Or globally for git: git config --global http.proxy http://your-proxy:port`);
      }
      // DNS check
      try {
        execSync(`nslookup github.com 2>nul || nslookup github.com 2>/dev/null`, { timeout: 5000, stdio: "pipe" });
        networkHints.push(`✅ DNS: github.com resolves`);
      } catch {
        networkHints.push(`❌ DNS: github.com does NOT resolve — check DNS settings or /etc/hosts`);
      }
      // Internet connectivity (ping)
      try {
        execSync(`ping -n 1 -w 2000 github.com 2>nul || ping -c 1 -W 2 github.com 2>/dev/null`, { timeout: 5000, stdio: "pipe" });
        networkHints.push(`✅ Internet: github.com reachable`);
      } catch {
        networkHints.push(`❌ Internet: cannot reach github.com — check firewall / proxy`);
      }
      // SSL check
      try {
        execSync(`git ls-remote --quiet https://github.com 2>nul`, { timeout: 8000, stdio: "pipe" });
        networkHints.push(`✅ SSL: git over HTTPS works`);
      } catch {
        networkHints.push(`❌ SSL: git over HTTPS failed — possible SSL/TLS or certificate issue`);
        networkHints.push(`   For testing: set GIT_SSL_NO_VERIFY=1`);
      }
      networkHints.forEach((h) => log.push(h));
      throw new Error(`Cannot download plugin '${plugin.id}' — all download methods failed.\n${networkHints.join("\n")}`);
    }

    // Auto-detect setup command based on project files
    const setupCmd = detectSetupCommand(targetDir, plugin.setupCmd);
    if (setupCmd) {
      log.push(`\n🔧 Running setup: ${setupCmd}`);
      try {
        const setupOutput = execSync(setupCmd, {
          cwd: targetDir,
          timeout: 300000, // 5 minutes
          maxBuffer: 10 * 1024 * 1024,
          stdio: ["ignore", "pipe", "pipe"],
        }).toString();
        log.push(`   ✅ Setup completed`);
        const lines = setupOutput.split("\n").filter(Boolean);
        if (lines.length > 0) {
          // Show last 10 lines of output (most relevant)
          const showLines = lines.slice(-10);
          log.push(`   Output (last ${showLines.length} lines):`);
          showLines.forEach((l) => log.push(`     ${l}`));
          if (lines.length > 10) log.push(`     ... (${lines.length - 10} more lines hidden)`);
        }
      } catch (setupErr: unknown) {
        const stderr = (setupErr && typeof setupErr === "object" && "stderr" in setupErr
          ? String((setupErr as any).stderr)
          : safeMessage(setupErr, "")).slice(0, 500);
        // Try to extract meaningful error from pip output
        const pipError = extractPipError(stderr);
        if (pipError) {
          log.push(`   ❌ Setup failed: ${pipError}`);
          throw new Error(pipError);
        }
        log.push(`   ⚠ Setup warning: ${safeMessage(setupErr)}`);
        // Don't fail — setup may have partially succeeded
      }
    } else {
      log.push(`\n   ℹ No setup command detected. Plugin cloned to ${targetDir}`);
      // Check if Makefile exists and notify
      try {
        const files = readdirSync(targetDir);
        if (files.some((f) => f.toLowerCase() === "makefile")) {
          log.push(`   ℹ A Makefile was found. You may need to run 'make' manually.`);
        }
      } catch {}
    }

    // Mark as installed
    state[plugin.id] = true;
    saveState(state);
    log.push(`\n✅ ${plugin.name} installed successfully!`);

    return { success: true, path: targetDir, log };
  } catch (err: unknown) {
    log.push(`\n❌ Installation failed: ${safeMessage(err)}`);
    // Clean up on failure using cross-platform Node.js API
    removeDir(targetDir);
    return { success: false, error: safeMessage(err), log };
  }
}

/**
 * Extract a meaningful error message from pip output
 */
function extractPipError(output: string): string | null {
  // Look for common pip error patterns
  const patterns = [
    /ERROR: Could not find a version that satisfies the requirement (\S+)/,
    /ERROR: No matching distribution found for (\S+)/,
    /ERROR: (.*?)(?:\n|$)/,
  ];
  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match) {
      // Return just the error line, not the full version listing
      const lines = output.split("\n").filter((l) => l.includes("ERROR"));
      if (lines.length > 0) {
        return lines[0].trim();
      }
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Uninstall a plugin — removes the directory
 */
export async function uninstallPlugin(id: string): Promise<{ success: boolean; error?: string }> {
  const state = loadState();
  if (!state[id]) return { success: false, error: `Plugin '${id}' is not installed` };

  const targetDir = join(PLUGINS_DIR, id);
  try {
    removeDir(targetDir);
    delete state[id];
    saveState(state);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: safeMessage(err) };
  }
}

console.log(`  ✓ Community plugin registry ready (${COMMUNITY_PLUGINS.length} plugins)`);
