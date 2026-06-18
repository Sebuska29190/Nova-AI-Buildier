/**
 * Simple API key authentication for Nexus AI
 */
import { safeMessage } from "../errors.ts";

interface AuthUser {
  id: string;
  name: string;
  role: "admin" | "user";
  apiKey: string;
}

class AuthManager {
  private users: AuthUser[] = [];
  private initialized = false;
  private apiKey: string = "";

  init(): void {
    if (this.initialized) return;
    this.apiKey = process.env.NOVA_AUTH_TOKEN || "";
    // Default admin user from env
    if (this.apiKey) {
      this.users.push({ id: "admin", name: "Admin", role: "admin", apiKey: this.apiKey });
    }
    this.initialized = true;
  }

  isEnabled(): boolean {
    return this.apiKey.length > 0;
  }

  validate(token: string | undefined): AuthUser | null {
    if (!this.isEnabled()) return { id: "local", name: "Local", role: "admin", apiKey: "" };
    if (!token) return null;
    return this.users.find((u) => u.apiKey === token) || null;
  }

  middleware(): (c: any, next: () => Promise<void>) => Promise<Response | void> {
    return async (c: any, next: () => Promise<void>) => {
      if (!this.isEnabled()) return next();
      const auth = c.req.header("Authorization") || "";
      const token = auth.replace(/^Bearer\s+/i, "");
      const user = this.validate(token);
      if (!user) return c.json({ error: "Unauthorized — provide valid Bearer token" }, 401);
      c.set("user", user);
      return next();
    };
  }
}

export const authManager = new AuthManager();
