/**
 * Workflow Builder — chain agents, tools, and conditions
 *
 * Each workflow is a DAG of steps that execute in sequence.
 * Steps can pass data via {{variables}}, branch on conditions,
 * and run agents or tools.
 */

import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { registerTool } from "../plugin/tools.ts";
import { safeMessage } from "../errors.ts";
import { agentStore } from "../agent/store.ts";
import { runAgent } from "../agent/runner.ts";
import { sessionManager } from "../session/manager.ts";
import { getTool } from "../plugin/tools.ts";

type StepType = "agent" | "tool" | "condition" | "delay" | "notify";

interface WorkflowStep {
  id: string;
  type: StepType;
  label: string;
  config: Record<string, any>;
  nextOnSuccess?: string;
  nextOnFailure?: string;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  status: "draft" | "active";
  createdAt: string;
  updatedAt: string;
}

interface WorkflowRun {
  id: string;
  workflowId: string;
  status: "running" | "completed" | "error";
  currentStep: string;
  results: Record<string, string>;
  startedAt: string;
  completedAt?: string;
}

class WorkflowEngine {
  private db!: Database;
  private initialized = false;

  init(dbPath?: string): void {
    if (this.initialized) return;
    const path = dbPath ?? join(process.cwd(), "nova.db");
    this.db = new Database(path);
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run(`CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
      steps TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`);
    this.db.run(`CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running', current_step TEXT DEFAULT '',
      results TEXT DEFAULT '{}', started_at TEXT NOT NULL, completed_at TEXT
    )`);
    this.initialized = true;
    this.registerTools();
  }

  create(name: string, description: string, steps: WorkflowStep[]): Workflow {
    const id = name.toLowerCase().replace(/[^a-z0-9-]/g, "-") || randomUUID().slice(0, 8);
    const now = new Date().toISOString();
    // Ensure each step has an id
    const cleanSteps = steps.map((s) => ({ ...s, id: s.id || randomUUID().slice(0, 8) }));
    this.db.run("INSERT INTO workflows (id, name, description, steps, status, created_at, updated_at) VALUES (?,?,?,?,'draft',?,?)",
      [id, name, description, JSON.stringify(cleanSteps), now, now]);
    return this.get(id)!;
  }

  get(id: string): Workflow | null {
    const r = this.db.query("SELECT * FROM workflows WHERE id = ?").get(id) as any;
    if (!r) return null;
    return { id: r.id, name: r.name, description: r.description || "", steps: JSON.parse(r.steps), status: r.status, createdAt: r.created_at, updatedAt: r.updated_at };
  }

  list(): Workflow[] {
    return this.db.query("SELECT * FROM workflows ORDER BY updated_at DESC").all().map((r: any) =>
      ({ id: r.id, name: r.name, description: r.description || "", steps: JSON.parse(r.steps), status: r.status, createdAt: r.created_at, updatedAt: r.updated_at }));
  }

  update(id: string, data: { name?: string; description?: string; steps?: WorkflowStep[]; status?: string }): boolean {
    const existing = this.get(id);
    if (!existing) return false;
    const now = new Date().toISOString();
    this.db.run("UPDATE workflows SET name=?, description=?, steps=?, status=?, updated_at=? WHERE id=?",
      [data.name ?? existing.name, data.description ?? existing.description, JSON.stringify(data.steps ?? existing.steps), data.status ?? existing.status, now, id]);
    return true;
  }

  delete(id: string): boolean {
    this.db.run("DELETE FROM workflow_runs WHERE workflow_id = ?", [id]);
    return (this.db.run("DELETE FROM workflows WHERE id = ?", [id]).changes ?? 0) > 0;
  }

