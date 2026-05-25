/**
 * Agent Chamber — Multi-Agent Communication & Collaboration
 *
 * Agents work together in a shared "chamber" with:
 * - Shared transcript (all agents see all messages)
 * - Round-robin execution (each agent takes turns)
 * - Delegation (agents can ask each other to do tasks)
 * - Consensus checking (decide when done)
 */

import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { registerTool } from "../plugin/tools.ts";
import { safeMessage } from "../errors.ts";
import { agentStore } from "../agent/store.ts";
import { runAgent, sessionAgentMap } from "../agent/runner.ts";
import { sessionManager } from "../session/manager.ts";

type ChamberStatus = "idle" | "running" | "completed" | "error";

interface ChamberConfig {
  id: string;
  name: string;
  description?: string;
  agents: ChamberAgent[];
  maxRounds: number;
  task: string;
  status: ChamberStatus;
  createdAt: string;
  completedAt?: string;
}

interface ChamberAgent {
  agentId: string;
  role: string;       // e.g. "researcher", "writer", "reviewer"
  order: number;      // execution order
}

interface ChamberMessage {
  id: string;
  chamberId: string;
  agentId: string;
  agentName: string;
  role: string;
  round: number;
  content: string;
  type: "message" | "delegation" | "result" | "decision";
  createdAt: string;
}

class ChamberManager {
  private db!: Database;
  private initialized = false;
  private activeRuns = new Map<string, AbortController>();

