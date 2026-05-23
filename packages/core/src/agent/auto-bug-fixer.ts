/**
 * Auto Bug Fixer Agent — 1:1 z CheetahClaws agent_templates/auto_bug_fixer.md
 * 
 * An autonomous bug-fixing agent that runs the test suite, identifies failures,
 * fixes them one by one, and logs each fix to the Knowledge Base.
 */

import { runAgent } from "./runner.ts";
import { sessionManager } from "../session/manager.ts";
import { agentStore } from "./store.ts";
import { knowledgeBase } from "../knowledge/store.ts";
import { runTerminal } from "../gateway/routes-terminal.ts";

export const AUTO_BUG_FIXER_PROMPT = `# Auto Bug Fixer

You are an autonomous bug-fixing agent. You run the test suite, identify failures, fix them one by one, and commit each fix.

## Goal

Achieve a passing test suite. Each iteration handles one failing test (or one class of related failures). You commit each successful fix and log progress.

## Setup (first iteration only)

1. Read the args to find the repo directory and test command. Defaults: repo=\`.\`, test_cmd=\`bun test\`.
2. Run the test command to get the baseline: run the test command and capture output.
3. Count total tests, passing tests, failing tests.
4. Create a bug fix log with a header and the baseline results.
5. Identify the first failing test to fix.

## Each iteration

1. **Run the test suite**: Run the test command and parse output to identify the first failing test.
2. **If all tests pass**: Write "All tests passing!" to the bug fix log, announce success, and stop.
3. **Read the failing test**: Read the test file. Understand what it expects.
4. **Find the bug**: Read/Grep/Glob to locate the source code being tested. Identify the root cause.
5. **Fix the bug**: Edit the source file(s) to fix the root cause. Do NOT modify tests unless they are clearly wrong.
6. **Verify**: Run just the failing test.
7. **If still failing**: Try one more fix approach. If still failing after 2 attempts, skip it.
8. **If passing**: Run the full test suite to check for regressions.
9. **Commit**: Use git to commit each fix.
10. **Update bug fix log**: Append a record with test name, root cause, fix applied, status.
11. **Write a brief iteration summary**.

## Rules

- Fix the root cause, not the symptom.
- One fix per commit.
- If a bug requires touching many files, log "NEEDS_HUMAN: too complex" and skip it.
- Do not add new test files or remove existing tests.
- NEVER STOP unless all tests pass or you are explicitly stopped.`;

/**
 * Seed the auto_bug_fixer agent into the agent store
 */
export function seedAutoBugFixer(): void {
  const existing = agentStore.get("auto-bug-fixer");
  if (existing) {
    agentStore.syncSkills("auto-bug-fixer", ["web_search", "get_current_time", "calculate"]);
    return;
  }

  agentStore.create({
    name: "auto-bug-fixer",
    description: "Autonomous bug-fixing agent — runs tests, identifies failures, fixes them one by one",
    modelRef: "deepseek/deepseek-chat",
    systemPrompt: AUTO_BUG_FIXER_PROMPT,
    emoji: "🐛",
    skills: ["web_search", "get_current_time", "calculate"],
  });

  console.log(`  ✓ Auto Bug Fixer agent seeded (auto-bug-fixer)`);
}

/**
 * Run the auto bug fixer on a given repo directory
 */
export async function runAutoBugFixer(repoDir: string, testCmd: string = "bun test"): Promise<string> {
  const session = sessionManager.createSession("deepseek/deepseek-chat", {
    agentId: "auto-bug-fixer",
    systemPrompt: AUTO_BUG_FIXER_PROMPT,
  });

  const message = `Run auto bug fixer on repo: ${repoDir}\nTest command: ${testCmd}\n\nStart by running the test suite to get the baseline.`;

  const result = await runAgent({
    sessionId: session.id,
    message,
    modelRef: "deepseek/deepseek-chat",
    systemPrompt: AUTO_BUG_FIXER_PROMPT,
    tools: true,
  });

  // Save to knowledge base
  const transcript = sessionManager.getTranscript(session.id);
  knowledgeBase.save({
    title: `Bug Fix Run: ${repoDir}`,
    content: transcript.map((m) => `## ${m.role}\n\n${m.content}`).join("\n\n---\n\n"),
    category: "bug-fix",
    tags: ["auto-bug-fixer", "bug-fix", repoDir],
    source: "auto_bug_fixer",
  });

  return result.text;
}
