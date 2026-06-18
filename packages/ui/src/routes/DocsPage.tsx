import { useState, useEffect } from "react";

const sections: Record<string, { title: string; icon: string; content: string }> = {
  overview: {
    title: "Overview",
    icon: "\u{1F3E0}",
    content: "# Nexus AI v2.0 — Aurora\n\nNexus AI is a premium, self-hosted platform for building, connecting, and orchestrating AI agents. It runs **entirely on your machine** and provides:\n\n- **Premium Chat** — Agent Switcher, Model Switcher, Context Bar, Fork, Streaming with thinking panel\n- **Agent Mesh Protocol** — 13 interconnected agents with real-time status, routing, and delegation\n- **Autonomous Agents** — configurable agents with tools, skills, workspace, and scheduling\n- **Knowledge Graph** — visual graph of connected knowledge entities\n- **RAG Pipeline** — upload → chunk → embed → semantic search\n- **Code Editor** — built-in editor with syntax highlighting\n- **Git Automation** — auto-commit, auto-PR, branch management\n- **Terminal** — web-based shell access with slash commands\n- **Workflow Builder** — visual drag-and-drop workflow engine\n- **Channel Bridges** — connect to Telegram, Discord, Slack, and WeChat\n- **Plugin System** — extensible via MCP, custom tools, and community plugins\n- **Workspace Management** — file browser and editor for project files\n- **Persistent Memory** — searchable memory with confidence scoring\n- **50+ Integrations** — Slack, Notion, Google, GitHub, Jira & more\n\n---\n\n## Getting Started\n\n1. Start the server: `bun run dev`\n2. Open dashboard: `http://localhost:4123`\n3. Configure API keys in **Settings → API Keys**\n4. Start chatting or create an agent\n\n> All data stays local. No cloud dependencies except model API calls."
  },
  chat: {
    title: "Chat",
    icon: "\u{1F4AC}",
    content: "# Chat Interface\n\nThe Chat page provides premium multi-agent conversation with model switching.\n\n### Features\n\n- **Agent Switcher** — choose from 8 specialized agents\n- **Model Switcher** — pick from 12+ providers, 44+ models\n- **Streaming** — real-time SSE responses with thinking panel\n- **Tool Calls** — live tool execution cards with status\n- **Fork** — branch conversation at any point\n- **Context Bar** — visualize token usage\n- **Session Persistence** — auto-saved conversations\n- **Slash Commands** — /help, /agents, /models, /clear, /fork, /export\n\n### Tips\n\n- Use Enter to send, Shift+Enter for newline\n- Sessions auto-saved in the Sessions page\n- Switch agents mid-conversation via the Agent dropdown"
  },
  agents: {
    title: "Agents & Mesh",
    icon: "\u{1F916}",
    content: "# Agent System & Mesh Protocol\n\nNexus AI features 13 interconnected agents via the Agent Mesh Protocol.\n\n### Agent Mesh\n\nAll agents are connected through the mesh — they can communicate, delegate tasks, and share context.\n\n### Creating an Agent\n\n1. Go to **Agents** page\n2. Click **+ Create Agent**\n3. Configure: Name, Model, Tools, System Prompt, Thinking Level, Workspace\n\n### Agent Types\n\n- **Chat Agent** — interactive conversation with tool calling\n- **Autonomous Agent** — runs independently on schedule\n- **Sub-Agent** — one-shot isolated task execution\n\n### Mesh API\n\n- `GET /api/mesh/topology` — current mesh map\n- `GET /api/mesh/agents` — all agents with status\n- `POST /api/mesh/send` — route message through mesh"
  },
  knowledge: {
    title: "Knowledge",
    icon: "\u{1F9E0}",
    content: "# Knowledge System\n\nNexus AI provides knowledge graph and RAG pipeline for intelligent information retrieval.\n\n### Knowledge Graph\n\nVisual graph of connected knowledge entities — nodes and edges representing concepts.\n\n### RAG Pipeline\n\n1. **Upload** — PDF, Markdown, text files\n2. **Chunk** — automatic document splitting\n3. **Embed** — vector embeddings for semantic search\n4. **Query** — natural language questions against knowledge base\n\n### Memory System\n\n- **User memories** — shared across projects\n- **Project memories** — local to current project\n- **Session memories** — scoped to individual conversations\n- **Confidence scoring** — ranks memory reliability\n- **Conflict resolution** — auto-merges related entries"
  },
  development: {
    title: "Development",
    icon: "\u{1F4BB}",
    content: "# Developer Tools\n\nNexus AI includes a full suite of developer tools.\n\n### Code Editor\n\nBuilt-in editor with syntax highlighting for editing workspace files.\n\n### Git Automation\n\n- Auto-commit on file saves\n- Auto-PR generation\n- Branch management\n- 11 git tools for agents\n\n### Terminal\n\nWeb-based shell access with full CLI capabilities.\n\n### Workflow Builder\n\nVisual drag-and-drop workflow engine using ReactFlow. Create, connect, and execute agent workflows.\n\n### Workspace\n\nFile browser and editor for managing project files with agent integration."
  },
  integrations: {
    title: "Integrations",
    icon: "\u{1F517}",
    content: "# Integrations Hub\n\nConnect Nexus AI to 50+ external services.\n\n### Categories\n\n- **Communication** — Slack, Discord, Telegram, WeChat\n- **Productivity** — Notion, Google Drive, Google Calendar, Jira\n- **Development** — GitHub, GitLab, Linear, ClickUp\n- **Data** — PostgreSQL, MySQL, MongoDB, Redis\n\n### Channel Bridges\n\nConnect agents to external platforms via channel plugins."
  },
  api: {
    title: "API Reference",
    icon: "\u{1F50C}",
    content: "# REST API Reference\n\nBase URL: http://localhost:4123\n\n## Core Endpoints\n\n| Method | Path | Description |\n|--------|------|-------------|\n| GET | /v1/models | List available models |\n| POST | /v1/chat/completions | Chat completion (SSE stream) |\n| GET | /healthz | Health check |\n\n## Agent & Mesh\n\n| Method | Path | Description |\n|--------|------|-------------|\n| GET | /api/agents | List configured agents |\n| POST | /api/agents | Create custom agent |\n| GET | /api/mesh/topology | Mesh topology map |\n| GET | /api/mesh/agents | All agents with status |\n| POST | /api/mesh/send | Route message through mesh |\n| POST | /api/agent/send | Send message to agent |\n\n## Sessions\n\n| Method | Path | Description |\n|--------|------|-------------|\n| GET | /api/sessions | List recent sessions |\n| GET | /api/sessions/:id | Get session detail |\n\n## Config\n\n| Method | Path | Description |\n|--------|------|-------------|\n| GET | /api/config/providers | List providers |\n| POST | /api/config/providers/:id | Save provider key |\n\n## System\n\n| Method | Path | Description |\n|--------|------|-------------|\n| GET | /api/mesh/stats | Mesh statistics |\n| GET | /api/mesh/events | Recent mesh events |\n| GET | /api/logs/stream | Real-time log stream |"
  }
};

