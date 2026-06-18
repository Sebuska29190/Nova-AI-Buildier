/**
 * Nexus AI Email Bridge — IMAP polling + SMTP send
 * Ported from Hermes Agent email_tool.py + send_message_tool.py
 *
 * Supports: send, list, read (full), reply, search, list_folders
 * Config: EMAIL_IMAP_HOST, EMAIL_IMAP_PORT, EMAIL_IMAP_USER, EMAIL_IMAP_PASS
 *         EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, EMAIL_SMTP_USER, EMAIL_SMTP_PASS
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

// We'll use dynamic imports for nodemailer (SMTP) and node-imap/mailparser
interface ImapConnection {
  connect(): Promise<void>;
  disconnect(): void;
  getFolders(): Promise<string[]>;
  search(criteria: any[]): Promise<number[]>;
  fetch(uids: number[], options: any): Promise<any[]>;
}

interface EmailFetchResult {
  uid: number;
  subject: string;
  from: string;
  to: string;
  date: Date;
  text: string;
  html?: string;
  attachments?: { filename: string; contentType: string; size: number }[];
}

export interface EmailMessage {
  uid: number;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  hasAttachments: boolean;
}

export interface EmailFull extends EmailMessage {
  text: string;
  html?: string;
  attachments?: { filename: string; contentType: string; size: number }[];
  headers: Record<string, string>;
}

export interface EmailConfig {
  imap: { host: string; port: number; user: string; password: string; tls?: boolean };
  smtp: { host: string; port: number; user: string; password: string; tls?: boolean };
  pollingInterval?: number;
}

let _config: EmailConfig | null = null;
let _imap: any = null; // ImapFlow or node-imap instance

function getConfig(): EmailConfig {
  if (_config) return _config;

  const cfg: EmailConfig = {
    imap: {
      host: process.env.EMAIL_IMAP_HOST || "",
      port: parseInt(process.env.EMAIL_IMAP_PORT || "993"),
      user: process.env.EMAIL_IMAP_USER || "",
      password: process.env.EMAIL_IMAP_PASS || "",
      tls: true,
    },
    smtp: {
      host: process.env.EMAIL_SMTP_HOST || process.env.EMAIL_IMAP_HOST || "",
      port: parseInt(process.env.EMAIL_SMTP_PORT || "587"),
      user: process.env.EMAIL_SMTP_USER || process.env.EMAIL_IMAP_USER || "",
      password: process.env.EMAIL_SMTP_PASS || process.env.EMAIL_IMAP_PASS || "",
      tls: true,
    },
  };

  if (!cfg.imap.host || !cfg.imap.user || !cfg.imap.password) {
    throw new Error("Email not configured. Set EMAIL_IMAP_HOST, EMAIL_IMAP_USER, EMAIL_IMAP_PASS in .env");
  }

  _config = cfg;
  return cfg;
}

export function configureEmail(cfg: Partial<EmailConfig>) {
  if (cfg.imap) _config = { ..._config, imap: { ..._config?.imap, ...cfg.imap } as any };
  if (cfg.smtp) _config = { ..._config, smtp: { ..._config?.smtp, ...cfg.smtp } as any };
  if (cfg.pollingInterval) _config = { ..._config, pollingInterval: cfg.pollingInterval };
}

async function getImapConnection() {
  if (_imap) return _imap;

  const cfg = getConfig();
  // Dynamic import of ImapFlow (lighter than node-imap)
  try {
    const { ImapFlow } = await import("imapflow");
    _imap = new ImapFlow({
      host: cfg.imap.host,
      port: cfg.imap.port,
      auth: { user: cfg.imap.user, pass: cfg.imap.password },
      tls: cfg.imap.tls !== false,
      logger: false,
    });
    await _imap.connect();
    return _imap;
  } catch (e: any) {
    throw new Error(`IMAP connection failed: ${e.message}. Install imapflow: npm install imapflow`);
  }
}

async function getSmtpTransport() {
  const cfg = getConfig();
  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: cfg.smtp.host,
      port: cfg.smtp.port,
      secure: cfg.smtp.tls !== false && cfg.smtp.port === 465,
      auth: { user: cfg.smtp.user, pass: cfg.smtp.password },
      tls: { rejectUnauthorized: false },
    });
    return transporter;
  } catch (e: any) {
    throw new Error(`SMTP setup failed: ${e.message}. Install nodemailer: npm install nodemailer`);
  }
}

/**
 * Send an email
 */
