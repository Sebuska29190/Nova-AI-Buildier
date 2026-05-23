/**
 * Provider Config — persistent API key & settings management
 *
 * Stores provider configurations (API keys, base URLs, token limits)
 * in a JSON file at data/provider-config.json.
 * API keys are encrypted at rest with AES-256-GCM.
 *
 * On startup, saved configs are merged into process.env so existing
 * provider plugins pick them up automatically.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomBytes, createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { registry } from "../plugin/registry.ts";
import { safeMessage } from "../errors.ts";

// ─── Encryption helpers (AES-256-GCM) ──────────────────────

/** Derive a 256-bit key from the server secret. If no secret, generate one. */
function getEncryptionKey(): Buffer {
  // Try env first, then fall back to reading/writing a server key file
  const envKey = process.env.NOVA_ENCRYPTION_KEY || process.env.NOVA_JWT_SECRET;
  if (envKey) {
    return createHash("sha256").update(envKey).digest();
  }
  // Auto-generate persistent key
  const KEY_FILE = join(process.cwd(), "data", ".encryption_key");
  try {
    if (existsSync(KEY_FILE)) {
      return Buffer.from(readFileSync(KEY_FILE, "utf-8").trim(), "hex");
    }
  } catch {}
  const key = randomBytes(32);
  try {
    mkdirSync(join(process.cwd(), "data"), { recursive: true });
    writeFileSync(KEY_FILE, key.toString("hex"), "utf-8");
    // Gitignore it
    try {
      const gi = join(process.cwd(), "data", ".gitignore");
      if (!existsSync(gi)) writeFileSync(gi, ".encryption_key\n", "utf-8");
    } catch {}
  } catch {}
  return key;
}

const ENC_KEY = getEncryptionKey();

/** Encrypt a plaintext string → hex-encoded "iv:tag:ciphertext" */
function encrypt(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", ENC_KEY, iv);
  let encrypted = cipher.update(plaintext, "utf-8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${tag}:${encrypted}`;
}

/** Decrypt an "iv:tag:ciphertext" string → plaintext. Returns empty string on failure. */
function decrypt(encoded: string): string {
  try {
    const parts = encoded.split(":");
    if (parts.length < 3) return "";
    const iv = Buffer.from(parts[0], "hex");
    const tag = Buffer.from(parts[1], "hex");
    const encrypted = parts.slice(2).join(":");
    const decipher = createDecipheriv("aes-256-gcm", ENC_KEY, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, "hex", "utf-8");
    decrypted += decipher.final("utf-8");
    return decrypted;
  } catch {
    return "";
  }
}

/** Check if a string looks like an encrypted value (starts with hex:hex:hex) */
function isEncrypted(s: string): boolean {
  return /^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/i.test(s);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProviderConfigEntry {
  providerId: string;
  apiKey: string;
  baseUrl?: string;
  enabled: boolean;
  maxTokens?: number;
  thinkingLevel?: string;
  updatedAt: string;
}

interface ProviderConfigStore {
  providers: Record<string, ProviderConfigEntry>;
}

// ─── Path ────────────────────────────────────────────────────────────────────

const DATA_DIR = join(process.cwd(), "data");
const CONFIG_PATH = join(DATA_DIR, "provider-config.json");

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ─── Load / Save ─────────────────────────────────────────────────────────────

/** @internal exposed for harness/pi.ts to read maxTokens */
export function loadRaw(): ProviderConfigStore {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, "utf-8");
      const store: ProviderConfigStore = JSON.parse(raw);
      // Decrypt API keys on load
      for (const [id, entry] of Object.entries(store.providers)) {
        if (entry.apiKey && isEncrypted(entry.apiKey)) {
          const plain = decrypt(entry.apiKey);
          if (plain) {
            store.providers[id] = { ...entry, apiKey: plain };
          } else {
            // Decryption failed — key corrupted or wrong key
            store.providers[id] = { ...entry, apiKey: "" };
          }
        }
      }
      return store;
    }
  } catch {
    // Corrupted file — start fresh
  }
  return { providers: {} };
}

