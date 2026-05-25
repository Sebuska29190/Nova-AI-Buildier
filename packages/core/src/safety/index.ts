/**
 * Safety Module — Nova AI Safety Middleware
 * 
 * Warstwa bezpieczeństwa dla wywołań narzędzi (tool calls).
 * Implementuje rekomendacje:
 * - OWASP Multi-Agent Threat Model v1.0
 * - MIT AI Agent Index 2025 (safety evaluation)
 * - arXiv: 2505.02077 (Open Challenges in Multi-Agent Security)
 * 
 * Komponenty:
 * - ToolCircuitBreaker: max tool calls, depth limit, timeout, loop detection
 * - ToolAuditLogger: centralny rejestr wszystkich wywołań narzędzi
 * 
 * @module safety
 */

export { toolBreaker, ToolCircuitBreaker } from "./circuit-breaker-tools.ts";
export type { ToolCircuitBreakerConfig, ToolCallContext } from "./circuit-breaker-tools.ts";
export { CircuitBreakerError, DepthLimitError, LoopDetectionError, TimeoutError } from "./circuit-breaker-tools.ts";

export { toolAudit, ToolAuditLogger } from "./tool-audit.ts";
export type { ToolAuditEntry, AuditConfig } from "./tool-audit.ts";
