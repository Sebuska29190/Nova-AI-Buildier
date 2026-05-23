import type { AgentMessage, ToolCall } from "@nova/sdk";
import { safeMessage } from "../errors.ts";
import { registry } from "../plugin/registry.ts";
import { getTool, listTools } from "../plugin/tools.ts";
import { sessionManager } from "../session/manager.ts";
import { emitEvent } from "../event-bus/index.ts";
import { piHarness } from "../harness/pi.ts";
import { getBreaker } from "../circuit-breaker.ts";
import { classifyError } from "../error-classifier.ts";
import { checkQuota } from "../quota.ts";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { loadSkills } from "../skill/loader.ts";

// Cache dla wydajności — TTL 30s
let _rulesCache: string | null = null;
let _rulesCacheTime = 0;
let _skillsCache: any[] | null = null;
let _skillsCacheTime = 0;
const CACHE_TTL = 30000;

export interface RunParams {
  sessionId: string;
  message: string;
  modelRef: string;
  thinkingLevel?: string;
  systemPrompt?: string;
  tools?: boolean;
  skills?: string[];
  fallbacks?: string[];
  signal?: AbortSignal;
  runId?: string;
}

export interface RunResult {
  sessionId: string;
  text: string;
  modelRef: string;
  usage: { input: number; output: number };
}

/**
 * Load global rules from config/rules.txt, returns empty string if not found
 */
function loadGlobalRules(): string {
  if (_rulesCache && Date.now() - _rulesCacheTime < CACHE_TTL) return _rulesCache;
  try {
    const rulesPath = join(process.cwd(), "config", "rules.txt");
    if (existsSync(rulesPath)) {
      _rulesCache = readFileSync(rulesPath, "utf-8").trim();
      _rulesCacheTime = Date.now();
      return _rulesCache;
    }
  } catch {}
  _rulesCache = "";
  _rulesCacheTime = Date.now();
  return "";
}

function loadCachedSkills(): any[] {
  if (_skillsCache && Date.now() - _skillsCacheTime < CACHE_TTL) return _skillsCache;
  _skillsCache = loadSkills();
  _skillsCacheTime = Date.now();
  return _skillsCache;
}

export async function runAgent(params: RunParams): Promise<RunResult> {
  const session = sessionManager.getSession(params.sessionId);
  const messages: AgentMessage[] = [];

  // Build system prompt with global rules + skills reference
  const basePrompt = params.systemPrompt ?? session?.systemPrompt ?? "";
  const globalRules = loadGlobalRules();
  let finalSystemPrompt = basePrompt;

  // Append skills reference so the agent knows what skills are available
  const allSkills = loadCachedSkills();
  if (allSkills.length > 0) {
    const skillsRef = allSkills
      .filter((s) => s.description)
      .map((s) => `  skills/${s.filePath} — ${s.description}`)
      .join("\n");
    finalSystemPrompt += `\n\n## Available Skills (${allSkills.length} total)\nUse \`skills_list\` tool to see all. Key skills:\n${skillsRef}\n\nWhen a user request matches a skill's trigger, load that skill file and follow its instructions. Skills are located in the \`skills/\` directory.`;
  }

  if (globalRules) {
    finalSystemPrompt = `${globalRules}\n\n${finalSystemPrompt}`;
  }
  if (finalSystemPrompt) {
    messages.push({ role: "system", content: finalSystemPrompt });
  }

  // Rebuild transcript into API messages
  // Skip tool-related entries (assistant with tool_calls and tool results) since
  // they are ephemeral — already processed in previous requests. Only keep
  // user messages and plain assistant text responses for conversation history.
  const transcript = sessionManager.getTranscript(params.sessionId);
  for (const entry of transcript) {
    if (entry.role === "system") continue;
    // Skip assistant messages that stored tool_calls (prefixed with __TOOL_CALLS__)
    if (entry.role === "assistant" && entry.content.startsWith("__TOOL_CALLS__")) continue;
    // Skip tool result messages
    if (entry.role === "tool") continue;
    messages.push({ role: entry.role as "user" | "assistant", content: entry.content });
  }
  messages.push({ role: "user", content: params.message });
  sessionManager.append(params.sessionId, "user", params.message);

  const toolDefs = params.tools !== false
    ? listTools().filter((t) => !params.skills || params.skills.length === 0 || params.skills.includes(t.name)).map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.parameters } }))
    : [];

  const candidates = [params.modelRef, ...(params.fallbacks ?? [])];

  for (const modelRef of candidates) {
    const resolved = registry.resolveModel(modelRef);
    if (!resolved) continue;
    const providerId = resolved.providerId;

    // Check circuit breaker
    const breaker = getBreaker(providerId);
    if (!breaker.allowRequest()) {
      emitEvent({ type: "event", kind: "message", sessionId: params.sessionId, data: { text: `⚠ ${providerId} circuit breaker OPEN — skipping` } });
      continue;
    }

    // Check quota
    try { checkQuota(params.sessionId); } catch (e: unknown) {
      return { sessionId: params.sessionId, text: `⛔ ${safeMessage(e)}`, modelRef, usage: { input: 0, output: 0 } };
    }

    const ctx = { modelRef, providerId, messages: [...messages], tools: toolDefs, thinkingLevel: params.thinkingLevel, signal: params.signal, config: { sessionId: params.sessionId, runId: params.runId } };

    await piHarness.prepare(ctx);
    await piHarness.start(ctx);

    try {
      const result = await toolLoop(params, ctx);
      breaker.recordSuccess();
      return result;
    } catch (e: unknown) {
      const classified = classifyError(e, providerId);
      breaker.recordFailure();
      emitEvent({ type: "event", kind: "message", sessionId: params.sessionId, data: { text: `⚠ ${classified.category}: ${classified.recoveryHint}` } });
      if (candidates.length === 1) {
        return { sessionId: params.sessionId, text: `Error: ${safeMessage(e)}`, modelRef, usage: { input: 0, output: 0 } };
      }
      continue;
    }
  }
  throw new Error("All models failed");
}