function saveRaw(store: ProviderConfigStore): void {
  ensureDataDir();
  const clone = JSON.parse(JSON.stringify(store)) as ProviderConfigStore;
  // Encrypt all API keys before saving
  for (const [id, entry] of Object.entries(clone.providers)) {
    if (entry.apiKey && !isEncrypted(entry.apiKey)) {
      clone.providers[id] = { ...entry, apiKey: encrypt(entry.apiKey) };
    }
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(clone, null, 2), "utf-8");
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Load all saved provider configs and merge API keys into process.env.
 * Call this ONCE during server startup, AFTER providers are registered.
 */
export function loadProviderConfigs(): void {
  const store = loadRaw();
  let restored = 0;

  for (const [providerId, entry] of Object.entries(store.providers)) {
    if (entry.apiKey) {
      // Derive env var name from provider auth definition
      const provider = registry.getProvider(providerId);
      const envVar = provider?.auth?.envVar || `${providerId.toUpperCase()}_API_KEY`;
      if (!process.env[envVar]) {
        process.env[envVar] = entry.apiKey;
        restored++;
      }
    }
  }

  if (restored > 0) {
    console.log(`  ✓ Restored ${restored} provider API key(s) from config`);
  }
}

/**
 * Get all provider configs (saved + registered providers with status).
 */
export function getAllProviderConfigs(): Array<{
  providerId: string;
  name: string;
  configured: boolean;
  enabled: boolean;
  hasApiKey: boolean;
  keySource: "env" | "saved" | "none";
  modelCount: number;
  maxTokens?: number;
  thinkingLevel?: string;
  baseUrl?: string;
}> {
  const store = loadRaw();
  const result: Array<any> = [];

  for (const [id, provider] of registry.providers) {
    const saved = store.providers[id];
    const envVar = provider.auth?.envVar || `${id.toUpperCase()}_API_KEY`;
    const hasEnvKey = !!process.env[envVar];
    const hasSavedKey = !!saved?.apiKey;
    const keySource = hasEnvKey ? "env" : hasSavedKey ? "saved" : "none";

    result.push({
      providerId: id,
      name: provider.name,
      configured: hasEnvKey || hasSavedKey,
      enabled: saved?.enabled ?? true,
      hasApiKey: hasEnvKey || hasSavedKey,
      keySource,
      modelCount: provider.models.length,
      maxTokens: saved?.maxTokens,
      thinkingLevel: saved?.thinkingLevel,
      baseUrl: saved?.baseUrl,
    });
  }

  return result;
}

/**
 * Save (or update) a provider's API key and settings.
 * Also sets process.env so the provider picks it up immediately.
 */
export function saveProviderConfig(
  providerId: string,
  config: { apiKey?: string; baseUrl?: string; maxTokens?: number; thinkingLevel?: string; enabled?: boolean },
): ProviderConfigEntry {
  const store = loadRaw();
  const existing = store.providers[providerId] || {
    providerId,
    apiKey: "",
    enabled: true,
    updatedAt: "",
  };

  const entry: ProviderConfigEntry = {
    providerId,
    apiKey: config.apiKey ?? existing.apiKey,
    baseUrl: config.baseUrl ?? existing.baseUrl,
    enabled: config.enabled ?? existing.enabled,
    maxTokens: config.maxTokens ?? existing.maxTokens,
    thinkingLevel: config.thinkingLevel ?? existing.thinkingLevel,
    updatedAt: new Date().toISOString(),
  };

  store.providers[providerId] = entry;
  saveRaw(store);

  // Set env var immediately so provider picks it up
  if (entry.apiKey) {
    const provider = registry.getProvider(providerId);
    const envVar = provider?.auth?.envVar || `${providerId.toUpperCase()}_API_KEY`;
    process.env[envVar] = entry.apiKey;
  }

  return entry;
}

/**
 * Remove a provider's API key (unbind).
 */
export function deleteProviderConfig(providerId: string): boolean {
  const store = loadRaw();
  if (!store.providers[providerId]) return false;

  delete store.providers[providerId];
  saveRaw(store);

  // Clear env var
  const provider = registry.getProvider(providerId);
  const envVar = provider?.auth?.envVar || `${providerId.toUpperCase()}_API_KEY`;
  delete process.env[envVar];

  return true;
}

/**
 * Test a provider connection by making a lightweight API call.
 * Returns { ok: true } or { ok: false, error: string }.
 */
export async function testProviderConnection(
  providerId: string,
  apiKey?: string,
): Promise<{ ok: boolean; error?: string }> {
  const provider = registry.getProvider(providerId);
  if (!provider) return { ok: false, error: "Provider not registered" };

  const key = apiKey || process.env[provider.auth?.envVar || `${providerId.toUpperCase()}_API_KEY`];
  if (!key) return { ok: false, error: "No API key provided" };

  // Use the first model to test
  const firstModel = provider.models[0];
  if (!firstModel) return { ok: false, error: "Provider has no models" };

  try {
    let response = "";
    await provider.stream({
      model: firstModel.id,
      messages: [{ role: "user", content: "Respond with exactly: OK" }],
      onChunk: (chunk) => {
        if (chunk.type === "text") response += chunk.text;
        if (chunk.type === "error") throw new Error(chunk.message);
      },
    });

    if (response.includes("OK")) return { ok: true };
    return { ok: true }; // Got some response, connection works
  } catch (e: unknown) {
    return { ok: false, error: safeMessage(e) };
  }
}
