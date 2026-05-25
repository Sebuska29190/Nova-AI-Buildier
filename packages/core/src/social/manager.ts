/**
 * Social Media Manager — browser-based + API-based automation for posting to social platforms.
 *
 * Auth methods:
 * - "browser" — opens Chrome with saved profile, user logs in manually
 * - "api_key" — user provides API token/app password, verified via API call
 *
 * Supports: Bluesky (API), TikTok (browser), Instagram (browser), YouTube (browser),
 * LinkedIn (browser), Facebook (browser), Reddit (browser), Threads (browser), X/Twitter (API)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const SOCIAL_DIR = join(process.cwd(), "data", "social");
mkdirSync(SOCIAL_DIR, { recursive: true });

export interface SocialAccount {
  id: string;
  name: string;
  platform: string;
  authMethod: "browser" | "api_key";
  authStatus: "pending" | "connected" | "error";
  profileDir: string;     // for browser-method — path to Chrome profile
  apiConfig: Record<string, string>;  // for api_key method — { apiKey, endpoint, ... }
  username?: string;
  createdAt: string;
  lastUsed?: string;
  errorMessage?: string;
}

// ─── Platform definitions ──────────────────────────────────────

export interface PlatformDef {
  id: string;
  name: string;
  icon: string;
  authMethod: "browser" | "api_key";
  loginUrl?: string;
  apiFields?: { key: string; label: string; type: "text" | "password" | "url"; required: boolean }[];
  verifyFn?: (config: Record<string, string>) => Promise<{ ok: boolean; username?: string; error?: string }>;
}

const apiVerifyFns: Record<string, (cfg: Record<string, string>) => Promise<{ ok: boolean; username?: string; error?: string }>> = {
  bluesky: async (cfg) => {
    try {
      const r = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: cfg.identifier, password: cfg.appPassword }),
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        return { ok: false, error: (e as any).message || `HTTP ${r.status}` };
      }
      const data = await r.json() as any;
      return { ok: true, username: data.handle };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },
  x: async (cfg) => {
    try {
      const r = await fetch("https://api.twitter.com/2/users/me", {
        headers: { Authorization: `Bearer ${cfg.apiKey}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
      const data = await r.json() as any;
      return { ok: true, username: data.data?.username };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },
};

export const PLATFORM_DEFS: PlatformDef[] = [
  { id: "bluesky",    name: "Bluesky",  icon: "🦋", authMethod: "api_key", apiFields: [
    { key: "identifier", label: "Handle or Email", type: "text", required: true },
    { key: "appPassword", label: "App Password", type: "password", required: true },
  ], verifyFn: apiVerifyFns.bluesky },
  { id: "x",           name: "X / Twitter", icon: "🐦", authMethod: "api_key", apiFields: [
    { key: "apiKey", label: "Bearer Token", type: "password", required: true },
    { key: "apiSecret", label: "API Secret (optional)", type: "password", required: false },
  ], verifyFn: apiVerifyFns.x },
  { id: "tiktok",      name: "TikTok",       icon: "🎵", authMethod: "browser", loginUrl: "https://www.tiktok.com/login" },
  { id: "instagram",   name: "Instagram",    icon: "📸", authMethod: "browser", loginUrl: "https://www.instagram.com/accounts/login/" },
  { id: "youtube",     name: "YouTube",      icon: "▶️", authMethod: "browser", loginUrl: "https://accounts.google.com/ServiceLogin?service=youtube" },
  { id: "linkedin",    name: "LinkedIn",     icon: "💼", authMethod: "browser", loginUrl: "https://www.linkedin.com/login" },
  { id: "facebook",    name: "Facebook",     icon: "👍", authMethod: "browser", loginUrl: "https://www.facebook.com/login" },
  { id: "reddit",      name: "Reddit",       icon: "👽", authMethod: "browser", loginUrl: "https://www.reddit.com/login" },
  { id: "threads",     name: "Threads",      icon: "🧵", authMethod: "browser", loginUrl: "https://www.threads.net/login" },
];

// ─── Persistence ───────────────────────────────────────────────

const accounts: SocialAccount[] = [];
const ACCOUNTS_FILE = join(SOCIAL_DIR, "accounts.json");

function loadAccounts(): void {
  try {
    if (existsSync(ACCOUNTS_FILE)) {
      const data = JSON.parse(readFileSync(ACCOUNTS_FILE, "utf-8"));
      accounts.length = 0;
      accounts.push(...data);
    }
  } catch {}
}

function saveAccounts(): void {
  try {
    writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), "utf-8");
  } catch {}
}

loadAccounts();

// ─── CRUD ──────────────────────────────────────────────────────

export function getPlatformDef(platform: string): PlatformDef | undefined {
  return PLATFORM_DEFS.find(p => p.id === platform);
}

export function listAccounts(): SocialAccount[] {
  return [...accounts];
}

export function getAccount(id: string): SocialAccount | undefined {
  return accounts.find(a => a.id === id);
}

export function addAccount(params: {
  name: string;
  platform: string;
  apiConfig?: Record<string, string>;
}): SocialAccount {
  const platDef = getPlatformDef(params.platform);
  const authMethod = platDef?.authMethod || "browser";
  const id = `social_${Date.now().toString(36)}`;
  const profileDir = authMethod === "browser" ? join(SOCIAL_DIR, "profiles", id) : "";
  if (authMethod === "browser") mkdirSync(profileDir, { recursive: true });

  const account: SocialAccount = {
    id,
    name: params.name,
    platform: params.platform,
    authMethod,
    authStatus: "pending",
    profileDir,
    apiConfig: params.apiConfig || {},
    createdAt: new Date().toISOString(),
  };

  accounts.push(account);
  saveAccounts();
  return account;
}

export function removeAccount(id: string): boolean {
  const idx = accounts.findIndex(a => a.id === id);
  if (idx === -1) return false;
  const account = accounts[idx];
  if (account.profileDir) {
    try { rmSync(account.profileDir, { recursive: true, force: true }); } catch {}
  }
  accounts.splice(idx, 1);
  saveAccounts();
  return true;
}

export function updateAccount(id: string, updates: Partial<SocialAccount>): SocialAccount | undefined {
  const account = accounts.find(a => a.id === id);
  if (!account) return undefined;
  Object.assign(account, updates);
  account.lastUsed = new Date().toISOString();
  saveAccounts();
  return account;
}

// ─── Auth ──────────────────────────────────────────────────────

export async function verifyAndConnect(id: string): Promise<{ ok: boolean; username?: string; error?: string }> {
  const account = getAccount(id);
  if (!account) return { ok: false, error: "Account not found" };

  const platDef = getPlatformDef(account.platform);
  if (!platDef) return { ok: false, error: "Unknown platform" };

  if (platDef.authMethod === "api_key" && platDef.verifyFn) {
    const result = await platDef.verifyFn(account.apiConfig);
    if (result.ok) {
      updateAccount(id, { authStatus: "connected", username: result.username, errorMessage: undefined });
    } else {
      updateAccount(id, { authStatus: "error", errorMessage: result.error });
    }
    return result;
  }

  // Browser-based — mark as pending, user must log in
  if (platDef.authMethod === "browser") {
    updateAccount(id, { authStatus: "pending" });
    return { ok: true, username: account.username };
  }

  return { ok: false, error: "No auth method available" };
}

export async function verifyBrowserLogin(id: string): Promise<{ ok: boolean; error?: string }> {
  const account = getAccount(id);
  if (!account) return { ok: false, error: "Account not found" };

  try {
    const { readdirSync, existsSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");

    if (!existsSync(account.profileDir)) {
      return { ok: false, error: "Browser profile directory not found. Try opening the browser first." };
    }

    // Chrome/Edge stores cookies inside profile subdirectories: Default/Cookies, Profile 1/Cookies, etc.
    // Also look for Login Data (saved passwords), which confirms an active login session
    const cookieFiles = ["Cookies", "Cookies.db", "Network/Cookies"];
    const loginIndicators = ["Login Data", "Login Data For Account", "Default/Web Data"];

    function findInDir(dir: string, depth = 0): boolean {
      if (depth > 3) return false;
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          // Check for cookie files
          if (!entry.isDirectory()) {
            const name = entry.name.toLowerCase();
            if (name === "cookies" || name === "cookies.db") return true;
            continue;
          }
          // Recurse into subdirectories
          if (findInDir(fullPath, depth + 1)) return true;
        }
      } catch {}
      return false;
    }

    const hasSession = findInDir(account.profileDir);

    if (hasSession) {
      updateAccount(id, { authStatus: "connected", errorMessage: undefined });
      return { ok: true };
    }

    // If the Default folder exists but no cookies yet, user may not have finished logging in
    const defaultDir = join(account.profileDir, "Default");
    if (existsSync(defaultDir)) {
      return { ok: false, error: "Profile exists but no login session detected. Make sure you completed the login in the browser, then try again." };
    }

    return { ok: false, error: "No browser session found. The browser may not have finished setting up the profile. Try opening the browser again and logging in." };
  } catch (e: any) {
    return { ok: false, error: `Could not verify login: ${e.message}` };
  }
}
