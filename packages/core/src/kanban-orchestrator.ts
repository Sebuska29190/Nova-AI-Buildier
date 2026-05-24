/**
 * Kanban Orchestrator — multi-agent task decomposition and parallel execution.
 * Breaks down complex tasks, assigns work to sub-agents, and merges results.
 */
import { fanOut, FanOutTask } from "../multi-agent/fanout.ts";
import { agentStore, AgentConfig } from "../agent/store.ts";

interface OrchestrationPlan {
  title: string;
  steps: { agentId: string; instruction: string; dependsOn?: number[] }[];
}

/**
 * Break down a complex task into parallel sub-tasks using available agents.
 * Uses the first available model to plan, then fans out execution.
 */
export async function orchestrate(
  task: string,
  modelRef: string = "deepseek/deepseek-chat",
  maxParallel: number = 4,
): Promise<{ plan: OrchestrationPlan; results: any[]; summary: string }> {
  // Get available agents
  const agents = agentStore.list().filter(a => a.status !== "error");
  if (agents.length === 0) {
    return {
      plan: { title: "No agents", steps: [] },
      results: [],
      summary: "❌ No agents available. Create agents first in the Agents page.",
    };
  }

  // Step 1: Plan the task breakdown using the orchestrator's LLM
  const plan = await planTask(task, agents, modelRef);

  if (plan.steps.length === 0) {
    return {
      plan,
      results: [],
      summary: `❌ Could not break down the task. Try describing it more specifically.`,
    };
  }

  // Step 2: Execute steps in dependency order
  const results: any[] = [];
  const completed = new Set<number>();

  // Group steps by dependency level (topological sort)
  const levels: number[][] = [];
  const assigned = new Set<number>();

  while (assigned.size < plan.steps.length) {
    const level: number[] = [];
    for (let i = 0; i < plan.steps.length; i++) {
      if (assigned.has(i)) continue;
      const step = plan.steps[i];
      const deps = step.dependsOn || [];
      if (deps.every(d => assigned.has(d))) {
        level.push(i);
        assigned.add(i);
      }
    }
    if (level.length === 0) break; // circular dependency guard
    levels.push(level);
  }

  // Execute each level in parallel
  for (const level of levels) {
    const levelTasks: FanOutTask[] = level.map(i => ({
      id: `step-${i + 1}`,
      agentId: plan.steps[i].agentId,
      instruction: plan.steps[i].instruction,
      context: task,
    }));

    const levelResults = await fanOut(levelTasks);
    results.push(...levelResults);

    // Mark completed
    level.forEach(i => completed.add(i));
  }

  // Step 3: Generate summary
  const summaryLines = [
    `## 📋 Orchestration: ${plan.title}`,
    ``,
    `**Task:** ${task}`,
    `**Steps:** ${plan.steps.length} · **Parallel batches:** ${levels.length}`,
    ``,
    ...results.map((r, i) =>
      `### Step ${i + 1}: ${r.agentName}\n${r.error ? `❌ Error: ${r.error}` : `✅ ${(r.result || "").slice(0, 300)}`}`
    ),
  ];

  return {
    plan,
    results,
    summary: summaryLines.join("\n\n"),
  };
}

async function planTask(
  task: string,
  agents: AgentConfig[],
  modelRef: string,
): Promise<OrchestrationPlan> {
  const { sessionManager } = await import("../session/manager.ts");
  const { runAgent } = await import("../agent/runner.ts");

  const agentList = agents.map(a =>
    `- ${a.id}: ${a.name} — ${a.description || "No description"} (skills: ${(a.skills || []).join(", ") || "none"})`
  ).join("\n");

  const session = sessionManager.createSession(modelRef, {
    systemPrompt: `You are an orchestrator that breaks down complex tasks into parallel sub-tasks for specialized agents.

Available agents:
${agentList}

Respond ONLY with a JSON object in this exact format — no markdown, no explanation:
{
  "title": "short task title",
  "steps": [
    { "agentId": "agent-id", "instruction": "specific instruction for this agent", "dependsOn": [] },
    { "agentId": "agent-id-2", "instruction": "another instruction", "dependsOn": [0] }
  ]
}

Rules:
- "dependsOn" lists step indices (0-based) that must complete first. Empty array = no dependency.
- Steps without dependencies run in parallel.
- Max 8 steps.
- Only use agents from the list above.`,
  });

  const result = await runAgent({
    sessionId: session.id,
    message: task,
    modelRef,
    systemPrompt: session.systemPrompt,
    tools: false,
  });

  try {
    // Extract JSON from response (handle markdown-wrapped JSON)
    const text = result.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        title: parsed.title || "Task",
        steps: (parsed.steps || []).slice(0, 8).map((s: any) => ({
          agentId: s.agentId,
          instruction: s.instruction,
          dependsOn: s.dependsOn || [],
        })),
      };
    }
  } catch {}

  return { title: "Task", steps: [] };
}

/**
 * Create a simple kanban board state for tracking multi-step orchestration progress.
 */
export function createBoard(steps: { id: string; description: string }[]): any[] {
  return steps.map(s => ({
    id: s.id,
    description: s.description,
    status: "pending" as const,
    assignedTo: null as string | null,
    result: null as string | null,
    startedAt: null as number | null,
    completedAt: null as number | null,
  }));
}