export async function emailSend(to: string, subject: string, body: string, options?: {
  cc?: string; bcc?: string; replyTo?: string; attachments?: { filename: string; path: string }[];
}): Promise<string> {
  const transport = await getSmtpTransport();
  try {
    const info = await transport.sendMail({
      from: `"Nexus AI" <${getConfig().smtp.user}>`,
      to,
      cc: options?.cc,
      bcc: options?.bcc,
      replyTo: options?.replyTo,
      subject,
      text: body,
      attachments: options?.attachments,
    });
    return `Email sent: ${info.messageId}`;
  } catch (e: any) {
    throw new Error(`Email send failed: ${e.message}`);
  } finally {
    transport.close();
  }
}

/**
 * List recent emails in a folder
 */
export async function emailList(folder = "INBOX", limit = 20): Promise<EmailMessage[]> {
  const client = await getImapConnection();
  try {
    // Get total count
    const mailbox = await client.mailboxOpen(folder);
    const total = mailbox.exists;
    const start = Math.max(1, total - limit + 1);

    for await (const msg of client.fetch(`${start}:${total}`, { uid: true, envelope: true, source: false })) {
      messages.push({
        uid: msg.uid,
        subject: msg.envelope.subject || "(no subject)",
        from: msg.envelope.from?.[0]?.address || "(unknown)",
        to: msg.envelope.to?.[0]?.address || "",
        date: msg.envelope.date?.toISOString() || "",
        snippet: msg.envelope.subject?.slice(0, 100) || "",
        hasAttachments: false,
      });
    }

    return messages.reverse().slice(0, limit);
  } catch (e: any) {
    throw new Error(`Email list failed: ${e.message}`);
  }
}

/**
 * Read a full email by UID
 */
export async function emailRead(uid: number): Promise<EmailFull> {
  const client = await getImapConnection();
  try {
    for await (const msg of client.fetch(`${uid}`, { uid: true, envelope: true, bodyStructure: true, source: true })) {
      const text = msg.text?.toString() || "";
      const html = msg.html?.toString() || undefined;
      const headers: Record<string, string> = {};

      // Parse simplified headers
      if (msg.envelope) {
        headers["subject"] = msg.envelope.subject || "";
        headers["from"] = msg.envelope.from?.[0]?.address || "";
        headers["to"] = msg.envelope.to?.[0]?.address || "";
        headers["date"] = msg.envelope.date?.toISOString() || "";
      }

      return {
        uid: msg.uid,
        subject: msg.envelope.subject || "(no subject)",
        from: msg.envelope.from?.[0]?.address || "(unknown)",
        to: msg.envelope.to?.[0]?.address || "",
        date: msg.envelope.date?.toISOString() || "",
        snippet: text.slice(0, 200),
        text,
        html,
        attachments: [],
        headers,
      };
    }
    throw new Error(`Email UID ${uid} not found`);
  } catch (e: any) {
    throw new Error(`Email read failed: ${e.message}`);
  }
}

/**
 * Reply to an email
 */
export async function emailReply(uid: number, body: string): Promise<string> {
  const original = await emailRead(uid);
  return await emailSend(original.from, `Re: ${original.subject}`, body, {
    replyTo: original.from,
  });
}

/**
 * Search emails by subject or sender
 */
export async function emailSearch(query: string, folder = "INBOX", limit = 20): Promise<EmailMessage[]> {
  const client = await getImapConnection();
  try {
    await client.mailboxOpen(folder);
    const messages: EmailMessage[] = [];
    const mailbox = await client.mailboxOpen(folder);
    const total = mailbox.exists;
    const start = Math.max(1, total - 100 + 1); // Search last 100

    for await (const msg of client.fetch(`${start}:${total}`, { uid: true, envelope: true })) {
      const subject = msg.envelope.subject || "";
      const from = msg.envelope.from?.[0]?.address || "";
      if (subject.toLowerCase().includes(query.toLowerCase()) || from.toLowerCase().includes(query.toLowerCase())) {
        messages.push({
          uid: msg.uid,
          subject,
          from,
          to: msg.envelope.to?.[0]?.address || "",
          date: msg.envelope.date?.toISOString() || "",
          snippet: subject.slice(0, 100),
          hasAttachments: false,
        });
      }
    }

    return messages.slice(0, limit);
  } catch (e: any) {
    throw new Error(`Email search failed: ${e.message}`);
  }
}

/**
 * List available IMAP folders
 */
export async function emailListFolders(): Promise<string[]> {
  const client = await getImapConnection();
  try {
    const folders = await client.listMailboxes();
    return folders.map((f: any) => f.path).filter(Boolean);
  } catch (e: any) {
    throw new Error(`Email folders failed: ${e.message}`);
  }
}

/**
 * Disconnect IMAP
 */
export async function emailDisconnect(): Promise<string> {
  if (_imap) {
    try {
      await _imap.logout();
    } catch {}
    _imap = null;
  }
  return "Email disconnected";
}
