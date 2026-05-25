import { useState, useRef, useEffect, useCallback } from "react";
import { marked } from "marked";
import hljs from "highlight.js";
import { api } from "../lib/api";
import { Send, Bot, Sparkles, Paperclip, Settings, X, Save, Sliders, User, Puzzle, Cpu, Command, Terminal, Globe, Brain, Search, Users, BookOpen, Trash2, HelpCircle, List, Mic, Volume2 } from "lucide-react";

marked.setOptions({
  highlight: (code: string, lang: string) => {
    if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value;
    return hljs.highlightAuto(code).value;
  },
  breaks: true,
  gfm: true,
} as any);

interface Message {
  id: number;
  role: string;
  content: string;
  timestamp: string;
  files?: { name: string; size: number; type: string }[];
}

interface ChatPageProps {
  model?: string;
  models?: Array<{ id: string }>;
  skills?: any[];
  resumeSessionId?: string;
  onResolved?: () => void;
  onSessionChange?: () => void;
  sessionKey?: string;
  onSessionKeyChange?: (key: string) => void;
  agents?: any[];
}

// ─── Slash Commands ─────────────────────────────────────────────
const SLASH_COMMANDS = [
  { cmd: "/help", desc: "Pokaż listę dostępnych komend", icon: HelpCircle },
  { cmd: "/clear", desc: "Wyczyść historię czatu", icon: Trash2 },
  { cmd: "/agents", desc: "Lista dostępnych agentów", icon: Users },
  { cmd: "/agent <nazwa> <zadanie>", desc: "Wyślij zadanie do konkretnego agenta", icon: Bot },
  { cmd: "/handoff <model>", desc: "Przełącz model bez utraty kontekstu", icon: Bot },
  { cmd: "/tools", desc: "Lista dostępnych narzędzi", icon: Terminal },
  { cmd: "/models", desc: "Lista dostępnych modeli", icon: Cpu },
  { cmd: "/skills", desc: "Lista dostępnych skilli", icon: Puzzle },
  { cmd: "/memory <query>", desc: "Szukaj w bazie pamięci", icon: Brain },
  { cmd: "/search <query>", desc: "Szukaj w sieci", icon: Globe },
  { cmd: "/docs", desc: "Linki do dokumentacji", icon: BookOpen },
];

const AT_COMMANDS = [
  "@workspace_get_state", "@workspace_list_files", "@workspace_read_file", "@workspace_write_file",
  "@browser_launch", "@browser_navigate",
  "@coingecko_price", "@fetch_crypto_news",
  "@search_products", "@whatsapp_send", "@email_send",
];

