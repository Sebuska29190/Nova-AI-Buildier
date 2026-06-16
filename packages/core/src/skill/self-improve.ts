/**
 * Self-Improving Skills — agent automatically creates skills from successful complex tasks.
 * Inspired by Hermes Agent's skill_manager_tool.py / skill_commands.py
 *
 * When an agent completes a task involving 4+ tool calls, the skill manager analyzes
 * the transcript and suggests creating a reusable SKILL.md for future use.
 */

import { join, dirname } from "node:path";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import type { AgentMessage } from "@nova/sdk";
import { registerTool } from "../plugin/tools.ts";

const SKILLS_DIR = join(process.cwd(), "skills");
if (!existsSync(SKILLS_DIR)) mkdirSync(SKILLS_DIR, { recursive: true });

export interface SkillSuggestion {
  name: string;
  description: string;
  triggers: string[];
  skillPath: string;
  confidence: number; // 0-1
}

/**
 * Analyze a conversation transcript to detect if it contains a reusable pattern
 * worth turning into a skill.
 */
export async function analyzeForSkill(
  transcript: AgentMessage[],
  modelRef: string = "deepseek/deepseek-chat"
): Promise<SkillSuggestion | null> {
  // Only consider transcripts with 4+ tool calls (complex enough to be reusable)
  const toolMessages = transcript.filter(
    (m) => m.role === "tool" || (m.role === "assistant" && m.content?.includes("tool_calls"))
  );
  if (toolMessages.length < 4) return null;

  // Extract user intent (first user message)
  const userIntent = transcript.find((m) => m.role === "user")?.content?.slice(0, 500) || "";

  // Build analysis prompt
  const analysisPrompt = `Analyze this conversation and determine if it contains a reusable procedural skill.

User request: ${userIntent}

Conversation involved ${toolMessages.length} tool calls. The agent successfully completed the task.

Your job: Determine if this task pattern is worth turning into a reusable SKILL.md file.

Criteria for a good skill:
- The task is not trivial (requires multiple steps)
- The approach is generalizable (not dependent on one-time context like specific filenames)
- The skill would save significant time if reused

If YES, output a JSON object:
{
  "shouldCreate": true,
  "name": "hyphenated-skill-name",
  "description": "Short one-line description",
  "triggers": ["trigger phrase 1", "trigger phrase 2"],
  "instructions": "## Steps\\n1. Describe the first step\\n2. Describe the second step\\n\\n## Notes\\n- Add any important caveats or tips",
  "confidence": 0.8
}

If NO, output:
{
  "shouldCreate": false,
  "reason": "why not"
}

Output ONLY the JSON object, no other text.`;

  try {
    const { piHarness } = await import("../harness/pi.ts");
    const { registry } = await import("../plugin/registry.ts");

    // Resolve provider from modelRef (e.g. "deepseek/deepseek-chat" -> providerId "deepseek")
    const resolved = registry.resolveModel(modelRef);
    const providerId = resolved?.providerId;

    const result = await piHarness.send({
      modelRef,
      providerId,
      messages: [{ role: "user", content: analysisPrompt }],
      temperature: 0.3,
      maxTokens: 2000,
    } as any);

    const text = result.text || "";
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.shouldCreate || !parsed.name) return null;

    // Generate SKILL.md content
    const skillContent = generateSkillMd(parsed);
    const skillDir = join(SKILLS_DIR, parsed.name);
    const skillPath = join(skillDir, "SKILL.md");

    if (!existsSync(skillDir)) mkdirSync(skillDir, { recursive: true });
    writeFileSync(skillPath, skillContent);

    console.log(`[skill:self-improve] Created skill: ${parsed.name} (confidence: ${parsed.confidence})`);

    return {
      name: parsed.name,
      description: parsed.description,
      triggers: parsed.triggers || [],
      skillPath,
      confidence: parsed.confidence,
    };
  } catch (e) {
    console.warn(`[skill:self-improve] Analysis failed: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

function generateSkillMd(data: any): string {
  const category = data.category || "auto-generated";
  return [
    `---`,
    `name: "${data.name}"`,
    `description: "${data.description}"`,
    `triggers: [${(data.triggers || []).map((t: string) => `"${t}"`).join(", ")}]`,
    `category: "${category}"`,
    `source: "auto-generated"`,
    `confidence: ${data.confidence}`,
    `created: "${new Date().toISOString()}"`,
    `---`,
    ``,
    `# ${data.name.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}`,
    ``,
    `> ${data.description}`,
    ``,
    data.instructions || `## Steps\n\n1. Follow the approach from the original task execution.\n\n## Notes\n\n- Automatically generated from successful task execution.`,
  ].join("\n");
}

