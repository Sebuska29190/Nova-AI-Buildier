// Brainstorm module — idea generation (1:1 z CheetahClaws)
import { streamAuxiliary } from "../auxiliary.ts";

export async function brainstorm(topic: string): Promise<string[]> {
  const prompt = `Generate 5 creative ideas about: ${topic}\nReturn a numbered list.`;
  const result = await streamAuxiliary("You are a creative brainstorming assistant.", prompt);
  return result.split("\n").filter((l) => /^\d+[.)]/.test(l.trim())).map((l) => l.replace(/^\d+[.)]\s*/, "").trim());
}
