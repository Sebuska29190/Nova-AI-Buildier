/**
 * Agent Mesh Event Bus
 * Pub/sub system for agent mesh events and messages
 */
import type { MeshEvent, MeshMessage, MeshEventHandler, MeshMessageHandler } from "./types";

class MeshEventBus {
  private eventHandlers = new Map<string, Set<MeshEventHandler>>();
  private messageHandlers = new Map<string, MeshMessageHandler>();
  private eventHistory: MeshEvent[] = [];
  private maxHistory = 500;

  /** Subscribe to mesh events */
  on(eventType: string, handler: MeshEventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
    return () => this.eventHandlers.get(eventType)?.delete(handler);
  }

  /** Subscribe to all events */
  onAll(handler: MeshEventHandler): () => void {
    return this.on("*", handler);
  }

  /** Emit a mesh event to all subscribers */
  emit(event: MeshEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistory);
    }
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      for (const h of handlers) h(event);
    }
    const allHandlers = this.eventHandlers.get("*");
    if (allHandlers) {
      for (const h of allHandlers) h(event);
    }
  }

  /** Register a message handler for a specific agent */
  registerHandler(agentId: string, handler: MeshMessageHandler): void {
    this.messageHandlers.set(agentId, handler);
  }

  /** Route a message to the target agent's handler */
  async routeMessage(message: MeshMessage): Promise<unknown> {
    if (message.to === "broadcast") {
      const results: unknown[] = [];
      for (const [agentId, handler] of this.messageHandlers) {
        if (agentId !== message.from) {
          try {
            results.push(await handler(message));
          } catch (e) {
            this.emit({
              type: "task_failed",
              agentId,
              timestamp: Date.now(),
              data: { error: String(e), messageId: message.id },
            });
          }
        }
      }
      return results;
    }
    const handler = this.messageHandlers.get(message.to);
    if (!handler) {
      throw new Error(`Agent ${message.to} not found in mesh`);
    }
    return handler(message);
  }

  /** Get recent event history */
  getHistory(limit = 50): MeshEvent[] {
    return this.eventHistory.slice(-limit);
  }

  /** Clear all subscribers */
  clear(): void {
    this.eventHandlers.clear();
    this.messageHandlers.clear();
    this.eventHistory = [];
  }
}

export const meshBus = new MeshEventBus();
