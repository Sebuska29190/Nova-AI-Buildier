/**
 * ChatPage — Premium AI Agent Chat (ZCode/Cursor style)
 * Full rewrite with markdown streaming, tool call cards, thinking panel,
 * code blocks, floating input, and action cards.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js";
import { Bot, Sparkles, Settings, Copy, ThumbsUp, ThumbsDown, RefreshCw, ChevronDown, Upload, Trash2, X, Edit3, Plus, MessageSquare, FileCode, Search, BookOpen, Zap, Brain, Cpu, FolderGit2, GitBranch, Users, Hexagon, Check, History } from "lucide-react";
import { api } from "../lib/api";
import { CodeBlock } from "../lib/components/chat/CodeBlock";
import { ToolCallCard } from "../lib/components/chat/ToolCallCard";
import { ThinkingPanel } from "../lib/components/chat/ThinkingPanel";
import { WelcomeScreen } from "../lib/components/chat/WelcomeScreen";
import { ChatInput } from "../lib/components/chat/ChatInput";
import { AgentActivityPanel } from "../lib/components/chat/AgentActivityPanel";
import { useToast } from "../lib/components/ui/Toast";

// Configure marked
marked.setOptions({
  highlight: (code: string, lang: string) => {
    if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value;
    return hljs.highlightAuto(code).value;
  },
  breaks: true,
  gfm: true,
} as any);

// ─── Types ──────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  files?: { name: string; size: number; type: string }[];
  toolCalls?: Array<{ tool: string; args: any; result?: string; success?: boolean; duration?: number }>;
  thinking?: string;
  duration?: number;
  tokens?: { input: number; output: number };
}

interface Settings { agent: string; autoApprove: boolean; autoAllowance: boolean; }

// ─── Agent List ──────────────────────────────────────
const AGENT_LIST = [
  { id: "main", name: "Main Assistant", icon: "🤖" },
  { id: "research", name: "Research Agent", icon: "🧠" },
  { id: "coder", name: "Coder Agent", icon: "💻" },
  { id: "data", name: "Data Analyst", icon: "📊" },
  { id: "security", name: "Security Auditor", icon: "🔒" },
  { id: "devops", name: "DevOps Engineer", icon: "🚀" },
  { id: "pm", name: "Project Manager", icon: "📋" },
  { id: "tester", name: "Tester", icon: "🧪" },
];

// ─── Slash Commands ─────────────────────────────────────
const SLASH_COMMANDS = [
  { cmd: "/help", desc: "Show available commands" },
  { cmd: "/clear", desc: "Clear conversation" },
  { cmd: "/agents", desc: "List available agents" },
  { cmd: "/agent", desc: "Switch to specific agent" },
  { cmd: "/tools", desc: "List available tools" },
  { cmd: "/models", desc: "List available models" },
  { cmd: "/skills", desc: "List active skills" },
  { cmd: "/memory", desc: "Search memory" },
  { cmd: "/search", desc: "Search workspace files" },
  { cmd: "/docs", desc: "Open documentation" },
  { cmd: "/knowledge", desc: "Query knowledge base" },
];

// ─── Main Component ─────────────────────────────────────
interface ChatPageProps {
  models?: Array<{ id: string }>;
  skills?: any[];
  agents?: any[];
  sessions?: any[];
  onRefresh?: () => void;
  sessionKey?: string;
  onSessionKeyChange?: (key: string) => void;
}

export function ChatPage({ models = [], skills = [], agents = [], sessions = [], onRefresh, sessionKey: initialSessionId = "", onSessionKeyChange }: ChatPageProps) {
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", content: "## Welcome to Nexus AI v2.0\n\nI'm your connected AI assistant — powered by the Agent Mesh Protocol. I can orchestrate specialized agents, search knowledge bases, write code, manage your workspace, and more.\n\n**Try these:**\n- `/agents` — see available agents\n- `/models` — browse AI models\n- `/help` — all slash commands\n- Just ask me anything!", timestamp: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [resumeSessionId, setResumeSessionId] = useState(initialSessionId);
  const [agentActivity, setAgentActivity] = useState<Array<{ type: string; tool?: string; args?: any; content?: string; success?: boolean; duration?: number; timestamp: number }>>([]);
  const [currentThinking, setCurrentThinking] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings>({ agent: "deepseek/deepseek-chat", autoApprove: false, autoAllowance: false });
  const [files, setFiles] = useState<File[]>([]);
  const [groupedModels, setGroupedModels] = useState<Record<string, { name: string; hasApiKey: boolean; models: { id: string; name: string }[] }>>({});
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  // ─── Auto-scroll ───────────────────────────────────
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, streamContent, agentActivity]);

  // ─── Fetch grouped models on mount ─────────────────
  useEffect(() => {
    fetch("/api/models/grouped").then(r => r.ok ? r.json() : null).then(d => { if (d?.grouped) setGroupedModels(d.grouped); }).catch(() => {});
  }, []);

  // ─── Resume session ────────────────────────────────
  useEffect(() => {
    if (initialSessionId && initialSessionId !== resumeSessionId) {
      setResumeSessionId(initialSessionId);
      loadSession(initialSessionId);
    }
  }, [initialSessionId]);

  async function loadSession(id: string) {
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages?.length) {
          setMessages(data.messages.map((m: any) => ({
            id: m.id || crypto.randomUUID(),
            role: m.role,
            content: m.content,
            timestamp: new Date(m.created_at).getTime(),
          })));
        }
      }
    } catch {}
  }

  // ─── Send message ──────────────────────────────────
  async function send() {
    const text = input.trim();
    if (!text && files.length === 0) return;
    if (loading) return;

    // Slash command
    if (text.startsWith("/")) {
      const result = await handleSlashCommand(text);
      if (result) {
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "user", content: text, timestamp: Date.now() }, { id: crypto.randomUUID(), role: "assistant", content: result, timestamp: Date.now() }]);
      }
      setInput("");
      return;
    }

    // User message
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text, timestamp: Date.now(), files: files.map(f => ({ name: f.name, size: f.size, type: f.type })) };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setStreaming(true);
    setStreamContent("");
    setAgentActivity([]);
    setCurrentThinking("");
    setIsThinking(false);

    const ac = new AbortController();
    abortRef.current = ac;
    startTimeRef.current = Date.now();

    // File context
    let fileContext = "";
    if (files.length > 0) {
      const uploaded: string[] = [];
      for (const f of files) {
        try {
          const buf = await f.arrayBuffer();
          const b64 = btoa(String.fromCharCode(...new Uint8Array(buf).slice(0, 50000)));
          const fd = new FormData(); fd.append("file", f);
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          if (res.ok) uploaded.push(`${f.name} (${(f.size / 1024).toFixed(0)}KB)`);
        } catch {}
      }
      if (uploaded.length) fileContext = `\n\n[Attached files: ${uploaded.join(", ")}]`;
      setFiles([]);
    }

    const fullMessage = text + fileContext;
    const sessionId = resumeSessionId || crypto.randomUUID();

    try {
      const result = await api.chatSend(fullMessage, settings.agent, sessionId, (chunk) => {
        setStreamContent(chunk);
      }, ac.signal, (event) => {
        if (event.type === "thinking") { setIsThinking(true); setCurrentThinking(event.content || ""); }
        else if (event.type === "tool_call") { setIsThinking(false); setCurrentThinking(""); setAgentActivity(prev => [...prev, { type: "tool_call", tool: event.tool, args: event.args, timestamp: Date.now() }]); }
        else if (event.type === "tool_result") {
          // Merge result into existing tool_call entry
          setAgentActivity(prev => {
            const updated = [...prev];
            for (let i = updated.length - 1; i >= 0; i--) {
              if (updated[i].type === "tool_call" && updated[i].tool === event.tool && !updated[i].duration) {
                updated[i] = { ...updated[i], success: event.success, duration: event.duration };
                break;
              }
            }
            return updated;
          });
        }
        else if (event.type === "done") { setIsThinking(false); setCurrentThinking(""); }
        else if (event.type === "error") { setIsThinking(false); setCurrentThinking(""); }
      });

      const duration = Date.now() - startTimeRef.current;
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: result.text, timestamp: Date.now(), duration, toolCalls: agentActivity.map(a => ({ tool: a.tool || "", args: a.args, success: a.success, duration: a.duration })) }]);
      if (result.sessionKey) { setResumeSessionId(result.sessionKey); onSessionKeyChange?.(result.sessionKey); }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: `Error: ${e.message}`, timestamp: Date.now() }]);
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
      setStreaming(false);
      setStreamContent("");
      setIsThinking(false);
    }
  }

  function cancelStream() {
    abortRef.current?.abort();
    if (streamContent) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: streamContent + "\n\n*[Cancelled]*", timestamp: Date.now() }]);
    }
    setLoading(false);
    setStreaming(false);
    setStreamContent("");
    setIsThinking(false);
  }

  function forkConversation(msgId: string) {
    const idx = messages.findIndex(m => m.id === msgId);
    if (idx >= 0) {
      const forked = messages.slice(0, idx + 1);
      setMessages(forked);
      setResumeSessionId("");
      onSessionKeyChange?.("");
    }
  }

  async function handleSlashCommand(text: string): Promise<string | null> {
    const [cmd, ...args] = text.split(" ");
    const arg = args.join(" ").trim();
    switch (cmd) {
      case "/clear": setMessages([{ id: "welcome", role: "assistant", content: "Conversation cleared.", timestamp: Date.now() }]); setResumeSessionId(""); onSessionKeyChange?.(""); return null;
      case "/help": return `**Available Commands:**\n\n${SLASH_COMMANDS.map(c => `\`${c.cmd}\` — ${c.desc}`).join("\n")}\n\n**Tip:** Type \`/\` to see commands, \`@\` to reference tools.`;
      case "/agents": return agents.length ? agents.map(a => `- **${a.name || a.id}** ${a.description || ""}`).join("\n") : "No agents configured.";
      case "/tools": return "Available tools are auto-detected by the agent based on context.";
      case "/models": return models.length ? models.map(m => `- \`${m.id}\``).join("\n") : "No models configured.";
      case "/skills": return skills.length ? skills.map(s => `- ${s.name || s.id}`).join("\n") : "No skills loaded.";
      case "/knowledge": return arg ? `Searching knowledge base for "${arg}"...` : "Usage: /knowledge <query>";
      case "/search": return arg ? `Searching workspace for "${arg}"...` : "Usage: /search <query>";
      case "/docs": return "Documentation is available at the Docs page in the sidebar.";
      case "/agent": return arg ? `Switching to agent: ${arg}...` : "Usage: /agent <agent-name>";
      default: return `Unknown command: ${cmd}. Type /help for available commands.`;
    }
  }

  // ─── Render markdown with code blocks ──────────────
  function renderContent(content: string): string {
    let html = marked.parse(content) as string;
    // Wrap code blocks with our CodeBlock component data
    html = html.replace(/<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g,
      (_, lang, code) => `<div class="code-block-wrapper" data-lang="${lang}"><pre><code class="language-${lang}">${code}</code></pre></div>`
    );
    html = html.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g,
      (_, code) => `<div class="code-block-wrapper" data-lang="text"><pre><code>${code}</code></pre></div>`
    );
    return html;
  }

  // ─── Chat config ───────────────────────────────────
  const tabs = [
    { id: "chat", label: "Chat", icon: <MessageSquare size={12} /> },
  ];

  return (
    <div className="flex flex-col h-full max-h-[calc(100dvh-3.5rem)]">
      {/* Header — premium Nexus */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-[rgba(255,255,255,0.06)] bg-[#0a0b1e]/90 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00d4ff] via-[#6366f1] to-[#8b5cf6] flex items-center justify-center shadow-[0_0_14px_rgba(0,212,255,0.25)]">
            <Hexagon size={14} className="text-white" />
          </div>
          <span className="text-xs font-semibold text-white tracking-tight">Nexus AI</span>
          {resumeSessionId && <span className="text-[9px] text-[#475569] font-mono">{resumeSessionId.slice(0, 8)}</span>}

          {/* Agent Switcher */}
          <div className="relative">
            <button onClick={() => { setShowAgentDropdown(!showAgentDropdown); setShowModelDropdown(false); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] text-[11px] text-[#94a3b8] hover:border-[rgba(0,212,255,0.15)] transition-all">
              <Users size={12} />
              <span>Agent</span>
              <ChevronDown size={10} />
            </button>
            {showAgentDropdown && (
              <div className="absolute top-full left-0 mt-1 w-52 bg-[#0d0f20] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden z-50" onClick={() => setShowAgentDropdown(false)}>
                {AGENT_LIST.map(a => (
                  <button key={a.id} onClick={() => setShowAgentDropdown(false)}
                    className="w-full px-3 py-2 flex items-center gap-2.5 text-xs transition-colors text-[#8892a8] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#e8ecf2]">
                    <span>{a.icon}</span><span>{a.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Model Switcher */}
          <div className="relative">
            <button onClick={() => { setShowModelDropdown(!showModelDropdown); setShowAgentDropdown(false); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] text-[11px] text-[#94a3b8] font-mono hover:border-[rgba(0,212,255,0.15)] transition-all">
              <Cpu size={12} />
              <span>{settings.agent.split("/").pop()}</span>
              <ChevronDown size={10} />
            </button>
            {showModelDropdown && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-[#0d0f20] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden z-50">
                {Object.entries(groupedModels).map(([providerId, provider]) => (
                  <div key={providerId}>
                    <button onClick={() => setExpandedProvider(expandedProvider === providerId ? null : providerId)}
                      className="w-full px-3 py-2 flex items-center justify-between hover:bg-[rgba(255,255,255,0.04)] transition-colors border-b border-[rgba(255,255,255,0.04)]">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                        <span className="text-xs text-[#e8ecf2] font-medium">{provider.name}</span>
                        <span className="text-[9px] text-[#4a5068]">{provider.models.length}m</span>
                      </div>
                      <ChevronDown size={12} className={`text-[#4a5068] transition-transform ${expandedProvider === providerId ? "rotate-180" : ""}`} />
                    </button>
                    {expandedProvider === providerId && (
                      <div className="bg-[rgba(0,0,0,0.2)]">
                        {provider.models.map(model => (
                          <button key={model.id} onClick={() => { setSettings(s => ({ ...s, agent: model.id })); setShowModelDropdown(false); setExpandedProvider(null); }}
                            className={`w-full px-4 py-1.5 text-left text-[11px] flex items-center gap-2 transition-colors ${
                              settings.agent === model.id ? "bg-[rgba(0,212,255,0.08)] text-[#00d4ff]" : "text-[#8892a8] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#e8ecf2]"
                            }`}>
                            <span className="font-mono">{model.id.split("/").pop()}</span>
                            {settings.agent === model.id && <Check size={12} className="ml-auto text-[#00d4ff]" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {Object.keys(groupedModels).length === 0 && (
                  <div className="px-3 py-4 text-[11px] text-[#4a5068] text-center">Loading models…</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => { setMessages([{ id: "welcome", role: "assistant", content: "## New Session\n\nReady for a fresh start. How can I help?", timestamp: Date.now() }]); setResumeSessionId(""); onSessionKeyChange?.(""); }}
            className="px-3 py-1 rounded-lg text-[10px] text-[#8892a8] hover:text-[#e8ecf2] hover:bg-[rgba(255,255,255,0.04)] transition-all flex items-center gap-1">
            <Plus size={12} /> New
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 text-[#4a5068] hover:text-[#8892a8] transition-colors rounded-lg hover:bg-[rgba(255,255,255,0.04)]">
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex min-h-0">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {messages.length <= 1 ? (
              <>
                <WelcomeScreen onSelectPrompt={(text) => { setInput(text); }} />
                {sessions && sessions.length > 0 && (
                  <div className="mt-8 glass-card rounded-2xl p-5 max-w-lg mx-auto">
                    <h3 className="text-xs font-semibold text-[#8892a8] mb-3 flex items-center gap-2">
                      <History size={14} className="text-[#00d4ff]" /> Recent Conversations
                    </h3>
                    <div className="space-y-1">
                      {sessions.sort((a: any, b: any) => new Date(b.createdAt || b.created_at || 0).getTime() - new Date(a.createdAt || a.created_at || 0).getTime()).slice(0, 8).map((s: any) => (
                        <button key={s.id} onClick={() => { setResumeSessionId(s.id); onSessionKeyChange?.(s.id); loadSession(s.id); }}
                          className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-[rgba(0,212,255,0.06)] transition-colors flex items-center justify-between group">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1] shrink-0" />
                            <span className="text-[#e8ecf2] truncate font-medium">{s.modelRef || s.model || 'Chat'}</span>
                          </div>
                          <span className="text-[10px] text-[#4a5068] font-mono shrink-0 ml-2 group-hover:text-[#8892a8]">
                            {s.messageCount || s.messages?.length || 0} msg
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-6">
                {messages.filter(m => m.role !== "system").map((msg) => (
                  <div key={msg.id} className={`animate-fade-in-up ${msg.role === "user" ? "flex justify-end" : ""}`}>
                    {msg.role === "assistant" ? (
                      /* Assistant message — full featured */
                      <div className="glass-card rounded-2xl p-4 max-w-[85%]">
                        {/* Thinking (collapsible, shown in ThinkingPanel) */}
                        {msg.thinking && <ThinkingPanel content={msg.thinking} />}

                        {/* Tool calls — collapsible summary */}
                        {msg.toolCalls && msg.toolCalls.length > 0 && (
                          <CollapsibleTools tools={msg.toolCalls} />
                        )}

                        {/* Content */}
                        <div className="prose-nova text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderContent(msg.content)) }} />

                        {/* Actions */}
                        <div className="flex items-center gap-3 mt-3 pt-2 border-t border-[rgba(255,255,255,0.04)]">
                          <span className="text-[9px] text-[#475569]">
                            {msg.duration && `${(msg.duration / 1000).toFixed(1)}s`}
                            {msg.tokens && ` · ${msg.tokens.input + msg.tokens.output} tok`}
                          </span>
                          <div className="flex items-center gap-0.5 ml-auto">
                            <button onClick={() => navigator.clipboard.writeText(msg.content)} className="p-1.5 text-[#475569] hover:text-[#00d4ff] hover:bg-[rgba(0,212,255,0.08)] rounded-lg transition-all" title="Copy"><Copy size={13} /></button>
                            <button className="p-1.5 text-[#475569] hover:text-[#22c55e] hover:bg-[rgba(34,197,94,0.08)] rounded-lg transition-all" title="Good"><ThumbsUp size={13} /></button>
                            <button className="p-1.5 text-[#475569] hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.08)] rounded-lg transition-all" title="Bad"><ThumbsDown size={13} /></button>
                            <button onClick={() => { setInput(msg.content); }} className="p-1.5 text-[#475569] hover:text-[#f59e0b] hover:bg-[rgba(245,158,11,0.08)] rounded-lg transition-all" title="Edit"><Edit3 size={13} /></button>
                            <button onClick={() => forkConversation(msg.id)} className="p-1.5 text-[#475569] hover:text-[#8b5cf6] hover:bg-[rgba(139,92,246,0.08)] rounded-lg transition-all" title="Fork"><GitBranch size={13} /></button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* User message */
                      <div className="bg-gradient-to-r from-[#00d4ff] via-[#6366f1] to-[#8b5cf6] rounded-2xl px-4 py-3 max-w-[75%] ml-auto shadow-[0_4px_16px_rgba(0,212,255,0.12)]">
                        <p className="text-sm text-white whitespace-pre-wrap">{msg.content}</p>
                        {msg.files && msg.files.length > 0 && (
                          <div className="flex gap-1.5 mt-2 flex-wrap">
                            {msg.files.map((f, i) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-[rgba(255,255,255,0.15)] text-white">{f.name}</span>
                            ))}
                          </div>
                        )}
                        <span className="text-[9px] text-[rgba(255,255,255,0.5)] mt-1 block text-right">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    )}
                  </div>
                ))}

                {/* Streaming agent activity */}
                {(agentActivity.length > 0 || isThinking || streaming) && (
                  <div className="animate-fade-in-up">
                    {/* Thinking */}
                    <ThinkingPanel content={currentThinking} isStreaming={isThinking} />

                    {/* Tool calls — live collapsible summary */}
                    {agentActivity.length > 0 && (
                      <CollapsibleTools
                        tools={agentActivity.map(a => ({ tool: a.tool || "", args: a.args, success: a.success, duration: a.duration }))}
                        isLive
                      />
                    )}

                    {/* Streaming text */}
                    {streaming && streamContent && (
                      <div className="glass-card rounded-2xl p-4 max-w-[85%]">
                        <div className="prose-nova text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderContent(streamContent)) }} />
                        <span className="inline-block w-1.5 h-4 bg-[#6366f1] animate-pulse ml-0.5" />
                      </div>
                    )}

                    {/* Loading indicator */}
                    {loading && !streaming && !streamContent && (
                      <div className="flex items-center gap-2 text-xs text-[#475569]">
                        <span className="w-2 h-2 rounded-full bg-[#6366f1] animate-pulse" />
                        <span>Nexus is thinking...</span>
                        <button onClick={cancelStream} className="text-[10px] text-[#ef4444] hover:text-[#f87171] ml-2 px-2 py-0.5 rounded bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)]">Cancel</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Agent Activity Panel — right sidebar (always visible during activity) */}
        {(agentActivity.length > 0 || isThinking || streaming || loading) && !showSettings && (
          <AgentActivityPanel
            status={isThinking ? "thinking" : streaming ? "acting" : loading ? "acting" : "done"}
            toolCalls={agentActivity.map(a => ({ tool: a.tool || "", args: a.args, success: a.success, duration: a.duration, timestamp: a.timestamp }))}
            duration={startTimeRef.current ? Date.now() - startTimeRef.current : 0}
            tokens={messages.length > 0 ? messages[messages.length - 1].tokens : undefined}
          />
        )}

        {/* Settings Panel (compact dropdown) */}
        {showSettings && (
          <div className="w-72 border-l border-[rgba(255,255,255,0.06)] bg-[rgba(18,18,26,0.95)] p-4 overflow-y-auto shrink-0 animate-slide-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-white">Settings</h3>
              <button onClick={() => setShowSettings(false)} className="text-[#475569] hover:text-white"><X size={14} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-[#475569] uppercase tracking-wider mb-1 block">Model</label>
                {Object.entries(groupedModels).length > 0 ? (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {Object.entries(groupedModels).map(([providerId, provider]) => (
                      <div key={providerId}>
                        <p className="text-[9px] text-[#475569] px-2 py-1 font-medium">{provider.name}</p>
                        {provider.models.map(model => (
                          <button key={model.id} onClick={() => setSettings(s => ({ ...s, agent: model.id }))}
                            className={`w-full text-left px-2 py-1 rounded text-[10px] transition-colors ${
                              settings.agent === model.id ? "bg-[rgba(99,102,241,0.1)] text-[#818cf8]" : "text-[#94a3b8] hover:bg-[rgba(255,255,255,0.04)]"
                            }`}>
                            {model.id.split("/").pop()}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <select value={settings.agent} onChange={e => setSettings(s => ({ ...s, agent: e.target.value }))}
                    className="glass-input w-full px-3 py-2 text-xs">
                    {(models.length > 0 ? models : [{ id: "deepseek/deepseek-chat" }]).map(m => (
                      <option key={m.id} value={m.id}>{m.id}</option>
                    ))}
                  </select>
                )}
              </div>

              {agents.length > 0 && (
                <div>
                  <label className="text-[10px] text-[#475569] uppercase tracking-wider mb-1 block">Quick Agents</label>
                  <div className="flex flex-wrap gap-1">
                    {agents.slice(0, 8).map(a => (
                      <button key={a.id} onClick={() => { setInput(`/agent ${a.name || a.id} `); }}
                        className="text-[10px] px-2 py-1 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[#94a3b8] hover:text-white hover:border-[rgba(99,102,241,0.2)] transition-all">
                        {a.name || a.id}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] text-[#475569] uppercase tracking-wider mb-1 block">Active Skills</label>
                <div className="flex flex-wrap gap-1">
                  {skills.filter((s: any) => s.enabled !== false).slice(0, 8).map((s: any) => (
                    <span key={s.id || s.name} className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(99,102,241,0.06)] text-[#818cf8] border border-[rgba(99,102,241,0.15)]">
                      {s.name || s.id}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Context Window Bar — dynamic per model */}
      {(() => {
        const MODEL_CONTEXT: Record<string, number> = {
          'deepseek/deepseek-chat': 64000, 'deepseek/deepseek-coder': 128000,
          'openai/gpt-5': 128000, 'openai/gpt-4o': 128000, 'openai/gpt-4': 8192,
          'anthropic/claude-opus-4': 200000, 'anthropic/claude-sonnet-4': 200000,
          'google/gemini-2.5-pro': 1000000, 'google/gemini-2.0-flash': 1000000,
          'mimo-v2.5': 1000000, 'custom/mimo-v2.5': 1000000,
          'qwen/qwen-max': 32768, 'zhipu/glm-4': 128000, 'kimi/kimi-latest': 128000,
        };
        const modelId = settings.agent;
        const contextLimit = MODEL_CONTEXT[modelId] || MODEL_CONTEXT[modelId.toLowerCase()] || 128000;
        const totalChars = messages.reduce((acc, m) => acc + (m.content?.length || 0), 0);
        const estimatedTokens = Math.round(totalChars / 3.5); // rough: ~3.5 chars per token
        const pct = Math.min(100, Math.round((estimatedTokens / contextLimit) * 100));
        const usedLabel = contextLimit >= 1000000 ? `${(estimatedTokens / 1000000).toFixed(1)}M` : `${(estimatedTokens / 1000).toFixed(0)}K`;
        const maxLabel = contextLimit >= 1000000 ? `${(contextLimit / 1000000).toFixed(0)}M` : `${(contextLimit / 1000).toFixed(0)}K`;
        const barColor = pct > 90 ? 'bg-[#ef4444]' : pct > 70 ? 'bg-[#f59e0b]' : 'bg-gradient-to-r from-[#00d4ff] to-[#6366f1]';

        return (
          <div className="shrink-0 px-6 py-1.5 border-t border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.01)]">
            <div className="max-w-4xl mx-auto flex items-center gap-3">
              <div className="flex-1 h-1 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[9px] text-[#4a5068] font-mono shrink-0">
                ~{usedLabel} / {maxLabel} tokens
              </span>
              <span className="text-[8px] text-[#4a5068] shrink-0">{modelId.split('/').pop()}</span>
            </div>
          </div>
        );
      })()}

      {/* Input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={send}
        onCancel={cancelStream}
        loading={loading}
        streaming={streaming}
        files={files}
        onFilesAdd={(newFiles) => setFiles(prev => [...prev, ...newFiles])}
        onFileRemove={(idx) => setFiles(prev => prev.filter((_, i) => i !== idx))}
        slashCommands={SLASH_COMMANDS}
        onSlashSelect={(cmd) => { setInput(cmd); }}
        model={settings.agent}
      />
    </div>
  );
}

// ─── Collapsible Tool Summary (Claude/ZCode-style) ────────
function CollapsibleTools({ tools, isLive }: { tools: Array<{ tool: string; args?: any; success?: boolean; duration?: number }>; isLive?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const readCount = tools.filter(t => t.tool.includes("read") || t.tool.includes("Read") || t.tool.includes("list")).length;
  const editCount = tools.filter(t => t.tool.includes("edit") || t.tool.includes("write") || t.tool.includes("Edit") || t.tool.includes("Write")).length;
  const runCount = tools.filter(t => t.tool.includes("run") || t.tool.includes("exec") || t.tool.includes("Run") || t.tool.includes("Exec")).length;
  const otherCount = tools.length - readCount - editCount - runCount;
  const totalDuration = tools.reduce((acc, t) => acc + (t.duration || 0), 0);
  const successCount = tools.filter(t => t.success !== false).length;

  const parts: string[] = [];
  if (readCount > 0) parts.push(`${readCount} reads`);
  if (editCount > 0) parts.push(`${editCount} edits`);
  if (runCount > 0) parts.push(`${runCount} runs`);
  if (otherCount > 0) parts.push(`${otherCount} other`);

  return (
    <div className="mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-[10px] text-[#4a5068] hover:text-[#8892a8] transition-colors w-full group"
      >
        <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
        <span className="font-mono">
          🔧 {tools.length} tool{tools.length !== 1 ? 's' : ''} used
          {parts.length > 0 && ` · ${parts.join(', ')}`}
          {totalDuration > 0 && ` · ${(totalDuration / 1000).toFixed(1)}s`}
        </span>
        {successCount < tools.length && (
          <span className="text-[#ef4444]">{tools.length - successCount} failed</span>
        )}
      </button>
      {expanded && (
        <div className="mt-2 ml-4 space-y-1 border-l border-[rgba(255,255,255,0.06)] pl-3">
          {tools.map((tc, i) => (
            <ToolCallCard key={i} tool={tc.tool} args={tc.args} success={tc.success} duration={tc.duration} status={isLive ? "running" : "done"} />
          ))}
        </div>
      )}
    </div>
  );
}
