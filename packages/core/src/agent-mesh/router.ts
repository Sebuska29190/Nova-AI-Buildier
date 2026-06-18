/**
 * Agent Mesh Router
 * Manages agent registration, topology, and message routing
 */
import type { MeshAgent, MeshRoute, MeshMessage, MeshEvent, MeshTopology, AgentStatus } from "./types";
import { meshBus } from "./bus";

class AgentMeshRouter {
  private agents = new Map<string, MeshAgent>();
  private routes = new Map<string, MeshRoute>();

  /** Register an agent in the mesh */
  register(agent: MeshAgent): void {
    const wasNew = !this.agents.has(agent.id);
    this.agents.set(agent.id, {
      ...agent,
      lastHeartbeat: Date.now(),
      connections: agent.connections || [],
    });

    // Build routes between connected agents
    for (const connId of agent.connections) {
      if (this.agents.has(connId)) {
        const routeKey = `${agent.id}->${connId}`;
        if (!this.routes.has(routeKey)) {
          this.routes.set(routeKey, {
            sourceId: agent.id,
            targetId: connId,
            hops: 1,
            latency: 0,
            active: true,
          });
        }
      }
    }

    meshBus.emit({
      type: wasNew ? "agent_connected" : "agent_status_changed",
      agentId: agent.id,
      timestamp: Date.now(),
      data: { agent },
    });
  }

  /** Update agent status */
  setStatus(agentId: string, status: AgentStatus): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      agent.lastHeartbeat = Date.now();
      meshBus.emit({
        type: "agent_status_changed",
        agentId,
        timestamp: Date.now(),
        data: { status },
      });
    }
  }

  /** Send heartbeat and update status */
  heartbeat(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.lastHeartbeat = Date.now();
    }
  }

  /** Unregister an agent */
  unregister(agentId: string): void {
    this.agents.delete(agentId);
    // Clean up routes
    for (const [key, route] of this.routes) {
      if (route.sourceId === agentId || route.targetId === agentId) {
        this.routes.delete(key);
      }
    }
    meshBus.emit({
      type: "agent_disconnected",
      agentId,
      timestamp: Date.now(),
    });
  }

  /** Send a message through the mesh */
  async send(message: MeshMessage): Promise<unknown> {
    const source = this.agents.get(message.from);
    if (!source) {
      throw new Error(`Source agent ${message.from} not found`);
    }
    if (message.to !== "broadcast" && !this.agents.has(message.to)) {
      throw new Error(`Target agent ${message.to} not found`);
    }
    return meshBus.routeMessage(message);
  }

  /** Delegate a task to the best-suited agent */
  async delegate(fromId: string, task: string, requiredCapability?: string): Promise<unknown> {
    const candidates = Array.from(this.agents.values())
      .filter(a => a.id !== fromId && a.status !== "offline")
      .filter(a => !requiredCapability || a.capabilities?.some(c => c.name === requiredCapability))
      .sort((a, b) => b.activeTasks - a.activeTasks); // prefer less busy

    if (candidates.length === 0) {
      throw new Error(`No agent available for: ${requiredCapability || task}`);
    }

    const target = candidates[0];
    return this.send({
      id: crypto.randomUUID(),
      from: fromId,
      to: target.id,
      type: "delegate",
      payload: { task, requiredCapability },
      timestamp: Date.now(),
    });
  }

  /** Get current mesh topology */
  getTopology(): MeshTopology {
    return {
      agents: Array.from(this.agents.values()),
      routes: Array.from(this.routes.values()),
      updatedAt: Date.now(),
    };
  }

  /** Get agent by ID */
  getAgent(id: string): MeshAgent | undefined {
    return this.agents.get(id);
  }

  /** Get all agents */
  getAllAgents(): MeshAgent[] {
    return Array.from(this.agents.values());
  }

  /** Get online agent count */
  getOnlineCount(): number {
    return Array.from(this.agents.values()).filter(a => a.status === "online" || a.status === "busy").length;
  }

  /** Check stale agents (no heartbeat for >30s) */
  checkStale(): void {
    const now = Date.now();
    for (const [id, agent] of this.agents) {
      if (now - agent.lastHeartbeat > 30_000) {
        this.setStatus(id, "offline");
      }
    }
  }
}

export const meshRouter = new AgentMeshRouter();

// Start stale check interval
setInterval(() => meshRouter.checkStale(), 15_000);