function thisRole(role: string, content: string, toolCallId?: string): AgentMessage {
  if (role === "tool") return { role: "tool", content, tool_call_id: toolCallId || "", name: "" };
  if (role === "assistant") return { role: "assistant", content };
  return { role: "user", content };
}

async function toolLoop(params: RunParams, ctx: { modelRef: string; messages: AgentMessage[]; signal?: AbortSignal; thinkingLevel?: string; tools: { type: "function"; function: { name: string; description?: string; parameters: Record<string, unknown> } }[] }): Promise<RunResult> {
  const seenTools = new Set<string>();

  for (let iteration = 0; iteration < 25; iteration++) {
    let text = "";
    let toolCalls: ToolCall[] = [];

    try {
      const result = await piHarness.send(ctx as Parameters<typeof piHarness.send>[0]);
      text = result.text || "";
      toolCalls = result.toolCalls || [];
    } catch (e: unknown) {
      console.error(`[toolLoop] piHarness.send error (iteration ${iteration}):`, safeMessage(e));
      text = `Tool execution error: ${safeMessage(e)}`;
      toolCalls = [];
    }

    // If no tool calls, return text (even if empty, we guard against that)
    if (!toolCalls.length) {
      const finalText = text || "(completed)";
      sessionManager.append(params.sessionId, "assistant", finalText);
      return { sessionId: params.sessionId, text: finalText, modelRef: params.modelRef, usage: { input: 0, output: 0 } };
    }

    // Force a final summary after 10 iterations — model may keep calling tools without producing text
    if (iteration >= 10 && !text.trim()) {
      text = `[Analysis complete after ${iteration + 1} tool iterations]`;
    }

    // Execute tools
    const toolNames = toolCalls.map((tc) => tc.function.name);
    const assistantMsg = { role: "assistant" as const, content: text, tool_calls: toolCalls };
    ctx.messages.push(assistantMsg);

    // Persist assistant message with tool_calls to transcript (marked with __TOOL_CALLS__ prefix)
    // so we can skip it on replay — tool calls are ephemeral and should not be replayed
    const toolCallsJson = JSON.stringify({ text, toolCalls: toolCalls.map(tc => ({
      id: tc.id, type: tc.type, function: { name: tc.function.name, arguments: tc.function.arguments }
    })) });
    sessionManager.append(params.sessionId, "assistant", `__TOOL_CALLS__${toolCallsJson}`);

    for (const tc of toolCalls) {
      const tool = getTool(tc.function.name);
      if (!tool) {
        ctx.messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: `Unknown tool: ${tc.function.name}` }), name: tc.function.name });
        sessionManager.append(params.sessionId, "tool", JSON.stringify({ error: `Unknown tool: ${tc.function.name}` }), tc.id, tc.function.name);
        continue;
      }

      // Parse arguments safely
      let parsedArgs: Record<string, unknown> = {};
      try { parsedArgs = JSON.parse(tc.function.arguments || "{}"); } catch {}

      // Execute tool with timeout
      try {
        const resultText = await Promise.race([
          tool.execute(parsedArgs, { sessionId: params.sessionId, signal: params.signal }),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error(`Tool ${tc.function.name} timed out after 60s`)), 60000)),
        ]);
        ctx.messages.push({ role: "tool", tool_call_id: tc.id, content: resultText.slice(0, 10000), name: tc.function.name });
        sessionManager.append(params.sessionId, "tool", resultText.slice(0, 10000), tc.id, tc.function.name);
        emitEvent({ type: "event", kind: "tool_result", sessionId: params.sessionId, data: { toolCallId: tc.id } });
      } catch (e: unknown) {
        const errMsg = `Error executing ${tc.function.name}: ${safeMessage(e)}`;
        console.error(`[toolLoop] Tool execution error: ${errMsg}`);
        ctx.messages.push({ role: "tool", tool_call_id: tc.id, content: errMsg, name: tc.function.name });
        sessionManager.append(params.sessionId, "tool", errMsg, tc.id, tc.function.name);
      }
    }

    // Track all tools seen across iterations
    for (const name of toolNames) seenTools.add(name);

    // Detect tool loops — if same exact tool called 8+ times in a single iteration, break
    if (toolNames.length >= 8 && new Set(toolNames).size <= 1) {
      const summary = `[Loop detected — same tool "${toolNames[0]}" called ${toolNames.length} times]`;
      sessionManager.append(params.sessionId, "assistant", summary);
      return { sessionId: params.sessionId, text: summary, modelRef: params.modelRef, usage: { input: 0, output: 0 } };
    }
  }

  // Max iterations reached — include last text if any
  const lastText = ctx.messages.filter(m => m.role === "assistant" && !m.content.startsWith("__TOOL_CALLS__")).pop()?.content || "";
  const allTools = [...seenTools];
  const summary = allTools.length > 0
    ? `${lastText || `[Completed after 15 tool iterations]`}\n\n_Tools used: ${allTools.join(", ")}_`
    : lastText || "Max attempts reached";
  sessionManager.append(params.sessionId, "assistant", summary);
  return { sessionId: params.sessionId, text: summary, modelRef: params.modelRef, usage: { input: 0, output: 0 } };
}

