// Sub-agent system — thread pool manager with parallel support
// Inspired by Hermes Agent delegate_tool.py
import { runAgent } from "../agent/runner.ts";
import { sessionManager } from "../session/manager.ts";
import { agentStore } from "../agent/store.ts";
import { safeMessage } from "../errors.ts";

export interface AgentDef {
  id: string; name: string; modelRef: string;
  systemPrompt: string;
}

export interface ParallelTask {
  def: AgentDef;
  message: string;
}

export interface MergedResult {
  name: string;
  result: string;
  error?: string;
}

export async function spawnSubAgent(def: AgentDef, message: string): Promise<string> {
  const session = sessionManager.createSession(def.modelRef, { systemPrompt: def.systemPrompt, agentId: def.id });
  try {
    const result = await runAgent({ sessionId: session.id, message, modelRef: def.modelRef, systemPrompt: def.systemPrompt, tools: true });
    return result.text;
  } catch (e: unknown) {
    return `Error: ${safeMessage(e)}`;
  }
}

/**
 * Spawn multiple sub-agents in parallel for divide-and-conquer tasks.
 * Each sub-agent gets the same system prompt but a different subtask message.
 * Results are collected and merged into a single summary.
 */
export async function spawnParallel(
  name: string,
  systemPrompt: string,
  tasks: string[],
  modelRef: string = "deepseek/deepseek-chat",
  maxConcurrent: number = 4
): Promise<MergedResult[]> {
  const results: MergedResult[] = [];
  const queue = [...tasks];

  async function worker(idx: number): Promise<void> {
    while (queue.length > 0) {
      const msg = queue.shift()!;
      const def: AgentDef = {
        id: `parallel-${name}-${idx}-${Date.now()}`,
        name: `${name}-worker-${idx}`,
        modelRef,
        systemPrompt,
      };

      try {
        const session = sessionManager.createSession(modelRef, { systemPrompt: systemPrompt, agentId: def.id });
        const result = await runAgent({
          sessionId: session.id,
          message: msg,
          modelRef,
          systemPrompt,
          tools: true,
        });
        results.push({ name: def.name, result: result.text });
      } catch (e: unknown) {
        results.push({ name: def.name, result: "", error: safeMessage(e as any) });
      }
    }
  }

  // Run up to maxConcurrent workers
  const workers = [];
  const actualWorkers = Math.min(maxConcurrent, tasks.length);
  for (let i = 0; i < actualWorkers; i++) {
    workers.push(worker(i));
  }
  await Promise.all(workers);

  // Sort by task order
  return results;
}

/**
 * Merge results from parallel sub-agents using an LLM summarizer.
 */
export async function mergeResults(
  results: MergedResult[],
  modelRef: string = "deepseek/deepseek-chat"
): Promise<string> {
  if (results.length === 0) return "(no results)";
  if (results.length === 1) return results[0].result;

  const formatted = results
    .map((r, i) => `### Worker ${i + 1}: ${r.name}\n${r.result || `ERROR: ${r.error}`}`)
    .join("\n\n");

  const session = sessionManager.createSession(modelRef, { systemPrompt: "You are a result merger." });
  const result = await runAgent({
    sessionId: session.id,
    message: `Merge these parallel worker results into a single coherent summary. Remove duplicates, resolve contradictions, and keep every unique finding:\n\n${formatted}`,
    modelRef,
    systemPrompt: "You merge parallel sub-agent results. Be concise but complete.",
    tools: false,
  });

  return result.text;
}
