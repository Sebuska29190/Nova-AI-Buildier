// JWT-based auth system — persistent JWT secret + SQLite user store
import { randomBytes, createHmac, createHash, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ── Persistent JWT secret ─────────────────────────────────
const SECRET_FILE = join(process.cwd(), "data", "jwt_secret.txt");

function loadOrGenerateSecret(): string {
  try {
    if (existsSync(SECRET_FILE)) {
      return readFileSync(SECRET_FILE, "utf-8").trim();
    }
  } catch {}
  const secret = randomBytes(32).toString("hex");
  try {
    mkdirSync(join(process.cwd(), "data"), { recursive: true });
    writeFileSync(SECRET_FILE, secret, "utf-8");
  } catch {}
  return secret;
}

const SECRET = process.env.NOVA_JWT_SECRET || loadOrGenerateSecret();

// ── JWT helpers ───────────────────────────────────────────

interface TokenPayload {
  userId: string; username: string; iat: number; exp: number;
}

function base64Url(data: Buffer): string {
  return data.toString("base64url").replace(/=+$/, "");
}

function hmacSign(data: string): string {
  const hmac = createHmac("sha256", SECRET).update(data).digest("base64url");
  return hmac;
}

export function issueToken(userId: string, username: string): string {
  const header = base64Url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64Url(Buffer.from(JSON.stringify({
    userId, username, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 604800, // 7 days
  })));
  const sig = hmacSign(`${header}.${payload}`);
  return `${header}.${payload}.${sig}`;
}

export function verifyToken(token: string): { userId: string; username: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const expectedSig = hmacSign(`${parts[0]}.${parts[1]}`);
    const sigBuf = Buffer.from(parts[2]);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expBuf)) return null;

    const payload: TokenPayload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: payload.userId, username: payload.username };
  } catch { return null; }
}

// ── SQLite user store (persistent) ────────────────────────
import Database from "bun:sqlite";

interface StoredUser {
  username: string; passwordHash: string; createdAt: string;
}

function getDb(): Database {
  const db = new Database(join(process.cwd(), "data", "nova.db"));
  db.run(`CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  return db;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + createHash("sha256").update(salt + password).digest("hex");
}

function verifyPassword(password: string, hash: string): boolean {
  const [salt, storedHash] = hash.split(":");
  return storedHash === createHash("sha256").update(salt + password).digest("hex");
}

export function registerUser(username: string, password: string): string | null {
  const db = getDb();
  try {
    db.run(`INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)`, [
      username, hashPassword(password), new Date().toISOString(),
    ]);
    return issueToken(username, username);
  } catch {
    // Duplicate username
    return null;
  } finally {
    db.close();
  }
}

export function loginUser(username: string, password: string): string | null {
  const db = getDb();
  try {
    const row = db.query(`SELECT username, password_hash, created_at FROM users WHERE username = ?`).get(username) as StoredUser | null;
    if (!row || !verifyPassword(password, row.passwordHash)) return null;
    return issueToken(username, username);
  } finally {
    db.close();
  }
}