  async execute(id: string): Promise<{ runId: string; status: string; results: Record<string, string> }> {
    const workflow = this.get(id);
    if (!workflow) throw new Error("Workflow not found");

    const runId = randomUUID().slice(0, 12);
    const now = new Date().toISOString();
    const results: Record<string, string> = {};

    this.db.run("INSERT INTO workflow_runs (id, workflow_id, status, current_step, results, started_at) VALUES (?,?,'running','',?,?)",
      [runId, id, "{}", now]);

    try {
      const stepMap = new Map(workflow.steps.map((s) => [s.id, s]));
      let currentId = workflow.steps[0]?.id;

      while (currentId) {
        const step = stepMap.get(currentId);
        if (!step) break;

        this.db.run("UPDATE workflow_runs SET current_step = ? WHERE id = ?", [currentId, runId]);

        try {
          const result = await this.executeStep(step, results);
          results[currentId] = result;
          currentId = step.nextOnSuccess;
        } catch (e: unknown) {
          const err = safeMessage(e);
          results[currentId] = `❌ Error: ${err}`;
          currentId = step.nextOnFailure;
        }
      }

      this.db.run("UPDATE workflow_runs SET status='completed', results=?, completed_at=? WHERE id=?",
        [JSON.stringify(results), new Date().toISOString(), runId]);
      return { runId, status: "completed", results };
    } catch (e: unknown) {
      this.db.run("UPDATE workflow_runs SET status='error', results=?, completed_at=? WHERE id=?",
        [JSON.stringify(results), new Date().toISOString(), runId]);
      return { runId, status: "error", results };
    }
  }

  private async executeStep(step: WorkflowStep, vars: Record<string, string>): Promise<string> {
    const r = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || `{{${k}}}`);

    switch (step.type) {
      case "agent": {
        const agent = agentStore.get(step.config.agentId);
        if (!agent) throw new Error(`Agent ${step.config.agentId} not found`);
        const session = sessionManager.createSession(agent.modelRef, { systemPrompt: agent.systemPrompt, agentId: agent.id });
        const result = await runAgent({
          sessionId: session.id, message: r(step.config.message || ""),
          modelRef: agent.modelRef, systemPrompt: agent.systemPrompt,
          tools: true, skills: agent.skills, agentId: agent.id,
        });
        return result.text;
      }
      case "tool": {
        const tool = getTool(step.config.toolName);
        if (!tool) throw new Error(`Tool ${step.config.toolName} not found`);
        const args = step.config.arguments || {};
        // Resolve variables in args
        const resolvedArgs: Record<string, any> = {};
        for (const [k, v] of Object.entries(args)) {
          resolvedArgs[k] = typeof v === "string" ? r(v) : v;
        }
        return await tool.execute(resolvedArgs, {});
      }
      case "condition": {
        const actual = vars[step.config.variable] || "";
        const expected = step.config.value || "";
        const operator = step.config.operator || "equals";
        let passed = false;
        switch (operator) {
          case "equals": passed = actual === expected; break;
          case "contains": passed = actual.includes(expected); break;
          case "gt": passed = parseFloat(actual) > parseFloat(expected); break;
          case "lt": passed = parseFloat(actual) < parseFloat(expected); break;
          case "exists": passed = actual.length > 0; break;
        }
        return passed ? "✅ Condition passed" : "❌ Condition failed";
      }
      case "delay": {
        const ms = parseInt(step.config.ms || "1000", 10);
        await new Promise((r) => setTimeout(r, ms));
        return `⏱️ Delayed ${ms}ms`;
      }
      case "notify": {
        return `📢 ${r(step.config.message || "")}`;
      }
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  private registerTools(): void {
    registerTool({
      name: "workflow_run",
      description: "Execute a workflow by ID",
      parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false },
      execute: async (args: Record<string, unknown>) => {
        try {
          const result = await this.execute(args.id as string);
          const wf = this.get(args.id as string);
          return `✅ Workflow "${wf?.name || args.id}" ${result.status}\nResults:\n${Object.entries(result.results).map(([k, v]) => `  ${k}: ${v.slice(0, 200)}`).join("\n")}`;
        } catch (e: unknown) { return `❌ ${safeMessage(e)}`; }
      },
    });
  }
}

export const workflowEngine = new WorkflowEngine();
