import { create } from 'zustand';

// ─── Types ───────────────────────────────────
export interface Message {
  id: string; role: 'user' | 'assistant' | 'system'; content: string;
  timestamp: number; files?: { name: string; size: number; type: string }[];
  toolCalls?: Array<{ tool: string; args: any; result?: string; success?: boolean; duration?: number }>;
  thinking?: string; duration?: number; tokens?: { input: number; output: number };
}
export interface AgentStatus {
  id: string; name: string; status: 'online' | 'busy' | 'idle' | 'offline'; activeTasks: number;
  tools: number; skills: number; model: string; connections: string[];
}
export type Route = 'chat' | 'workflows' | 'chambers' | 'rag' | 'agents' | 'memory' | 'skills' | 'plugins' | 'integrations' | 'playground' | 'code-editor' | 'git' | 'terminal' | 'workspace' | 'worker' | 'sessions' | 'channels' | 'settings' | 'apikeys' | 'logs' | 'profiles' | 'models' | 'cron' | 'analytics' | 'tools-analytics' | 'docs';

// ─── Store ────────────────────────────────────
interface AppState {
  // UI
  route: Route; sidebarCollapsed: boolean; contextPanelOpen: boolean;
  setRoute: (r: Route) => void; toggleSidebar: () => void; toggleContextPanel: () => void;
  
  // Chat
  messages: Message[]; activeSession: string | null; streamingMessage: string | null;
  activeAgent: string; activeModel: string; contextUsed: number; contextLimit: number;
  sendMessage: (content: string, files?: File[]) => Promise<void>;
  clearChat: () => void; setActiveAgent: (id: string) => void; setActiveModel: (id: string) => void;
  addMessage: (msg: Message) => void; setStreamingMessage: (text: string | null) => void;
  
  // Agents
  agents: AgentStatus[]; setAgents: (a: AgentStatus[]) => void;
  updateAgentStatus: (id: string, status: Partial<AgentStatus>) => void;
  
  // System
  connected: boolean; version: string; health: any;
  setConnected: (c: boolean) => void; setVersion: (v: string) => void; setHealth: (h: any) => void;
}

export const useStore = create<AppState>((set, get) => ({
  // UI
  route: 'chat', sidebarCollapsed: false, contextPanelOpen: true,
  setRoute: (route) => set({ route }),
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleContextPanel: () => set(s => ({ contextPanelOpen: !s.contextPanelOpen })),
  
  // Chat
  messages: [], activeSession: null, streamingMessage: null,
  activeAgent: 'main', activeModel: 'nexus-4',
  contextUsed: 0, contextLimit: 200000,
  sendMessage: async (_content, _files) => {}, // Implemented in ChatPage
  clearChat: () => set({ messages: [], streamingMessage: null }),
  setActiveAgent: (id) => set({ activeAgent: id }),
  setActiveModel: (id) => set({ activeModel: id }),
  addMessage: (msg) => set(s => ({ messages: [...s.messages, msg] })),
  setStreamingMessage: (text) => set({ streamingMessage: text }),
  
  // Agents
  agents: [],
  setAgents: (agents) => set({ agents }),
  updateAgentStatus: (id, status) => set(s => ({
    agents: s.agents.map(a => a.id === id ? { ...a, ...status } : a)
  })),
  
  // System
  connected: false, version: '', health: null,
  setConnected: (connected) => set({ connected }),
  setVersion: (version) => set({ version }),
  setHealth: (health) => set({ health }),
}));