export function ChatPage({
  model: initialModel = "deepseek/deepseek-chat",
  models = [],
  skills = [],
  agents = [],
  resumeSessionId: initialSessionId = "",
  onResolved = () => {},
  onSessionChange = () => {},
  sessionKey: externalSessionKey = "",
  onSessionKeyChange = () => {},
}: ChatPageProps) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: "assistant", content: "Witaj w Nova AI Builder. Użyj **/** aby zobaczyć dostępne komendy.", timestamp: new Date().toISOString() }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [resumeSessionId, setResumeSessionId] = useState(initialSessionId);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    agent: initialModel,
    autoApprove: true,
    autoAllowance: false,
  });
  const [files, setFiles] = useState<File[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionFilter, setSuggestionFilter] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [workspacePath, setWorkspacePath] = useState("");
  const [voiceActive, setVoiceActive] = useState(false);
  const voiceRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent]);

  // Load existing messages when resuming a session
  useEffect(() => {
    const sid = resumeSessionId || externalSessionKey;
    if (sid && sid.length > 0) {
      fetch(`/api/sessions/${sid}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.messages?.length > 0) {
            const loaded: Message[] = data.messages.map((m: any, i: number) => ({
              id: i + 1,
              role: m.role || "user",
              content: m.content || "",
              timestamp: m.timestamp || new Date().toISOString(),
            }));
            setMessages(loaded);
            setResumeSessionId(sid);
          }
        })
        .catch(() => {});
    }
  }, []);

  // ─── Slash Command Handler ──────────────────────────────────
  async function handleSlashCommand(text: string): Promise<string | null> {
    const parts = text.slice(1).trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    const args = parts.slice(1).join(" ");

    switch (cmd) {
      case "help": {
        const lines = ["**Dostępne komendy:**\n"];
        for (const c of SLASH_COMMANDS) {
          lines.push(`- **\`${c.cmd}\`** — ${c.desc}`);
        }
        lines.push("\n**Komendy @:**");
        for (const ac of AT_COMMANDS) {
          lines.push(`- \`${ac}\``);
        }
        return lines.join("\n");
      }

      case "clear":
        setMessages([{ id: Date.now(), role: "assistant", content: "Historia czatu wyczyszczona. Użyj **/** aby zobaczyć komendy.", timestamp: new Date().toISOString() }]);
        return null; // already handled

      case "agents": {
        if (!agents?.length) return "Brak skonfigurowanych agentów.";
        const lines = ["**Dostępni agenci:**\n"];
        for (const a of agents) {
          lines.push(`- **${a.emoji || "🤖"} ${a.name}** — ${a.description || "Brak opisu"} \`${a.id}\``);
        }
        return lines.join("\n");
      }

      case "agent": {
        const agentName = parts[1];
        const task = parts.slice(2).join(" ");
        if (!agentName) return "Użycie: `/agent <nazwa> <zadanie>`\nLista agentów: `/agents`";
        if (!task) return "Podaj zadanie dla agenta.\nUżycie: `/agent <nazwa> <zadanie>`";

        const agent = agents?.find((a: any) =>
          a.name?.toLowerCase() === agentName.toLowerCase() || a.id?.toLowerCase() === agentName.toLowerCase()
        );
        if (!agent) {
          const names = agents?.map((a: any) => `- ${a.name}`).join("\n") || "Brak agentów";
          return `Nie znaleziono agenta "${agentName}".\nDostępni:\n${names}`;
        }

        try {
          const res = await fetch("/api/agent/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentId: agent.id, message: task }),
          });
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json();
          return `**${agent.emoji || "🤖"} ${agent.name}** odpowiada:\n\n${data.text || data.result?.text || JSON.stringify(data)}`;
        } catch (e: any) {
          return `Błąd agenta: ${e.message}`;
        }
      }

      case "tools": {
        try {
          const res = await fetch("/api/tools");
          const data = await res.json();
          const tools = data.tools || [];
          if (!tools.length) return "Brak dostępnych narzędzi.";
          const lines = [`**Dostępne narzędzia (${tools.length}):**\n`];
          for (const t of tools.slice(0, 30)) {
            lines.push(`- **${t.name}** — ${(t.description || "").slice(0, 100)}`);
          }
          if (tools.length > 30) lines.push(`\n... i ${tools.length - 30} więcej`);
          return lines.join("\n");
        } catch { return "Nie udało się pobrać listy narzędzi."; }
      }

      case "models": {
        if (!models?.length) return "Brak dostępnych modeli.";
        const lines = ["**Dostępne modele:**\n"];
        for (const m of models) {
          lines.push(`- \`${m.id}\``);
        }
        return lines.join("\n");
      }

      case "skills": {
        if (!skills?.length) return "Brak dostępnych skilli.";
        const lines = [`**Dostępne skille (${skills.length}):**\n`];
        for (const s of skills.slice(0, 30)) {
          lines.push(`- **${s.name || s.id}** — ${(s.description || "").slice(0, 80)}`);
        }
        return lines.join("\n");
      }

      case "memory": {
        if (!args) return "Użycie: `/memory <query>` — szukaj w bazie pamięci";
        try {
          const res = await fetch(`/api/memory/search?q=${encodeURIComponent(args)}`);
          const data = await res.json();
          const results = data.results || [];
          if (!results.length) return "Brak wyników wyszukiwania w pamięci.";
          const lines = [`**Wyniki wyszukiwania w pamięci:**\n`];
          for (const r of results.slice(0, 10)) {
            lines.push(`- **${r.name || r.title || "entry"}** — ${(r.content || "").slice(0, 200)}`);
          }
          return lines.join("\n");
        } catch { return "Nie udało się przeszukać pamięci."; }
      }

      case "search": {
        if (!args) return "Użycie: `/search <query>` — szukaj w sieci";
        try {
          const res = await fetch("/api/research", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: args }),
          });
          if (!res.ok) throw new Error();
          const data = await res.json();
          const results = data.results || [];
          if (!results.length) return "Brak wyników wyszukiwania.";
          const lines = [`**Wyniki wyszukiwania dla "${args}":**\n`];
          for (const r of results.slice(0, 8)) {
            lines.push(`- [${r.title || "Link"}](${r.url || "#"}) — ${(r.snippet || r.description || "").slice(0, 150)}`);
          }
          return lines.join("\n");
        } catch { return "Nie udało się wykonać wyszukiwania."; }
      }

      case "docs":
        return [
          "**Dokumentacja Nova AI:**\n",
          "- [Nova API](/) — dokumentacja API",
          "- [Provider Docs](/) — konfiguracja providerów",
          "- [GitHub](https://github.com/) — źródła projektu",
          "\nUżyj `/help` po więcej komend.",
        ].join("\n");

      case "handoff": {
        const targetModel = args.trim();
        if (!targetModel) return "Użycie: `/handoff <model>`\\nPrzykład: `/handoff gpt-4o`\\nLista modeli: `/models`";
        const modelExists = models.some((m: any) => m.id === targetModel);
        if (!modelExists) return `Nie znaleziono modelu "${targetModel}".\\nLista: \`/models\``;
        setSettings((prev) => ({ ...prev, agent: targetModel }));
        return `🔄 **Handoff** — przełączono na \`${targetModel}\`\\nKontekst zachowany, możesz kontynuować rozmowę.`;
      }

      default:
        return `Nieznana komenda: **/${cmd}**\nUżyj \`/help\` aby zobaczyć listę dostępnych komend.`;
    }
  }

  // ─── Drag & Drop ─────────────────────────────────────────────
  const [dragOver, setDragOver] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles]);
    }
  }

  // ─── Send ────────────────────────────────────────────────────
  async function send() {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    setShowSuggestions(false);

    // Check for slash commands
    if (text.startsWith("/")) {
      const result = await handleSlashCommand(text);
      if (result === null) return; // command handled internally (e.g. /clear)
      const newMsg: Message = { id: Date.now(), role: "user", content: text, timestamp: new Date().toISOString() };
      setMessages((prev) => [...prev, newMsg]);
      const reply: Message = { id: Date.now() + 1, role: "assistant", content: result, timestamp: new Date().toISOString() };
      setMessages((prev) => [...prev, reply]);
      return;
    }

    // Regular chat send
    const newMsg: Message = { id: Date.now(), role: "user", content: text || (files.length > 0 ? `[${files.length} file(s) attached]` : ""), timestamp: new Date().toISOString() };
    if (files.length > 0) {
      newMsg.files = files.map(f => ({ name: f.name, size: f.size, type: f.type }));
    }
    setMessages((prev) => [...prev, newMsg]);
    setLoading(true);
    setStreaming(true);
    setStreamContent("");

    try {
      // Create abort controller for this request
      const ac = new AbortController();
      abortRef.current = ac;

      // Upload files first if any
      let fileContext = "";
      if (files.length > 0) {
        const fileData = await Promise.all(files.map(async (f) => {
          const buf = await f.arrayBuffer();
          return { name: f.name, type: f.type, content: btoa(String.fromCharCode(...new Uint8Array(buf))) };
        }));
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: fileData }),
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          const fileList = uploadData.files.map((f: any) => `- ${f.name} (${(f.size / 1024).toFixed(1)} KB)`).join("\n");
          fileContext = `\n\n[Attached files:]\n${fileList}\n`;
        }
        setFiles([]);
      }

      const fullMessage = text + fileContext;
      const sessionId = resumeSessionId || crypto.randomUUID();
      const result = await api.chatSend(fullMessage, settings.agent, sessionId, (chunk) => {
        setStreamContent(chunk);
      }, ac.signal);
      setMessages((prev) => [...prev, { id: Date.now(), role: "assistant", content: result.text, timestamp: new Date().toISOString() }]);
      if (result.sessionKey) {
        setResumeSessionId(result.sessionKey);
        onSessionKeyChange(result.sessionKey);
      }
    } catch (e: unknown) {
      setMessages((prev) => [...prev, { id: Date.now(), role: "assistant", content: `Error: ${(e as Error).message}`, timestamp: new Date().toISOString() }]);
    } finally {
      abortRef.current = null;
      setLoading(false);
      setStreaming(false);
      setStreamContent("");
    }
  }

  function cancelStream() {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setMessages((prev) => [...prev, { id: Date.now(), role: "assistant", content: "⛔ **Cancelled by user**", timestamp: new Date().toISOString() }]);
      setLoading(false);
      setStreaming(false);
      setStreamContent("");
    }
  }

  // ─── Input handlers ─────────────────────────────────────────
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setInput(val);

    // Show suggestions when typing /
    if (val.startsWith("/")) {
      const filter = val.slice(1).toLowerCase();
      setSuggestionFilter(filter);
      setShowSuggestions(true);
      setSelectedSuggestion(0);
    } else {
      setShowSuggestions(false);
    }
  }

  function handleKeydown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (showSuggestions) {
      const filtered = SLASH_COMMANDS.filter(c => c.cmd.toLowerCase().includes(`/${suggestionFilter}`));
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestion((prev) => Math.min(prev + 1, filtered.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestion((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        if (filtered[selectedSuggestion]) {
          e.preventDefault();
          setInput(filtered[selectedSuggestion].cmd.split(" ")[0] + " ");
          setShowSuggestions(false);
          return;
        }
      }
      if (e.key === "Escape") {
        setShowSuggestions(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    if (e.key === "Escape") setShowSettings(false);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
      e.target.value = "";
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function getFileIcon(name: string) {
    const ext = name.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext || "")) return "🖼";
    if (["pdf"].includes(ext || "")) return "📄";
    if (["mp3", "wav", "ogg"].includes(ext || "")) return "🎵";
    if (["mp4", "webm", "mov"].includes(ext || "")) return "🎬";
    if (["txt", "md"].includes(ext || "")) return "📝";
    return "📎";
  }

  const filteredCommands = SLASH_COMMANDS.filter(c => c.cmd.toLowerCase().includes(`/${suggestionFilter}`));

  return (
    <div className="flex h-full bg-[#0a0c10] text-gray-200 overflow-hidden font-sans"
      ref={dropRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}>
      {/* Drag overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-[100] bg-[#00f2fe]/5 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-[#0b0f19] border-2 border-dashed border-[#00f2fe]/50 rounded-2xl px-8 py-6 text-center shadow-2xl">
            <p className="text-[#00f2fe] text-lg font-bold mb-1">Drop files here</p>
            <p className="text-slate-400 text-xs">Images, documents, audio, video</p>
          </div>
        </div>
      )}
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b border-gray-800 p-4 flex items-center justify-between bg-[#0e1117]/80 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400">
              <Bot size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-white">{settings.agent}</h2>
              <p className="text-[10px] text-teal-500">Aktywny proces</p>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-teal-400"
          >
            <Settings size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            /* Welcome screen */
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-6 shadow-lg shadow-teal-500/5">
                <Sparkles size={32} className="text-teal-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white mb-2">How can we empower your build today?</h2>
              <p className="text-sm text-gray-500 max-w-md mb-8">Type **/** for commands, or use @commands below.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-lg w-full mb-8">
                {AT_COMMANDS.slice(0, 9).map((cmd) => (
                  <button key={cmd} onClick={() => { setInput(cmd + " "); inputRef.current?.focus(); }}
                    className="custom-badge bg-[#161b22] border border-gray-800 hover:border-teal-500/30 hover:bg-[#1c2333] text-gray-400 hover:text-white transition-all text-left truncate">
                    <span className="text-teal-500 mr-1 opacity-70">~</span>{cmd}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <span className="text-[10px] bg-teal-500/5 border border-teal-500/20 text-teal-400 px-2 py-1 rounded-full">
                  <Command size={10} className="inline mr-1" />/help — lista komend
                </span>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-4 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {msg.role !== "user" && (
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                      <Sparkles size={16} className="text-teal-400" />
                    </div>
                  )}
                  <div className={`max-w-[75%] p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-teal-600 text-white"
                      : "bg-gray-900 border border-gray-800"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose-nova text-sm text-gray-200 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) as string }} />
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                    {msg.files && msg.files.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-white/20">
                        {msg.files.map((f, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 flex items-center gap-1">
                            📎 {f.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {msg.timestamp && msg.role === "assistant" && (
                      <div className="text-[10px] text-gray-600 mt-2 font-mono">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming message */}
              {streaming && streamContent && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                    <Sparkles size={16} className="text-teal-400" />
                  </div>
                  <div className="max-w-[75%] p-4 rounded-2xl bg-gray-900 border border-gray-800">
                    <div className="text-sm text-gray-300 whitespace-pre-wrap">{streamContent}</div>
                    <span className="inline-block w-1.5 h-4 bg-teal-400 animate-pulse ml-0.5" />
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {loading && !streamContent && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                    <Sparkles size={16} className="text-teal-400" />
                  </div>
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                      Nova is thinking...
                    </div>
                    <button onClick={cancelStream} className="text-[10px] px-2 py-1 rounded bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/30 transition-all">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div ref={scrollRef} />
            </div>
          )}
        </div>

        {/* File preview bar */}
        {files.length > 0 && (
          <div className="px-4 py-2 bg-[#0e1117] border-t border-gray-800 flex flex-wrap gap-2">
            {files.map((file, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-[#161b22] border border-gray-800 rounded-lg px-2.5 py-1 text-xs text-gray-400">
                <span>{getFileIcon(file.name)}</span>
                <span className="max-w-[120px] truncate">{file.name}</span>
                <button onClick={() => removeFile(i)} className="text-gray-600 hover:text-red-400 ml-1">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div className="p-4 bg-[#0a0c10]">
          <div className="max-w-4xl mx-auto relative">
            {/* Slash command autocomplete */}
            {showSuggestions && filteredCommands.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#161b22] border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50">
                <div className="px-3 py-2 text-[10px] text-gray-500 border-b border-gray-800 font-medium uppercase tracking-wider">
                  Komendy ({filteredCommands.length})
                </div>
                {filteredCommands.map((c, i) => {
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.cmd}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left text-xs transition-all ${
                        i === selectedSuggestion
                          ? "bg-teal-500/10 text-white border-l-2 border-teal-500"
                          : "text-gray-400 hover:bg-gray-800/50 hover:text-white"
                      }`}
                      onMouseDown={(e) => { e.preventDefault(); setInput(c.cmd.split(" ")[0] + " "); setShowSuggestions(false); }}
                    >
                      <Icon size={14} className={i === selectedSuggestion ? "text-teal-400" : "text-gray-500"} />
                      <div>
                        <span className="font-mono text-teal-400">{c.cmd.split(" ")[0]}</span>
                        {c.cmd.includes(" ") && (
                          <span className="text-gray-500 ml-1">{c.cmd.slice(c.cmd.indexOf(" "))}</span>
                        )}
                        <div className="text-[10px] text-gray-500">{c.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="bg-[#161b22] border border-gray-800 rounded-2xl shadow-xl flex items-center p-2">
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple className="hidden" />
              {/* Voice button */}
              <button onClick={() => {
                if (!voiceRef.current) {
                  import("../lib/voice-mode.ts").then(({ VoiceMode, isVoiceSupported }) => {
                    if (!isVoiceSupported()) { setInput("Voice not supported. Try Chrome."); return; }
                    voiceRef.current = new VoiceMode({ language: "pl-PL" }, {
                      onTranscript: (text) => { setInput(text); send(); },
                      onStateChange: (state) => setVoiceActive(state === "listening"),
                      onResponse: () => {},
                      onError: (err) => setInput(`Voice error: ${err}`),
                    });
                    voiceRef.current.start();
                    setVoiceActive(true);
                  });
                } else {
                  voiceRef.current.toggle();
                  setVoiceActive(voiceRef.current.getState() === "listening");
                }
              }} className={`p-2 transition-colors ${voiceActive ? "text-red-400 animate-pulse" : "text-gray-400 hover:text-teal-400"}`}>
                <Mic size={20} />
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-teal-400 transition-colors">
                <Paperclip size={20} />
              </button>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeydown}
                placeholder={files.length > 0 ? "Dodaj komentarz do plików..." : 'Wpisz komendę... (/)'}
                className="flex-1 bg-transparent border-none outline-none px-3 text-sm text-white placeholder-gray-600"
                disabled={loading}
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="bg-teal-600 p-2.5 rounded-xl text-white hover:bg-teal-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="w-80 border-l border-gray-800 bg-[#0e1117] p-6 shadow-2xl overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-semibold flex items-center gap-2 text-white">
              <Sliders size={18} className="text-teal-400" /> Ustawienia
            </h3>
            <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-xs text-gray-500 mb-2">Agent & Model</label>
              <select
                className="w-full bg-[#161b22] border border-gray-800 rounded-lg p-2 text-sm text-gray-300 outline-none focus:border-teal-500"
                value={settings.agent}
                onChange={(e) => setSettings({ ...settings, agent: e.target.value })}
              >
                {models.length > 0 ? models.map((m) => (
                  <option key={m.id} value={m.id}>{m.id}</option>
                )) : (
                  <>
                    <option>deepseek/deepseek-chat</option>
                    <option>gpt-4o</option>
                    <option>claude-3.5-sonnet</option>
                  </>
                )}
              </select>
            </div>

            {/* Available agents quick-select */}
            {agents && agents.length > 0 && (
              <div>
                <label className="block text-xs text-gray-500 mb-2">Wywołaj agenta</label>
                <div className="flex flex-wrap gap-1.5">
                  {agents.slice(0, 8).map((a: any) => (
                    <button
                      key={a.id}
                      className="bg-[#161b22] border border-gray-800 hover:border-teal-500/30 rounded-lg px-2.5 py-1.5 text-xs text-gray-400 hover:text-white transition-all"
                      onClick={() => { setInput(`/agent ${a.name} `); inputRef.current?.focus(); }}
                    >
                      {a.emoji || "🤖"} {a.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Auto Approve</span>
                <input type="checkbox" checked={settings.autoApprove}
                  onChange={() => setSettings({ ...settings, autoApprove: !settings.autoApprove })}
                  className="accent-teal-500 w-4 h-4" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Auto Allowance</span>
                <input type="checkbox" checked={settings.autoAllowance}
                  onChange={() => setSettings({ ...settings, autoAllowance: !settings.autoAllowance })}
                  className="accent-teal-500 w-4 h-4" />
              </div>
            </div>

            <div className="border-t border-gray-800 pt-4">
              <h4 className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Aktywne skille</h4>
              <div className="flex flex-wrap gap-1.5">
                {skills.filter((s: any) => s.enabled !== false).slice(0, 8).map((skill: any) => (
                  <span key={skill.name || skill.id} className="custom-badge bg-teal-500/5 border border-teal-500/20 text-teal-400 text-[10px]">
                    <Puzzle size={10} className="mr-1 inline" />
                    {skill.name || skill.id}
                  </span>
                ))}
              </div>
            </div>

            {/* Workspace selector */}
            <div className="border-t border-gray-800 pt-4">
              <h4 className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Workspace</h4>
              <div className="flex gap-2">
                <input value={workspacePath} onChange={(e) => setWorkspacePath(e.target.value)}
                  placeholder="e.g. C:\Projects\my-app"
                  className="flex-1 bg-[#161b22] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-teal-500 font-mono" />
                <button onClick={async () => {
                  try {
                    const res = await fetch("/api/workspace/browse", { method: "POST" });
                    if (res.ok) { const data = await res.json(); if (data?.path) { setWorkspacePath(data.path); } }
                  } catch { /* ignore */ }
                }}
                  className="bg-[#161b22] hover:bg-gray-800 text-gray-400 border border-gray-800 px-2.5 py-1.5 rounded-lg text-xs">
                  Browse...
                </button>
              </div>
              {workspacePath && <p className="text-[10px] text-teal-500 mt-1.5 flex items-center gap-1">✓ Workspace: {workspacePath}</p>}
              {workspacePath && (
                <button onClick={async () => {
                  try {
                    await fetch("/api/workspace/set", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ path: workspacePath }),
                    });
                  } catch { /* ignore */ }
                }} className="text-[10px] text-teal-400 hover:text-teal-300 mt-1">
                  Set as active workspace
                </button>
              )}
            </div>

            <button className="w-full bg-gray-800 hover:bg-gray-700 p-2.5 rounded-lg text-xs font-medium flex items-center justify-center gap-2 text-gray-300 transition-colors">
              <List size={14} /> /help — lista komend
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
