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
import { agentMemory } from "./memory.ts";
import { toolBreaker } from "../safety/circuit-breaker-tools.ts";
import { toolAudit } from "../safety/tool-audit.ts";
import { usageTracker } from "../monitor/usage.ts";
import { workspaceManager } from "../workspace/manager.ts";

// Session → Agent mapping for memory tools
export const sessionAgentMap = new Map<string, string>();

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
  agentId?: string; // Agent ID for persistent memory
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

  // ─── Current date/time injection ─────────────────────────────
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  messages.push({
    role: "system",
    content: `\n## Current Date & Time\nToday is **${dateStr}**, current time is **${timeStr}**.\nYour knowledge cutoff is earlier than today — always use the current date for any time-sensitive information, news, prices, or events.`,
  });

  // ─── Agent Persistent Memory ──────────────────────────────────
  if (params.agentId) {
    sessionAgentMap.set(params.sessionId, params.agentId);
    const memoryBlock = agentMemory.injectMemory(params.agentId);
    if (memoryBlock) {
      messages.push({ role: "system", content: memoryBlock });
    }
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

      // ─── Post-run memory consolidation ────────────────────────
      if (params.agentId) {
        agentMemory.consolidateRun(params.agentId, result.text, params.runId || result.sessionId).catch(() => {});
      }

      // ─── Self-learning: Auto-create skill from complex tasks ───
      maybeCreateSkill(params.sessionId, params.modelRef).catch(() => {});

      // Emit done event for Agent Work Viewer
      emitEvent({ type: "done", sessionId: params.sessionId, runId: params.runId });

      // Cleanup sessionAgentMap on success
      if (params.agentId) {
        sessionAgentMap.delete(params.sessionId);
      }

      return result;
    } catch (e: unknown) {
      const classified = classifyError(e, providerId);
      breaker.recordFailure();
      emitEvent({ type: "event", kind: "message", sessionId: params.sessionId, data: { text: `â ${classified.category}: ${classified.recoveryHint}` } });
      emitEvent({ type: "error", sessionId: params.sessionId, runId: params.runId, message: safeMessage(e) });
      if (candidates.length === 1) {
        return { sessionId: params.sessionId, text: `Error: ${safeMessage(e)}`, modelRef, usage: { input: 0, output: 0 } };
      }
      continue;
    }
  }

  // Cleanup sessionAgentMap AFTER all model candidates are exhausted
  if (params.agentId) {
    sessionAgentMap.delete(params.sessionId);
  }
  throw new Error("All models failed");
}

// thisRole() removed — was dead code, all callers use direct object construction

