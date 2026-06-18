/**
 * Agent Capability Registry — enhanced Smart Router v2
 *
 * Improvements over v1:
 * - TF-IDF-like term weighting (rare terms score higher)
 * - N-gram matching for multi-word phrases
 * - Agent affinity: remembers which agents worked well for similar tasks
 * - Task complexity estimation: routes simple tasks to lighter agents
 * - Better domain/language patterns with expanded coverage
 * - Penalty for overly generic agents on specific tasks
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { agentStore } from "./store.ts";
import { qualityScorer } from "./scoring.ts";

export interface AgentCapability {
  agentId: string;
  name: string;
  emoji: string;
  domains: string[];
  languages: string[];
  keywords: string[];
  bigrams: string[];       // NEW: two-word phrases for better matching
  tools: string[];
  trustScore: number;
  trustLevel: string;
  specificity: number;     // NEW: 0-1, how specific vs generic this agent is
}

// ─── Agent Affinity Cache ──────────────────────────────────────
// Tracks which agents worked well for task patterns
interface AffinityEntry {
  agentId: string;
  taskPattern: string;    // normalized task keywords
  successCount: number;
  failCount: number;
  lastUsed: number;
}

class AgentAffinity {
  private history = new Map<string, AffinityEntry[]>();
  private readonly MAX_HISTORY = 100;

  recordSuccess(agentId: string, taskPattern: string): void {
    this.record(agentId, taskPattern, true);
  }

  recordFailure(agentId: string, taskPattern: string): void {
    this.record(agentId, taskPattern, false);
  }

  getScore(agentId: string, taskPattern: string): number {
    const entries = this.history.get(agentId) || [];
    let matchScore = 0;
    for (const entry of entries) {
      const overlap = this.calculateOverlap(taskPattern, entry.taskPattern);
      if (overlap > 0.3) {
        const total = entry.successCount + entry.failCount;
        const successRate = total > 0 ? entry.successCount / total : 0.5;
        matchScore = Math.max(matchScore, successRate * overlap);
      }
    }
    return matchScore; // 0-1
  }

  private record(agentId: string, taskPattern: string, success: boolean): void {
    if (!this.history.has(agentId)) this.history.set(agentId, []);
    const entries = this.history.get(agentId)!;

    // Find existing entry for similar pattern
    const existing = entries.find(e => this.calculateOverlap(taskPattern, e.taskPattern) > 0.5);
    if (existing) {
      if (success) existing.successCount++;
      else existing.failCount++;
      existing.lastUsed = Date.now();
    } else {
      entries.push({
        agentId,
        taskPattern,
        successCount: success ? 1 : 0,
        failCount: success ? 0 : 1,
        lastUsed: Date.now(),
      });
    }

    // Trim old entries
    if (entries.length > this.MAX_HISTORY) {
      entries.sort((a, b) => b.lastUsed - a.lastUsed);
      entries.splice(this.MAX_HISTORY);
    }
  }

  private calculateOverlap(a: string, b: string): number {
    const wordsA = new Set(a.split(/\s+/));
    const wordsB = new Set(b.split(/\s+/));
    let overlap = 0;
    for (const w of wordsA) { if (wordsB.has(w)) overlap++; }
    return overlap / Math.max(wordsA.size, wordsB.size, 1);
  }
}

// ─── Task Complexity Estimation ────────────────────────────────
function estimateComplexity(task: string): "simple" | "moderate" | "complex" {
  const words = task.split(/\s+/).length;
  const hasCodeBlocks = /```|`[^`]+`/.test(task);
  const hasMultipleRequests = /\band\b.*\band\b|\bthen\b.*\bthen\b|1\)|2\)|3\)/.test(task);
  const mentionsFiles = /file|folder|directory|project|codebase/i.test(task);
  const mentionsArchitecture = /architect|design|system|infrastructure|deploy/i.test(task);

  if (words > 30 || (hasMultipleRequests && mentionsFiles) || mentionsArchitecture) return "complex";
  if (words > 15 || hasCodeBlocks || hasMultipleRequests) return "moderate";
  return "simple";
}

// ─── Domain Patterns (expanded) ────────────────────────────────
const DOMAIN_PATTERNS: Record<string, RegExp> = {
  "api-design": /api\s+(design|development|architecture|endpoint|rest|graphql|openapi|swagger)/,
  "frontend": /(frontend|front-end|ui|ux|react|vue|angular|css|html|component|dom|svelte|nextjs|nuxt)/,
  "backend": /(backend|back-end|server|api|database|microservice|scalable|endpoint|route|middleware)/,
  "devops": /(devops|deployment|ci\/cd|pipeline|docker|kubernetes|k8s|infrastructure|terraform|helm|ansible)/,
  "testing": /(test|qa|quality|automation|bug|debug|coverage|jest|vitest|mocha|cypress|playwright)/,
  "security": /(security|vulnerability|audit|compliance|penetration|encryption|auth|oauth|jwt|xss|csrf|sqli)/,
  "data": /(data|analytics|sql|database|ml|machine.?learning|pipeline|etl|warehouse|spark|kafka)/,
  "mobile": /(mobile|android|ios|swift|flutter|react.?native|kotlin|dart|xamarin)/,
  "documentation": /(documentation|docs|readme|writing|technical.?writing|javadoc|typedoc)/,
  "architecture": /(architecture|design.?pattern|system.?design|microservice|distributed|event.?driven|cqrs|ddd)/,
  "performance": /(performance|optimization|profiling|caching|latency|throughput|benchmark|memory|cpu)/,
  "blockchain": /(blockchain|web3|solana|ethereum|smart.?contract|defi|nft|crypto|wallet|dex)/,
  "ai-ml": /(ai|artificial.?intelligence|ml|machine.?learning|neural|deep.?learning|transformer|llm|gpt|bert|rag)/,
  "cloud": /(cloud|aws|azure|gcp|serverless|lambda|s3|ec2|kubernetes|terraform)/,
  "database": /(database|sql|postgres|mysql|mongodb|redis|elasticsearch|assandra|dynamodb)/,
  "voice-media": /(voice|audio|tts|stt|speech|video|image|media|ffmpeg|whisper)/,
  "social": /(social|twitter|discord|slack|telegram|whatsapp|email|notification)/,
  "finance": /(finance|trading|crypto|defi|portfolio|stock|market|exchange|wallet)/,
  "iot": /(iot|smart.?home|hue|philips|sensor|device|embedded|raspberry)/,
};

// ─── Language Patterns (expanded) ──────────────────────────────
const LANG_PATTERNS: Record<string, RegExp> = {
  "typescript": /(typescript|\.ts\b|\.tsx\b|\bts\b|bun\b)/,
  "javascript": /(javascript|\.js\b|\.jsx\b|\bjs\b|node\.?js|ecmascript|es20\d\d)/,
  "python": /(python|\.py\b|\bpy\b|django|flask|fastapi|pytorch|tensorflow|pip)/,
  "go": /(\bgolang\b|\bgo\b|go\.mod)/,
  "rust": /(\brust\b|cargo|\.rs\b|rustc)/,
  "java": /(\bjava\b|spring|kotlin|\.java\b|gradle|maven)/,
  "csharp": /(c#|csharp|\.net|dotnet|\.cs\b|asp\.net)/,
  "cpp": /(\bc\+\+|cpp|\.cpp\b|\.hpp\b|cmake|clang)/,
  "sql": /(\bsql\b|postgresql|mysql|sqlite|\.sql\b|database.?query)/,
  "php": /(\bphp\b|laravel|symfony|composer)/,
  "ruby": /(\bruby\b|rails|\.rb\b|gem)/,
  "powershell": /(powershell|pwsh|\.ps1\b)/,
  "swift": /(\bswift\b|\.swift\b|xcode|uikit|swiftui)/,
  "kotlin": /(\bkotlin\b|\.kt\b|android.?kotlin)/,
};

// ─── Generic Agent Penalty Keywords ────────────────────────────
// These words in agent names/descriptions indicate generic agents
const GENERIC_INDICATORS = /^(default|general|assistant|helper|chat|basic|simple|main)/i;

class CapabilityRegistry {
  private capabilities = new Map<string, AgentCapability>();
  private affinity = new AgentAffinity();
  private initialized = false;
  private idfCache = new Map<string, number>(); // term → IDF score

  /** Build capability index from all agents */
  build(): void {
    this.capabilities.clear();
    const agents = agentStore.list();
    const agentsDir = join(process.cwd(), "packages", "core", "agents");

    // First pass: collect all terms for IDF calculation
    const termDocCount = new Map<string, number>();
    const agentTexts: Array<{ id: string; text: string }> = [];

    for (const agent of agents) {
      if (!agent.id || agent.id === "default") continue;
      const text = [
        agent.description || "",
        agent.systemPrompt || "",
        agent.name || agent.id,
      ].join(" ").toLowerCase();

      agentTexts.push({ id: agent.id, text });
      const words = new Set(text.match(/\b[a-z]{3,}\b/g) || []);
      for (const w of words) {
        termDocCount.set(w, (termDocCount.get(w) || 0) + 1);
      }
    }

    // Calculate IDF for each term
    const totalAgents = agentTexts.length || 1;
    for (const [term, docCount] of termDocCount) {
      this.idfCache.set(term, Math.log(totalAgents / (1 + docCount)));
    }

    // Second pass: build capabilities with TF-IDF scoring
    for (const agent of agents) {
      if (!agent.id || agent.id === "default") continue;
      const score = qualityScorer.get(agent.id);

      const keywords = new Set<string>();
      const domains = new Set<string>();
      const languages = new Set<string>();
      const bigrams = new Set<string>();

      const desc = (agent.description || "").toLowerCase();
      const prompt = (agent.systemPrompt || "").toLowerCase();
      const combined = `${desc} ${prompt}`;

      // Extract domains
      for (const [domain, pattern] of Object.entries(DOMAIN_PATTERNS)) {
        if (pattern.test(combined)) domains.add(domain);
      }

      // Extract languages
      for (const [lang, pattern] of Object.entries(LANG_PATTERNS)) {
        if (pattern.test(combined)) languages.add(lang);
      }

      // Extract keywords with TF-IDF weighting
      const words = combined.match(/\b[a-z]{3,}\b/g) || [];
      const stopWords = new Set([
        "the", "and", "for", "with", "this", "that", "from",
        "your", "have", "will", "when", "use", "can", "are",
        "you", "all", "not", "but", "its", "has", "was", "been",
        "agent", "using", "used", "tool", "tools", "should",
        "must", "need", "make", "create", "provide", "help",
      ]);

      for (const word of words) {
        if (stopWords.has(word)) continue;
        const idf = this.idfCache.get(word) || 0;
        // High IDF = rare term = more specific/discriminating
        if (idf > 0.5 || word.length > 5) keywords.add(word);
      }

      // Extract bigrams (two-word phrases)
      for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        if (!stopWords.has(words[i]) && !stopWords.has(words[i + 1])) {
          bigrams.add(bigram);
        }
      }

      // Calculate specificity (0-1)
      const isGeneric = GENERIC_INDICATORS.test(agent.id) || GENERIC_INDICATORS.test(agent.name || "");
      const specificity = isGeneric ? 0.2 : Math.min(1.0, domains.size * 0.15 + languages.size * 0.1 + keywords.size * 0.02);

      keywords.add(agent.id);
      keywords.add((agent.name || agent.id).toLowerCase());

      this.capabilities.set(agent.id, {
        agentId: agent.id,
        name: agent.name || agent.id,
        emoji: agent.emoji || "🤖",
        domains: [...domains],
        languages: [...languages],
        keywords: [...keywords].slice(0, 50),
        bigrams: [...bigrams].slice(0, 30),
        tools: agent.skills || [],
        trustScore: score.evidenceRate,
        trustLevel: score.trustLevel,
        specificity,
      });
    }
    this.initialized = true;
  }

  /** Match a task description to the best agents — enhanced v2 */
  match(task: string, topK = 5): Array<{ agentId: string; name: string; emoji: string; score: number; trustLevel: string; reason: string[] }> {
    if (!this.initialized) this.build();

    const taskLower = task.toLowerCase();
    const taskWords = new Set(taskLower.match(/\b[a-z]{3,}\b/g) || []);
    const taskBigrams: string[] = [];
    const taskWordsArr = taskLower.match(/\b[a-z]{3,}\b/g) || [];
    for (let i = 0; i < taskWordsArr.length - 1; i++) {
      taskBigrams.push(`${taskWordsArr[i]} ${taskWordsArr[i + 1]}`);
    }

    const complexity = estimateComplexity(task);
    const results: Array<{ agentId: string; name: string; emoji: string; score: number; trustLevel: string; reason: string[] }> = [];

    for (const [id, cap] of this.capabilities) {
      let score = 0;
      const reasons: string[] = [];

      // 1. Bigram matching (highest signal — specific phrases)
      for (const bg of cap.bigrams) {
        if (taskLower.includes(bg)) {
          score += 5;
          reasons.push(`phrase:"${bg}"`);
        }
      }

      // 2. TF-IDF weighted keyword matching
      for (const kw of cap.keywords) {
        if (taskLower.includes(kw)) {
          const idf = this.idfCache.get(kw) || 1;
          const weight = Math.min(4, 1 + idf); // 1-4 pts based on specificity
          score += weight;
          if (weight > 2) reasons.push(`rare:"${kw}"`);
        }
      }

      // 3. Domain match (3 pts each)
      for (const domain of cap.domains) {
        if (taskLower.includes(domain)) {
          score += 3;
          reasons.push(`domain:${domain}`);
        }
      }

      // 4. Language match (2 pts each)
      for (const lang of cap.languages) {
        if (taskLower.includes(lang)) {
          score += 2;
          reasons.push(`lang:${lang}`);
        }
      }

      // 5. Agent affinity bonus (0-3 pts)
      const taskPattern = [...taskWords].join(" ");
      const affinityScore = this.affinity.getScore(id, taskPattern);
      if (affinityScore > 0) {
        score += affinityScore * 3;
        reasons.push(`affinity:${Math.round(affinityScore * 100)}%`);
      }

      // 6. Specificity bonus for complex tasks
      if (complexity === "complex" && cap.specificity > 0.6) {
        score += 2;
        reasons.push("specialist+complex");
      }

      // 7. Trust multiplier (0.5-1.5)
      const trustMult = cap.trustLevel === "verified" ? 1.5 :
                        cap.trustLevel === "degraded" ? 0.5 :
                        cap.trustLevel === "low" ? 0.7 : 1.0;
      score *= trustMult;

      // 8. Penalty for overly generic agents on specific tasks
      if (complexity !== "simple" && cap.specificity < 0.3) {
        score *= 0.6;
      }

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

  /** Record that an agent succeeded for a task (for affinity learning) */
  recordSuccess(agentId: string, task: string): void {
    const taskPattern = (task.toLowerCase().match(/\b[a-z]{3,}\b/g) || []).join(" ");
    this.affinity.recordSuccess(agentId, taskPattern);
  }

  /** Record that an agent failed for a task (for affinity learning) */
  recordFailure(agentId: string, task: string): void {
    const taskPattern = (task.toLowerCase().match(/\b[a-z]{3,}\b/g) || []).join(" ");
    this.affinity.recordFailure(agentId, taskPattern);
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

  /** Force rebuild (e.g., after agent config changes) */
  rebuild(): void {
    this.initialized = false;
    this.idfCache.clear();
    this.build();
  }
}

export const capabilityRegistry = new CapabilityRegistry();
