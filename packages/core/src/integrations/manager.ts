/**
 * Integrations Manager — 100+ API service connectors
 * 
 * Unified system for connecting Nova to external services:
 * Slack, GitHub, Notion, Google, Discord, Linear, Jira,
 * Reddit, Trello, Twitter/X, Telegram, YouTube, and more.
 */
import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { registerTool } from "../plugin/tools.ts";
import { safeMessage } from "../errors.ts";

const db = new Database("nova.db");
db.run("PRAGMA journal_mode = WAL");
db.run(`CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  service TEXT NOT NULL,
  name TEXT NOT NULL,
  auth_type TEXT NOT NULL,  -- "apikey" | "oauth" | "webhook"
  config TEXT NOT NULL,       -- JSON with api_key, webhook_url, tokens etc.
  enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`);
db.run(`CREATE TABLE IF NOT EXISTS integration_logs (
  id TEXT PRIMARY KEY,
  integration_id TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (integration_id) REFERENCES integrations(id)
)`);

export interface Integration {
  id: string;
  service: string;
  name: string;
  authType: "apikey" | "oauth" | "webhook";
  config: Record<string, string>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  authType: "apikey" | "oauth" | "webhook";
  docsUrl: string;
  category: string;
  configFields: { key: string; label: string; type: "text" | "password" | "url"; required: boolean }[];
}

