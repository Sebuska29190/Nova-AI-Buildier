import { Hono } from "hono";
import { registerUser, loginUser } from "../../auth/jwt.ts";
import { rateLimit } from "./middleware.ts";

export function register(app: Hono): void {
  // Auth (rate limited: 10 requests per minute per IP)
  app.post("/api/auth/register", async (c) => {
    const ip = c.req.header("x-forwarded-for") || "local";
    if (!rateLimit(`register:${ip}`, 10, 60000)) return c.json({ error: "Too many requests" }, 429);
    const body = await c.req.json<{ username: string; password: string }>();
    if (!body.username || !body.password) return c.json({ error: "username and password required" }, 400);
    const token = registerUser(body.username, body.password);
    if (!token) return c.json({ error: "User already exists" }, 409);
    return c.json({ token, username: body.username });
  });
  app.post("/api/auth/login", async (c) => {
    const ip = c.req.header("x-forwarded-for") || "local";
    if (!rateLimit(`login:${ip}`, 10, 60000)) return c.json({ error: "Too many requests" }, 429);
    const body = await c.req.json<{ username: string; password: string }>();
    const token = loginUser(body.username, body.password);
    if (!token) return c.json({ error: "Invalid credentials" }, 401);
    return c.json({ token, username: body.username });
  });
  app.get("/api/auth/me", (c) => {
    const user = (c as any).get("user");
    if (!user) return c.json({ error: "Not authenticated" }, 401);
    return c.json({ user });
  });

  // Health
  app.get("/health", (c) => c.json({ status: "ok", version: "0.6.1" }));
}
