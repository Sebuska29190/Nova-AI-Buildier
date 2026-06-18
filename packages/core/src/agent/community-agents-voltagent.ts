/**
 * Community Agents — VoltAgent Imports (112 agents)
 * System prompts loaded from packages/core/agents/{id}/AGENTS.md at seed time
 * Source: https://github.com/VoltAgent/awesome-claude-code-subagents
 */

import type { AgentConfig } from "./store.ts";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Read system prompt from agent directory */
function loadPrompt(agentId: string): string {
  try {
    const p = join(import.meta.dirname || process.cwd(), "..", "..", "agents", agentId, "AGENTS.md");
    if (existsSync(p)) return readFileSync(p, "utf-8");
    // Fallback for packaged paths
    const p2 = join(process.cwd(), "packages", "core", "agents", agentId, "AGENTS.md");
    if (existsSync(p2)) return readFileSync(p2, "utf-8");
  } catch {}
  return `You are ${agentId}, a specialized AI agent.`;
}

export const VOLTAGENT_AGENTS: AgentConfig[] = [
  { id: "accessibility-tester", name: "accessibility-tester", description: "Use this agent when you need comprehensive accessibility testing, WCAG compliance verification, or assessment of assisti", emoji: "🔒", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "search_files_content", "workspace_list_files", "bash_exec", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "ad-security-reviewer", name: "ad-security-reviewer", description: "Use this agent when you need to audit Active Directory security posture, evaluate privilege escalation risks, review ide", emoji: "🔒", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "agent-installer", name: "agent-installer", description: "Use this agent when the user wants to discover, browse, or install Claude Code agents from the awesome-claude-code-subag", emoji: "🎯", modelRef: "deepseek/deepseek-chat", skills: ["bash_exec", "WebFetch", "workspace_read_file", "workspace_write_file", "workspace_list_files", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "agent-organizer", name: "agent-organizer", description: "Use when assembling and optimizing multi-agent teams to execute complex projects that require careful task decomposition", emoji: "🎯", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "ai-engineer", name: "ai-engineer", description: "Use this agent when architecting, implementing, or optimizing end-to-end AI systems—from model selection and training pi", emoji: "📊", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "ai-writing-auditor", name: "ai-writing-auditor", description: "Use this agent when you need to audit content for AI writing patterns and rewrite text to remove them.", emoji: "🔒", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "angular-architect", name: "angular-architect", description: "Use when architecting enterprise Angular 15+ applications with complex state management, optimizing RxJS patterns, desig", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "api-designer", name: "api-designer", description: "Use this agent when designing new APIs, creating API specifications, or refactoring existing API architecture for scalab", emoji: "💻", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "architect-reviewer", name: "architect-reviewer", description: "Use this agent when you need to evaluate system design decisions, architectural patterns, and technology choices at the ", emoji: "🔒", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "azure-infra-engineer", name: "azure-infra-engineer", description: "Use when designing, deploying, or managing Azure infrastructure with focus on network architecture, Entra ID integration", emoji: "☁️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "backend-developer", name: "backend-developer", description: "Use this agent when building server-side APIs, microservices, and backend systems that require robust architecture, scal", emoji: "💻", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "build-engineer", name: "build-engineer", description: "Use this agent when you need to optimize build performance, reduce compilation times, or scale build systems across grow", emoji: "🛠️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "chaos-engineer", name: "chaos-engineer", description: "Use this agent when you need to design and execute controlled failure experiments, validate system resilience before inc", emoji: "🔒", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "cli-developer", name: "cli-developer", description: "Use this agent when building command-line tools and terminal applications that require intuitive command design, cross-p", emoji: "🛠️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "cloud-architect", name: "cloud-architect", description: "Use this agent when you need to design, evaluate, or optimize cloud infrastructure architecture at scale. Invoke when de", emoji: "☁️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "codebase-orchestrator", name: "codebase-orchestrator", description: "Use this agent when you need repository-wide refactor governance with explicit approval loops, weighted risk prioritizat", emoji: "🎯", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "WebFetch", "airis-mcp-gateway", "context-manager", "error-coordinator", "pied-piper", "subagent-catalog:search", "subagent-catalog:fetch", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "compliance-auditor", name: "compliance-auditor", description: "Use this agent when you need to achieve regulatory compliance, implement compliance controls, or prepare for audits acro", emoji: "🔒", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "search_files_content", "workspace_list_files", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "context-manager", name: "context-manager", description: "Use for managing shared state, information retrieval, and data synchronization when multiple agents need coordinated acc", emoji: "🎯", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "cpp-pro", name: "cpp-pro", description: "Use this agent when building high-performance C++ systems requiring modern C++20/23 features, template metaprogramming, ", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "csharp-developer", name: "csharp-developer", description: "Use this agent when building ASP.NET Core web APIs, cloud-native .NET solutions, or modern C# applications requiring asy", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "data-engineer", name: "data-engineer", description: "Use this agent when you need to design, build, or optimize data pipelines, ETL/ELT processes, and data infrastructure. I", emoji: "📊", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "data-scientist", name: "data-scientist", description: "Use this agent when you need to analyze data patterns, build predictive models, or extract statistical insights from dat", emoji: "📊", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "database-administrator", name: "database-administrator", description: "Use this agent when optimizing database performance, implementing high-availability architectures, setting up disaster r", emoji: "☁️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "database-optimizer", name: "database-optimizer", description: "Use this agent when you need to analyze slow queries, optimize database performance across multiple systems, or implemen", emoji: "📊", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "debugger", name: "debugger", description: "Use this agent when you need to diagnose and fix bugs, identify root causes of failures, or analyze error logs and stack", emoji: "🔒", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "dependency-manager", name: "dependency-manager", description: "Use this agent when you need to audit dependencies for vulnerabilities, resolve version conflicts, optimize bundle sizes", emoji: "🛠️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "deployment-engineer", name: "deployment-engineer", description: "Use this agent when designing, building, or optimizing CI/CD pipelines and deployment automation strategies.", emoji: "☁️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "design-bridge", name: "design-bridge", description: "Use this agent when you need to translate a DESIGN.md from the VoltAgent/awesome-design-md repository into polished Clau", emoji: "💻", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "WebFetch", "WebSearch", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "devops-incident-responder", name: "devops-incident-responder", description: "Use when actively responding to production incidents, diagnosing critical service failures, or conducting incident postm", emoji: "☁️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "django-developer", name: "django-developer", description: "Use when building Django 4+ web applications, REST APIs, or modernizing existing Django projects with async views and en", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "docker-expert", name: "docker-expert", description: "Use this agent when you need to build, optimize, or secure Docker container images and orchestration for production envi", emoji: "☁️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "documentation-engineer", name: "documentation-engineer", description: "Use this agent when you need to create, architect, or overhaul comprehensive documentation systems including API docs, t", emoji: "🛠️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "workspace_list_files", "search_files_content", "WebFetch", "WebSearch", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "dotnet-core-expert", name: "dotnet-core-expert", description: "Use when building .NET Core applications requiring cloud-native architecture, high-performance microservices, modern C# ", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "dotnet-framework-48-expert", name: "dotnet-framework-4.8-expert", description: "Use this agent when working on legacy .NET Framework 4.8 enterprise applications that require maintenance, modernization", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "dx-optimizer", name: "dx-optimizer", description: "Use this agent when optimizing the complete developer workflow including build times, feedback loops, testing efficiency", emoji: "🛠️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "electron-pro", name: "electron-pro", description: "Use this agent when building Electron desktop applications that require native OS integration, cross-platform distributi", emoji: "💻", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "elixir-expert", name: "elixir-expert", description: "Use this agent when you need to build fault-tolerant, concurrent systems leveraging OTP patterns, GenServer architecture", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "error-coordinator", name: "error-coordinator", description: "Use this agent when distributed system errors occur and need coordinated handling across multiple components, or when yo", emoji: "🎯", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "error-detective", name: "error-detective", description: "Use this agent when you need to diagnose why errors are occurring in your system, correlate errors across services, iden", emoji: "🔒", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "expo-react-native-expert", name: "expo-react-native-expert", description: "Use when building mobile applications with Expo and React Native that require native module integration, navigation setu", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "fastapi-developer", name: "fastapi-developer", description: "Use when building modern async Python APIs with FastAPI, implementing Pydantic v2 validation, dependency injection patte", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "flutter-expert", name: "flutter-expert", description: "Use when building cross-platform mobile applications with Flutter 3+ that require custom UI implementation, complex stat", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "frontend-developer", name: "frontend-developer", description: "Use when building complete frontend applications across React, Vue, and Angular frameworks requiring multi-framework exp", emoji: "💻", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "fullstack-developer", name: "fullstack-developer", description: "Use this agent when you need to build complete features spanning database, API, and frontend layers together as a cohesi", emoji: "💻", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "gdpr-ccpa-compliance", name: "gdpr-ccpa-compliance", description: "Use when the user needs to understand GDPR or CCPA compliance, review data practices, or assess privacy requirements. Tr", emoji: "🔒", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "search_files_content", "workspace_list_files", "WebFetch", "WebSearch", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "git-workflow-manager", name: "git-workflow-manager", description: "Use this agent when you need to design, establish, or optimize Git workflows, branching strategies, and merge management", emoji: "🛠️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "golang-pro", name: "golang-pro", description: "Use when building Go applications requiring concurrent programming, high-performance systems, microservices, or cloud-na", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "graphql-architect", name: "graphql-architect", description: "Use this agent when designing or evolving GraphQL schemas across microservices, implementing federation architectures, o", emoji: "💻", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "incident-responder", name: "incident-responder", description: "Use this agent when an active security breach, service outage, or operational incident requires immediate response, evid", emoji: "☁️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "it-ops-orchestrator", name: "it-ops-orchestrator", description: "Use for orchestrating complex IT operations tasks that span multiple domains (PowerShell automation, .NET development, i", emoji: "🎯", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "java-architect", name: "java-architect", description: "Use this agent when designing enterprise Java architectures, migrating Spring Boot applications, or establishing microse", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "javascript-pro", name: "javascript-pro", description: "Use this agent when you need to build, optimize, or refactor modern JavaScript code for browser, Node.js, or full-stack ", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "knowledge-synthesizer", name: "knowledge-synthesizer", description: "Use when you need to extract actionable patterns from agent interactions, synthesize insights across multiple workflows,", emoji: "🎯", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "kotlin-specialist", name: "kotlin-specialist", description: "Use when building Kotlin applications requiring advanced coroutine patterns, multiplatform code sharing, or Android/serv", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "kubernetes-specialist", name: "kubernetes-specialist", description: "Use this agent when you need to design, deploy, configure, or troubleshoot Kubernetes clusters and workloads in producti", emoji: "☁️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "laravel-specialist", name: "laravel-specialist", description: "Use when building Laravel 10+ applications, architecting Eloquent models with complex relationships, implementing queue ", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "legacy-modernizer", name: "legacy-modernizer", description: "Use this agent when modernizing legacy systems that need incremental migration strategies, technical debt reduction, and", emoji: "🛠️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "llm-architect", name: "llm-architect", description: "Use when designing LLM systems for production, implementing fine-tuning or RAG architectures, optimizing inference servi", emoji: "📊", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "machine-learning-engineer", name: "machine-learning-engineer", description: "Use this agent when you need to deploy, optimize, or serve machine learning models at scale in production environments.", emoji: "📊", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "mcp-developer", name: "mcp-developer", description: "Use this agent when you need to build, debug, or optimize Model Context Protocol (MCP) servers and clients that connect ", emoji: "🛠️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "microservices-architect", name: "microservices-architect", description: "Use when designing distributed system architecture, decomposing monolithic applications into independent microservices, ", emoji: "💻", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "ml-engineer", name: "ml-engineer", description: "Use this agent when building production ML systems requiring model training pipelines, model serving infrastructure, per", emoji: "📊", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "mlops-engineer", name: "mlops-engineer", description: "Use this agent when you need to design and implement ML infrastructure, set up CI/CD for machine learning models, establ", emoji: "📊", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "mobile-developer", name: "mobile-developer", description: "Use this agent when building cross-platform mobile applications requiring native performance optimization, platform-spec", emoji: "💻", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "multi-agent-coordinator", name: "multi-agent-coordinator", description: "Use when coordinating multiple concurrent agents that need to communicate, share state, synchronize work, and handle dis", emoji: "🎯", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "network-engineer", name: "network-engineer", description: "Use this agent when designing, optimizing, or troubleshooting cloud and hybrid network infrastructures, or when addressi", emoji: "☁️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "nextjs-developer", name: "nextjs-developer", description: "Use this agent when building production Next.js 14+ applications that require full-stack development with App Router, se", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "nlp-engineer", name: "nlp-engineer", description: "Use when building production NLP systems, implementing text processing pipelines, developing language models, or solving", emoji: "📊", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "node-specialist", name: "node-specialist", description: "Use this agent when you need to build, optimize, or debug Node.js backend applications, APIs, CLIs, or microservices req", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "penetration-tester", name: "penetration-tester", description: "Use this agent when you need to conduct authorized security penetration tests to identify real vulnerabilities through a", emoji: "🔒", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "search_files_content", "workspace_list_files", "bash_exec", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "performance-engineer", name: "performance-engineer", description: "Use this agent when you need to identify and eliminate performance bottlenecks in applications, databases, or infrastruc", emoji: "🔒", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "performance-monitor", name: "performance-monitor", description: "Use when establishing observability infrastructure to track system metrics, detect performance anomalies, and optimize r", emoji: "🎯", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "php-pro", name: "php-pro", description: "Use this agent when working with PHP 8.3+ projects that require strict typing, modern language features, and enterprise ", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "platform-engineer", name: "platform-engineer", description: "Use when building or improving internal developer platforms (IDPs), designing self-service infrastructure, or optimizing", emoji: "☁️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "postgres-pro", name: "postgres-pro", description: "Use when you need to optimize PostgreSQL performance, design high-availability replication, or troubleshoot database iss", emoji: "📊", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "powershell-51-expert", name: "powershell-5.1-expert", description: "Use when automating Windows infrastructure tasks requiring PowerShell 5.1 scripts with RSAT modules for Active Directory", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "powershell-7-expert", name: "powershell-7-expert", description: "Use when building cross-platform cloud automation scripts, Azure infrastructure orchestration, or CI/CD pipelines requir", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "powershell-module-architect", name: "powershell-module-architect", description: "Use this agent when architecting and refactoring PowerShell modules, designing profile systems, or creating cross-versio", emoji: "🛠️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "powershell-security-hardening", name: "powershell-security-hardening", description: "Use this agent when you need to harden PowerShell automation, secure remoting configuration, enforce least-privilege des", emoji: "🔒", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "powershell-ui-architect", name: "powershell-ui-architect", description: "Use when designing or building desktop graphical interfaces (WinForms, WPF, Metro-style dashboards) or terminal user int", emoji: "🛠️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "prompt-engineer", name: "prompt-engineer", description: "Use this agent when you need to design, optimize, test, or evaluate prompts for large language models in production syst", emoji: "📊", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "python-pro", name: "python-pro", description: "Use this agent when you need to build type-safe, production-ready Python code for web APIs, system utilities, or complex", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "qa-expert", name: "qa-expert", description: "Use this agent when you need comprehensive quality assurance strategy, test planning across the entire development cycle", emoji: "🔒", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "search_files_content", "workspace_list_files", "bash_exec", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "rails-expert", name: "rails-expert", description: "Use when building or modernizing Rails applications requiring API development, Hotwire reactivity, real-time features, b", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "react-specialist", name: "react-specialist", description: "Use when optimizing existing React applications for performance, implementing advanced React 18+ features, or solving co", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "readme-generator", name: "readme-generator", description: "Use this agent when you need a maintainer-ready README built from exact repository reality, with deep codebase scanning,", emoji: "🛠️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "WebFetch", "WebSearch", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "refactoring-specialist", name: "refactoring-specialist", description: "Use when you need to transform poorly structured, complex, or duplicated code into clean, maintainable systems while pre", emoji: "🛠️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "reinforcement-learning-engineer", name: "reinforcement-learning-engineer", description: "Use when designing RL environments, training agents with reward optimization, implementing policy gradient methods, or d", emoji: "📊", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "rust-engineer", name: "rust-engineer", description: "Use when building Rust systems where memory safety, ownership patterns, zero-cost abstractions, and performance optimiza", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "security-engineer", name: "security-engineer", description: "Use this agent when implementing comprehensive security solutions across infrastructure, building automated security con", emoji: "☁️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "shopping-agent", name: "Shopping Agent", description: "Specialized agent", emoji: "🤖", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_list_files", "agent_memory_save"], status: "ready" },

  { id: "slack-expert", name: "slack-expert", description: "Use this agent when developing Slack applications, implementing Slack API integrations, or reviewing Slack bot code for ", emoji: "🛠️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "WebFetch", "WebSearch", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "spring-boot-engineer", name: "spring-boot-engineer", description: "Use this agent when building enterprise Spring Boot 3+ applications requiring microservices architecture, cloud-native d", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "sql-pro", name: "sql-pro", description: "Use this agent when you need to optimize complex SQL queries, design efficient database schemas, or solve performance is", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "sre-engineer", name: "sre-engineer", description: "Use this agent when you need to establish or improve system reliability through SLO definition, error budget management,", emoji: "☁️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "swift-expert", name: "swift-expert", description: "Use this agent when building native iOS, macOS, or server-side Swift applications requiring advanced concurrency pattern", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "symfony-specialist", name: "symfony-specialist", description: "Use when building Symfony 6+/7+/8+ applications, architecting Doctrine ORM entities with complex relationships, implemen", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "task-distributor", name: "task-distributor", description: "Use when distributing tasks across multiple agents or workers, managing queues, and balancing workloads to maximize thro", emoji: "🎯", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "terraform-engineer", name: "terraform-engineer", description: "Use when building, refactoring, or scaling infrastructure as code using Terraform with focus on multi-cloud deployments,", emoji: "☁️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "terragrunt-expert", name: "terragrunt-expert", description: "Expert Terragrunt specialist mastering infrastructure orchestration, DRY configurations, and multi-environment deploymen", emoji: "☁️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "test-automator", name: "test-automator", description: "Use this agent when you need to build, implement, or enhance automated test frameworks, create test scripts, or integrat", emoji: "🔒", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "tooling-engineer", name: "tooling-engineer", description: "Use this agent when you need to build or enhance developer tools including CLIs, code generators, build tools, and IDE e", emoji: "🛠️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "typescript-pro", name: "typescript-pro", description: "Use when implementing TypeScript code requiring advanced type system patterns, complex generics, type-level programming,", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "ui-designer", name: "ui-designer", description: "Use this agent when designing visual interfaces, creating design systems, building component libraries, or refining user", emoji: "💻", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "ui-ux-tester", name: "ui-ux-tester", description: "Use this agent when you need exhaustive UI and UX functionality testing driven by documented user flows, with browser or", emoji: "🔒", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "WebSearch", "chrome-mcp", "computer-use", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "video-editor-agent", name: "Video Editor Agent", description: "Specialized agent", emoji: "🤖", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_list_files", "agent_memory_save"], status: "ready" },

  { id: "video-post-processor", name: "Video Post-Processor", description: "Specialized agent", emoji: "🤖", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_list_files", "agent_memory_save"], status: "ready" },

  { id: "visual-asset-generator", name: "visual-asset-generator", description: "Use this agent when you need to generate production-ready visual assets for a project — app icons, favicons, OG images, ", emoji: "🛠️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "bash_exec", "mcp__prompt-to-asset", "workspace_list_files", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "vue-expert", name: "vue-expert", description: "Use this agent when building Vue 3 applications that require Composition API mastery, reactivity optimization, or Nuxt 3", emoji: "🔤", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "websocket-engineer", name: "websocket-engineer", description: "Use this agent when implementing real-time bidirectional communication features using WebSockets, Socket.IO, or similar ", emoji: "💻", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "windows-infra-admin", name: "windows-infra-admin", description: "Use when managing Windows Server infrastructure, Active Directory, DNS, DHCP, and Group Policy configurations, especiall", emoji: "☁️", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "bash_exec", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },

  { id: "workflow-orchestrator", name: "workflow-orchestrator", description: "Use this agent when you need to design, implement, or optimize complex business process workflows with multiple states, ", emoji: "🎯", modelRef: "deepseek/deepseek-chat", skills: ["workspace_read_file", "workspace_write_file", "workspace_edit_file", "workspace_list_files", "search_files_content", "agent_memory_save", "agent_memory_search"], status: "ready" },
];

export function seedVoltAgentAgents(agentStore: any): number {
  let count = 0;
  for (const agent of VOLTAGENT_AGENTS) {
    if (agentStore.get(agent.id)) continue;
    try {
      agentStore.create({ ...agent, systemPrompt: loadPrompt(agent.id) });
      count++;
    } catch (e: any) {
      // Skip SQLite UNIQUE constraint (already seeded by another path)
      if (!e.message?.includes("UNIQUE constraint")) console.warn(`  ⚠ VoltAgent seed skip: ${agent.id} — ${e.message}`);
    }
  }
  if (count > 0) console.log(`  ✓ ${count} VoltAgent community agents seeded`);
  return count;
}
