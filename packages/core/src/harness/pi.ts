import type { HarnessV2, HarnessContext, HarnessResult, HarnessOutcome, ToolCall } from "@nova/sdk";
import { registry } from "../plugin/registry.ts";
import { emitEvent } from "../event-bus/index.ts";
import { loadRaw } from "../config/provider-config.ts";

// Cache provider config to avoid disk I/O + decryption on every send
let _cachedConfig: { providers: Record<string, { maxTokens?: number }> } | null = null;
let _configCacheTime = 0;
const CONFIG_CACHE_TTL = 30000;

function getCachedConfig(): { providers: Record<string, { maxTokens?: number }> } {
  if (_cachedConfig && Date.now() - _configCacheTime < CONFIG_CACHE_TTL) return _cachedConfig;
  _cachedConfig = loadRaw();
  _configCacheTime = Date.now();
  return _cachedConfig;
}

export const piHarness: HarnessV2 = {
  id: "pi",
  async prepare() {},
  async start() {},

  async send(ctx: HarnessContext): Promise<HarnessResult> {
    const provider = registry.getProvider(ctx.providerId);
    if (!provider) throw new Error(`Provider ${ctx.providerId} not found`);
    const modelId = ctx.modelRef.split("/").pop() ?? ctx.modelRef;

    const toolCallMap = new Map<string, ToolCall>();
    let lastToolCallId = "";
    let text = "";

    const sessionId = (ctx.config as any)?.sessionId || "unknown";
    const runId = (ctx.config as any)?.runId;

    // Load maxTokens from saved provider config (cached)
    const configStore = getCachedConfig();
    const savedConfig = configStore.providers[ctx.providerId];
    const maxTokens = savedConfig?.maxTokens;

    await provider.stream({
      model: modelId,
      messages: ctx.messages,
      tools: ctx.tools,
      thinking: ctx.modelRef.includes("o1") || ctx.modelRef.includes("o3") || ctx.modelRef.includes("claude-sonnet-4") ? ctx.thinkingLevel : undefined,
      signal: ctx.signal,
      maxTokens,
      onChunk: (chunk) => {
        switch (chunk.type) {
          case "text":
            text += chunk.text;
            emitEvent({ type: "event", kind: "assistant", sessionId, runId, data: { text: chunk.text } });
            break;
          case "thinking":
            emitEvent({ type: "event", kind: "thinking", sessionId, runId, data: { text: chunk.text || "" } });
            break;
          case "tool_call": {
            // Accumulate tool call deltas across chunks
            const toolId = chunk.id || lastToolCallId;
            if (!toolId && !chunk.args) break; // Skip empty chunks
            if (toolId) lastToolCallId = toolId;
            const finalId = toolId || lastToolCallId || "tc_" + Date.now();
            const existing = toolCallMap.get(finalId);
            if (existing) {
              if (chunk.args) existing.function.arguments += chunk.args;
              if (chunk.name) existing.function.name = chunk.name;
            } else {
              toolCallMap.set(finalId, {
                id: finalId,
                type: "function",
                function: { name: chunk.name || "", arguments: chunk.args || "" },
              });
            }
            emitEvent({ type: "event", kind: "tool_call", sessionId, runId, data: { toolCallId: finalId, toolName: chunk.name || "", args: chunk.args || "" } });
            break;
          }
          case "error": throw new Error(chunk.message);
          case "usage": break;
          case "done": break;
        }
      },
    });

    const toolCalls = [...toolCallMap.values()];
    emitEvent({ type: "done", sessionId, runId });
    return { text, toolCalls, stopReason: toolCalls.length > 0 ? "tool_calls" : "stop" };
  },

  resolveOutcome(result: HarnessResult): HarnessOutcome {
    if (!result.text && result.toolCalls.length === 0) return { kind: "retry", reason: "empty" };
    return { kind: "success", result };
  },

  async cleanup() {},
};

export default piHarness;
