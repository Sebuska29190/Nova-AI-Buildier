/**
 * Agent Mesh Protocol
 * Handles agent handshake, capability negotiation, and message serialization
 */
import type { MeshAgent, MeshMessage, AgentCapability } from "./types";
import { meshRouter } from "./router";

/** Agent handshake — register capabilities and establish connections */
export async function handshake(agent: Omit<MeshAgent, "lastHeartbeat" | "status">): Promise<MeshAgent> {
  const fullAgent: MeshAgent = {
    ...agent,
    status: "online",
    lastHeartbeat: Date.now(),
    connections: agent.connections || [],
    capabilities: agent.capabilities || getDefaultCapabilities(agent.role),
  };

  meshRouter.register(fullAgent);
  return fullAgent;
}

/** Get default capabilities based on agent role */
function getDefaultCapabilities(role: string): AgentCapability[] {
  const defaults: Record<string, AgentCapability[]> = {
    main: [
      { name: "chat", description: "General conversation and assistance" },
      { name: "orchestrate", description: "Orchestrate other agents via mesh" },
      { name: "search", description: "Search knowledge bases and web" },
    ],
    research: [
      { name: "deep_research", description: "Deep research across multiple sources" },
      { name: "analyze", description: "Analyze data and provide insights" },
      { name: "summarize", description: "Summarize complex information" },
    ],
    coder: [
      { name: "write_code", description: "Write and modify source code" },
      { name: "debug", description: "Debug and fix code issues" },
      { name: "review", description: "Code review and analysis" },
      { name: "refactor", description: "Refactor and optimize code" },
    ],
    data: [
      { name: "analyze_data", description: "Analyze datasets and produce insights" },
      { name: "visualize", description: "Create data visualizations" },
      { name: "query", description: "Query databases and APIs" },
    ],
    security: [
      { name: "audit", description: "Security audit of code and configuration" },
      { name: "scan", description: "Vulnerability scanning" },
      { name: "report", description: "Generate security reports" },
    ],
    devops: [
      { name: "deploy", description: "Deploy applications and infrastructure" },
      { name: "monitor", description: "Monitor system health" },
      { name: "configure", description: "Configure CI/CD pipelines" },
    ],
    pm: [
      { name: "plan", description: "Create project plans and roadmaps" },
      { name: "estimate", description: "Estimate tasks and complexity" },
      { name: "track", description: "Track progress and milestones" },
    ],
    tester: [
      { name: "write_tests", description: "Write unit and integration tests" },
      { name: "run_tests", description: "Execute test suites" },
      { name: "report_coverage", description: "Test coverage reporting" },
    ],
    docs: [
      { name: "write_docs", description: "Write documentation" },
      { name: "format", description: "Format and structure documents" },
      { name: "translate", description: "Translate documentation" },
    ],
    paper: [
      { name: "write_paper", description: "Write academic papers" },
      { name: "cite", description: "Generate citations" },
      { name: "review_paper", description: "Review academic content" },
    ],
    auditor: [
      { name: "audit_code", description: "Full codebase audit" },
      { name: "compliance", description: "Compliance checking" },
      { name: "generate_report", description: "Generate audit reports" },
    ],
  };
  return defaults[role] || [{ name: role, description: `${role} agent` }];
}

/** Serialize a mesh message for WebSocket transport */
export function serializeMessage(msg: MeshMessage): string {
  return JSON.stringify(msg);
}

/** Deserialize a mesh message from WebSocket transport */
export function deserializeMessage(data: string): MeshMessage {
  return JSON.parse(data);
}

/** Create a request message */
export function createRequest(from: string, to: string, payload: unknown, replyTo?: string): MeshMessage {
  return {
    id: crypto.randomUUID(),
    from,
    to,
    type: "request",
    payload,
    timestamp: Date.now(),
    replyTo,
  };
}

/** Create a response message */
export function createResponse(from: string, to: string, payload: unknown, replyTo: string): MeshMessage {
  return {
    id: crypto.randomUUID(),
    from,
    to,
    type: "response",
    payload,
    timestamp: Date.now(),
    replyTo,
  };
}

/** Initialize the default agent mesh with all known agents */
export async function initializeMesh(): Promise<void> {
  const agents: Array<Omit<MeshAgent, "lastHeartbeat" | "status">> = [
    {
      id: "main", name: "Main Assistant", role: "main", model: "deepseek/deepseek-chat",
      skills: [], tools: 42, connections: ["research", "coder", "data", "security"], activeTasks: 0, capabilities: [],
    },
    {
      id: "research", name: "Research Agent", role: "research", model: "deepseek/deepseek-chat",
      skills: [], tools: 18, connections: ["main", "data", "paper"], activeTasks: 0, capabilities: [],
    },
    {
      id: "coder", name: "Coder Agent", role: "coder", model: "deepseek/deepseek-coder",
      skills: [], tools: 24, connections: ["main", "tester", "devops", "docs"], activeTasks: 0, capabilities: [],
    },
    {
      id: "data", name: "Data Analyst", role: "data", model: "deepseek/deepseek-chat",
      skills: [], tools: 15, connections: ["main", "research"], activeTasks: 0, capabilities: [],
    },
    {
      id: "security", name: "Security Auditor", role: "security", model: "deepseek/deepseek-chat",
      skills: [], tools: 12, connections: ["main", "coder", "auditor"], activeTasks: 0, capabilities: [],
    },
    {
      id: "devops", name: "DevOps Engineer", role: "devops", model: "deepseek/deepseek-chat",
      skills: [], tools: 20, connections: ["main", "coder"], activeTasks: 0, capabilities: [],
    },
    {
      id: "pm", name: "Project Manager", role: "pm", model: "deepseek/deepseek-chat",
      skills: [], tools: 10, connections: ["main", "coder", "docs"], activeTasks: 0, capabilities: [],
    },
    {
      id: "docs", name: "Documentation Writer", role: "docs", model: "deepseek/deepseek-chat",
      skills: [], tools: 8, connections: ["main", "coder", "paper"], activeTasks: 0, capabilities: [],
    },
    {
      id: "tester", name: "Tester", role: "tester", model: "deepseek/deepseek-chat",
      skills: [], tools: 10, connections: ["coder"], activeTasks: 0, capabilities: [],
    },
    {
      id: "paper", name: "Paper Writer", role: "paper", model: "deepseek/deepseek-chat",
      skills: [], tools: 12, connections: ["main", "research", "docs"], activeTasks: 0, capabilities: [],
    },
    {
      id: "auditor", name: "Code Auditor", role: "auditor", model: "deepseek/deepseek-chat",
      skills: [], tools: 8, connections: ["security", "coder"], activeTasks: 0, capabilities: [],
    },
    {
      id: "auto-bug-fixer", name: "Auto Bug Fixer", role: "coder", model: "deepseek/deepseek-coder",
      skills: [], tools: 14, connections: ["coder", "tester"], activeTasks: 0, capabilities: [],
    },
    {
      id: "auto-coder", name: "Auto Coder", role: "coder", model: "deepseek/deepseek-coder",
      skills: [], tools: 16, connections: ["coder", "tester", "devops"], activeTasks: 0, capabilities: [],
    },
  ];

  for (const agent of agents) {
    await handshake(agent);
  }

  console.log(`  Mesh:        ${agents.length} agents connected via Agent Mesh Protocol`);
}
