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
import { findSkillsForContext, buildSkillContext, loadSkillByName } from "../skill/loader.ts";
import { agentMemory } from "./memory.ts";
import { toolBreaker } from "../safety/circuit-breaker-tools.ts";
import { toolAudit } from "../safety/tool-audit.ts";
import { usageTracker } from "../monitor/usage.ts";
import { workspaceManager } from "../workspace/manager.ts";
import { ledger } from "../kernel/ledger.ts";
import { EVIDENCE_PROTOCOL_PROMPT, validateReport, strikeTracker } from "./validator.ts";
import { qualityScorer } from "./scoring.ts";
import { learningLoop } from "./learning.ts";

// Session → Agent mapping for memory tools
// TTL: entries older than 30 minutes are cleaned up
const SESSION_AGENT_TTL_MS = 30 * 60 * 1000;
const sessionAgentTimestamps = new Map<string, number>();
export const sessionAgentMap = new Map<string, string>();

/** Clean up stale session→agent mappings */
function cleanupSessionAgentMap(): void {
  const now = Date.now();
  for (const [sid, ts] of sessionAgentTimestamps) {
    if (now - ts > SESSION_AGENT_TTL_MS) {
      sessionAgentMap.delete(sid);
      sessionAgentTimestamps.delete(sid);
    }
  }
}

// Cache dla wydajności — TTL 30s
let _rulesCache: string | null = null;
let _rulesCacheTime = 0;
const CACHE_TTL = 30000;

/**
 * Detect if a message is a task (needs tool use) vs simple chat (instant reply).
 * Tasks contain action verbs, file references, code keywords.
 * Chat is greetings, questions, opinions, small talk.
 */
function isTaskMessage(message: string): boolean {
  const lower = message.toLowerCase().trim();
  // Very short messages are always chat
  if (lower.length < 15) return false;
  // Task indicators — message requests concrete work
  const taskPatterns = /\b(read|write|edit|create|fix|bug|error|test|build|deploy|refactor|implement|add|remove|delete|update|check|analyze|search|find|scan|audit|review|optimize|migrate|install|configure|setup|debug|trace|profile|benchmark|deploy|publish|commit|push|pull|merge|rebase|cherry-pick|squash|revert|rollback)\b/i;
  // File/code references
  const filePattern = /\b(src\/|lib\/|test\/|\.ts|\.js|\.py|\.rs|\.go|\.tsx|\.jsx|function |class |const |import |export |async |await |return )\b/i;
  // Question words + long enough = likely needs investigation
  const questionPattern = /^(what|how|why|where|when|who|which|can you|could you|please|help me|explain|describe|tell me about)\b/i;
  return taskPatterns.test(lower) || filePattern.test(lower) || (questionPattern.test(lower) && lower.length > 30);
}

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
  // Deprecated — use findSkillsForContext or buildSkillContext instead
  return [];
}