// ─── All Available Services ───────────────────────────────────
export const AVAILABLE_SERVICES: ServiceDef[] = [
  { id: "slack", name: "Slack", description: "Send messages, notifications, alerts to channels", icon: "💬", authType: "webhook", docsUrl: "https://api.slack.com/messaging/webhooks", category: "Communication", configFields: [{ key: "webhook_url", label: "Webhook URL", type: "url", required: true }] },
  { id: "discord", name: "Discord", description: "Send messages to Discord channels via webhook", icon: "🎮", authType: "webhook", docsUrl: "https://discord.com/developers/docs/resources/webhook", category: "Communication", configFields: [{ key: "webhook_url", label: "Webhook URL", type: "url", required: true }] },
  { id: "telegram", name: "Telegram", description: "Send messages, photos, files via Telegram Bot API", icon: "✈️", authType: "apikey", docsUrl: "https://core.telegram.org/bots/api", category: "Communication", configFields: [{ key: "bot_token", label: "Bot Token", type: "password", required: true }, { key: "chat_id", label: "Chat ID", type: "text", required: true }] },
  { id: "github", name: "GitHub", description: "Manage repos, issues, PRs, gists, releases", icon: "🐙", authType: "apikey", docsUrl: "https://docs.github.com/en/rest", category: "Developer", configFields: [{ key: "token", label: "Personal Access Token", type: "password", required: true }] },
  { id: "gitlab", name: "GitLab", description: "Manage repos, issues, MRs, CI/CD pipelines", icon: "🦊", authType: "apikey", docsUrl: "https://docs.gitlab.com/ee/api/", category: "Developer", configFields: [{ key: "token", label: "Personal Access Token", type: "password", required: true }, { key: "url", label: "GitLab URL", type: "url", required: false }] },
  { id: "notion", name: "Notion", description: "Create pages, databases, query content", icon: "📝", authType: "apikey", docsUrl: "https://developers.notion.com/", category: "Productivity", configFields: [{ key: "api_key", label: "Integration Token", type: "password", required: true }] },
  { id: "linear", name: "Linear", description: "Create and manage issues, projects, cycles", icon: "📋", authType: "apikey", docsUrl: "https://developers.linear.app/", category: "Developer", configFields: [{ key: "api_key", label: "API Key", type: "password", required: true }] },
  { id: "jira", name: "Jira", description: "Create issues, search projects, manage workflows", icon: "🔵", authType: "apikey", docsUrl: "https://developer.atlassian.com/cloud/jira/platform/rest/", category: "Developer", configFields: [{ key: "email", label: "Email", type: "text", required: true }, { key: "api_token", label: "API Token", type: "password", required: true }, { key: "domain", label: "Domain (your-domain.atlassian.net)", type: "text", required: true }] },
  { id: "trello", name: "Trello", description: "Manage boards, lists, cards, checklists", icon: "📌", authType: "apikey", docsUrl: "https://developer.atlassian.com/cloud/trello/rest/", category: "Productivity", configFields: [{ key: "api_key", label: "API Key", type: "password", required: true }, { key: "token", label: "Token", type: "password", required: true }] },
  { id: "reddit", name: "Reddit", description: "Post, comment, search, manage subreddits", icon: "🤖", authType: "apikey", docsUrl: "https://www.reddit.com/dev/api/", category: "Social", configFields: [{ key: "client_id", label: "Client ID", type: "text", required: true }, { key: "client_secret", label: "Client Secret", type: "password", required: true }, { key: "username", label: "Username", type: "text", required: true }, { key: "password", label: "Password", type: "password", required: true }] },
  { id: "twitter", name: "Twitter / X", description: "Post tweets, search, manage timeline", icon: "🐦", authType: "apikey", docsUrl: "https://developer.twitter.com/en/docs", category: "Social", configFields: [{ key: "api_key", label: "API Key", type: "password", required: true }, { key: "api_secret", label: "API Secret", type: "password", required: true }, { key: "access_token", label: "Access Token", type: "password", required: true }, { key: "access_secret", label: "Access Secret", type: "password", required: true }] },
  { id: "youtube", name: "YouTube", description: "Manage videos, comments, playlists, analytics", icon: "▶️", authType: "apikey", docsUrl: "https://developers.google.com/youtube/v3", category: "Social", configFields: [{ key: "api_key", label: "API Key", type: "password", required: true }] },
  { id: "gmail", name: "Gmail", description: "Send, read, search emails", icon: "📧", authType: "apikey", docsUrl: "https://developers.google.com/gmail/api", category: "Productivity", configFields: [{ key: "api_key", label: "API Key", type: "password", required: true }] },
  { id: "google_calendar", name: "Google Calendar", description: "Manage events, reminders, schedules", icon: "📅", authType: "apikey", docsUrl: "https://developers.google.com/calendar", category: "Productivity", configFields: [{ key: "api_key", label: "API Key", type: "password", required: true }] },
  { id: "google_drive", name: "Google Drive", description: "Upload, download, manage files and folders", icon: "📁", authType: "apikey", docsUrl: "https://developers.google.com/drive", category: "Productivity", configFields: [{ key: "api_key", label: "API Key", type: "password", required: true }] },
  { id: "asana", name: "Asana", description: "Manage tasks, projects, portfolios", icon: "🎯", authType: "apikey", docsUrl: "https://developers.asana.com/", category: "Productivity", configFields: [{ key: "token", label: "Personal Access Token", type: "password", required: true }] },
  { id: "bitbucket", name: "Bitbucket", description: "Manage repos, PRs, pipelines", icon: "🪣", authType: "apikey", docsUrl: "https://developer.atlassian.com/cloud/bitbucket/rest/", category: "Developer", configFields: [{ key: "username", label: "Username", type: "text", required: true }, { key: "app_password", label: "App Password", type: "password", required: true }] },
  { id: "figma", name: "Figma", description: "Access designs, components, files", icon: "🎨", authType: "apikey", docsUrl: "https://www.figma.com/developers/api", category: "Design", configFields: [{ key: "token", label: "Personal Access Token", type: "password", required: true }] },
  { id: "pagerduty", name: "PagerDuty", description: "Manage incidents, on-call schedules", icon: "🚨", authType: "apikey", docsUrl: "https://developer.pagerduty.com/", category: "DevOps", configFields: [{ key: "api_key", label: "API Key", type: "password", required: true }] },
  { id: "datadog", name: "Datadog", description: "Query metrics, monitors, dashboards", icon: "📊", authType: "apikey", docsUrl: "https://docs.datadoghq.com/api/", category: "DevOps", configFields: [{ key: "api_key", label: "API Key", type: "password", required: true }, { key: "app_key", label: "Application Key", type: "password", required: true }] },
  { id: "sentry", name: "Sentry", description: "Track errors, performance, releases", icon: "⚠️", authType: "apikey", docsUrl: "https://docs.sentry.io/api/", category: "DevOps", configFields: [{ key: "token", label: "Auth Token", type: "password", required: true }, { key: "organization", label: "Organization", type: "text", required: true }] },
  { id: "openai", name: "OpenAI", description: "GPT models, embeddings, assistants, files", icon: "🤖", authType: "apikey", docsUrl: "https://platform.openai.com/docs/", category: "AI", configFields: [{ key: "api_key", label: "API Key", type: "password", required: true }] },
  { id: "anthropic", name: "Anthropic", description: "Claude models, messages API", icon: "🧠", authType: "apikey", docsUrl: "https://docs.anthropic.com/", category: "AI", configFields: [{ key: "api_key", label: "API Key", type: "password", required: true }] },
  { id: "stability", name: "Stability AI", description: "Image generation, upscaling, editing", icon: "🎨", authType: "apikey", docsUrl: "https://platform.stability.ai/", category: "AI", configFields: [{ key: "api_key", label: "API Key", type: "password", required: true }] },
  { id: "elevenlabs", name: "ElevenLabs", description: "Text-to-speech, voice cloning, dubbing", icon: "🗣️", authType: "apikey", docsUrl: "https://elevenlabs.io/docs", category: "AI", configFields: [{ key: "api_key", label: "API Key", type: "password", required: true }] },
  { id: "pinecone", name: "Pinecone", description: "Vector database for semantic search, RAG", icon: "🌲", authType: "apikey", docsUrl: "https://docs.pinecone.io/", category: "AI", configFields: [{ key: "api_key", label: "API Key", type: "password", required: true }, { key: "environment", label: "Environment", type: "text", required: true }] },
  { id: "supabase", name: "Supabase", description: "Database, auth, storage, realtime", icon: "⚡", authType: "apikey", docsUrl: "https://supabase.com/docs", category: "Developer", configFields: [{ key: "url", label: "Project URL", type: "url", required: true }, { key: "service_key", label: "Service Role Key", type: "password", required: true }] },
  { id: "shopify", name: "Shopify", description: "Manage products, orders, customers, inventory", icon: "🛒", authType: "apikey", docsUrl: "https://shopify.dev/docs/api", category: "Business", configFields: [{ key: "store", label: "Store Name", type: "text", required: true }, { key: "access_token", label: "Admin Access Token", type: "password", required: true }] },
  { id: "stripe", name: "Stripe", description: "Payments, customers, subscriptions, invoices", icon: "💳", authType: "apikey", docsUrl: "https://stripe.com/docs/api", category: "Business", configFields: [{ key: "secret_key", label: "Secret Key", type: "password", required: true }] },
  { id: "hubspot", name: "HubSpot", description: "CRM, contacts, deals, marketing, tickets", icon: "🔄", authType: "apikey", docsUrl: "https://developers.hubspot.com/", category: "Business", configFields: [{ key: "access_token", label: "Private App Token", type: "password", required: true }] },
  { id: "notion_db", name: "Notion Databases", description: "Query, create, update database items", icon: "🗄️", authType: "apikey", docsUrl: "https://developers.notion.com/", category: "Productivity", configFields: [{ key: "api_key", label: "Integration Token", type: "password", required: true }, { key: "database_id", label: "Database ID", type: "text", required: true }] },
  { id: "aws", name: "AWS", description: "S3, Lambda, EC2, DynamoDB, SQS, SNS", icon: "☁️", authType: "apikey", docsUrl: "https://docs.aws.amazon.com/", category: "DevOps", configFields: [{ key: "access_key", label: "Access Key ID", type: "text", required: true }, { key: "secret_key", label: "Secret Access Key", type: "password", required: true }, { key: "region", label: "Region", type: "text", required: true }] },
];

