// Skill loader tests
import { describe, it, expect } from "bun:test";
import { loadSkills } from "../skill/loader.ts";

describe("Skill Loader", () => {
  it("loads skills without throwing", () => {
    expect(() => loadSkills()).not.toThrow();
  });

  it("returns an array", () => {
    const skills = loadSkills();
    expect(Array.isArray(skills)).toBe(true);
  });
});
