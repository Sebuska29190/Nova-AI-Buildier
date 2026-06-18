import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { verifyToken } from "../../auth/jwt.ts";

// Auth middleware — bypass for /health, /api/auth, /v1, and /api/sessions
const PUBLIC_PATHS = ["/health", "/api/auth", "/", "/assets"];

function authMiddleware(c: any, next: any) {
  const path = c.req.path;
  if (PUBLIC_PATHS.some((p) => path === p || path.startsWith(p))) return next();
  const auth = c.req.header("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : getCookie(c, "nova_token") || "";
  if (token) {
    const user = verifyToken(token);
    if (user) {
      c.set("user", user);
      return next();
    }
  }
  // Allow public GET requests only for known safe endpoints
  const PUBLIC_GET_PATHS = ["/api/sessions", "/api/tools", "/api/agents", "/v1/models", "/health"];
  if (c.req.method === "GET" && PUBLIC_GET_PATHS.some(p => path === p || path.startsWith(p + "/"))) return next();
  return c.json({ error: "Unauthorized" }, 401);
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

export { authMiddleware, rateLimit, rateLimitMap, PUBLIC_PATHS, PUBLIC_GET_PATHS };

/**
 * Register middleware on the given Hono app.
 */
export function registerRoutes(app: Hono): void {
  // Auth middleware
  app.use("*", authMiddleware);

  // Security headers
  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("X-XSS-Protection", "1; mode=block");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    const path = c.req.path;
    if (!path.startsWith("/v1/") && !path.includes("/stream") && !path.includes("/events")) {
      c.header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https: wss:;");
    }
  });
}