  init(dbPath?: string): void {
    if (this.initialized) return;
    const path = dbPath ?? join(process.cwd(), "nova.db");
    this.db = new Database(path);
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run(`CREATE TABLE IF NOT EXISTS agent_chambers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      agents TEXT NOT NULL,       -- JSON array of {agentId, role, order}
      max_rounds INTEGER NOT NULL DEFAULT 3,
      task TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      created_at TEXT NOT NULL,
      completed_at TEXT
    )`);
    this.db.run(`CREATE TABLE IF NOT EXISTS chamber_messages (
      id TEXT PRIMARY KEY,
      chamber_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      role TEXT NOT NULL,
      round INTEGER NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'message',
      created_at TEXT NOT NULL
    )`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_chamber_msgs ON chamber_messages(chamber_id, round ASC)`);
    this.initialized = true;
    this.registerTools();
  }

  // ─── CRUD ────────────────────────────────────────────────────

  create(name: string, task: string, agents: { agentId: string; role: string; order: number }[], maxRounds = 3): ChamberConfig {
    const id = name.toLowerCase().replace(/[^a-z0-9-]/g, "-") || randomUUID().slice(0, 8);
    const now = new Date().toISOString();
    this.db.run(
      "INSERT INTO agent_chambers (id, name, description, agents, max_rounds, task, status, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [id, name, "", JSON.stringify(agents), maxRounds, task, "idle", now],
    );
    return this.get(id)!;
  }

  get(id: string): ChamberConfig | null {
    const r = this.db.query("SELECT * FROM agent_chambers WHERE id = ?").get(id) as any;
    if (!r) return null;
    return {
      id: r.id, name: r.name, description: r.description || undefined,
      agents: JSON.parse(r.agents), maxRounds: r.max_rounds,
      task: r.task, status: r.status, createdAt: r.created_at,
      completedAt: r.completed_at || undefined,
    };
  }

  list(): ChamberConfig[] {
    return this.db.query("SELECT * FROM agent_chambers ORDER BY created_at DESC").all().map((r: any) => ({
      id: r.id, name: r.name, description: r.description || undefined,
      agents: JSON.parse(r.agents), maxRounds: r.max_rounds,
      task: r.task, status: r.status, createdAt: r.created_at,
      completedAt: r.completed_at || undefined,
    }));
  }

  delete(id: string): boolean {
    this.db.run("DELETE FROM chamber_messages WHERE chamber_id = ?", [id]);
    const result = this.db.run("DELETE FROM agent_chambers WHERE id = ?", [id]);
    return (result.changes ?? 0) > 0;
  }

  getMessages(chamberId: string, limit = 50): ChamberMessage[] {
    return this.db.query(
      "SELECT * FROM chamber_messages WHERE chamber_id = ? ORDER BY round ASC, created_at ASC LIMIT ?"
    ).all(chamberId, limit).map((r: any) => ({
      id: r.id, chamberId: r.chamber_id, agentId: r.agent_id,
      agentName: r.agent_name, role: r.role, round: r.round,
      content: r.content, type: r.type, createdAt: r.created_at,
    }));
  }

  private addMessage(chamberId: string, agentId: string, agentName: string, role: string, round: number, content: string, type: string = "message"): ChamberMessage {
    const id = randomUUID().slice(0, 12);
    const now = new Date().toISOString();
    this.db.run(
      "INSERT INTO chamber_messages (id, chamber_id, agent_id, agent_name, role, round, content, type, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
      [id, chamberId, agentId, agentName, role, round, content, type, now],
    );
    return { id, chamberId, agentId, agentName, role, round, content, type, createdAt: now };
  }

  /** Get shared transcript for agent context injection */
  private buildTranscript(chamberId: string, maxRound?: number): string {
    const msgs = this.getMessages(chamberId, 200);
    const filtered = maxRound ? msgs.filter((m) => m.round <= maxRound) : msgs;
    if (filtered.length === 0) return "";
    return filtered.map((m) => {
      const tag = m.type === "delegation" ? " [DELEGATION]" : m.type === "decision" ? " [DECISION]" : "";
      return `  [${m.role}] ${m.agentName}${tag}: ${m.content.replace(/\n/g, "\n    ")}`;
    }).join("\n");
  }

  // ─── Run Chamber ─────────────────────────────────────────────

  async runRoom(id: string): Promise<{ success: boolean; error?: string }> {
    const chamber = this.get(id);
    if (!chamber) return { success: false, error: "Chamber not found" };
    if (chamber.status === "running") return { success: false, error: "Chamber is already running. Stop it first or wait for completion." };

    // Stale "running" from crash — force reset
    if (chamber.status === "running") {
      this.db.run("UPDATE agent_chambers SET status = 'idle' WHERE id = ?", [id]);
    }

    const sortedAgents = [...chamber.agents].sort((a, b) => a.order - b.order);
    const abortCtrl = new AbortController();
    this.activeRuns.set(id, abortCtrl);

    this.db.run("UPDATE agent_chambers SET status = 'running' WHERE id = ?", [id]);

    // Run in background — don't block the caller
    const promise = (async () => {
      try {
        for (let round = 1; round <= chamber.maxRounds; round++) {
          if (abortCtrl.signal.aborted) throw new Error("Chamber cancelled");

          for (const chAgent of sortedAgents) {
            if (abortCtrl.signal.aborted) throw new Error("Chamber cancelled");
            const agent = agentStore.get(chAgent.agentId);
            if (!agent) {
              this.addMessage(id, chAgent.agentId, "unknown", chAgent.role || "worker", round, `❌ Agent ${chAgent.agentId} not found`, "message");
              continue;
            }

            const transcript = this.buildTranscript(id, round - 1);
            const wsNote = "\n\n## Workspace\nYour workspace is the project root (D:\\nova). You can use workspace tools like `workspace_list_files`, `workspace_read_file`, and `workspace_write_file` to access files.";

            const roleStr = chAgent.role ? ` (${chAgent.role})` : "";
            const roleContext = chAgent.role ? `\nYour assigned role: **${chAgent.role}**` : "";

            const roundPrompt = chamber.agents.length > 1
              ? `[Chamber] Task: ${chamber.task}\n\nYou are the **${agent.name}**${roleStr} in this team. Other team members:\n${chamber.agents.filter((a) => a.agentId !== chAgent.agentId).map((a) => `  - ${agentStore.get(a.agentId)?.name || a.agentId}${a.role ? ` (${a.role})` : ""}`).join("\n")}\n\n${roleContext}\nCurrent round: ${round}/${chamber.maxRounds}\n\nShared discussion so far:\n${transcript || "(no messages yet)"}\n\nContribute based on your role and expertise. You can:\n1. Share findings and analysis\n2. Ask questions to other agents (use @name)\n3. Delegate subtasks by saying @agentName: do X\n4. Report progress or completion\n5. Signal [DONE] when your part is complete${wsNote}`
              : `[Chamber] Task: ${chamber.task}\n\nRound: ${round}/${chamber.maxRounds}\n\nYour previous work:\n${transcript || "(no messages yet)"}\n\nContinue working on the task. Be thorough.${wsNote}`;

            const session = sessionManager.createSession(agent.modelRef, {
              systemPrompt: agent.systemPrompt,
              agentId: agent.id,
            });

            const result = await runAgent({
              sessionId: session.id,
              message: roundPrompt,
              modelRef: agent.modelRef,
              systemPrompt: agent.systemPrompt,
              tools: true,
              skills: agent.skills,
              signal: abortCtrl.signal,
              agentId: agent.id,
            });

            this.addMessage(id, agent.id, agent.name, chAgent.role || "worker", round, result.text, "message");

            // Check for delegation patterns
            const delegateMatch = result.text.match(/@(\w[\w-]*):\s*(.+?)(?=\n@|\n*$)/g);
            if (delegateMatch && chamber.agents.length > 1) {
              for (const match of delegateMatch) {
                const parts = match.match(/@(\w[\w-]*):\s*(.+)/);
                if (parts) {
                  const targetName = parts[1].toLowerCase();
                  const delegateTask = parts[2].trim();
                  const targetAgent = chamber.agents.find(
                    (a) => (agentStore.get(a.agentId)?.name || "").toLowerCase().includes(targetName) || a.role.toLowerCase() === targetName
                  );
                  if (targetAgent) {
                    this.addMessage(id, agent.id, agent.name, chAgent.role || "worker", round,
                      `→ Delegated to ${targetAgent.role || targetAgent.agentId}: ${delegateTask}`, "delegation");
                  }
                }
              }
            }
          }

          // Consensus check
          const recentMsgs = this.getMessages(id, 20);
          const decisionSignals = recentMsgs.filter((m) =>
            m.round === round &&
            (m.content.toLowerCase().includes("[done]") ||
             m.content.toLowerCase().includes("task complete") ||
             m.content.toLowerCase().includes("consensus reached"))
          );
          const uniqueDecidingAgents = new Set(decisionSignals.map((m) => m.agentId));
          if (uniqueDecidingAgents.size >= Math.ceil(chamber.agents.length * 0.66)) {
            this.addMessage(id, "system", "System", "orchestrator", round, "✅ All agents signaled completion — ending chamber early.", "decision");
            break;
          }
        }

        const now = new Date().toISOString();
        this.db.run("UPDATE agent_chambers SET status = 'completed', completed_at = ? WHERE id = ?", [now, id]);
        console.log(`[Chamber] "${chamber.name}" completed`);
        return { success: true };
      } catch (e: unknown) {
        this.db.run("UPDATE agent_chambers SET status = 'error' WHERE id = ?", [id]);
        console.error(`[Chamber] "${chamber.name}" failed:`, safeMessage(e));
        return { success: false, error: safeMessage(e) };
      } finally {
        this.activeRuns.delete(id);
      }
    })();

    // Don't await — return immediately, run in background
    promise.catch(() => {});

    return { success: true };
  }

  stopRoom(id: string): boolean {
    const ctrl = this.activeRuns.get(id);
    if (ctrl) {
      ctrl.abort();
      this.db.run("UPDATE agent_chambers SET status = 'idle' WHERE id = ?", [id]);
      return true;
    }
    return false;
  }

  isRunning(id: string): boolean {
    return this.activeRuns.has(id);
  }

  // ─── Tools ───────────────────────────────────────────────────

  private registerTools(): void {
    registerTool({
      name: "chamber_list",
      description: "List all agent chambers (teams) available",
      parameters: { type: "object", properties: {}, additionalProperties: false },
      execute: async () => {
        const chambers = this.list();
        if (chambers.length === 0) return "No chambers created yet.";
        return chambers.map((c) =>
          `  ${c.status === "running" ? "▶️" : c.status === "completed" ? "✅" : "⏸️"} ${c.name} (${c.id}) — ${c.agents.length} agents, ${c.status}`
        ).join("\n") + `\n\nUse \`chamber_status <id>\` to see details or \`chamber_run <id>\` to start.`;
      },
    });

    registerTool({
      name: "chamber_status",
      description: "Get detailed status of a chamber (messages, round, agents)",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "Chamber ID" } },
        required: ["id"],
        additionalProperties: false,
      },
      execute: async (args: Record<string, unknown>) => {
        const chamber = this.get(args.id as string);
        if (!chamber) return "❌ Chamber not found";
        const msgs = this.getMessages(chamber.id, 10);
        let out = `🏛️ Chamber: ${chamber.name}\n`;
        out += `Task: ${chamber.task}\n`;
        out += `Status: ${chamber.status}\n`;
        out += `Max rounds: ${chamber.maxRounds}\n`;
        out += `Agents:\n`;
        for (const a of chamber.agents) {
          const agent = agentStore.get(a.agentId);
          out += `  ${a.order}. ${a.role} → ${agent?.name || a.agentId}\n`;
        }
        if (msgs.length > 0) {
          out += `\nRecent messages:\n`;
          out += msgs.slice(-5).map((m) =>
            `  [R${m.round}] ${m.agentName} (${m.role}): ${m.content.slice(0, 200)}`
          ).join("\n");
        }
        return out;
      },
    });

    registerTool({
      name: "chamber_run",
      description: "Start or resume a chamber — agents will collaborate on the task",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "Chamber ID" } },
        required: ["id"],
        additionalProperties: false,
      },
      execute: async (args: Record<string, unknown>, ctx: any) => {
        const result = await this.runRoom(args.id as string);
        const chamber = this.get(args.id as string);
        if (!result.success) return `❌ Chamber failed: ${result.error}`;
        const msgs = this.getMessages(chamber!.id, 5);
        let out = `✅ Chamber "${chamber!.name}" completed!\n`;
        out += `\nSummary:\n`;
        for (const m of msgs) {
          out += `  [${m.role}] ${m.agentName}: ${m.content.slice(0, 300)}\n`;
        }
        return out;
      },
    });
  }
}

export const chamberManager = new ChamberManager();
