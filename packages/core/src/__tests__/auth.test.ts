// JWT Auth tests
import { describe, it, expect } from "bun:test";
import { issueToken, verifyToken, registerUser, loginUser } from "../auth/jwt.ts";

describe("JWT Auth", () => {
  it("issues and verifies tokens", () => {
    const token = issueToken("user-1", "testuser");
    expect(token).toBeTruthy();
    const payload = verifyToken(token);
    expect(payload).toBeTruthy();
    expect(payload!.userId).toBe("user-1");
    expect(payload!.username).toBe("testuser");
  });

  it("rejects invalid tokens", () => {
    const result = verifyToken("invalid-token");
    expect(result).toBeNull();
  });

  it("registers users", () => {
    const result = registerUser("newuser", "password123");
    expect(result).toBeTruthy();
  });

  it("logs in registered users", () => {
    const token = loginUser("newuser", "password123");
    expect(token).toBeTruthy();
  });

  it("rejects wrong passwords", () => {
    const result = loginUser("newuser", "wrongpassword");
    expect(result).toBeNull();
  });
});