/**
 * Show skill suggestions to the agent in the final response.
 * Called by runner after agent completes.
 */
export function wrapResultWithSuggestions(text: string, suggestion: SkillSuggestion | null): string {
  if (!suggestion) return text;

  const note = [
    ``,
    `---`,
    `💡 **Skill Learned:** I created a reusable skill for this task:`,
    `- **${suggestion.name}** — ${suggestion.description}`,
    `- Location: \`${suggestion.skillPath}\``,
    `- Triggers: ${suggestion.triggers.join(", ")}`,
    `- Confidence: ${Math.round(suggestion.confidence * 100)}%`,
    ``,
    `This skill will be available in future conversations.`,
    ``,
  ].join("\n");

  return text + "\n" + note;
}

// Register tools for the agent
registerTool({
  name: "skill_analyze_and_create",
  description:
    "After completing a complex task, analyze if it should become a reusable skill. Creates SKILL.md automatically if the pattern is worthwhile.",
  parameters: {
    type: "object",
    properties: {
      session_id: {
        type: "string",
        description: "Session ID to analyze",
      },
    },
    required: ["session_id"],
    additionalProperties: false,
  },
  async execute(args) {
    const { session_id } = args as { session_id: string };
    const { sessionManager } = await import("../session/manager.ts");
    const transcript = sessionManager.getTranscript(session_id);

    if (!transcript || transcript.length === 0) {
      return "No transcript found for this session.";
    }

    const suggestion = await analyzeForSkill(transcript as AgentMessage[]);
    if (!suggestion) {
      return "No reusable skill pattern detected in this session.";
    }

    return [
      `✅ Created new skill: **${suggestion.name}**`,
      `   Description: ${suggestion.description}`,
      `   Path: ${suggestion.skillPath}`,
      `   Triggers: ${suggestion.triggers.join(", ")}`,
      `   Confidence: ${Math.round(suggestion.confidence * 100)}%`,
    ].join("\n");
  },
});

registerTool({
  name: "skill_delete",
  description: "Delete a user-created or auto-generated skill",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Skill name (hyphenated)" },
    },
    required: ["name"],
    additionalProperties: false,
  },
  async execute(args) {
    const { name } = args as { name: string };
    const skillDir = join(SKILLS_DIR, name);
    if (!existsSync(skillDir)) return `❌ Skill "${name}" not found at ${skillDir}`;

    // Only allow deleting auto-generated skills
    const skillMd = join(skillDir, "SKILL.md");
    if (existsSync(skillMd)) {
      const content = readFileSync(skillMd, "utf-8");
      if (!content.includes("source: \"auto-generated\"")) {
        return `❌ Cannot delete built-in skill "${name}". Only auto-generated skills can be deleted.`;
      }
    }

    try {
      for (const file of [skillMd]) {
        if (existsSync(file)) {
          const { unlink } = await import("node:fs/promises");
          await unlink(file);
        }
      }
      const { rmdir } = await import("node:fs/promises");
      await rmdir(skillDir);
      return `✅ Skill "${name}" deleted.`;
    } catch (e) {
      return `❌ Failed to delete: ${e instanceof Error ? e.message : e}`;
    }
  },
});
