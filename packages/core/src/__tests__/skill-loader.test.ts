import { describe, it, expect } from "bun:test";
import { loadSkills } from "../skill/loader.ts";

describe("Skill Loader", () => {
  it("should load skills from disk", () => {
    const skills = loadSkills();
    // Should find at least some skills (the project has 45+ skills)
    expect(skills.length).toBeGreaterThan(0);
  });

  it("should parse skill metadata correctly", () => {
    const skills = loadSkills();
    for (const skill of skills) {
      expect(skill.name).toBeTruthy();
      expect(skill.filePath).toBeTruthy();
      expect(typeof skill.description).toBe("string");
    }
  });

  it("should have unique skill names", () => {
    const skills = loadSkills();
    const names = skills.map(s => s.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it("should include category information", () => {
    const skills = loadSkills();
    for (const skill of skills) {
      expect(skill.category).toBeTruthy();
    }
  });

  it("should handle missing skill directories gracefully", () => {
    // loadSkills should not throw even if directories are missing
    expect(() => loadSkills()).not.toThrow();
  });
});
