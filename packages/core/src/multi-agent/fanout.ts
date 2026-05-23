/**
 * Multi-Agent Collaboration — Fan-out pattern
 * Main agent can delegate work to sub-agents and share knowledge between them
 * 1:1 z CheetahClaws multi_agent/fanout.py
 */

import { runAgent } from "../agent/runner.ts";
import { sessionManager } from "../session/manager.ts";
import { agentStore } from "../agent/store.ts";
import { knowledgeBase } from "../knowledge/store.ts";
import { safeMessage } from "../errors.ts";
import { registry } from "../plugin/registry.ts";

export interface FanOutTask {
  id: string;
  agentId: string;
  instruction: string;
  context?: string;
}

export interface FanOutResult {
  taskId: string;
  agentId: string;
  agentName: string;
  result: string;
  error?: string;
}

/**
 * Delegate work to multiple agents in parallel (fan-out pattern)
 * Each agent works independently, results are collected and shared
 */
export async function fanOut(
  tasks: FanOutTask[],
  sharedContext?: string,
): Promise<FanOutResult[]> {
  const results: FanOutResult[] = [];

  // Run all tasks in parallel
  const promises = tasks.map(async (task) => {
    const agent = agentStore.get(task.agentId);
    if (!agent) {
      return {
        taskId: task.id,
        agentId: task.agentId,
        agentName: task.agentId,
        result: "",
        error: `Agent '${task.agentId}' not found`,
      };
    }

    const contextBlock = sharedContext
      ? `\n\n## Shared Context\n\n${sharedContext}`
      : "";

    const session = sessionManager.createSession(agent.modelRef, {
      agentId: agent.id,
      systemPrompt: agent.systemPrompt,
    });

    try {
      const result = await runAgent({
        sessionId: session.id,
        message: `${task.instruction}${contextBlock}`,
        modelRef: agent.modelRef,
        systemPrompt: agent.systemPrompt,
        tools: true,
      });

      // Save agent's work to knowledge base
      knowledgeBase.save({
        title: `Agent Collaboration: ${agent.name} — ${task.instruction.slice(0, 60)}`,
        content: result.text,
        category: "agent",
        tags: ["collaboration", agent.id, `task:${task.id}`],
        source: `agent:${agent.id}`,
      });

      return {
        taskId: task.id,
        agentId: agent.id,
        agentName: agent.name,
        result: result.text,
      };
    } catch (e: unknown) {
      return {
        taskId: task.id,
        agentId: agent.id,
        agentName: agent.name,
        result: "",
        error: safeMessage(e),
      };
    }
  });

  const settled = await Promise.allSettled(promises);
  for (const s of settled) {
    if (s.status === "fulfilled") {
      results.push(s.value);
    } else {
      results.push({
        taskId: "unknown",
        agentId: "unknown",
        agentName: "unknown",
        result: "",
        error: s.reason?.message || "Unknown error",
      });
    }
  }

  return results;
}

/**
 * Run a collaborative session where the main agent coordinates
 * multiple sub-agents, sharing results between them
 */
export async function collaborativeRun(
  mainInstruction: string,
  agentIds: string[],
  orchestratorModel?: string,
): Promise<{
  orchestration: string;
  agentResults: FanOutResult[];
}> {
  // Step 1: Main agent breaks down the task
  const orchestratorSession = sessionManager.createSession(
    orchestratorModel || "deepseek/deepseek-chat",
    {
      systemPrompt: `You are an orchestrator agent. Break down the following task into sub-tasks that can be delegated to specialized agents. List each sub-task with the agent that should handle it.

Available agents:
${agentStore.list().map((a) => `- ${a.id}: ${a.name} — ${a.description || "No description"}`).join("\n")}

Format your response as:
## Task Breakdown
1. [agentId]: [instruction]
2. [agentId]: [instruction]
...`,
    },
  );

  const breakdownResult = await runAgent({
    sessionId: orchestratorSession.id,
    message: mainInstruction,
    modelRef: orchestratorModel || "deepseek/deepseek-chat",
    tools: true,
  });

  // Step 2: Parse sub-tasks from the breakdown
  const taskLines = breakdownResult.text
    .split("\n")
    .filter((line) => /^\d+\.\s+\S+:\s/.test(line));

  const tasks: FanOutTask[] = [];
  for (const line of taskLines) {
    const match = line.match(/^\d+\.\s+(\S+):\s+(.+)$/);
    if (match) {
      const agentId = match[1].replace(/[^a-z0-9-]/g, "");
      const instruction = match[2];
      if (agentStore.get(agentId)) {
        tasks.push({
          id: `task-${tasks.length + 1}`,
          agentId,
          instruction,
          context: mainInstruction,
        });
      }
    }
  }

  // If no parseable tasks, use all specified agents
  if (tasks.length === 0) {
    for (const agentId of agentIds) {
      tasks.push({
        id: `task-${tasks.length + 1}`,
        agentId,
        instruction: mainInstruction,
        context: breakdownResult.text,
      });
    }
  }

  // Step 3: Fan-out to all agents in parallel
  const agentResults = await fanOut(tasks, breakdownResult.text);

  // Step 4: Collect results and save to knowledge base
  const summary = agentResults
    .map(
      (r) =>
        `## ${r.agentName} (${r.agentId})\n\n${r.error ? `Error: ${r.error}` : r.result.slice(0, 500)}`,
    )
    .join("\n\n---\n\n");

  knowledgeBase.save({
    title: `Collaborative Run: ${mainInstruction.slice(0, 60)}`,
    content: `## Orchestration\n\n${breakdownResult.text}\n\n## Results\n\n${summary}`,
    category: "agent",
    tags: ["collaboration", "orchestration", ...agentIds],
    source: "multi-agent",
  });

  return {
    orchestration: breakdownResult.text,
    agentResults,
  };
}
