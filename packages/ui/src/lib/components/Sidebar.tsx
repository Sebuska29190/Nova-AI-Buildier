import {
  MessageSquare, Users, Zap, PlusCircle, History, Radio, Brain,
  FolderGit2, Video, FileCode, Cpu, Coins, ShoppingBag, Terminal,
  Settings, KeyRound, ScrollText, UserCog, ToyBrick, Calendar,
  BarChart3, BookOpen, Search, Sliders, Orbit, Sparkles, Globe2, Plug
} from "lucide-react";

interface SidebarProps {
  route: string;
  onRoute: (r: string) => void;
  version: string;
  sessions?: any[];
}

interface NavItem {
  id: string;
  icon: React.ElementType;
  label: string;
  badge?: string;
  dot?: string;
}

const navGroups: { label: string; items: NavItem[] }[] = [
  { label: "Main", items: [
    { id: "chat", icon: MessageSquare, label: "Chat Assistant" },
    { id: "agents", icon: Users, label: "Agents", badge: "16" },
    { id: "skills", icon: Zap, label: "Skills", badge: "46" },
    { id: "plugins", icon: PlusCircle, label: "Add Tools / Plugins" },
    { id: "integrations", icon: Plug, label: "Integrations", badge: "30+" },
  ]},
  { label: "Data", items: [
    { id: "sessions", icon: History, label: "Sessions" },
    { id: "channels", icon: Radio, label: "Channels", dot: "emerald" },
    { id: "memory", icon: Brain, label: "Memory DB" },
  ]},
  { label: "Tools", items: [
    { id: "workspace", icon: FolderGit2, label: "Workspace" },
    { id: "video", icon: Video, label: "Video Gen" },
    { id: "editor", icon: FileCode, label: "Video Editor" },
    { id: "social", icon: Globe2, label: "Social Media" },
    { id: "worker", icon: Cpu, label: "Worker Nodes" },
    { id: "crypto-hub", icon: Coins, label: "Crypto & Trading" },
    { id: "shopping", icon: ShoppingBag, label: "Smart Shopping" },
    { id: "terminal", icon: Terminal, label: "Terminal" },
  ]},
  { label: "Configuration", items: [
    { id: "settings", icon: Settings, label: "Settings" },
    { id: "apikeys", icon: KeyRound, label: "API Keys" },
    { id: "logs", icon: ScrollText, label: "System Logs" },
    { id: "profiles", icon: UserCog, label: "User Profiles" },
    { id: "aimodels", icon: ToyBrick, label: "AI Models" },
    { id: "schedule", icon: Calendar, label: "Cron Schedule" },
    { id: "analytics", icon: BarChart3, label: "Analytics" },
    { id: "docs", icon: BookOpen, label: "Documentation" },
  ]},
];

export function Sidebar({ route, onRoute, version, sessions = [] }: SidebarProps) {
  function resumeSession(id: string) {
    window.dispatchEvent(new CustomEvent("nova-resume-session", { detail: { sessionId: id } }));
  }

  // Get 5 most recent sessions
  const recentSessions = [...sessions]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 5);

  return (
    <aside className="w-64 bg-[#0e1117]/90 border-r border-gray-800 flex flex-col justify-between z-20 backdrop-blur-md">
      <div className="overflow-y-auto flex-1">
        {/* Branding */}
        <div className="p-5 border-b border-gray-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400">
            <Orbit size={18} />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-wide text-white font-mono">NOVA AI</h1>
            <span className="text-[9px] text-teal-500 tracking-widest uppercase font-mono font-semibold">BUILDER SUITE</span>
          </div>
        </div>

        {/* Quick nav input: resume by session ID */}
        <div className="px-4 py-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
            <input type="text" placeholder="Search or paste Session ID..."
              className="w-full bg-[#161b22]/60 border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-[11px] focus:outline-none focus:border-teal-500/50 transition-all text-gray-300 placeholder-gray-600"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (val) resumeSession(val);
                }
              }} />
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 space-y-4 pb-6">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest px-3 mb-1">{group.label}</div>
              <div className="space-y-0.5">
                {group.items.map((item: NavItem) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onRoute(item.id)}
                      className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        route === item.id
                          ? "bg-teal-500/10 border-l-2 border-teal-500 text-white"
                          : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {item.dot ? (
                          <span className="w-4 h-4 relative">
                            <Icon size={16} />
                            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 active-dot" />
                          </span>
                        ) : (
                          <Icon size={16} className={route === item.id ? "text-teal-400" : ""} />
                        )}
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[10px] bg-teal-500/10 text-teal-400 px-1.5 py-0.5 rounded font-mono font-bold">{item.badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Recent Sessions — real data */}
          {recentSessions.length > 0 && (
            <div>
              <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest px-3 mb-1">Recent Sessions</div>
              <div className="space-y-0.5">
                {recentSessions.map((s) => (
                  <button key={s.id} type="button"
                    onClick={() => resumeSession(s.id)}
                    className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-[11px] font-mono text-gray-500 hover:text-white hover:bg-gray-800/50 transition-all truncate text-left">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500/40 shrink-0" />
                    <span className="truncate">{s.model || s.id?.slice(0, 12)}</span>
                    <span className="text-[9px] text-gray-600 ml-auto shrink-0">{(s.messages?.length || 0)}msgs</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>
      </div>

      {/* Bottom: Profile */}
      <div className="p-3 border-t border-gray-800 bg-[#0a0c10]/90">
        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800/50 transition-all cursor-pointer">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center font-bold text-xs text-white">OP</div>
            <div>
              <div className="text-[11px] font-semibold text-white">System Operator</div>
              <div className="text-[9px] text-gray-500">core@nova-ai-builder</div>
            </div>
          </div>
          <Sliders size={14} className="text-gray-500 hover:text-teal-400 transition-colors" />
        </div>
      </div>
    </aside>
  );
}
