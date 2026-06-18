/**
 * Agent Quality Scoring — trust-based reputation system
 * 
 * Every agent gets a public trust score based on:
 * - evidenceRate: % of claims with evidence anchors
 * - successRate: % of tasks without errors
 * - validatorPasses: how many reports passed validation
 * - avgToolsPerTask: efficiency
 */

import { agentStore } from "./store.ts";
import { agentMemory } from "./memory.ts";

export interface AgentScore {
  agentId: string;
  evidenceRate: number;       // 0-1
  successRate: number;         // 0-1
  totalRuns: number;
  validatorPasses: number;
  validatorFailures: number;
  avgToolsPerTask: number;
  strikes: number;
  trustLevel: "verified" | "neutral" | "low" | "degraded";
  lastRunAt: string | null;
}

class QualityScorer {
  private scores = new Map<string, AgentScore>();

  /** Get or create score for an agent */
  get(agentId: string): AgentScore {
    if (this.scores.has(agentId)) return this.scores.get(agentId)!;
    
    const score: AgentScore = {
      agentId,
      evidenceRate: 0.5, // neutral start
      successRate: 0.5,
      totalRuns: 0,
      validatorPasses: 0,
      validatorFailures: 0,
      avgToolsPerTask: 0,
      strikes: 0,
      trustLevel: "neutral",
      lastRunAt: null,
    };
    this.scores.set(agentId, score);
    return score;
  }

  /** Record a successful, validated run */
  recordPass(agentId: string, evidenceRate: number, toolCount: number): void {
    const s = this.get(agentId);
    s.totalRuns++;
    s.validatorPasses++;
    s.evidenceRate = (s.evidenceRate * (s.totalRuns - 1) + evidenceRate) / s.totalRuns;
    s.avgToolsPerTask = s.totalRuns > 1 
      ? (s.avgToolsPerTask * (s.totalRuns - 1) + toolCount) / s.totalRuns
      : toolCount;
    s.successRate = s.validatorPasses / Math.max(s.totalRuns, 1);
    s.lastRunAt = new Date().toISOString();
    this.recalcTrust(agentId);
  }

  /** Record a failed/rejected run */
  recordFail(agentId: string, evidenceRate: number, reason: string): void {
    const s = this.get(agentId);
    s.totalRuns++;
    s.validatorFailures++;
    s.evidenceRate = (s.evidenceRate * (s.totalRuns - 1) + evidenceRate) / s.totalRuns;
    s.successRate = s.validatorPasses / Math.max(s.totalRuns, 1);
    s.strikes++;
    s.lastRunAt = new Date().toISOString();
    this.recalcTrust(agentId);
    
    // Save strike to agent memory
    agentMemory.add(agentId, "episodic", `Strike #${s.strikes}: ${reason}`, 4, ["validator", "strike"]);
  }

  /** Recalculate trust level */
  private recalcTrust(agentId: string): void {
    const s = this.get(agentId);
    if (s.strikes >= 3) s.trustLevel = "degraded";
    else if (s.strikes >= 1) s.trustLevel = "low";
    else if (s.totalRuns >= 3 && s.evidenceRate >= 0.7 && s.successRate >= 0.8) s.trustLevel = "verified";
    else if (s.totalRuns >= 1 && s.evidenceRate >= 0.5) s.trustLevel = "neutral";
    else s.trustLevel = "neutral";
  }

  /** Get trust badge emoji/color */
  getTrustBadge(agentId: string): { emoji: string; color: string; label: string } {
    const s = this.get(agentId);
    switch (s.trustLevel) {
      case "verified": return { emoji: "🟢", color: "#22c55e", label: "Verified" };
      case "neutral": return { emoji: "🟡", color: "#f59e0b", label: "Neutral" };
      case "low": return { emoji: "🔴", color: "#ef4444", label: "Low Trust" };
      case "degraded": return { emoji: "⚠️", color: "#ef4444", label: "Degraded" };
    }
  }

  /** Get all scores sorted by trust */
  listByTrust(): AgentScore[] {
    return [...this.scores.values()].sort((a, b) => {
      const order = { verified: 0, neutral: 1, low: 2, degraded: 3 };
      return (order[a.trustLevel] || 1) - (order[b.trustLevel] || 1);
    });
  }
}

export const qualityScorer = new QualityScorer();