async function toolLoop(params: RunParams, ctx: { modelRef: string; messages: AgentMessage[]; signal?: AbortSignal; thinkingLevel?: string; tools: { type: "function"; function: { name: string; description?: string; parameters: Record<string, unknown> } }[] }): Promise<RunResult> {
  // ─── Safety Middleware initialization ──────────────────────────
  const taskId = params.sessionId;
  const agentId = params.agentId || "default";
  toolBreaker.initTask(taskId);

  const seenTools = new Set<string>();
  const fileMutations: { action: string; path: string; detail: string }[] = [];

  const FILE_TOOLS = new Set(["workspace_write_file", "workspace_edit_file", "workspace_delete_file", "write_file", "patch", "delete_file"]);

  function trackFileMutation(toolName: string, args: Record<string, unknown>, result: string): void {
    if (!FILE_TOOLS.has(toolName)) return;
    const path = (args.path as string) || "";
    if (toolName === "workspace_write_file" || toolName === "write_file") {
      const content = (args.content as string) || "";
      fileMutations.push({ action: "✏️ Written", path, detail: `${content.length} bytes` });
    } else if (toolName === "workspace_edit_file" || toolName === "patch") {
      fileMutations.push({ action: "🔧 Edited", path, detail: `find/replace` });
    } else if (toolName === "workspace_delete_file" || toolName === "delete_file") {
      fileMutations.push({ action: "🗑️ Deleted", path, detail: `` });
    }
  }

  function buildMutationFooter(): string {
    if (fileMutations.length === 0) return "";
    const lines = fileMutations.map(m => `  ${m.action} \`${m.path}\`${m.detail ? ` — ${m.detail}` : ""}`);
    return `\n\n📁 **File changes** (${fileMutations.length}):\n${lines.join("\n")}`;
  }

  for (let iteration = 0; iteration < 50; iteration++) {
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

    // At iteration 20, inject a "wrap up" prompt to prevent hitting the limit
    if (iteration === 20) {
      const wrapUpMsg: AgentMessage = {
        role: "user",
        content: "You are approaching the iteration limit. Please provide your final answer/summary now based on what you've gathered so far. Do not call any more tools — just write the report directly."
      };
      ctx.messages.push(wrapUpMsg);
      sessionManager.append(params.sessionId, "user", wrapUpMsg.content);
      continue;
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

      // ─── Safety Middleware: Circuit Breaker check ─────────────
      const callCtx: import("../safety/circuit-breaker-tools.ts").ToolCallContext = {
        taskId: params.runId || params.sessionId,
        agentId: sessionAgentMap.get(params.sessionId) || agentId || "unknown",
        toolName: tc.function.name,
        toolParams: parsedArgs,
        paramsHash: toolAudit.hashParams(parsedArgs),
        iteration,
      };
      toolBreaker.beforeCall(callCtx);

      // Premium: Emit tool_call event BEFORE execution (shows what agent is doing)
      emitEvent({ type: "event", kind: "tool_call", sessionId: params.sessionId, runId: params.runId, data: {
        name: tc.function.name,
        arguments: parsedArgs,
        iteration,
      } });

      // Execute tool with timeout
      const toolStartTime = Date.now();
      try {
        let toolTimeout: ReturnType<typeof setTimeout> | undefined;
        const resultText = await Promise.race([
          tool.execute(parsedArgs, { sessionId: params.sessionId, signal: params.signal }),
          new Promise<string>((_, reject) => { toolTimeout = setTimeout(() => reject(new Error(`Tool ${tc.function.name} timed out after 60s`)), 60000); }),
        ]);
        if (toolTimeout) clearTimeout(toolTimeout);
        const toolDurationMs = Date.now() - toolStartTime;
        trackFileMutation(tc.function.name, parsedArgs, resultText);

        // LSP diagnostics after file writes
        if (FILE_TOOLS.has(tc.function.name) && resultText.includes("✅")) {
          try {
            const { runDiagnostics, formatDiagnostics } = await import("../lsp-diagnostics.ts");
            const filePath = (parsedArgs.path as string) || "";
            const wsRoot = workspaceManager?.getRoot?.();
            if (filePath && wsRoot) {
              const diags = runDiagnostics(filePath, wsRoot);
              if (diags.length > 0) {
                const diagMsg = formatDiagnostics(diags);
                fileMutations.push({ action: "🔍 Lint", path: filePath, detail: diagMsg.replace(/\n/g, "; ") });
              }
            }
          } catch {} // diagnostics are non-blocking
        }

        ctx.messages.push({ role: "tool", tool_call_id: tc.id, content: resultText.slice(0, 10000), name: tc.function.name });
        sessionManager.append(params.sessionId, "tool", resultText.slice(0, 10000), tc.id, tc.function.name);
        // Premium: Emit rich tool_result event
        emitEvent({ type: "event", kind: "tool_result", sessionId: params.sessionId, runId: params.runId, data: {
          toolCallId: tc.id,
          toolName: tc.function.name,
          success: true,
          durationMs: toolDurationMs,
          resultPreview: resultText.slice(0, 200),
        } });

        // ─── Audit & Usage Logging ──────────────────────────────
        const auditAgentId = sessionAgentMap.get(params.sessionId) || agentId;
        toolAudit.record({
          taskId: params.runId || params.sessionId,
          agentId: auditAgentId || "unknown",
          toolName: tc.function.name,
          paramsHash: toolAudit.hashParams(parsedArgs as Record<string, unknown>),
          resultPreview: resultText.slice(0, 200),
          durationMs: toolDurationMs,
          success: true,
          iteration,
        });
        usageTracker.log({
          agentId: agentId || undefined,
          sessionId: params.sessionId,
          modelRef: params.modelRef,
          action: "tool_call",
          durationMs: toolDurationMs,
        });

        // ─── Safety Middleware: afterCall unwind ──────────────
        toolBreaker.afterCall({ taskId: params.runId || params.sessionId, toolName: tc.function.name });
      } catch (e: unknown) {
        const toolDurationMs = Date.now() - toolStartTime;
        const errMsg = `Error executing ${tc.function.name}: ${safeMessage(e)}`;
        console.error(`[toolLoop] Tool execution error: ${errMsg}`);
        ctx.messages.push({ role: "tool", tool_call_id: tc.id, content: errMsg, name: tc.function.name });
        sessionManager.append(params.sessionId, "tool", errMsg, tc.id, tc.function.name);
        // Premium: Emit tool_result for failed tool
        emitEvent({ type: "event", kind: "tool_result", sessionId: params.sessionId, runId: params.runId, data: {
          toolCallId: tc.id, toolName: tc.function.name, success: false,
          durationMs: toolDurationMs, error: safeMessage(e),
        } });

        // ─── Audit Failure ──────────────────────────────────────
        const failAgentId = sessionAgentMap.get(params.sessionId);
        toolAudit.record({
          taskId: params.runId || params.sessionId,
          agentId: failAgentId || "unknown",
          toolName: tc.function.name,
          paramsHash: toolAudit.hashParams(parsedArgs as Record<string, unknown>),
          resultPreview: errMsg.slice(0, 200),
          durationMs: toolDurationMs,
          success: false,
          iteration,
        });

        // ─── Safety Middleware: afterCall unwind (failure) ────
        toolBreaker.afterCall({ taskId: params.runId || params.sessionId, toolName: tc.function.name });
      }
    }

    // Track all tools seen across iterations
    for (const name of toolNames) seenTools.add(name);

    // Detect tool loops — if same exact tool called 8+ times in a single iteration, break
    if (toolNames.length >= 8 && new Set(toolNames).size <= 1) {
      const summary = `[Loop detected — same tool "${toolNames[0]}" called ${toolNames.length} times]`;
      sessionManager.append(params.sessionId, "assistant", summary);
      return { sessionId: params.sessionId, text: summary + buildMutationFooter(), modelRef: params.modelRef, usage: { input: 0, output: 0 } };
    }
  }

  // Max iterations reached — include last text if any
  const lastText = ctx.messages.filter(m => m.role === "assistant" && !m.content.startsWith("__TOOL_CALLS__")).pop()?.content || "";
  const allTools = [...seenTools];
  const summary = allTools.length > 0
    ? `${lastText || `[Completed after tool iterations]`}\n\n_Tools used: ${allTools.join(", ")}_`
    : lastText || "Max attempts reached";
  const fullText = summary + buildMutationFooter();
  sessionManager.append(params.sessionId, "assistant", fullText);

  // Fire-and-forget: compress long sessions in background
  try {
    const { maybeCompressSession } = await import("../trajectory-compression.ts");
    maybeCompressSession(params.sessionId, params.modelRef).catch(() => {});
  } catch {}

  return { sessionId: params.sessionId, text: fullText, modelRef: params.modelRef, usage: { input: 0, output: 0 } };
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
