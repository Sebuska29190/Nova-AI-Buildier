/**
 * Agent Capability Registry — auto-extracts capabilities from agent definitions
 * Used by Smart Router to match user tasks to the best agent
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { agentStore } from "./store.ts";
import { qualityScorer } from "./scoring.ts";

export interface AgentCapability {
  agentId: string;
  name: string;
  emoji: string;
  domains: string[];       // ["api-design", "testing", "security"]
  languages: string[];      // ["typescript", "python"]
  keywords: string[];       // extracted from description + AGENTS.md
  tools: string[];
  trustScore: number;
  trustLevel: string;
}

class CapabilityRegistry {
  private capabilities = new Map<string, AgentCapability>();
  private initialized = false;

  /** Build capability index from all agents */
  build(): void {
    this.capabilities.clear();
    const agents = agentStore.list();
    const agentsDir = join(process.cwd(), "packages", "core", "agents");

    for (const agent of agents) {
      if (!agent.id || agent.id === "default") continue;
      const score = qualityScorer.get(agent.id);

      // Extract keywords from description and AGENTS.md
      const keywords = new Set<string>();
      const domains = new Set<string>();
      const languages = new Set<string>();

      // From agent description
      const desc = (agent.description || "").toLowerCase();
      this.extractFromText(desc, keywords, domains, languages);

      // From system prompt (if available)
      const prompt = (agent.systemPrompt || "").toLowerCase();
      this.extractFromText(prompt, keywords, domains, languages);

      // From AGENTS.md file
      try {
        const md = readFileSync(join(agentsDir, agent.id, "AGENTS.md"), "utf-8").toLowerCase();
        this.extractFromText(md, keywords, domains, languages);
      } catch {}

      // Name itself is a keyword
      keywords.add(agent.id);
      keywords.add((agent.name || agent.id).toLowerCase());

      this.capabilities.set(agent.id, {
        agentId: agent.id,
        name: agent.name || agent.id,
        emoji: agent.emoji || "🤖",
        domains: [...domains],
        languages: [...languages],
        keywords: [...keywords].slice(0, 30),
        tools: agent.skills || [],
        trustScore: score.evidenceRate,
        trustLevel: score.trustLevel,
      });
    }
    this.initialized = true;
  }

  /** Extract domains, languages, keywords from text */
  private extractFromText(
    text: string,
    keywords: Set<string>,
    domains: Set<string>,
    languages: Set<string>,
  ): void {
    // Domain patterns
    const domainPatterns: Record<string, RegExp> = {
      "api-design": /api (design|development|architecture|endpoint|rest|graphql)/,
      "frontend": /(frontend|ui|ux|react|vue|angular|css|html|component)/,
      "backend": /(backend|server|api|database|microservice|scalable)/,
      "devops": /(devops|deployment|ci.cd|pipeline|docker|kubernetes|infrastructure|terraform)/,
      "testing": /(test|qa|quality|automation|bug|debug|coverage)/,
      "security": /(security|vulnerability|audit|compliance|penetration|encryption|auth)/,
      "data": /(data|analytics|sql|database|ml|machine.learning|pipeline|etl)/,
      "mobile": /(mobile|android|ios|swift|flutter|react.native)/,
      "documentation": /(documentation|docs|readme|writing|technical.writing)/,
      "architecture": /(architecture|design.pattern|system.design|microservice|distributed)/,
      "performance": /(performance|optimization|profiling|caching|latency)/,
    };

    for (const [domain, pattern] of Object.entries(domainPatterns)) {
      if (pattern.test(text)) domains.add(domain);
    }

    // Language patterns
    const langPatterns: Record<string, RegExp> = {
      "typescript": /(typescript|ts|tsx|bun)/,
      "javascript": /(javascript|js|jsx|node|ecmascript)/,
      "python": /(python|py|django|flask|fastapi|pytorch)/,
      "go": /(\bgolang\b|\bgo\b)/,
      "rust": /(\brust\b|cargo)/,
      "java": /(\bjava\b|spring|kotlin)/,
      "csharp": /(c#|csharp|\.net|dotnet)/,
      "sql": /(sql|postgresql|mysql|sqlite)/,
      "php": /(\bphp\b|laravel|symfony)/,
      "ruby": /(\bruby\b|rails)/,
      "powershell": /(powershell|pwsh)/,
    };

    for (const [lang, pattern] of Object.entries(langPatterns)) {
      if (pattern.test(text)) languages.add(lang);
    }

    // Keyword extraction — significant words from description
    const words = text.match(/\b[a-z]{3,}\b/g) || [];
    const stopWords = new Set([
      "the", "and", "for", "with", "this", "that", "from",
      "your", "have", "will", "when", "use", "can", "are",
      "you", "all", "not", "but", "its", "has", "was", "been",
      "agent", "using", "used", "tool", "tools"
    ]);

    const domainTerms = [
      "api", "rest", "graphql", "react", "vue", "angular", "node",
      "database", "sql", "docker", "kubernetes", "terraform", "aws",
      "azure", "gcp", "security", "testing", "debug", "performance",
      "scalability", "architecture", "design", "frontend", "backend",
      "fullstack", "mobile", "web", "desktop", "ci/cd", "pipeline",
      "monitoring", "logging", "analytics", "ml", "ai", "llm",
      "typescript", "javascript", "python", "go", "rust", "java",
    ];

    for (const word of words) {
      if (stopWords.has(word)) continue;
      if (domainTerms.includes(word)) keywords.add(word);
      // Accept words that appear 2+ times (significant)
      const count = (text.match(new RegExp(`\\b${word}\\b`, "gi")) || []).length;
      if (count >= 3) keywords.add(word);
    }
  }

  /** Match a task description to the best agents */
  match(task: string, topK = 5): Array<{ agentId: string; name: string; emoji: string; score: number; trustLevel: string; reason: string[] }> {
    if (!this.initialized) this.build();

    const taskLower = task.toLowerCase();
    const taskWords = new Set(taskLower.match(/\b[a-z]{3,}\b/g) || []);
    const results: Array<{ agentId: string; name: string; emoji: string; score: number; trustLevel: string; reason: string[] }> = [];

    for (const [id, cap] of this.capabilities) {
      let score = 0;
      const reasons: string[] = [];

      // Exact keyword match (2 pts each)
      for (const kw of cap.keywords) {
        if (taskLower.includes(kw)) { score += 2; reasons.push(`keyword:"${kw}"`); }
      }

      // Domain match (3 pts)
      for (const domain of cap.domains) {
        if (taskLower.includes(domain)) { score += 3; reasons.push(`domain:${domain}`); }
      }

      // Language match (2 pts)
      for (const lang of cap.languages) {
        if (taskLower.includes(lang)) { score += 2; reasons.push(`lang:${lang}`); }
      }

      // Trust multiplier (0.5-1.5)
      const trustMult = cap.trustLevel === "verified" ? 1.5 : 
                        cap.trustLevel === "degraded" ? 0.5 :
                        cap.trustLevel === "low" ? 0.7 : 1.0;
      score *= trustMult;

      if (score > 0) {
        results.push({
          agentId: id, name: cap.name, emoji: cap.emoji,
          score: Math.round(score * 10) / 10,
          trustLevel: cap.trustLevel,
          reason: reasons.slice(0, 5),
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /** Get capability for a single agent */
  get(agentId: string): AgentCapability | undefined {
    if (!this.initialized) this.build();
    return this.capabilities.get(agentId);
  }

  /** List all capabilities */
  list(): AgentCapability[] {
    if (!this.initialized) this.build();
    return [...this.capabilities.values()];
  }
}

export const capabilityRegistry = new CapabilityRegistry();
