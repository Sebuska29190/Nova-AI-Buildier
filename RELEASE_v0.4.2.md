# RELEASE_v0.4.2 — Skills System Overhaul (45 skills, 24 tools, agent integration)

**Date:** 2026-05-19
**Type:** Feature release

## Summary
Complete overhaul of the Nova skills system — from 5 basic skills to 45 production-ready skills across 16 categories, each with executable tool support, agent integration, and community download capability.

## Changes

### Skills: 5 → 45 skills across 16 categories
- **software-dev** (5): `plan`, `skill-authoring`, `rest-graphql-debug`, `web-development`, `security`
- **github** (5): `github-code-review`, `github-auth`, `github-pr-workflow`, `github-issues`, `github-repo-management`
- **research** (3): `arxiv`, `research-paper-writing`, `llm-wiki`
- **note-taking** (1): `obsidian`
- **creative** (2): `architecture-diagram`, `excalidraw`
- **smart-home** (1): `openhue`
- **media** (3): `spotify`, `youtube-content`, `gif-search`
- **social-media** (1): `xurl`
- **data-science** (1): `jupyter-live-kernel`
- **mcp** (1): `native-mcp`
- **email** (2): `himalaya`, `agentmail`
- **productivity** (5): `google-workspace`, `linear`, `airtable`, `powerpoint`, `ocr-and-documents`
- **devops** (1): `kanban-orchestrator`
- **blockchain** (3): `evm`, `solana`, `hyperliquid`
- **health** (1): `health`
- **finance** (1): `finance`
- **sw-dev-opt** (3): `eslint`, `prettier`, `typescript`
- **community** (1): `community-download`

### Tools: 24 new executable tools registered (`community-skills.ts`)
| Tool | Description |
|------|-------------|
| `plan_save` / `plan_list` | Structured plan management in `.cheetahclaws/plans/` |
| `skill_create` | Skill template generator with proper YAML frontmatter |
| `arxiv_search` | Live arXiv paper search via Atom XML API |
| `gif_search` | GIF search via Tenor API (no key needed) |
| `spotify_search` | Spotify track/artist/album search |
| `youtube_search` | YouTube video search via Data API v3 |
| `github_search` | GitHub repository search |
| `github_create_issue` | Automated GitHub issue creation via gh CLI |
| `github_list_issues` | List open issues |
| `github_pr_create` | PR creation workflow |
| `github_review_pr` | PR review with inline comments |
| `twitter_search` | X/Twitter API v2 recent tweet search |
| `jupyter_list_kernels` | Available Jupyter kernel listing |
| `diagram_architecture` | Dark-theme inline SVG architecture diagrams → HTML |
| `excalidraw_generate` | Hand-drawn style Excalidraw JSON scenes |
| `openhue_control` | Philips Hue: on/off/brightness/color |
| `community_skills_download` | Download skills from any GitHub repo |
| `skills_list` | List all installed skills by category |
| `kanban_summary` | Task board reference |
| `obsidian_create_note` | Create notes in Obsidian vault |
| `powerpoint_generate` | PPTX generation via python-pptx |
| `ocr_extract` | Text extraction via Tesseract OCR |
| `wiki_build` / `wiki_search` | Project wiki scaffolding + search |

### Architecture changes
- **`packages/core/src/skill/loader.ts`**: **Recursive directory scanning** — no longer limited to root `skills/` dir. Added `findSkillByTrigger()`, `getSkillsByCategory()`, and `SkillDef` now includes `category` + `filePath`.
- **`packages/core/src/agent/runner.ts`**: System prompt auto-injects **skills reference section** so every agent knows what skills exist and their descriptions. Agents discover skills via `skills_list` tool and read `.md` files when triggers match.
- **`packages/core/src/plugin/community-skills.ts`**: Expanded from 20 utility tools to 24 real skill-execution tools with proper parameter schemas, error handling, and API integrations.

## Files changed
| File | Change |
|------|--------|
| `skills/` (45 files) | **New** — full skill catalog in 16 category subdirs |
| `skills/README.md` | **New** — skills system documentation |
| `packages/core/src/skill/loader.ts` | Rewritten — recursive scan, category support, trigger search |
| `packages/core/src/agent/runner.ts` | Modified — skills injected into system prompt |
| `packages/core/src/plugin/community-skills.ts` | Rewritten — 24 executable tools for all skills |
| `packages/core/package.json` | Version bumped 0.4.1 → 0.4.2 |
| `packages/ui/package.json` | Version bumped 0.4.1 → 0.4.2 |
| `packages/core/src/health.ts` | Version bumped 0.4.1 → 0.4.2 |
| `skills/commit.md` | Updated — conventional commits format + workflow |
| `skills/explain.md` | Updated — structured format with analogies |
| `skills/review.md` | Updated — severity classification, PR integration |
| `skills/test.md` | Updated — coverage goals, framework detection |
| `skills/refactor.md` | Updated — code smell checklist, output format |

## Breaking changes
- `loader.ts` export interface `SkillDef` now has **required** `category` and `filePath` fields — any code using the old interface may need updating
- `runner.ts` system prompt now includes skills section — if custom system prompts relied on exact string match, the skills section may shift token alignment

## Testing
- All 45 skills validated: proper YAML frontmatter (`---` start, `description`, `triggers`, `tools`)
- `pnpm test` — existing skill loader tests pass
- Manual verification: `skills_list` tool returns all 45 entries grouped by category
