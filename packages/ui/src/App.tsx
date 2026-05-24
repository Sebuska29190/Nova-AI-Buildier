import { useState, useEffect } from "react";
import { api } from "./lib/api";
import { Sidebar } from "./lib/components/Sidebar";
import { StatusBar } from "./lib/components/StatusBar";
import { ToastProvider, useToast } from "./lib/components/ui/Toast";
import { ErrorBoundary } from "./lib/ErrorBoundary";

// Pages
import { ChatPage } from "./routes/ChatPage";
import { AgentsPage } from "./routes/AgentsPage";
import { SkillsPage } from "./routes/SkillsPage";
import { PluginsPage } from "./routes/PluginsPage";
import { SessionsPage } from "./routes/SessionsPage";
import { ChannelsPage } from "./routes/ChannelsPage";
import { MemoryPage } from "./routes/MemoryPage";
import { ConfigPage } from "./routes/ConfigPage";
import { EnvPage } from "./routes/EnvPage";
import { LogsPage } from "./routes/LogsPage";
import { AnalyticsPage } from "./routes/AnalyticsPage";
import { ModelsPage } from "./routes/ModelsPage";
import { CronPage } from "./routes/CronPage";
import { ProfilesPage } from "./routes/ProfilesPage";
import { DocsPage } from "./routes/DocsPage";
import { VideoPage } from "./routes/VideoPage";
import { VideoEditorPage } from "./routes/VideoEditorPage";
import { WorkerPage } from "./routes/WorkerPage";
import { TerminalPage } from "./routes/TerminalPage";
import { WorkspacePage } from "./routes/WorkspacePage";
import { CryptoHubPage } from "./routes/CryptoHubPage";
import { ShoppingPage } from "./routes/ShoppingPage";
import { EditorPage } from "./routes/EditorPage";
import { SocialPage } from "./routes/SocialPage";
import { IntegrationsPage } from "./routes/IntegrationsPage";

// Page component map
const pages: Record<string, React.ComponentType<any>> = {
  chat: ChatPage,
  agents: AgentsPage,
  skills: SkillsPage,
  plugins: PluginsPage,
  sessions: SessionsPage,
  channels: ChannelsPage,
  memory: MemoryPage,
  config: ConfigPage,
  env: EnvPage,
  logs: LogsPage,
  analytics: AnalyticsPage,
  aimodels: ModelsPage,
  schedule: CronPage,
  profiles: ProfilesPage,
  docs: DocsPage,
  video: VideoPage,
  "video-editor": VideoEditorPage,
  worker: WorkerPage,
  terminal: TerminalPage,
  workspace: WorkspacePage,
  "crypto-hub": CryptoHubPage,
  shopping: ShoppingPage,
  settings: ConfigPage,
  apikeys: EnvPage,
  editor: EditorPage,
  social: SocialPage,
  integrations: IntegrationsPage,
  tools: WorkspacePage,
};

function AppContent() {
  const [health, setHealth] = useState<any>(null);
  const [models, setModels] = useState<Array<{ id: string }>>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [memories, setMemories] = useState<any[]>([]);
  const [version, setVersion] = useState("");
  const [connected, setConnected] = useState(false);
  const [route, setRoute] = useState("chat");
  const [workspaceName, setWorkspaceName] = useState("");
  const [resumeSessionId, setResumeSessionId] = useState("");
  const { showToast } = useToast();

  async function refresh() {
    try {
      const h = await api.health();
      setHealth(h);
      setVersion(h.version || "0.3.0");
      setConnected(true);
    } catch {
      setConnected(false);
      return;
    }
    try { setModels(await api.models()); } catch {}
    try { setSessions(await api.sessions()); } catch {}
    try { setSkills(await api.skills()); } catch {}
    try { setAgents(await api.agents()); } catch {}
    try { setChannels(await api.channels()); } catch {}
    try { setMemories(await api.memories()); } catch {}
  }

  function triggerWorkspacePicker() {
    if ("showDirectoryPicker" in window) {
      (window as any).showDirectoryPicker().then((dir: any) => {
        setWorkspaceName(dir.name);
        showToast(`Workspace mapped: ${dir.name}`, "success");
      }).catch(() => {
        showToast("Directory picker cancelled", "info");
      });
    } else {
      showToast("Directory picker not available in this browser", "info");
    }
  }

  useEffect(() => {
    // Listen for custom navigation events from child pages
    const navHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "string") setRoute(detail);
    };
    // Listen for resume session events
    const resumeHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.sessionId) {
        setResumeSessionId(detail.sessionId);
        setRoute("chat");
      }
    };
    window.addEventListener("nova-navigate", navHandler);
    window.addEventListener("nova-resume-session", resumeHandler);
    // Init lucide icons (inline SVG replaced this, but keep for legacy support)
    refresh();
    const int = setInterval(() => { try { refresh(); } catch {} }, 15000);
    return () => {
      clearInterval(int);
      window.removeEventListener("nova-navigate", navHandler);
      window.removeEventListener("nova-resume-session", resumeHandler);
    };
  }, []);

  // Render current page
  const PageComponent = pages[route];

  return (
    <>
      <div className="ambient-glow" />
      <div className="h-dvh max-h-dvh flex bg-[#020408] text-nova-foreground overflow-hidden relative z-10">
        <Sidebar route={route} onRoute={setRoute} version={version} sessions={sessions} />

        <div className="flex-1 flex flex-col min-w-0">
          <StatusBar
            connected={connected}
            version={version || "0.6.1"}
            selectedModel={models[0]?.id || "deepseek/deepseek-chat"}
            models={models}
            workspaceName={workspaceName}
            onWorkspacePick={triggerWorkspacePicker}
          />

          <main className="flex-1 overflow-y-auto relative p-6 z-10" id="main-content">
            <ErrorBoundary>
            {PageComponent ? (
              <PageComponent
                models={models}
                skills={skills}
                agents={agents}
                sessions={sessions}
                onResolved={() => {}}
                onRefresh={() => refresh()}
                onSessionChange={() => refresh()}
                sessionKey={route === "chat" ? resumeSessionId : ""}
                onSessionKeyChange={(key: string) => setResumeSessionId(key)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 max-w-5xl mx-auto w-full">
                <div className="w-12 h-12 rounded-xl bg-[rgba(0,242,254,0.06)] border border-[#00f2fe]/20 flex items-center justify-center">
                  <svg data-lucide="sparkles" className="w-5 h-5 text-[#00f2fe]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3v18M3 12h18M5.64 5.64l12.72 12.72M18.36 5.64l-12.72 12.72"/>
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-white">Coming Soon</h2>
                <p className="text-xs text-slate-400">This section is under development</p>
              </div>
            )}
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
