/**
 * Agent Mesh Protocol — Core Types
 * Nexus AI v2.0 — Interconnected Agent System
 */

export type AgentStatus = "online" | "idle" | "offline" | "busy" | "error";

export interface MeshAgent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  model: string;
  skills: string[];
  tools: number;
  connections: string[]; // agent IDs this agent is connected to
  activeTasks: number;
  lastHeartbeat: number;
  capabilities: AgentCapability[];
}

export interface AgentCapability {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface MeshMessage {
  id: string;
  from: string; // agent ID
  to: string | "broadcast"; // agent ID or broadcast
  type: "request" | "response" | "event" | "heartbeat" | "delegate";
  payload: unknown;
  timestamp: number;
  replyTo?: string; // message ID this is replying to
  ttl?: number; // time-to-live in ms
}

export interface MeshEvent {
  type: "agent_connected" | "agent_disconnected" | "agent_status_changed"
    | "task_started" | "task_completed" | "task_failed"
    | "capability_registered" | "capability_removed"
    | "mesh_topology_changed";
  agentId: string;
  timestamp: number;
  data?: unknown;
}

export interface MeshRoute {
  sourceId: string;
  targetId: string;
  hops: number;
  latency: number;
  active: boolean;
}

export interface MeshTopology {
  agents: MeshAgent[];
  routes: MeshRoute[];
  updatedAt: number;
}

export type MeshEventHandler = (event: MeshEvent) => void;
export type MeshMessageHandler = (message: MeshMessage) => Promise<unknown> | unknown;