function renderMarkdown(content: string) {
  const lines = content.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("# ")) {
      return <h1 key={i} className="text-xl font-bold text-white mb-4 mt-2">{line.slice(2)}</h1>;
    } else if (line.startsWith("## ")) {
      return <h2 key={i} className="text-lg font-semibold text-white mb-3 mt-6 border-b border-slate-800 pb-2">{line.slice(3)}</h2>;
    } else if (line.startsWith("### ")) {
      return <h3 key={i} className="text-sm font-semibold text-indigo-300 mb-2 mt-5">{line.slice(4)}</h3>;
    } else if (line.startsWith("|") && line.endsWith("|") && !line.includes("---")) {
      const cells = line.slice(1, -1).split("|").map(c => c.trim());
      return (
        <div key={i} className="text-xs text-slate-400 font-mono border-b border-slate-800 py-1.5 flex">
          {cells.map((cell, ci) => (
            <span key={ci} className="flex-1 px-1">{cell}</span>
          ))}
        </div>
      );
    } else if (line.startsWith("> ")) {
      return <blockquote key={i} className="text-xs text-slate-400 italic border-l-2 border-indigo-500/30 pl-3 my-2">{line.slice(2)}</blockquote>;
    } else if (line.startsWith("- **")) {
      return <div key={i} className="text-xs text-slate-300 ml-4 my-1">{line}</div>;
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      return <div key={i} className="text-xs text-slate-400 ml-4 my-0.5">{line.slice(2)}</div>;
    } else if (line.trim() === "") {
      return <div key={i} className="h-2" />;
    } else {
      return <p key={i} className="text-xs text-slate-400 leading-relaxed">{line}</p>;
    }
  });
}

export function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && sections[hash]) setActiveSection(hash);

    const onHashChange = () => {
      const h = window.location.hash.slice(1);
      if (h && sections[h]) setActiveSection(h);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-56 shrink-0 border-r border-slate-800 overflow-y-auto p-3 hidden md:block">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3 px-2">Documentation</div>
        {Object.entries(sections).map(([key, section]) => (
          <button
            key={key}
            onClick={() => { setActiveSection(key); window.location.hash = key; }}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all mb-0.5 ${
              activeSection === key
                ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent"
            }`}
          >
            <span className="mr-2">{section.icon}</span>
            {section.title}
          </button>
        ))}
      </div>

      {/* Mobile menu button */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-slate-900 border border-slate-700"
      >
        <svg className="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {menuOpen ? <path d="M18 6 6 18M6 6l12 12"/> : <path d="M3 12h18M3 6h18M3 18h18"/>}
        </svg>
      </button>

      {/* Mobile overlay */}
      {menuOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setMenuOpen(false)} />
          <div className="md:hidden fixed left-0 top-0 z-40 h-full w-56 bg-slate-900 border-r border-slate-800 p-3 pt-16 overflow-y-auto">
            {Object.entries(sections).map(([key, section]) => (
              <button
                key={key}
                onClick={() => { setActiveSection(key); setMenuOpen(false); window.location.hash = key; }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all mb-0.5 ${
                  activeSection === key
                    ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent"
                }`}
              >
                <span className="mr-2">{section.icon}</span>
                {section.title}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          {activeSection && sections[activeSection] && (
            <>
              <div className="mb-6 md:hidden">
                <h1 className="text-lg font-bold text-white">{sections[activeSection].title}</h1>
              </div>
              <div className="glass-panel rounded-xl p-5 md:p-8">
                <div className="prose prose-invert prose-xs max-w-none">
                  {renderMarkdown(sections[activeSection].content)}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
