// Auxiliary model — cheap/fast side model for simple tasks (1:1 z CheetahClaws)
import { registry } from "./plugin/registry.ts";

const CHEAP_MODELS = ["deepseek/deepseek-chat", "openai/gpt-4o-mini", "gemini/gemini-2.0-flash"];

export async function streamAuxiliary(system: string, prompt: string): Promise<string> {
  for (const modelRef of CHEAP_MODELS) {
    const resolved = registry.resolveModel(modelRef);
    if (!resolved) continue;
    try {
      let result = "";
      await resolved.provider.stream({
        model: resolved.model.id,
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
        onChunk: (chunk: any) => { if (chunk.type === "text") result += chunk.text; },
      });
      if (result) return result;
    } catch {}
  }
  return "";
}
