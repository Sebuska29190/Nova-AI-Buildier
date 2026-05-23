import { createInterface } from "node:readline";
import { registry } from "../plugin/registry.ts";
import { runAgent } from "../agent/runner.ts";
import { sessionManager } from "../session/manager.ts";
import { agentStore } from "../agent/store.ts";
import { listTools } from "../plugin/tools.ts";
import { getVideoJobs, startVideoGeneration } from "../video/pipeline.ts";
import { createWorkJob, getWorkJobs } from "../worker/manager.ts";
import { knowledgeBase } from "../knowledge/store.ts";
import { research, listSources } from "../research/engine.ts";
import { analyzeSymbol } from "../trading/analyzer.ts";
import { brainstorm } from "../brainstorm/engine.ts";
import { createTask, listTasks, updateTask, deleteTask } from "../task/store.ts";
import { loadSkills } from "../skill/loader.ts";
import { spawnSubAgent } from "../multi-agent/subagent.ts";
import { safeMessage } from "../errors.ts";
import { runTerminal } from "../gateway/routes-terminal.ts";
import { workspaceManager } from "../workspace/manager.ts";
import { kernel, agentFS, ledger } from "../kernel/index.ts";
import { tmuxAvailable, listSessions as tmuxListSessions, createSession as tmuxCreateSession, killSession as tmuxKillSession, sendKeys as tmuxSendKeys, capturePane as tmuxCapturePane, getStatus as tmuxGetStatus } from "../tmux/tools.ts";

const COMMANDS: Record<string, (args: string) => Promise<void>> = {};
let currentModel = "deepseek/deepseek-chat";

export function registerCommand(name: string, fn: (args: string) => Promise<void>): void {
  COMMANDS[name] = fn;
}

