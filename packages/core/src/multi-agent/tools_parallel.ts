import { registerTool } from "../plugin/tools.ts";

registerTool({
  name: "spawn_parallel",
  description:
    "Spawn multiple sub-agents in parallel for divide-and-conquer tasks. Each gets the same system prompt but a different subtask. Results are collected and optionally merged.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Base name for the worker group" },
      systemPrompt: { type: "string", description: "System prompt shared by all workers" },
      tasks: {
        type: "array",
        items: { type: "string" },
        description: "Array of subtask messages — one per worker",
      },
      modelRef: { type: "string", description: "Model (default: deepseek/deepseek-chat)" },
      merge: { type: "boolean", description: "If true, merge all results into a single summary (default: true)" },
    },
    required: ["name", "systemPrompt", "tasks"],
    additionalProperties: false,
  },
  async execute(args: {
    name: string;
    systemPrompt: string;
    tasks: string[];
    modelRef?: string;
    merge?: boolean;
  }) {
    const { spawnParallel, mergeResults } = await import("./subagent.ts");

    const results = await spawnParallel(
      args.name,
      args.systemPrompt,
      args.tasks,
      args.modelRef || "deepseek/deepseek-chat",
      4
    );

    const summary = results.map((r) => {
      if (r.error) return `- ${r.name}: ERROR — ${r.error}`;
      return `- ${r.name}: ${r.result.slice(0, 300)}...`;
    }).join("\n");

    let prefix = `✅ ${results.length} parallel workers completed:\n\n${summary}`;

    if (args.merge !== false && results.length > 1) {
      const merged = await mergeResults(results, args.modelRef);
      prefix += `\n\n## Merged Summary\n\n${merged}`;
    }

    return prefix;
  },
});