class IntegrationManager {
  listServices(): ServiceDef[] {
    return AVAILABLE_SERVICES;
  }

  listAccounts(): Integration[] {
    const rows = db.query("SELECT * FROM integrations ORDER BY created_at DESC").all() as any[];
    return rows.map((r) => ({
      id: r.id, service: r.service, name: r.name,
      authType: r.auth_type, config: JSON.parse(r.config || "{}"),
      enabled: r.enabled === 1,
      createdAt: r.created_at, updatedAt: r.updated_at,
    }));
  }

  getAccount(id: string): Integration | null {
    const r = db.query("SELECT * FROM integrations WHERE id = ?").get(id) as any;
    if (!r) return null;
    return {
      id: r.id, service: r.service, name: r.name,
      authType: r.auth_type, config: JSON.parse(r.config || "{}"),
      enabled: r.enabled === 1,
      createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }

  addAccount(service: string, name: string, config: Record<string, string>): Integration {
    const svc = AVAILABLE_SERVICES.find((s) => s.id === service);
    if (!svc) throw new Error(`Unknown service: ${service}`);
    const id = randomUUID().slice(0, 12);
    const now = new Date().toISOString();
    db.run(
      "INSERT INTO integrations (id, service, name, auth_type, config, enabled, created_at, updated_at) VALUES (?,?,?,?,?,1,?,?)",
      [id, service, name, svc.authType, JSON.stringify(config), now, now]
    );
    console.log(`[integrations] Added ${service}: ${name} (${id})`);
    return this.getAccount(id)!;
  }

  removeAccount(id: string): boolean {
    db.run("DELETE FROM integration_logs WHERE integration_id = ?", [id]);
    const result = db.run("DELETE FROM integrations WHERE id = ?", [id]);
    return (result.changes ?? 0) > 0;
  }

  toggleAccount(id: string, enabled: boolean): Integration | null {
    const now = new Date().toISOString();
    db.run("UPDATE integrations SET enabled = ?, updated_at = ? WHERE id = ?", [enabled ? 1 : 0, now, id]);
    return this.getAccount(id);
  }

  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    const acc = this.getAccount(id);
    if (!acc) return { success: false, message: "Account not found" };

    const now = new Date().toISOString();
    const logId = randomUUID().slice(0, 12);

    try {
      let ok = false;
      let msg = "";

      switch (acc.service) {
        case "github": {
          const r = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${acc.config.token}`, "User-Agent": "Nova/1.0" }, signal: AbortSignal.timeout(10000) });
          ok = r.ok; msg = ok ? `Authenticated as @${(await r.json()).login}` : `HTTP ${r.status}`;
          break;
        }
        case "slack":
        case "discord": {
          const r = await fetch(acc.config.webhook_url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "✅ Nova integration test successful!" }), signal: AbortSignal.timeout(10000) });
          ok = r.ok; msg = ok ? "Webhook sent test message" : `HTTP ${r.status}`;
          break;
        }
        case "telegram": {
          const r = await fetch(`https://api.telegram.org/bot${acc.config.bot_token}/getMe`, { signal: AbortSignal.timeout(10000) });
          ok = r.ok; msg = ok ? `Bot: ${(await r.json()).result?.username || "OK"}` : `HTTP ${r.status}`;
          break;
        }
        case "youtube": {
          const r = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&type=video&key=${acc.config.api_key}`,
            { signal: AbortSignal.timeout(10000) }
          );
          ok = r.ok;
          msg = ok ? "YouTube Data API connected" : `HTTP ${r.status}`;
          break;
        }
        default:
          msg = "No test available for this service (config saved)";
          ok = true;
      }

      db.run("INSERT INTO integration_logs (id, integration_id, action, status, message, created_at) VALUES (?,?,'test',?,?,?)",
        [logId, id, ok ? "success" : "error", msg, now]);

      return { success: ok, message: msg };
    } catch (e: unknown) {
      const errMsg = safeMessage(e);
      db.run("INSERT INTO integration_logs (id, integration_id, action, status, message, created_at) VALUES (?,?,'test','error',?,?)",
        [logId, id, errMsg, now]);
      return { success: false, message: errMsg };
    }
  }

  getLogs(integrationId: string, limit = 20): any[] {
    return db.query("SELECT * FROM integration_logs WHERE integration_id = ? ORDER BY created_at DESC LIMIT ?")
      .all(integrationId, limit) as any[];
  }

  async executeAction(service: string, action: string, params: Record<string, any>, config: Record<string, string>): Promise<any> {
    const $ = (url: string, opts?: any) => fetch(url, { signal: AbortSignal.timeout(15000), ...opts });

    switch (service) {
      case "slack":
      case "discord": {
        const r = await fetch(config.webhook_url, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: params.text || params.message || "(empty)" }),
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) throw new Error(`Webhook HTTP ${r.status}`);
        return { sent: true };
      }

      case "telegram": {
        const r = await fetch(`https://api.telegram.org/bot${config.bot_token}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: config.chat_id, text: params.text || params.message || "(empty)", parse_mode: "HTML" }),
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) throw new Error(`Telegram HTTP ${r.status}: ${await r.text()}`);
        return { sent: true };
      }

      // ── Developer ──────────────────────────────────────────

      case "github": {
        const h = { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json", "User-Agent": "Nova/1.0" };
        if (action === "create_issue") {
          const r = await $(`https://api.github.com/repos/${params.repo}/issues`, { method: "POST", headers: h, body: JSON.stringify({ title: params.title, body: params.body || "" }) });
          if (!r.ok) throw new Error(`GitHub HTTP ${r.status}`);
          const d: any = await r.json();
          return { url: d.html_url, number: d.number };
        }
        if (action === "list_issues") {
          const r = await $(`https://api.github.com/repos/${params.repo}/issues?state=${params.state || "open"}&per_page=${params.perPage || 10}`, { headers: h });
          if (!r.ok) throw new Error(`GitHub HTTP ${r.status}`);
          const d: any = await r.json();
          return { issues: d.map((i: any) => ({ number: i.number, title: i.title, state: i.state, url: i.html_url, labels: i.labels?.map((l: any) => l.name) })) };
        }
        if (action === "list_repos") {
          const r = await $(`https://api.github.com/user/repos?per_page=${params.perPage || 30}&sort=updated`, { headers: h });
          if (!r.ok) throw new Error(`GitHub HTTP ${r.status}`);
          const d: any = await r.json();
          return { repos: d.map((r: any) => ({ name: r.full_name, url: r.html_url, private: r.private, language: r.language, stars: r.stargazers_count })) };
        }
        throw new Error(`Unknown GitHub action: ${action} (available: create_issue, list_issues, list_repos)`);
      }

      case "gitlab": {
        const h = { "PRIVATE-TOKEN": config.token, "Content-Type": "application/json" };
        const base = config.url || "https://gitlab.com";
        if (action === "list_projects") {
          const r = await $(`${base}/api/v4/projects?per_page=${params.perPage || 20}&membership=true&order_by=updated_at`, { headers: h });
          if (!r.ok) throw new Error(`GitLab HTTP ${r.status}`);
          const d: any = await r.json();
          return { projects: d.map((p: any) => ({ id: p.id, name: p.path_with_namespace, url: p.web_url, visibility: p.visibility })) };
        }
        if (action === "create_issue") {
          const r = await $(`${base}/api/v4/projects/${encodeURIComponent(params.project)}/issues`, { method: "POST", headers: h, body: JSON.stringify({ title: params.title, description: params.description || "" }) });
          if (!r.ok) throw new Error(`GitLab HTTP ${r.status}`);
          const d: any = await r.json();
          return { url: d.web_url, iid: d.iid };
        }
        throw new Error(`Unknown GitLab action: ${action} (available: list_projects, create_issue)`);
      }

      case "bitbucket": {
        const auth = Buffer.from(`${config.username}:${config.app_password}`).toString("base64");
        const h = { Authorization: `Basic ${auth}`, "Content-Type": "application/json" };
        if (action === "list_repos") {
          const r = await $(`https://api.bitbucket.org/2.0/repositories/${config.username}?pagelen=${params.perPage || 10}&sort=-updated_on`, { headers: h });
          if (!r.ok) throw new Error(`Bitbucket HTTP ${r.status}`);
          const d: any = await r.json();
          return { repos: d.values?.map((r: any) => ({ name: r.full_name, url: r.links?.html?.href, language: r.language, private: r.is_private })) || [] };
        }
        throw new Error(`Unknown Bitbucket action: ${action} (available: list_repos)`);
      }

      case "supabase": {
        const h = { apikey: config.service_key, Authorization: `Bearer ${config.service_key}`, "Content-Type": "application/json" };
        const base = config.url;
        if (action === "query") {
          if (!params.table) throw new Error("table parameter required");
          const r = await $(`${base}/rest/v1/${params.table}?select=${params.select || "*"}&limit=${params.limit || 50}`, { headers: h });
          if (!r.ok) throw new Error(`Supabase HTTP ${r.status}`);
          return { rows: await r.json() };
        }
        throw new Error(`Unknown Supabase action: ${action} (available: query)`);
      }

      // ── Productivity ───────────────────────────────────────

      case "notion":
      case "notion_db": {
        const h = { Authorization: `Bearer ${config.api_key}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" };
        if (action === "search") {
          const r = await $("https://api.notion.com/v1/search", { method: "POST", headers: h, body: JSON.stringify({ query: params.query || "", page_size: params.perPage || 10 }) });
          if (!r.ok) throw new Error(`Notion HTTP ${r.status}`);
          const d: any = await r.json();
          return { results: d.results?.map((p: any) => ({ id: p.id, title: p.properties?.title?.title?.[0]?.plain_text || p.url || "(untitled)", url: p.url, type: p.object })) || [] };
        }
        if (action === "create_page") {
          const r = await $("https://api.notion.com/v1/pages", { method: "POST", headers: h, body: JSON.stringify({ parent: { database_id: params.database_id || params.parent_id }, properties: params.properties || {} }) });
          if (!r.ok) throw new Error(`Notion HTTP ${r.status}`);
          const d: any = await r.json();
          return { url: d.url, id: d.id };
        }
        throw new Error(`Unknown Notion action: ${action} (available: search, create_page)`);
      }

      case "linear": {
        const h = { Authorization: config.api_key, "Content-Type": "application/json" };
        if (action === "list_issues") {
          const r = await $("https://api.linear.app/graphql", { method: "POST", headers: h, body: JSON.stringify({ query: `{ issues(first: ${params.perPage || 20}) { nodes { id title identifier state { name } url priority } } }` }) });
          if (!r.ok) throw new Error(`Linear HTTP ${r.status}`);
          const d: any = await r.json();
          return { issues: d.data?.issues?.nodes?.map((i: any) => ({ id: i.identifier, title: i.title, state: i.state?.name, url: i.url, priority: i.priority })) || [] };
        }
        if (action === "create_issue") {
          const r = await $("https://api.linear.app/graphql", { method: "POST", headers: h, body: JSON.stringify({ query: `mutation { issueCreate(input: { title: "${params.title.replace(/"/g, '\\"')}", teamId: "${params.teamId}" ${params.description ? `, description: "${params.description.replace(/"/g, '\\"')}"` : ""} }) { success issue { id identifier url } } }` }) });
          if (!r.ok) throw new Error(`Linear HTTP ${r.status}`);
          const d: any = await r.json();
          return { url: d.data?.issueCreate?.issue?.url, identifier: d.data?.issueCreate?.issue?.identifier };
        }
        throw new Error(`Unknown Linear action: ${action} (available: list_issues, create_issue)`);
      }

      case "jira": {
        const base = `https://${config.domain}`;
        const auth = Buffer.from(`${config.email}:${config.api_token}`).toString("base64");
        const h = { Authorization: `Basic ${auth}`, "Content-Type": "application/json", "Accept": "application/json" };
        if (action === "list_projects") {
          const r = await $(`${base}/rest/api/3/project`, { headers: h });
          if (!r.ok) throw new Error(`Jira HTTP ${r.status}`);
          const d: any = await r.json();
          return { projects: d.map((p: any) => ({ key: p.key, name: p.name, url: `${base}/browse/${p.key}` })) };
        }
        if (action === "create_issue") {
          const body = { fields: { project: { key: params.projectKey }, summary: params.summary, issuetype: { name: params.issueType || "Task" }, description: params.description ? { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: params.description }] }] } : undefined } };
          const r = await $(`${base}/rest/api/3/issue`, { method: "POST", headers: h, body: JSON.stringify(body) });
          if (!r.ok) throw new Error(`Jira HTTP ${r.status}: ${await r.text()}`);
          const d: any = await r.json();
          return { key: d.key, url: `${base}/browse/${d.key}` };
        }
        throw new Error(`Unknown Jira action: ${action} (available: list_projects, create_issue)`);
      }

      case "trello": {
        const q = `key=${config.api_key}&token=${config.token}`;
        if (action === "list_boards") {
          const r = await $(`https://api.trello.com/1/members/me/boards?${q}&fields=name,url`);
          if (!r.ok) throw new Error(`Trello HTTP ${r.status}`);
          return { boards: await r.json() };
        }
        if (action === "list_lists") {
          if (!params.boardId) throw new Error("boardId required");
          const r = await $(`https://api.trello.com/1/boards/${params.boardId}/lists?${q}&fields=name`);
          if (!r.ok) throw new Error(`Trello HTTP ${r.status}`);
          return { lists: await r.json() };
        }
        if (action === "create_card") {
          if (!params.listId || !params.name) throw new Error("listId and name required");
          const r = await $(`https://api.trello.com/1/cards?${q}&idList=${params.listId}&name=${encodeURIComponent(params.name)}${params.desc ? `&desc=${encodeURIComponent(params.desc)}` : ""}`, { method: "POST" });
          if (!r.ok) throw new Error(`Trello HTTP ${r.status}`);
          const d: any = await r.json();
          return { url: d.url, id: d.id };
        }
        throw new Error(`Unknown Trello action: ${action} (available: list_boards, list_lists, create_card)`);
      }

      case "asana": {
        const h = { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" };
        if (action === "list_projects") {
          const r = await $(`https://app.asana.com/api/1.0/projects?limit=${params.perPage || 20}&opt_fields=name,notes,color`, { headers: h });
          if (!r.ok) throw new Error(`Asana HTTP ${r.status}`);
          const d: any = await r.json();
          return { projects: d.data?.map((p: any) => ({ gid: p.gid, name: p.name, color: p.color })) || [] };
        }
        if (action === "create_task") {
          if (!params.projects && !params.workspace) throw new Error("projects or workspace required");
          const r = await $("https://app.asana.com/api/1.0/tasks", { method: "POST", headers: h, body: JSON.stringify({ data: { name: params.name, notes: params.notes || "", projects: params.projects ? [params.projects] : undefined, workspace: params.workspace } }) });
          if (!r.ok) throw new Error(`Asana HTTP ${r.status}`);
          const d: any = await r.json();
          return { gid: d.data?.gid, url: `https://app.asana.com/0/0/${d.data?.gid}` };
        }
        throw new Error(`Unknown Asana action: ${action} (available: list_projects, create_task)`);
      }

      // ── AI ─────────────────────────────────────────────────

      case "openai": {
        const h = { Authorization: `Bearer ${config.api_key}`, "Content-Type": "application/json" };
        if (action === "list_models") {
          const r = await $("https://api.openai.com/v1/models", { headers: h });
          if (!r.ok) throw new Error(`OpenAI HTTP ${r.status}`);
          const d: any = await r.json();
          return { models: d.data?.map((m: any) => m.id) || [] };
        }
        if (action === "chat") {
          const r = await $("https://api.openai.com/v1/chat/completions", { method: "POST", headers: h, body: JSON.stringify({ model: params.model || "gpt-4o-mini", messages: params.messages || [{ role: "user", content: params.prompt }], max_tokens: params.maxTokens || 500 }) });
          if (!r.ok) throw new Error(`OpenAI HTTP ${r.status}`);
          const d: any = await r.json();
          return { text: d.choices?.[0]?.message?.content || "" };
        }
        throw new Error(`Unknown OpenAI action: ${action} (available: list_models, chat)`);
      }

      case "anthropic": {
        const h = { "x-api-key": config.api_key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" };
        if (action === "chat") {
          const r = await $("https://api.anthropic.com/v1/messages", { method: "POST", headers: h, body: JSON.stringify({ model: params.model || "claude-sonnet-4-20250514", max_tokens: params.maxTokens || 500, messages: [{ role: "user", content: params.prompt || params.messages?.[0]?.content || "" }] }) });
          if (!r.ok) throw new Error(`Anthropic HTTP ${r.status}`);
          const d: any = await r.json();
          return { text: d.content?.[0]?.text || "" };
        }
        throw new Error(`Unknown Anthropic action: ${action} (available: chat)`);
      }

      case "stability": {
        const h = { Authorization: `Bearer ${config.api_key}`, Accept: "application/json" };
        if (action === "generate_image") {
          const r = await $("https://api.stability.ai/v2beta/stable-image/generate/sd3", { method: "POST", headers: { ...h, "Content-Type": "multipart/form-data" }, body: (() => { const fd = new FormData(); fd.append("prompt", params.prompt); if (params.aspectRatio) fd.append("aspect_ratio", params.aspectRatio); if (params.negativePrompt) fd.append("negative_prompt", params.negativePrompt); return fd; })() });
          if (!r.ok) throw new Error(`Stability AI HTTP ${r.status}`);
          return { image: "generated (binary)", contentType: r.headers.get("content-type") };
        }
        throw new Error(`Unknown Stability action: ${action} (available: generate_image)`);
      }

      case "elevenlabs": {
        const h = { "xi-api-key": config.api_key, "Content-Type": "application/json" };
        if (action === "list_voices") {
          const r = await $("https://api.elevenlabs.io/v1/voices", { headers: h });
          if (!r.ok) throw new Error(`ElevenLabs HTTP ${r.status}`);
          const d: any = await r.json();
          return { voices: d.voices?.map((v: any) => ({ id: v.voice_id, name: v.name, category: v.category })) || [] };
        }
        if (action === "text_to_speech") {
          if (!params.voiceId) throw new Error("voiceId required");
          const r = await $(`https://api.elevenlabs.io/v1/text-to-speech/${params.voiceId}`, { method: "POST", headers: h, body: JSON.stringify({ text: params.text, model_id: params.modelId || "eleven_multilingual_v2" }) });
          if (!r.ok) throw new Error(`ElevenLabs HTTP ${r.status}`);
          return { audio: "generated (binary stream)", contentType: r.headers.get("content-type") };
        }
        throw new Error(`Unknown ElevenLabs action: ${action} (available: list_voices, text_to_speech)`);
      }

      case "pinecone": {
        const h = { "Api-Key": config.api_key, "Content-Type": "application/json", "X-Pinecone-API-Version": "2024-10" };
        if (action === "list_indexes") {
          const r = await $("https://api.pinecone.io/indexes", { headers: h });
          if (!r.ok) throw new Error(`Pinecone HTTP ${r.status}`);
          return { indexes: await r.json() };
        }
        throw new Error(`Unknown Pinecone action: ${action} (available: list_indexes)`);
      }

      // ── YouTube ─────────────────────────────────────────────

      case "youtube": {
        const key = config.api_key;
        if (!key) throw new Error("YouTube API key not configured");
        switch (action) {
          case "search_videos": {
            if (!params.query) throw new Error("query parameter required");
            const r = await $(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(params.query)}&maxResults=${params.maxResults || 10}&type=video&key=${key}`);
            if (!r.ok) throw new Error(`YouTube API HTTP ${r.status}`);
            const data: any = await r.json();
            return { videos: (data.items || []).map((v: any) => ({ id: v.id.videoId, title: v.snippet.title, channel: v.snippet.channelTitle, description: v.snippet.description?.slice(0, 200), publishedAt: v.snippet.publishedAt, url: `https://youtu.be/${v.id.videoId}`, thumbnail: v.snippet.thumbnails?.medium?.url })) };
          }
          case "get_video_stats": {
            if (!params.videoId) throw new Error("videoId parameter required");
            const r = await $(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${params.videoId}&key=${key}`);
            if (!r.ok) throw new Error(`YouTube API HTTP ${r.status}`);
            const data: any = await r.json();
            const v = data.items?.[0];
            if (!v) throw new Error("Video not found");
            return { id: v.id, title: v.snippet.title, channel: v.snippet.channelTitle, views: parseInt(v.statistics.viewCount || "0"), likes: parseInt(v.statistics.likeCount || "0"), comments: parseInt(v.statistics.commentCount || "0"), url: `https://youtu.be/${v.id}` };
          }
          case "search_channels": {
            if (!params.query) throw new Error("query parameter required");
            const r = await $(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(params.query)}&maxResults=${params.maxResults || 5}&type=channel&key=${key}`);
            if (!r.ok) throw new Error(`YouTube API HTTP ${r.status}`);
            const data: any = await r.json();
            return { channels: (data.items || []).map((c: any) => ({ id: c.snippet.channelId, title: c.snippet.channelTitle, description: c.snippet.description?.slice(0, 200), thumbnail: c.snippet.thumbnails?.medium?.url })) };
          }
          default: throw new Error(`Unknown YouTube action: ${action} (available: search_videos, get_video_stats, search_channels)`);
        }
      }

      // ── Business ────────────────────────────────────────────

      case "shopify": {
        const base = `https://${config.store}.myshopify.com`;
        const h = { "X-Shopify-Access-Token": config.access_token, "Content-Type": "application/json" };
        if (action === "list_products") {
          const r = await $(`${base}/admin/api/2024-01/products.json?limit=${params.limit || 20}`, { headers: h });
          if (!r.ok) throw new Error(`Shopify HTTP ${r.status}`);
          const d: any = await r.json();
          return { products: d.products?.map((p: any) => ({ id: p.id, title: p.title, status: p.status, variants: p.variants?.length, url: `https://${config.store}.myshopify.com/products/${p.handle}` })) || [] };
        }
        if (action === "list_orders") {
          const r = await $(`${base}/admin/api/2024-01/orders.json?status=${params.status || "any"}&limit=${params.limit || 20}`, { headers: h });
          if (!r.ok) throw new Error(`Shopify HTTP ${r.status}`);
          const d: any = await r.json();
          return { orders: d.orders?.map((o: any) => ({ id: o.id, name: o.name, total: o.total_price, currency: o.currency, financialStatus: o.financial_status, createdAt: o.created_at })) || [] };
        }
        throw new Error(`Unknown Shopify action: ${action} (available: list_products, list_orders)`);
      }

      case "stripe": {
        const h = { Authorization: `Bearer ${config.secret_key}`, "Content-Type": "application/x-www-form-urlencoded" };
        if (action === "list_products") {
          const r = await $(`https://api.stripe.com/v1/products?limit=${params.limit || 20}&active=true`, { headers: h });
          if (!r.ok) throw new Error(`Stripe HTTP ${r.status}`);
          const d: any = await r.json();
          return { products: d.data?.map((p: any) => ({ id: p.id, name: p.name, description: p.description, active: p.active })) || [] };
        }
        if (action === "list_charges") {
          const r = await $(`https://api.stripe.com/v1/charges?limit=${params.limit || 20}`, { headers: h });
          if (!r.ok) throw new Error(`Stripe HTTP ${r.status}`);
          const d: any = await r.json();
          return { charges: d.data?.map((c: any) => ({ id: c.id, amount: c.amount / 100, currency: c.currency, status: c.status, created: new Date(c.created * 1000).toISOString(), description: c.description, receiptUrl: c.receipt_url })) || [] };
        }
        if (action === "list_customers") {
          const r = await $(`https://api.stripe.com/v1/customers?limit=${params.limit || 20}`, { headers: h });
          if (!r.ok) throw new Error(`Stripe HTTP ${r.status}`);
          const d: any = await r.json();
          return { customers: d.data?.map((c: any) => ({ id: c.id, email: c.email, name: c.name, created: new Date(c.created * 1000).toISOString() })) || [] };
        }
        throw new Error(`Unknown Stripe action: ${action} (available: list_products, list_charges, list_customers)`);
      }

      case "hubspot": {
        const h = { Authorization: `Bearer ${config.access_token}`, "Content-Type": "application/json" };
        if (action === "list_contacts") {
          const r = await $(`https://api.hubapi.com/crm/v3/objects/contacts?limit=${params.limit || 20}&properties=firstname,lastname,email,phone`, { headers: h });
          if (!r.ok) throw new Error(`HubSpot HTTP ${r.status}`);
          const d: any = await r.json();
          return { contacts: d.results?.map((c: any) => ({ id: c.id, firstName: c.properties?.firstname, lastName: c.properties?.lastname, email: c.properties?.email, phone: c.properties?.phone })) || [] };
        }
        if (action === "list_deals") {
          const r = await $(`https://api.hubapi.com/crm/v3/objects/deals?limit=${params.limit || 20}&properties=dealname,amount,dealstage`, { headers: h });
          if (!r.ok) throw new Error(`HubSpot HTTP ${r.status}`);
          const d: any = await r.json();
          return { deals: d.results?.map((d: any) => ({ id: d.id, name: d.properties?.dealname, amount: d.properties?.amount, stage: d.properties?.dealstage })) || [] };
        }
        throw new Error(`Unknown HubSpot action: ${action} (available: list_contacts, list_deals)`);
      }

      // ── DevOps ──────────────────────────────────────────────

      case "sentry": {
        const h = { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" };
        if (action === "list_issues") {
          const r = await $(`https://${config.organization}.sentry.io/api/0/projects/${config.organization}/${params.project || "sentry"}/issues/?limit=${params.limit || 20}`, { headers: h });
          if (!r.ok) throw new Error(`Sentry HTTP ${r.status}`);
          const d: any = await r.json();
          return { issues: d.map((i: any) => ({ id: i.id, title: i.title, level: i.level, count: i.count, firstSeen: i.firstSeen, lastSeen: i.lastSeen, permalink: i.permalink })) };
        }
        throw new Error(`Unknown Sentry action: ${action} (available: list_issues)`);
      }

      case "datadog": {
        const auth = Buffer.from(`${config.api_key}:${config.app_key}`).toString("base64");
        const h = { "DD-API-KEY": config.api_key, "DD-APPLICATION-KEY": config.app_key, "Content-Type": "application/json" };
        if (action === "list_monitors") {
          const r = await $("https://api.datadoghq.com/api/v1/monitor?page_size=20", { headers: h });
          if (!r.ok) throw new Error(`Datadog HTTP ${r.status}`);
          const d: any = await r.json();
          return { monitors: d.map((m: any) => ({ id: m.id, name: m.name, type: m.type, status: m.overall_state })) };
        }
        throw new Error(`Unknown Datadog action: ${action} (available: list_monitors)`);
      }

      case "pagerduty": {
        const h = { Authorization: `Token token=${config.api_key}`, Accept: "application/json" };
        if (action === "list_incidents") {
          const r = await $(`https://api.pagerduty.com/incidents?limit=${params.limit || 20}&statuses[]=${params.status || "triggered,acknowledged"}`, { headers: h });
          if (!r.ok) throw new Error(`PagerDuty HTTP ${r.status}`);
          const d: any = await r.json();
          return { incidents: d.incidents?.map((i: any) => ({ id: i.id, title: i.title, status: i.status, urgency: i.urgency, createdAt: i.created_at, url: i.html_url })) || [] };
        }
        throw new Error(`Unknown PagerDuty action: ${action} (available: list_incidents)`);
      }

      // ── Design ──────────────────────────────────────────────

      case "figma": {
        const h = { "X-Figma-Token": config.token };
        if (action === "get_file") {
          if (!params.fileKey) throw new Error("fileKey required");
          const r = await $(`https://api.figma.com/v1/files/${params.fileKey}`, { headers: h });
          if (!r.ok) throw new Error(`Figma HTTP ${r.status}`);
          const d: any = await r.json();
          return { name: d.name, lastModified: d.lastModified, document: d.document?.children?.map((c: any) => ({ type: c.type, name: c.name, id: c.id })) || [] };
        }
        if (action === "get_images") {
          if (!params.fileKey || !params.ids) throw new Error("fileKey and ids required");
          const r = await $(`https://api.figma.com/v1/images/${params.fileKey}?ids=${params.ids}&format=png`, { headers: h });
          if (!r.ok) throw new Error(`Figma HTTP ${r.status}`);
          const d: any = await r.json();
          return { images: d.images };
        }
        throw new Error(`Unknown Figma action: ${action} (available: get_file, get_images)`);
      }

      default:
        throw new Error(`Service ${service} action not implemented yet. Available actions are being added per service.`);
    }
  }
}

export const integrationManager = new IntegrationManager();

// ─── Register Tools ──────────────────────────────────────────

registerTool({
  name: "integration_list",
  description: "List all available integration services",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  async execute() {
    const services = integrationManager.listServices();
    return `🔌 Available integrations (${services.length}):\n${
      services.map((s) => `  ${s.icon} ${s.name} — ${s.description}`).join("\n")
    }`;
  },
});

registerTool({
  name: "integration_add",
  description: "Connect a service integration (API key, webhook URL, etc.)",
  parameters: {
    type: "object",
    properties: {
      service: { type: "string", description: "Service ID (e.g. slack, github, notion)" },
      name: { type: "string", description: "Display name for this connection" },
      config: { type: "object", description: "Configuration key-value pairs (api_key, token, webhook_url, etc.)" },
    },
    required: ["service", "name", "config"],
    additionalProperties: false,
  },
  async execute(args: { service: string; name: string; config: Record<string, string> }) {
    try {
      const acc = integrationManager.addAccount(args.service, args.name, args.config);
      return `✅ Connected ${args.service}: ${args.name} (${acc.id})`;
    } catch (e: unknown) {
      return `❌ ${safeMessage(e)}`;
    }
  },
});

registerTool({
  name: "integration_list_accounts",
  description: "List your connected integration accounts",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  async execute() {
    const accs = integrationManager.listAccounts();
    if (accs.length === 0) return "No connected integrations.";
    return `🔗 Connected integrations (${accs.length}):\n${
      accs.map((a) => `  ${a.enabled ? "✅" : "⏸️"} ${a.name} (${a.service}) — ${a.id}`).join("\n")
    }`;
  },
});

registerTool({
  name: "integration_remove",
  description: "Remove a connected integration account",
  parameters: {
    type: "object",
    properties: { id: { type: "string", description: "Account ID" } },
    required: ["id"],
    additionalProperties: false,
  },
  async execute(args: { id: string }) {
    return integrationManager.removeAccount(args.id) ? `🗑️ Removed integration ${args.id}` : `❌ Not found`;
  },
});

registerTool({
  name: "integration_test",
  description: "Test a connected integration",
  parameters: {
    type: "object",
    properties: { id: { type: "string", description: "Account ID" } },
    required: ["id"],
    additionalProperties: false,
  },
  async execute(args: { id: string }) {
    const result = await integrationManager.testConnection(args.id);
    return result.success ? `✅ ${result.message}` : `❌ ${result.message}`;
  },
});

registerTool({
  name: "integration_execute",
  description: "Execute an action on a connected integration service — supports: Slack/Discord send_message, Telegram send_message, GitHub create_issue/list_issues/list_repos, GitLab list_projects/create_issue, Bitbucket list_repos, Supabase query, Notion search/create_page, Linear list_issues/create_issue, Jira list_projects/create_issue, Trello list_boards/list_lists/create_card, Asana list_projects/create_task, YouTube search_videos/get_video_stats/search_channels, OpenAI list_models/chat, Anthropic chat, Stability generate_image, ElevenLabs list_voices/text_to_speech, Pinecone list_indexes, Shopify list_products/list_orders, Stripe list_products/list_charges/list_customers, HubSpot list_contacts/list_deals, Sentry list_issues, Datadog list_monitors, PagerDuty list_incidents, Figma get_file/get_images",
  parameters: {
    type: "object",
    properties: {
      accountId: { type: "string", description: "Integration account ID (from integration_list_accounts)" },
      action: { type: "string", description: "Action to execute. See description for full list per service." },
      params: { type: "object", description: "Parameters: { text/message: string } for send_message, { repo: string, title: string, body?: string } for create_issue" },
    },
    required: ["accountId", "action", "params"],
    additionalProperties: false,
  },
  async execute(args: { accountId: string; action: string; params: Record<string, any> }) {
    try {
      const acc = integrationManager.getAccount(args.accountId);
      if (!acc) return `❌ Account ${args.accountId} not found`;
      if (!acc.enabled) return `❌ Account ${acc.name} is disabled`;
      const result = await integrationManager.executeAction(acc.service, args.action, args.params, acc.config);
      return `✅ ${acc.service}: ${args.action} succeeded${result.url ? ` — ${result.url}` : ""}`;
    } catch (e: unknown) {
      return `❌ ${safeMessage(e)}`;
    }
  },
});
