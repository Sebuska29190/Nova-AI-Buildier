// Nova SDK — Core Types
// Ported from CheetahClaws v3.05.79

// --- Plugin Manifest ---
export interface PluginManifest {
  id: string; name: string; version: string;
  kind?: "provider" | "channel" | "tool" | "memory";
  providers?: string[]; channels?: string[];
  configSchema?: Record<string, unknown>;
}

// --- Model ---
export interface ModelDef {
  id: string; name?: string;
  contextWindow?: number; maxTokens?: number;
  reasoning?: boolean;
  cost?: { input: number; output: number; cacheRead?: number; };
}

// --- Provider ---
export interface ProviderPlugin {
  id: string; name: string;
  models: ModelDef[];
  auth: { method: "api-key" | "oauth"; envVar?: string; };
  stream: (p: StreamParams) => Promise<void>;
  thinkingProfile?: ThinkingProfile;
  classifyError?: (e: unknown) => "auth" | "rate" | "context" | "timeout" | "server" | "unknown";
}

export interface StreamParams {
  model: string;
  messages: AgentMessage[];
  tools?: ToolDef[];
  thinking?: string;
  signal?: AbortSignal;
  maxTokens?: number;
  onChunk(chunk: StreamChunk): void;
}

export type StreamChunk =
  | { type: "text"; text: string }
  | { type: "thinking"; text: string }
  | { type: "tool_call"; id: string; name: string; args: string }
  | { type: "usage"; input: number; output: number }
  | { type: "error"; message: string }
  | { type: "done" };

export interface ThinkingProfile {
  levels: string[]; defaultLevel: string;
}

// --- Agent ---
export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  name?: string;
}

export interface ToolDef {
  type: "function";
  function: { name: string; description?: string; parameters: Record<string, unknown>; };
}

export interface ToolCall {
  id: string; type: "function";
  function: { name: string; arguments: string; };
}

// --- Tool Plugin ---
export interface ToolPlugin {
  name: string; description: string;
  parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<string>;
}

export interface ToolContext {
  sessionId?: string; signal?: AbortSignal;
}

// --- Channel ---
export interface ChannelPlugin {
  id: string; name: string;
  start(bot: ChannelBot): Promise<void>;
  stop(): Promise<void>;
}

export interface ChannelBot {
  sendMessage(target: string, text: string): Promise<void>;
  sendThinking(target: string): Promise<void>;
  onMessage(handler: (msg: ChannelMessage) => Promise<void>): void;
}

export interface ChannelMessage {
  id: string; channelId: string; userId: string;
  text: string; target: string; replyTo?: string;
}

// --- Harness ---
export interface HarnessV2 {
  id: string;
  prepare(ctx: HarnessContext): Promise<void>;
  start(ctx: HarnessContext): Promise<void>;
  send(ctx: HarnessContext): Promise<HarnessResult>;
  resolveOutcome(result: HarnessResult): HarnessOutcome;
  cleanup(ctx: HarnessContext): Promise<void>;
}

export interface HarnessContext {
  modelRef: string; providerId: string;
  messages: AgentMessage[]; tools: ToolDef[];
  thinkingLevel?: string; signal?: AbortSignal;
  config: Record<string, unknown>;
}

export interface HarnessResult {
  text: string; toolCalls: ToolCall[];
  usage?: { input: number; output: number; };
  stopReason: "stop" | "tool_calls" | "length" | "error";
}

export type HarnessOutcome =
  | { kind: "success"; result: HarnessResult }
  | { kind: "retry"; reason: string }
  | { kind: "fallback"; reason: string }
  | { kind: "error"; message: string };

// --- Session ---
export interface SessionEntry {
  id: string; createdAt: string; updatedAt: string;
  modelRef: string; thinkingLevel?: string;
  systemPrompt?: string;
  usage: { input: number; output: number; total: number; cost: number; };
}

// --- Auth ---
export interface AuthProfile {
  id: string; providerId: string;
  apiKey?: string; baseUrl?: string;
  cooldownUntil?: number; failures: number;
}

// --- Agent config ---
export interface AgentConfig {
  modelRef: string; systemPrompt?: string;
  thinkingLevel?: string;
  fallbacks?: Array<{ providerId: string; modelId: string }>;
  maxToolLoopIterations?: number;
}