export async function runAgent(params: RunParams): Promise<RunResult> {
  const session = sessionManager.getSession(params.sessionId);
  const messages: AgentMessage[] = [];

  // Build system prompt with global rules + skills reference
  const basePrompt = params.systemPrompt ?? session?.systemPrompt ?? "";
  const globalRules = loadGlobalRules();
  let finalSystemPrompt = basePrompt;

  // Context-aware skill injection: find skills matching the user's message
  // Skip for simple chat messages — saves tokens and latency
  if (messageIsTask) {
    const matchingSkills = findSkillsForContext(params.message, params.agentId);
    if (matchingSkills.length > 0) {
      const skillContext = buildSkillContext(matchingSkills, 4000);
      finalSystemPrompt += `\n\n${skillContext}\n\nThese skills are loaded based on your current task. Read the <instructions> of each matching skill and follow them. Use \`skills_list\` tool to see all available skills.`;
    }
  }

  if (globalRules) {
    finalSystemPrompt = `${globalRules}\n\n${finalSystemPrompt}`;
  }
  
  // ─── Evidence Protocol — mandatory for all agents ──────────
  finalSystemPrompt += EVIDENCE_PROTOCOL_PROMPT;
  
  // ─── Strike feedback — if agent has prior strikes ──────────
  if (params.agentId) {
    const feedback = strikeTracker.getFeedback(params.agentId);
    if (feedback) finalSystemPrompt += feedback;
  }
  
  if (finalSystemPrompt) {
    messages.push({ role: "system", content: finalSystemPrompt });
  }

  // ═══ EXECUTION PROTOCOL — mandatory agent behavior ═══
  // Only inject for TASK messages. Simple chat/greetings get instant replies.
  const messageIsTask = isTaskMessage(params.message);
  if (params.agentId && params.tools !== false && messageIsTask) {
    messages.push({
      role: "system",
      content: `## ⚠️ EXECUTION PROTOCOL — How You Must Behave

### Core Principle
You are an AGENT working in a project, not a chatbot answering questions.
Your job is to COMPLETE TASKS, not to DISCUSS them.

### Execution Bias
- **Act in this turn.** Don't say "I'll check" — IMMEDIATELY call workspace_read_file, workspace_search_files, or workspace_run_command.
- **Continue until done or genuinely blocked.** Don't finish with a "plan" when tools can move forward.
- **Non-final turn: use tools to advance.** Every response WITHOUT tool calls = FINAL REPORT.
- **Never give up early.** If the task needs 10+ tool calls, do them all.

### Tool Call Rules
- **Default: DO NOT narrate.** For routine calls (read, search, list) — just call them silently.
- **Narrate ONLY when it helps:** complex decisions, unexpected results, strategy changes.
- **One sentence max** for narration. No paragraphs.

### Forbidden Responses (WILL BE REJECTED)
- ❌ "Ok, let me check..." / "I'll look into that..." / "Rozumiem, zacznę od..."
- ❌ "Here's my plan:" / "Plan działania:" / "Next steps:" / "First, I'll..."
- ❌ Any response under 300 characters WITHOUT tool calls
- ❌ Any response that's a "to-do list" instead of completed work

### Required Behavior
- ✅ Call tools IMMEDIATELY. Explore, read, analyze, execute.
- ✅ When done with tools → COMPLETE report (300+ chars, concrete findings with file:line references).
- ✅ Be resourceful: don't ask, don't plan — DO IT.
- ✅ If you read a file in turn 1, REMEMBER what you found in turn 2.
- ✅ If a tool call failed, try a DIFFERENT approach, not the same one.

### Continuity Rules
- Your response WITHOUT tool calls is your FINAL RESPONSE. No follow-ups allowed.
- If you cannot complete the task, explain exactly WHAT is missing and WHY you're stuck.
- Minimum 300 characters for any final report — be thorough, be specific.`,
    });
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
    sessionAgentTimestamps.set(params.sessionId, Date.now());
    // Cleanup stale entries periodically
    if (sessionAgentMap.size > 100) cleanupSessionAgentMap();
    const memoryBlock = agentMemory.injectMemory(params.agentId);
    if (memoryBlock) {
      messages.push({ role: "system", content: memoryBlock });
    }
  }

  // Rebuild transcript into API messages
  // v2: Keep tool calls and results as context so the agent remembers what it already did.
  // This prevents the agent from re-reading the same files or repeating failed approaches.
  const transcript = sessionManager.getTranscript(params.sessionId);
  for (const entry of transcript) {
    if (entry.role === "system") continue;
    // Keep tool calls as context markers — agent sees what tools were used
    if (entry.role === "assistant" && entry.content.startsWith("__TOOL_CALLS__")) {
      const toolName = entry.content.replace("__TOOL_CALLS__", "");
      messages.push({ 
        role: "assistant", 
        content: `[Previously called tool: ${toolName}]` 
      });
      continue;
    }
    // Keep tool results as context — agent sees what was found
    if (entry.role === "tool") {
      const preview = entry.content.slice(0, 300);
      messages.push({ 
        role: "user", 
        content: `[Tool result]: ${preview}${entry.content.length > 300 ? "..." : ""}` 
      });
      continue;
    }
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
      let result = await toolLoop(params, ctx);
      breaker.recordSuccess();

      // ─── Post-run memory consolidation ────────────────────────
      if (params.agentId) {
        agentMemory.consolidateRun(params.agentId, result.text, params.runId || result.sessionId).catch(() => {});
      }

      // ─── Evidence Protocol Validation ──────────────────────────
      if (params.agentId) {
        const validation = validateReport(result.text);
        if (!validation.passed) {
          strikeTracker.addStrike(params.agentId, validation.reason);
          qualityScorer.recordFail(params.agentId, validation.evidenceRate, validation.reason);
          
          // ─── Learning Loop: auto-remediate degraded agents ───
          learningLoop.apply(params.agentId);
          
          result = { ...result, text: `⚠️ REPORT REJECTED BY VALIDATOR\n${validation.reason}\n\n---\n${result.text.slice(0, 2000)}` };
          emitEvent({ type: "event", kind: "message", sessionId: params.sessionId, runId: params.runId, data: { text: `Validator: ${validation.reason.slice(0, 500)}` } });
        } else {
          qualityScorer.recordPass(params.agentId, validation.evidenceRate, validation.claims.length);
        }
      }

      // ─── Self-learning: Auto-create skill from complex tasks ───
      maybeCreateSkill(params.sessionId, params.modelRef).catch(() => {});

      // Emit done event for Agent Work Viewer
      emitEvent({ type: "done", sessionId: params.sessionId, runId: params.runId });

      // Cleanup sessionAgentMap on success
      if (params.agentId) {
        sessionAgentMap.delete(params.sessionId);
        sessionAgentTimestamps.delete(params.sessionId);
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
    sessionAgentTimestamps.delete(params.sessionId);
  }
  throw new Error("All models failed");
}

// thisRole() removed — was dead code, all callers use direct object construction



/**
 * The tool execution loop — runs the LLM with tool definitions, handles
 * tool calls, and enforces safety limits via the ToolCircuitBreaker.
 *
 * Safety layers integrated:
 * - toolBreaker.initTask / beforeCall / afterCall / resetTask (infinite loop, depth, timeout protection)
 * - toolAudit.record() (hash-based loop detection, call logging)
 * - usageTracker.log() (API cost monitoring)
 */
async function toolLoop(params: RunParams, ctx: {
  modelRef: string;
  messages: AgentMessage[];
  signal?: AbortSignal;
  thinkingLevel?: string;
  tools: { type: "function"; function: { name: string; description?: string; parameters: Record<string, unknown> } }[];
}): Promise<RunResult> {
  const taskId = params.runId ?? `${params.sessionId}-${Date.now()}`;
  const agentId = params.agentId ?? "anonymous";
  const messageIsTask = isTaskMessage(params.message);

  // ─── Safety: Initialize tool circuit breaker ─────────────────
  toolBreaker.initTask(taskId);

  // ─── Ledger: Record agent run start ───────────────────────────
  ledger.append({
    agentId,
    action: "agent_run",
    target: params.modelRef,
    status: "started",
    detail: params.message.slice(0, 200),
  });

  // ─── Usage tracker: log the start of this run ─────────────────
  try { usageTracker.init(); } catch { /* best-effort */ }
  usageTracker.log({
    agentId,
    sessionId: params.sessionId,
    modelRef: params.modelRef,
    action: "agent_run",
    tokensInput: 0,
    tokensOutput: 0,
    cost: 0,
    durationMs: 0,
  });

  // ─── Workspace Manager: auto-init if not yet active ──────────
  try {
    if (!workspaceManager.isActive()) {
      const cwd = process.cwd();
      workspaceManager.setRoot(cwd);
    }
  } catch { /* best-effort: workspace is optional */ }

  // ─── Tool Execution State ────────────────────────────────────
  const maxIterations = 50; // matches toolBreaker maxToolCallsPerTask
  let iteration = 0;
  let fullResponse = "";
  let inputTokens = 0;
  let outputTokens = 0;

  // Resolve the LLM provider
  const resolved = registry.resolveModel(params.modelRef);
  if (!resolved) {
    toolBreaker.resetTask(taskId);
    throw new Error(`Model ${params.modelRef} not found in registry`);
  }
  const providerId = resolved.providerId;

  // ─── Main Tool Loop ─────────────────────────────────────────
  while (iteration < maxIterations) {
    // Check abort signal
    if (params.signal?.aborted) {
      toolBreaker.resetTask(taskId);
      return {
        sessionId: params.sessionId,
        text: fullResponse || "⚠️ Agent run was aborted.",
        modelRef: params.modelRef,
        usage: { input: inputTokens, output: outputTokens },
      };
    }

    // ─── Wrap-up prompt v2: earlier nudge to prevent hitting iteration limit ──
    if (iteration === 10) {
      ctx.messages.push({
        role: "user",
        content: "⚠️ You are at iteration 10 of 50. Please produce your final answer/summary NOW based on what you have gathered so far. Do NOT call any more tools — just write your report directly.",
      });
    }

    // ═══ FORCE EXIT v2 at iteration 15: remove all tools ═══
    // If agent ignores the wrap-up prompt, force it to stop by removing
    // tools entirely — the LLM can't call what isn't available.
    if (iteration >= 15) {
      ctx.tools = [];
      ctx.messages.push({
        role: "system",
        content: "🔴 FINAL WARNING: All tools have been removed. You MUST produce your complete final answer NOW. No more investigation is possible. Write your report with whatever information you have.",
      });
    }

    // ─── Safety: Check circuit breaker before each LLM call ───
    const startTime = Date.now();
    try {
      toolBreaker.beforeCall({
        taskId,
        agentId,
        toolName: "__llm_call__",
        toolParams: {},
        paramsHash: `iter_${iteration}`,
        iteration,
      });
    } catch (breakerError: unknown) {
      // Circuit breaker tripped — stop gracefully
      toolBreaker.resetTask(taskId);
      const msg = safeMessage(breakerError);
      emitEvent({
        type: "event",
        kind: "message",
        sessionId: params.sessionId,
        data: { text: `⚠ Circuit breaker: ${msg}` },
      });
      return {
        sessionId: params.sessionId,
        text: fullResponse || `⚠️ ${msg}`,
        modelRef: params.modelRef,
        usage: { input: inputTokens, output: outputTokens },
      };
    }

    // ─── Call the LLM ─────────────────────────────────────────
    const piResult = await piHarness.send(ctx);
    inputTokens += piResult.usage?.inputTokens ?? 0;
    outputTokens += piResult.usage?.outputTokens ?? 0;

    // ─── Usage tracking ───────────────────────────────────────
    usageTracker.log({
      agentId,
      sessionId: params.sessionId,
      modelRef: params.modelRef,
      action: "api_call",
      tokensInput: piResult.usage?.inputTokens ?? 0,
      tokensOutput: piResult.usage?.outputTokens ?? 0,
      cost: (piResult.usage?.inputTokens ?? 0) * 0.000002 + (piResult.usage?.outputTokens ?? 0) * 0.00001,
      durationMs: Date.now() - startTime,
    });

    const content = piResult.content ?? "";

    // ─── Check for tool calls ─────────────────────────────────
    if (piResult.toolCalls && piResult.toolCalls.length > 0) {
      for (const tc of piResult.toolCalls) {
        const toolStart = Date.now();
        const toolName = tc.function?.name ?? tc.name ?? "unknown";
        const toolArgs = tc.function?.arguments ?? tc.arguments ?? {};
        const argsStr = typeof toolArgs === "string" ? toolArgs : JSON.stringify(toolArgs);
        let parsedArgs: Record<string, unknown>;
        try {
          parsedArgs = typeof toolArgs === "string" ? JSON.parse(toolArgs) : toolArgs;
        } catch {
          parsedArgs = {};
        }

        // ─── Safety: Check circuit breaker for this tool call ──
        const paramsHash = toolAudit.hashParams(parsedArgs);
        try {
          toolBreaker.beforeCall({
            taskId,
            agentId,
            toolName,
            toolParams: parsedArgs,
            paramsHash,
            iteration,
          });
        } catch (toolBreakerError: unknown) {
          // Log the breach and break out
          toolAudit.record({
            taskId,
            agentId,
            toolName,
            paramsHash,
            resultPreview: `❌ Circuit breaker: ${safeMessage(toolBreakerError)}`,
            durationMs: Date.now() - toolStart,
            success: false,
            iteration,
          });
          toolBreaker.afterCall({ taskId, toolName });
          throw toolBreakerError; // Let outer catch handle it
        }

        // ─── Execute the tool ─────────────────────────────────
        let resultStr: string;
        let success = false;
        try {
          const toolFn = getTool(toolName);
          if (!toolFn) {
            resultStr = `❌ Tool "${toolName}" not found. Available tools: ${listTools().map(t => t.name).join(", ")}`;
          } else {
            resultStr = await toolFn.execute(parsedArgs, { sessionId: params.sessionId });
          }
          success = true;
        } catch (toolError: unknown) {
          resultStr = `❌ Error executing ${toolName}: ${safeMessage(toolError)}`;
          success = false;
        }

        const toolDuration = Date.now() - toolStart;

        // ─── Audit logging ────────────────────────────────────
        toolAudit.record({
          taskId,
          agentId,
          toolName,
          paramsHash,
          resultPreview: resultStr.slice(0, 200),
          durationMs: toolDuration,
          success,
          iteration,
        });

        // ─── Emit tool_result event for real-time UI visibility ──
        emitEvent({
          type: "event",
          kind: "tool_result",
          sessionId: params.sessionId,
          runId: params.runId,
          data: {
            toolName,
            success,
            durationMs: toolDuration,
            resultPreview: resultStr.slice(0, 200),
          },
        });

        // ─── Usage tracking for tool call ──────────────────────
        usageTracker.log({
          agentId,
          sessionId: params.sessionId,
          modelRef: params.modelRef,
          action: "tool_call",
          tokensInput: 0,
          tokensOutput: 0,
          cost: 0,
          durationMs: toolDuration,
        });

        // ─── Safety: After-call hook ──────────────────────────
        toolBreaker.afterCall({ taskId, toolName });

        // ─── Save tool activity to session ──────────────────────
        try {
          sessionManager.appendToolActivity(
            params.sessionId,
            agentId,
            toolName,
            argsStr,
            resultStr,
            success,
            toolDuration,
            iteration
          );
        } catch { /* best-effort: tool activity is non-critical */ }

        // ─── Append tool result to messages ───────────────────
        ctx.messages.push({
          role: "assistant",
          content: `__TOOL_CALLS__${tc.id ?? toolName}`,
          tool_calls: [{
            id: tc.id ?? `call_${iteration}`,
            type: "function",
            function: { name: toolName, arguments: argsStr },
          }],
        });
        ctx.messages.push({
          role: "tool",
          content: resultStr,
          tool_call_id: tc.id ?? `call_${iteration}`,
        });
      }

      iteration++;
      continue; // Go back to LLM call with tool results
    }

    // ═══ Smart exit detection v2: don't let AGENTS quit early ═══
    // CRITICAL: This only applies to agent INVESTIGATIONS (agentId set, not "default").
    // Regular chat must exit immediately — users expect instant answers to simple questions.
    // v2: Stricter min rounds, plan detection, completion recognition.
    
    const isAgentMode = agentId && agentId !== "default";
    
    if (isAgentMode && messageIsTask) {
      // TASK MODE: require deeper investigation
      const minRounds = 3;  // reduced from 6 — enough for most tasks
      const isShortResponse = content.length < 200;  // reduced from 300
      const looksIncomplete = /^(ok|rozumiem|zaraz|sprawdzam|let me|i'll|i will|checking|looking|starting|begin|first|sure|absolutely|of course)/i.test(content.trim());
      const looksLikePlan = /^(plan|next steps|here's what|proposed|approach|strategy|roadmap|will do|going to|first i'll|start by|to do|todo|checklist)/i.test(content.trim());
      const noRealOutput = content.trim().length < 80;  // reduced from 100
      const hasDoneWork = iteration > 0;
      const looksComplete = /^(completed|fixed|done|implemented|created|updated|changed|resolved|analyzed|found|here's what|summary|report|findings)/i.test(content.trim());
      
      if (iteration < minRounds || isShortResponse || looksIncomplete || looksLikePlan || noRealOutput) {
        // ALLOW completion if agent looks done AND has done real work
        if (looksComplete && hasDoneWork && !isShortResponse) {
          // Fall through to success — agent finished properly
        } else {
          const reason = noRealOutput ? "empty response"
            : looksLikePlan ? "plan instead of execution"
            : looksIncomplete ? "placeholder reply"
            : isShortResponse ? `too short (${content.length} chars, need 200+)`
            : `need ${minRounds - iteration} more investigation rounds`;
          
          ctx.messages.push({
            role: "user",
            content: `⚠️ REJECTED: ${reason}. Continue working — use tools, gather evidence, produce a COMPREHENSIVE final report with concrete findings.`,
          });
          iteration++;
          continue;
        }
      }
    } else if (isAgentMode && !messageIsTask) {
      // CHAT MODE: allow instant exit on first turn with any substantive response
      if (iteration === 0 && content.length > 20) {
        // Simple chat — exit immediately
      } else if (iteration > 0 && content.length > 20) {
        // Had tool calls but now responding — allow exit
      }
    }
    
    fullResponse = content;

    // ─── Safety: Reset circuit breaker ─────────────────────────
    toolBreaker.resetTask(taskId);

    // ─── Ledger: Record completion ────────────────────────────
    ledger.append({
      agentId,
      action: "agent_run",
      target: params.modelRef,
      status: "completed",
      detail: fullResponse.slice(0, 200),
    });

    return {
      sessionId: params.sessionId,
      text: fullResponse,
      modelRef: params.modelRef,
      usage: { input: inputTokens, output: outputTokens },
    };
  }

  // ─── Max iterations reached without final response ─────────
  toolBreaker.resetTask(taskId);
  ledger.append({
    agentId,
    action: "agent_run",
    target: params.modelRef,
    status: "failed",
    detail: "Max tool call iterations reached without final response",
  });

  return {
    sessionId: params.sessionId,
    text: fullResponse || "⚠️ Agent reached maximum tool call limit without a final response.",
    modelRef: params.modelRef,
    usage: { input: inputTokens, output: outputTokens },
  };
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
