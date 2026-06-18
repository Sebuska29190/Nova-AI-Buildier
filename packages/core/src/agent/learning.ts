/**
 * Agent Learning Loop — prompt self-improvement based on feedback
 * 
 * When an agent accumulates strikes, the system:
 * 1. Analyzes the failed reports for patterns
 * 2. Generates a corrective prompt addition
 * 3. Appends it to the agent's system prompt
 * 4. Resets strikes (agent got "remediation")
 */

import { agentStore } from "./store.ts";
import { strikeTracker } from "./validator.ts";
import { qualityScorer } from "./scoring.ts";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

interface LearningCorrection {
  agentId: string;
  strikesBeforeRemediation: number;
  addedToPrompt: string;
  appliedAt: string;
}

class LearningLoop {
  private corrections = new Map<string, LearningCorrection[]>();
  private AGENTS_DIR = join(process.cwd(), "packages", "core", "agents");

  /**
   * Check if an agent needs remediation (3+ strikes)
   * If yes, analyze pattern and generate corrective prompt
   */
  remediate(agentId: string): string | null {
    const agent = agentStore.get(agentId);
    if (!agent) return null;
    if (!strikeTracker.isDegraded(agentId)) return null;

    const strikes = strikeTracker.getStrikes(agentId);
    
    // Analyze the most common failure pattern
    const pattern = this.analyzeFailurePattern(agentId);
    
    // Generate corrective prompt
    const correction = this.generateCorrection(agentId, pattern);
    
    // Record the correction
    const history = this.corrections.get(agentId) || [];
    history.push({
      agentId,
      strikesBeforeRemediation: strikes,
      addedToPrompt: correction.slice(0, 200),
      appliedAt: new Date().toISOString(),
    });
    this.corrections.set(agentId, history);

    // Reset strikes after remediation
    strikeTracker.reset(agentId);
    
    console.log(`  🧠 Learning: Remediated ${agentId} (${strikes} strikes → ${pattern.pattern})`);
    
    return correction;
  }

  /** Analyze what went wrong in the failed reports */
  private analyzeFailurePattern(agentId: string): {
    pattern: string;
    severity: string;
    suggestion: string;
  } {
    // Common failure patterns
    const patterns = [
      { 
        key: "no evidence", 
        pattern: "Making claims without verifying with tools",
        suggestion: "BEFORE making any claim: 1) Use workspace_read_file to check the actual code. 2) Use workspace_exec to run tests/build. 3) Quote the actual output in your report. NEVER state something you haven't personally verified in this session."
      },
      {
        key: "fabricated", 
        pattern: "Reporting bugs that don't exist (hallucination)",
        suggestion: "If you cannot find a real, verified bug, say 'No bugs found. Build passes. Tests pass.' This is BETTER than inventing problems. Cite the actual build/test output as evidence."
      },
      {
        key: "import", 
        pattern: "Claiming imports are broken or modules don't exist",
        suggestion: "BEFORE claiming an import is broken: 1) Read the full file with workspace_read_file. 2) Verify the imported module exists. 3) Run the build (bun run build:ui) — if it says '✓ built', ALL imports resolve correctly."
      },
      {
        key: "truncated",
        pattern: "Claiming files are truncated or incomplete",
        suggestion: "Read the FULL file before claiming it's truncated. Use workspace_read_file to read the entire file. The last line alone doesn't indicate truncation."
      },
    ];

    // Match against strike reasons
    const reasons = strikeTracker.getReasons(agentId);
    for (const p of patterns) {
      for (const reason of reasons) {
        if (reason.toLowerCase().includes(p.key)) return p;
      }
    }

    // Default: general anti-hallucination
    return {
      pattern: "General accuracy issues",
      severity: "high",
      suggestion: "CRITICAL REMINDER: Every claim in your report must be backed by actual tool output. Read files, run commands, verify everything. If unsure, say 'I don't have enough evidence for this claim.' Never fabricate."
    };
  }

  /** Generate corrective prompt addition */
  private generateCorrection(agentId: string, pattern: { pattern: string; suggestion: string }): string {
    return `\n\n## 🔧 AUTO-CORRECTION (Learning Loop)\n\nYour previous runs showed this pattern: **${pattern.pattern}**.\n\n${pattern.suggestion}\n\nThis correction was auto-applied by the Learning Loop to help you improve. Future runs will be evaluated against these standards.`;
  }

  /** Apply correction to agent's system prompt */
  apply(agentId: string): void {
    const correction = this.remediate(agentId);
    if (!correction) return;

    // Update in-memory agent config
    const agent = agentStore.get(agentId);
    if (agent) {
      const updated = (agent.systemPrompt || "") + correction;
      agentStore.update(agentId, { systemPrompt: updated } as any);
    }

    // Append to AGENTS.md file for persistence
    try {
      const mdPath = join(this.AGENTS_DIR, agentId, "AGENTS.md");
      if (existsSync(mdPath)) {
        const current = readFileSync(mdPath, "utf-8");
        if (!current.includes("AUTO-CORRECTION")) {
          writeFileSync(mdPath, current + correction, "utf-8");
        }
      }
    } catch {}
  }

  /** Get learning history for an agent */
  getHistory(agentId: string): LearningCorrection[] {
    return this.corrections.get(agentId) || [];
  }
}

export const learningLoop = new LearningLoop();
