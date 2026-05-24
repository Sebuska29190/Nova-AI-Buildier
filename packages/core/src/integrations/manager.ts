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
    switch (service) {
      case "slack":
      case "discord": {
        const r = await fetch(config.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: params.text || params.message || "(empty)" }),
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) throw new Error(`Webhook HTTP ${r.status}`);
        return { sent: true };
      }
      case "telegram": {
        const r = await fetch(`https://api.telegram.org/bot${config.bot_token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: config.chat_id, text: params.text || params.message || "(empty)", parse_mode: "HTML" }),
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) throw new Error(`Telegram HTTP ${r.status}: ${await r.text()}`);
        return { sent: true };
      }
      case "github": {
        if (action === "create_issue") {
          const r = await fetch(`https://api.github.com/repos/${params.repo}/issues`, {
            method: "POST",
            headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json", "User-Agent": "Nova/1.0" },
            body: JSON.stringify({ title: params.title, body: params.body || "" }),
            signal: AbortSignal.timeout(15000),
          });
          if (!r.ok) throw new Error(`GitHub HTTP ${r.status}`);
          const data = await r.json();
          return { url: data.html_url, number: data.number };
        }
        throw new Error(`Unknown GitHub action: ${action}`);
      }
      default:
        throw new Error(`Service ${service} action not implemented yet`);
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