/**
 * After agent completes a task, analyze transcript and auto-create a
 * reusable skill if the task pattern is complex enough (4+ tool calls).
 * Runs as fire-and-forget — doesn't block the response.
 */
async function maybeCreateSkill(sessionId: string, modelRef: string) {
  try {
    const transcript = sessionManager.getTranscript(sessionId);
    if (!transcript || transcript.length === 0) return;

    // Count actual tool calls in transcript
    const toolMsgCount = transcript.filter(
      (m: AgentMessage) => m.role === "tool"
    ).length;
    if (toolMsgCount < 4) return; // Too simple

    const { analyzeForSkill } = await import("../skill/self-improve.ts");
    const suggestion = await analyzeForSkill(transcript as AgentMessage[], modelRef);

    if (suggestion) {
      const { agentStore } = await import("./store.ts");
      // Note: skill was already written to disk by analyzeForSkill.
      // Now notify the agent store so it shows up in the skills list.
      const { loadSkills } = await import("../skill/loader.ts");
      await loadSkills(); // Refresh skill cache
      console.log(`[agent:runner] Auto-created skill "${suggestion.name}" from session ${sessionId} (${toolMsgCount} tool calls)`);
    }
  } catch (e) {
    // Fire-and-forget — never crash the main flow
  }
}
