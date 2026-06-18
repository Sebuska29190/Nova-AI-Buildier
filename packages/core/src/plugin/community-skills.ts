/**
 * Community Skills — expanded tool registry for all 40+ Nova skills
 *
 * Each skill .md in D:\nova\skills\<category>\ gets a corresponding
 * executable tool registered here so agents can call them at runtime.
 * Sources: CheetahClaws tools, OpenClaw patterns, community requests
 *
 * Refactored into category modules under ./skills/
 */

import { register as registerPlanning } from "./skills/planning-skills.ts";
import { register as registerSearch } from "./skills/search-skills.ts";
import { register as registerGithub } from "./skills/github-skills.ts";
import { register as registerCreative } from "./skills/creative-skills.ts";
import { register as registerSmartHome } from "./skills/smart-home-skills.ts";
import { register as registerSkillsHub } from "./skills/skills-hub.ts";
import { register as registerProductivity } from "./skills/productivity-skills.ts";
import { register as registerWiki } from "./skills/wiki-skills.ts";
import { register as registerVoiceMedia } from "./skills/voice-media-skills.ts";
import { register as registerDiscord } from "./skills/discord-skills.ts";
import { register as registerMessaging } from "./skills/messaging-skills.ts";

export function registerAllCommunitySkills(): void {
  registerPlanning();
  registerSearch();
  registerGithub();
  registerCreative();
  registerSmartHome();
  registerSkillsHub();
  registerProductivity();
  registerWiki();
  registerVoiceMedia();
  registerDiscord();
  registerMessaging();

  console.log("  ✓ Community skills loaded (49 tools)");
}