export async function startREPL(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "nova> " });

  // Register built-in commands — 1:1 z CheetahClaws command set
  registerCommand("help", async () => {
    console.log("\n  ╔══════════════════════════════════════╗");
    console.log("  ║        Nova CLI Commands             ║");
    console.log("  ╚══════════════════════════════════════╝");
    const groups: Record<string, string[]> = {
      "Chat": ["chat", "model", "clear", "history"],
      "Agents": ["agents", "agent", "bug-fix"],
      "Tools": ["tools", "skills", "terminal"],
      "Sessions": ["sessions", "session"],
      "Knowledge": ["knowledge", "kb"],
      "Research": ["research", "brainstorm"],
      "Trading": ["trading", "trade"],
      "Tasks": ["tasks", "task"],
      "Video": ["video", "video-gen"],
      "Worker": ["worker", "jobs"],
      "System": ["help", "exit", "quit"],
    };
    for (const [group, cmds] of Object.entries(groups)) {
      console.log(`\n  ${group}:`);
      for (const cmd of cmds) {
        const handler = COMMANDS[cmd];
        console.log(`    /${cmd}`);
      }
    }
    console.log("\n  Type /help, /chat <message>, or just type to chat\n");
  });

  registerCommand("chat", async (args) => {
    if (!args.trim()) { console.log("Usage: /chat <message>"); return; }
    const session = sessionManager.createSession(currentModel);
    try {
      const result = await runAgent({ sessionId: session.id, message: args.trim(), modelRef: currentModel, tools: true });
      console.log(`\n${result.text}\n`);
      // Auto-save to knowledge base
      sessionManager.saveToKnowledge(session.id);
    } catch (e: unknown) { console.log(`Error: ${safeMessage(e)}`); }
  });

  registerCommand("model", async (args) => {
    const m = args.trim();
    if (!m) { console.log(`Current model: ${currentModel}`); return; }
    const resolved = registry.resolveModel(m);
    if (!resolved) {
      console.log(`Model '${m}' not found. Available:`);
      registry.listModels().forEach((md) => console.log(`  ${md.ref}`));
      return;
    }
    currentModel = m;
    console.log(`✓ Switched to: ${m}`);
  });

  registerCommand("history", async (args) => {
    const sessions = sessionManager.listSessions(20);
    console.log(`\n  Recent sessions (${sessions.length}):`);
    sessions.forEach((s) => {
      const msgs = sessionManager.getTranscript(s.id);
      const preview = msgs.length > 0 ? msgs[0].content.slice(0, 60) : "(empty)";
      console.log(`  [${s.id.slice(0, 8)}] ${new Date(s.updatedAt).toLocaleString()} — ${preview}...`);
    });
    console.log();
  });

  registerCommand("session", async (args) => {
    const id = args.trim();
    if (!id) { console.log("Usage: /session <id>"); return; }
    const msgs = sessionManager.getTranscript(id);
    if (msgs.length === 0) { console.log("Session not found or empty."); return; }
    console.log(`\n  Session ${id.slice(0, 8)} (${msgs.length} messages):`);
    msgs.forEach((m) => console.log(`  [${m.role}] ${m.content.slice(0, 120)}`));
    console.log();
  });

  registerCommand("tools", async () => {
    const tools = listTools();
    console.log(`\n  ${tools.length} tool(s):`);
    tools.forEach((t) => console.log(`    ${t.name}: ${t.description}`));
    console.log();
  });

  registerCommand("skills", async () => {
    const skills = loadSkills();
    console.log(`\n  ${skills.length} skill(s):`);
    skills.forEach((s) => console.log(`    ${s.name}: ${s.description}`));
    console.log();
  });

  registerCommand("agents", async () => {
    const agents = agentStore.list();
    console.log(`\n  ${agents.length} agent(s):`);
    agents.forEach((a) => console.log(`    ${a.emoji || "🤖"} ${a.name} (${a.id}) — ${a.modelRef}`));
    console.log();
  });

  registerCommand("agent", async (args) => {
    const parts = args.trim().split(/\s+/);
    if (parts.length < 2) { console.log("Usage: /agent <agentId> <message>"); return; }
    const agentId = parts[0];
    const message = parts.slice(1).join(" ");
    const agent = agentStore.get(agentId);
    if (!agent) { console.log(`Agent '${agentId}' not found.`); return; }
    const session = sessionManager.createSession(agent.modelRef, { agentId, systemPrompt: agent.systemPrompt });
    try {
      const result = await runAgent({ sessionId: session.id, message, modelRef: agent.modelRef, systemPrompt: agent.systemPrompt, tools: true });
      console.log(`\n[${agent.emoji || "🤖"} ${agent.name}]\n${result.text}\n`);
    } catch (e: unknown) { console.log(`Error: ${safeMessage(e)}`); }
  });

  registerCommand("bug-fix", async (args) => {
    const parts = args.trim().split(/\s+/);
    const repoDir = parts[0] || ".";
    const testCmd = parts.slice(1).join(" ") || "bun test";
    console.log(`\n  Running Auto Bug Fixer on: ${repoDir}`);
    console.log(`  Test command: ${testCmd}\n`);
    const { runAutoBugFixer } = await import("../agent/auto-bug-fixer.ts");
    try {
      const result = await runAutoBugFixer(repoDir, testCmd);
      console.log(`\n${result}\n`);
    } catch (e: unknown) { console.log(`Error: ${safeMessage(e)}`); }
  });

  registerCommand("sessions", async () => {
    const sessions = sessionManager.listSessions(20);
    console.log(`\n  ${sessions.length} session(s):`);
    sessions.forEach((s) => console.log(`    ${s.id.slice(0, 8)} — ${s.modelRef} (${new Date(s.updatedAt).toLocaleString()})`));
    console.log();
  });

  registerCommand("video", async () => {
    const jobs = getVideoJobs();
    console.log(`\n  ${jobs.length} video job(s):`);
    jobs.forEach((j) => console.log(`    ${j.id} — ${j.status} (${j.progress}%)`));
    console.log();
  });

  registerCommand("video-gen", async (args) => {
    if (!args.trim()) { console.log("Usage: /video-gen <topic>"); return; }
    console.log(`\n  Starting video generation for: ${args.trim()}\n`);
    try {
      const job = await startVideoGeneration({ topic: args.trim(), duration: 30, quality: "medium", language: "en" });
      console.log(`  ✓ Video job created: ${job.id}\n`);
    } catch (e: unknown) { console.log(`Error: ${safeMessage(e)}`); }
  });

  registerCommand("worker", async () => {
    const jobs = getWorkJobs();
    console.log(`\n  ${jobs.length} worker job(s):`);
    jobs.forEach((j: any) => console.log(`    ${j.id} — ${j.status}`));
    console.log();
  });

  registerCommand("jobs", async () => {
    const jobs = getWorkJobs();
    console.log(`\n  ${jobs.length} job(s):`);
    jobs.forEach((j: any) => console.log(`    ${j.id} — ${j.status}`));
    console.log();
  });

  registerCommand("research", async (args) => {
    if (!args.trim()) { console.log("Usage: /research <query>"); return; }
    console.log(`\n  Researching: ${args.trim()}\n`);
    try {
      const results = await research(args.trim());
      console.log(`  ${results.length} result(s):`);
      results.forEach((r: any) => console.log(`    ${r.title} — ${r.url}`));
      console.log();
    } catch (e: unknown) { console.log(`Error: ${safeMessage(e)}`); }
  });

  registerCommand("brainstorm", async (args) => {
    if (!args.trim()) { console.log("Usage: /brainstorm <topic>"); return; }
    console.log(`\n  Brainstorming: ${args.trim()}\n`);
    try {
      const ideas = await brainstorm(args.trim());
      ideas.forEach((idea, i) => console.log(`  ${i + 1}. ${idea}`));
      console.log();
    } catch (e: unknown) { console.log(`Error: ${safeMessage(e)}`); }
  });

  registerCommand("trading", async (args) => {
    if (!args.trim()) { console.log("Usage: /trading <symbol>"); return; }
    console.log(`\n  Analyzing: ${args.trim().toUpperCase()}\n`);
    try {
      const result = await analyzeSymbol(args.trim().toUpperCase());
      console.log(`  Symbol: ${result.symbol}`);
      if (result.price) console.log(`  Price: $${result.price}`);
      console.log(`  Recommendation: ${result.recommendation}`);
      if (result.reason) console.log(`  Reason: ${result.reason}`);
      console.log();
    } catch (e: unknown) { console.log(`Error: ${safeMessage(e)}`); }
  });

  registerCommand("trade", async (args) => {
    await COMMANDS["trading"](args);
  });

  registerCommand("tasks", async () => {
    const tasks = listTasks();
    console.log(`\n  ${tasks.length} task(s):`);
    tasks.forEach((t: any) => console.log(`    ${t.status === "done" ? "✓" : "○"} ${t.title}`));
    console.log();
  });

  registerCommand("task", async (args) => {
    if (!args.trim()) { console.log("Usage: /task <title>"); return; }
    const task = createTask(args.trim());
    console.log(`  ✓ Task created: ${task.id}\n`);
  });

  registerCommand("knowledge", async (args) => {
    const parts = args.trim().split(/\s+/);
    const sub = parts[0];
    if (sub === "stats") {
      const stats = knowledgeBase.getStats();
      console.log("\n  Knowledge Base Stats:");
      for (const [cat, count] of Object.entries(stats)) {
        console.log(`    ${cat}: ${count} entries`);
      }
      console.log();
    } else if (sub === "search" && parts.length > 1) {
      const query = parts.slice(1).join(" ");
      const results = knowledgeBase.search(query);
      console.log(`\n  ${results.length} result(s) for "${query}":`);
      results.forEach((r) => console.log(`    [${r.category}] ${r.title}`));
      console.log();
    } else if (sub) {
      const entries = knowledgeBase.listByCategory(sub);
      console.log(`\n  ${entries.length} entry(ies) in ${sub}:`);
      entries.forEach((e) => console.log(`    ${e.title} (${e.createdAt.slice(0, 10)})`));
      console.log();
    } else {
      console.log("Usage: /knowledge stats|search|<category>");
    }
  });

  registerCommand("kb", async (args) => {
    await COMMANDS["knowledge"](args);
  });

  // ─── Workspace Commands ──────────────────────────────────────────────────
  registerCommand("workspace", async (args) => {
    const parts = args.trim().split(/\s+/);
    const sub = parts[0];
    if (sub === "set" && parts.length > 1) {
      const dir = parts.slice(1).join(" ");
      const ok = workspaceManager.setRoot(dir);
      if (ok) {
        const state = workspaceManager.getState();
        console.log(`\n  ✓ Workspace set to: ${state?.rootDir}`);
        console.log(`  Files: ${state?.fileCount}, Dirs: ${state?.dirCount}\n`);
      } else {
        console.log("  ✗ Failed to set workspace\n");
      }
    } else if (sub === "status" || !sub) {
      const state = workspaceManager.getState();
      if (!state) {
        console.log("\n  No workspace set. Use /workspace set <dir>\n");
      } else {
        console.log(`\n  Workspace: ${state.rootDir}`);
        console.log(`  Files: ${state.fileCount}, Dirs: ${state.dirCount}`);
        console.log(`  Created: ${state.createdAt.slice(0, 10)}\n`);
      }
    } else if (sub === "files" || sub === "ls") {
      if (!workspaceManager.isActive()) { console.log("  No workspace set\n"); return; }
      const dir = parts[1] || "";
      const files = workspaceManager.listFiles(dir);
      console.log(`\n  Files in ${dir || "/"} (${files.length}):`);
      files.forEach((f) => console.log(`    ${f.type === "dir" ? "📁" : "📄"} ${f.name} (${f.size} B)`));
      console.log();
    } else if (sub === "tree") {
      if (!workspaceManager.isActive()) { console.log("  No workspace set\n"); return; }
      const dir = parts[1] || "";
      const depth = parseInt(parts[2] || "2");
      const tree = workspaceManager.getTree(dir, depth);
      console.log(`\n${tree}\n`);
    } else if (sub === "read" && parts.length > 1) {
      const content = workspaceManager.readFile(parts[1]);
      if (content === null) { console.log("  File not found or too large\n"); return; }
      console.log(`\n${content}\n`);
    } else if (sub === "write" && parts.length > 2) {
      const filePath = parts[1];
      const text = parts.slice(2).join(" ");
      const ok = workspaceManager.writeFile(filePath, text);
      console.log(ok ? `  ✓ Written to ${filePath}\n` : "  ✗ Failed to write\n");
    } else if (sub === "clear") {
      workspaceManager.clear();
      console.log("  ✓ Workspace cleared\n");
    } else {
      console.log("Usage: /workspace set|status|files|tree|read|write|clear [args]");
    }
  });

  // ─── Kernel Commands ─────────────────────────────────────────────────────
  registerCommand("kernel", async (args) => {
    const parts = args.trim().split(/\s+/);
    const sub = parts[0];
    if (sub === "status" || !sub) {
      console.log(`\n  Kernel initialized: ${kernel.isInitialized()}\n`);
    } else if (sub === "agentfs" && parts.length > 1) {
      const agentId = parts[1];
      const action = parts[2] || "list";
      if (action === "list") {
        const files = agentFS.listAgentFiles(agentId);
        console.log(`\n  AgentFS files for ${agentId.slice(0, 8)} (${files.length}):`);
        files.forEach((f) => console.log(`    ${f}`));
        console.log();
      } else if (action === "read" && parts.length > 3) {
        const content = agentFS.readAgentFile(agentId, parts[3]);
        console.log(content !== null ? `\n${content}\n` : "  File not found\n");
      } else if (action === "write" && parts.length > 4) {
        const ok = agentFS.writeAgentFile(agentId, parts[3], parts.slice(4).join(" "));
        console.log(ok ? `  ✓ Written\n` : "  ✗ Failed\n");
      }
    } else if (sub === "global") {
      const files = agentFS.listGlobalFiles();
      console.log(`\n  Global files (${files.length}):`);
      files.forEach((f) => console.log(`    ${f}`));
      console.log();
    } else if (sub === "ledger") {
      const entries = ledger.query({ limit: parseInt(parts[1] || "20") });
      console.log(`\n  Ledger entries (${entries.length}):`);
      entries.forEach((e) => console.log(`    [${e.action}] ${e.agentId?.slice(0, 8) || "system"} — ${e.status}`));
      console.log();
    } else if (sub === "stats") {
      const stats = ledger.getStats();
      console.log("\n  Ledger Stats:");
      console.log(`    Total entries: ${stats.total}`);
      for (const [agent, count] of Object.entries(stats.byAgent)) {
        console.log(`    ${agent.slice(0, 8)}: ${count}`);
      }
      console.log();
    } else {
      console.log("Usage: /kernel status|agentfs|global|ledger|stats [args]");
    }
  });

  // ─── Tmux Commands ───────────────────────────────────────────────────────
  registerCommand("tmux", async (args) => {
    const parts = args.trim().split(/\s+/);
    const sub = parts[0];
    if (sub === "status" || !sub) {
      const avail = tmuxAvailable();
      console.log(`\n  Tmux available: ${avail}`);
      if (avail) {
        const status = tmuxGetStatus();
        console.log(`  Status: ${status}`);
        const sessions = tmuxListSessions();
        console.log(`  Sessions: ${sessions.length}`);
        sessions.forEach((s) => console.log(`    ${s.name} (${s.windows} windows)`));
      }
      console.log();
    } else if (sub === "sessions") {
      const sessions = tmuxListSessions();
      console.log(`\n  ${sessions.length} tmux session(s):`);
      sessions.forEach((s) => console.log(`    ${s.name} — ${s.windows} windows`));
      console.log();
    } else if (sub === "create" && parts.length > 1) {
      const name = parts[1];
      const dir = parts.slice(2).join(" ") || undefined;
      const ok = tmuxCreateSession(name, dir);
      console.log(ok ? `  ✓ Session '${name}' created\n` : "  ✗ Failed\n");
    } else if (sub === "kill" && parts.length > 1) {
      const ok = tmuxKillSession(parts[1]);
      console.log(ok ? `  ✓ Session '${parts[1]}' killed\n` : "  ✗ Not found\n");
    } else if (sub === "send" && parts.length > 2) {
      const session = parts[1];
      const cmd = parts.slice(2).join(" ");
      const ok = tmuxSendKeys(session, cmd);
      console.log(ok ? `  ✓ Sent to ${session}\n` : "  ✗ Failed\n");
    } else if (sub === "capture" && parts.length > 1) {
      const output = tmuxCapturePane(parts[1]);
      console.log(`\n${output}\n`);
    } else {
      console.log("Usage: /tmux status|sessions|create|kill|send|capture [args]");
    }
  });

  // ─── Research Sources ────────────────────────────────────────────────────
  registerCommand("sources", async () => {
    const sources = listSources();
    console.log(`\n  Research sources (${sources.length}):`);
    sources.forEach((s) => console.log(`    ${s.enabled ? "✓" : "○"} ${s.name}`));
    console.log();
  });

  registerCommand("terminal", async (args) => {
    if (!args.trim()) { console.log("Usage: /terminal <command>"); return; }
    console.log(`\n  Running: ${args.trim()}\n`);
    try {
      const output = await runTerminal(args.trim());
      console.log(output);
      console.log();
    } catch (e: unknown) { console.log(`Error: ${safeMessage(e)}`); }
  });

  registerCommand("clear", async () => { console.clear(); });
  registerCommand("exit", async () => { rl.close(); process.exit(0); });
  registerCommand("quit", async () => { rl.close(); process.exit(0); });

  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║     Nova AI Platform — CLI v0.4      ║");
  console.log("  ╚══════════════════════════════════════╝");
  console.log(`  Model: ${currentModel}`);
  console.log(`  Agents: ${agentStore.list().length}`);
  console.log(`  Tools: ${listTools().length}`);
  console.log("  Type /help for commands or just chat\n");

  rl.prompt();
  rl.on("line", async (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) { rl.prompt(); return; }

    if (trimmed.startsWith("/")) {
      const [cmd, ...rest] = trimmed.slice(1).split(" ");
      const handler = COMMANDS[cmd];
      if (handler) {
        try { await handler(rest.join(" ")); }
        catch (e: unknown) { console.log(`Error: ${safeMessage(e)}`); }
      } else {
        console.log(`Unknown command: /${cmd}. Try /help`);
      }
    } else {
      const session = sessionManager.createSession(currentModel);
      try {
        const result = await runAgent({ sessionId: session.id, message: trimmed, modelRef: currentModel, tools: true });
        console.log(`\n${result.text}\n`);
        // Auto-save to knowledge base
        sessionManager.saveToKnowledge(session.id);
      } catch (e: unknown) { console.log(`Error: ${safeMessage(e)}`); }
    }
    rl.prompt();
  });
}
