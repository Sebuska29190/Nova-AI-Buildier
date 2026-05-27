/**
 * Fan-Out — execute multiple agent tasks in parallel
 * Used by kanban-orchestrator.ts to distribute sub-tasks to agents.
 */
import { runAgent } from "../agent/runner.ts";
import { sessionManager } from "../session/manager.ts";
import { agentStore } from "../agent/store.ts";
import { safeMessage } from "../errors.ts";

export interface FanOutTask {
  id: string;
  agentId: string;
  instruction: string;
  context?: string;
}

export interface FanOutResult {
  id: string;
  agentId: string;
  agentName: string;
  result: string;
  error?: string;
}

/**
 * Execute multiple tasks in parallel, each assigned to a specific agent.
 * Returns results for all tasks, with errors captured individually.
 */
export async function fanOut(tasks: FanOutTask[]): Promise<FanOutResult[]> {
  const results: FanOutResult[] = [];

  async function executeTask(task: FanOutTask): Promise<void> {
    const agent = agentStore.get(task.agentId);
    if (!agent) {
      results.push({
        id: task.id,
        agentId: task.agentId,
        agentName: task.agentId,
        error: `Agent not found: ${task.agentId}`,
        result: "",
      });
      return;
    }

    const message = task.context
      ? `${task.instruction}\n\nContext:\n${task.context}`
      : task.instruction;

    try {
      const session = sessionManager.createSession(agent.modelRef, {
        agentId: agent.id,
        systemPrompt: agent.systemPrompt,
        thinkingLevel: agent.thinkingLevel,
      });

      const result = await runAgent({
        sessionId: session.id,
        message,
        modelRef: agent.modelRef,
        systemPrompt: agent.systemPrompt,
        thinkingLevel: agent.thinkingLevel,
        tools: true,
        skills: agent.skills,
      });

      results.push({
        id: task.id,
        agentId: task.agentId,
        agentName: agent.name,
        result: result.text,
      });
    } catch (e: unknown) {
      results.push({
        id: task.id,
        agentId: task.agentId,
        agentName: agent.name,
        result: "",
        error: safeMessage(e),
      });
    }
  }

  // Run all tasks in parallel
  await Promise.all(tasks.map(executeTask));

  return results;
}
