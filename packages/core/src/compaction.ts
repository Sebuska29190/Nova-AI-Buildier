// Context window management — two-layer compression (1:1 z CheetahClaws)
import { registry } from "./plugin/registry.ts";

export function estimateTokens(messages: any[]): number {
  let count = 0;
  for (const m of messages) {
    count += (m.content || "").length / 4;
    if (m.tool_calls) count += JSON.stringify(m.tool_calls).length / 4;
  }
  return Math.ceil(count);
}

export function getContextLimit(modelRef: string): number {
  const resolved = registry.resolveModel(modelRef);
  return resolved?.model?.contextWindow ?? 128000;
}

export function snipOldToolResults(messages: any[], maxTokens: number): any[] {
  let total = estimateTokens(messages);
  if (total <= maxTokens) return messages;

  const result = [...messages];
  // Snip old tool results (keep structure, remove content)
  for (let i = 0; i < result.length - 3; i++) {
    if (result[i]?.role === "tool" && result[i]?.tool_call_id) {
      const originalLen = (result[i].content || "").length;
      if (originalLen > 50) {
        result[i] = { ...result[i], content: result[i].content.slice(0, 50) + `… [${originalLen} chars snipped]` };
        total = estimateTokens(result);
        if (total <= maxTokens) break;
      }
    }
  }
  return result;
}

export function maybeCompact(messages: any[], modelRef: string): { messages: any[]; compacted: boolean } {
  const limit = getContextLimit(modelRef);
  const threshold = Math.floor(limit * 0.7);
  const total = estimateTokens(messages);

  if (total <= threshold) return { messages, compacted: false };

  // Layer 1: Snip old tool results
  const snipped = snipOldToolResults(messages, threshold);
  return { messages: snipped, compacted: true };
}
