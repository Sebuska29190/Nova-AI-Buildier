import { registry } from "../plugin/registry.ts";
import { selectNiche, CONTENT_NICHES } from "./niches.ts";
import type { StoryData, ImagePrompt, SfxCue, Niche } from "./types.ts";
import { parseTimestamp } from "./types.ts";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function storyTooShort(result: StoryData): boolean {
  const story = result.story;
  if (story.length >= 150) return false;
  return story.split(" ").length < 40;
}

function parseStoryResponse(response: string, nicheId: string, niche: Niche): StoryData | null {
  const storyBlocks = response.split(/===STORY\s*\d+===/i).filter(Boolean);
  if (storyBlocks.length === 0) return null;

  const block = storyBlocks[0];
  const parts = block.split(/===IMAGES?\s*\d+===/i);
  const storyPart = parts[0].trim();
  let imagesPart = "";
  let sfxPart = "";

  if (parts.length > 1) {
    const imgSfxParts = parts[1].split(/===SFX\s*\d+===/i);
    imagesPart = imgSfxParts[0].trim();
    if (imgSfxParts.length > 1) sfxPart = imgSfxParts[1].trim();
  }

  const lines = storyPart.split("\n").map((l) => l.trim()).filter(Boolean);
  const cleanLines = lines.filter((l) => !/^IMAGES?:\s*\d+/i.test(l));

  if (cleanLines.length < 2) return null;

  let title = "Untitled Story";
  for (const line of cleanLines) {
    const cleaned = line.replace(/[^\x20-\x7E\u00C0-\u024F\u1E00-\u1EFF]/g, "").trim().replace(/\s*[—–-]+\s*$/, "").trim();
    if (cleaned.length >= 3 && !/^\d+$/.test(cleaned)) { title = cleaned; break; }
  }

  const storyText = cleanLines.slice(1).join("\n").trim();
  if (storyText.length < 30) return null;

  // Parse image prompts
  const imgData: ImagePrompt[] = [];
  const imgRegex = /IMG\d+\s+(\d+:\d+)\s*:\s*(.+?)(?=\nIMG\d+|\n===|\Z)/gmi;
  let m;
  while ((m = imgRegex.exec(imagesPart)) !== null) {
    const ts = m[1].trim();
    const prompt = m[2].trim().replace(/\s+/g, " ");
    if (prompt.length > 15) imgData.push({ prompt, timestamp: ts, seconds: parseTimestamp(ts) });
  }

  // Fallback: no ts
  if (imgData.length === 0) {
    const fallbackRegex = /IMG\d+:\s*\[?(.+?)\]?\s*$/gm;
    while ((m = fallbackRegex.exec(imagesPart)) !== null) {
      const p = m[1].trim();
      if (p.length > 15) imgData.push({ prompt: p, timestamp: null, seconds: null });
    }
  }

  // Parse SFX cues
  const sfxCues: SfxCue[] = [];
  const sfxRegex = /(\d+:\d+)\s*:\s*([a-zA-Z0-9_]+)/g;
  while ((m = sfxRegex.exec(sfxPart)) !== null) {
    sfxCues.push({ timestamp: m[1], seconds: parseTimestamp(m[1]), name: m[2] });
  }

  return {
    title, story: storyText, nicheId, niche,
    imagePrompts: imgData, sfxCues, hasTimestamps: imgData.some((i) => i.timestamp),
  };
}

async function streamText(modelId: string, system: string, prompt: string): Promise<string> {
  const resolved = registry.resolveModel(modelId);
  if (!resolved) return "";

  const chunks: string[] = [];
  try {
    await resolved.provider.stream({
      model: resolved.model.id,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      onChunk: (chunk) => {
        if (chunk.type === "text") chunks.push(chunk.text);
      },
    });
  } catch (e) { console.warn(`[story] streamText error: ${e}`); }
  return chunks.join("").trim();
}

function buildPrompt(topic: string, niche: Niche, nicheId: string, targetWords: number | null, isShort: boolean, langInstr: string): string {
  const hookExamples = pickRandomN(niche.hooks, 3);
  const hooksText = hookExamples.map((h) => `  - "${h}"`).join("\n");
  const titleExamples = niche.titulo_ejemplos.map((t) => `"${t}"`).join(", ");
  const cliches = niche.cliches_prohibidos.join(", ");
  const contextBlock = topic ? `\nUSER CREATIVE DIRECTION (integrate with the niche):\n${topic}\n` : "";
  const langBlock = langInstr ? `=== CRITICAL LANGUAGE REQUIREMENT ===\n${langInstr}\nFAILURE TO WRITE IN THIS LANGUAGE MEANS THE OUTPUT IS REJECTED.\n\n` : "";

  let wordRule: string;
  if (targetWords) {
    wordRule = `- MANDATORY LENGTH: ~${targetWords} words (±30 words). If you write fewer than ${Math.floor(targetWords * 0.85)} words the story will be rejected.`;
  } else if (isShort) {
    wordRule = "- Between 80 and 110 words (SHORT — max 60-second video)";
  } else {
    wordRule = "- Between 350 and 500 words (complete story with development, do NOT write fewer than 350)";
  }

  return `You are a viral content writer for YouTube/TikTok. Your specialty: ${niche.nombre}.
${langBlock}
GENERATE 1 story with VIRAL potential using these narrative techniques.
${contextBlock}
=== NICHE IDENTITY ===
- TONE: ${niche.tono}
- NARRATIVE STYLE: ${niche.narrativa}

=== VIRAL TECHNIQUES (MANDATORY) ===
1. HOOK (first sentence): MUST stop the scroll — instant curiosity, tension, or shock.
   Draw inspiration from these niche hooks:
${hooksText}
2. ESCALATION: Every paragraph must increase tension/emotion. No boring plateaus.
3. SENSORY DETAILS: Smells, textures, specific sounds — don't describe, make them FEEL.
4. PUNCHY DIALOGUE: At least 1-2 lines of dialogue that hit hard.
5. TWIST/CLOSE: Ending that leaves the viewer processing. Revelation, irony, ambiguity, or emotional punch.

=== STORY RULES ===
${wordRule}
- First person ("I", "my") — the viewer must feel you are telling THEM directly
- FORBIDDEN clichés for this niche: ${cliches}
- FORBIDDEN: flowery prose, excessive metaphors, unnecessary descriptions
- YES: short sentences for tense moments, paragraphs that breathe
- Natural language (not too formal, not excessive slang)

=== TITLE RULES (CRITICAL FOR CTR) ===
- The title SELLS the story — must create irresistible curiosity
- Use ONLY Latin characters (A-Z, accented letters, numbers)
- Maximum 8 words — short, punchy, memorable
- Good examples for this niche: ${titleExamples}
- FORBIDDEN: "The/A [noun] of [thing]", "Protocol of...", "Heritage of..."

=== IMAGE RULES (FOR AI IMAGE GENERATION) ===
- Choose between 4 and 8 images based on story length
- Each image MUST have a TIMESTAMP in format MM:SS
- PACING: ~135 words per minute of narration
- DISTRIBUTION: visual hook (0:00), development, climax, close
- Minimum 6 seconds between images
- Prompts in ENGLISH, 40-70 words, SPECIFIC to scenes in THIS story
- Image style for this niche: ${niche.imagen_estilo}
- VARIETY: Do NOT repeat the same composition or perspective

=== OUTPUT FORMAT (EXACT — do not copy instructions, just fill in) ===

===STORY 1===
IMAGES: [number]

[Your title here]

[Full story — remember the mandatory length]

===IMAGES 1===
IMG1 0:00: [detailed prompt of the hook scene, visual style, composition]
IMG2 0:12: [detailed prompt of the development scene, different composition]
IMG3 0:25: [detailed prompt of the climax scene]
IMG4 0:40: [detailed prompt of the close/twist scene]

===SFX 1===
0:12: rain
0:25: heartbeat
0:40: door_knocking

START DIRECTLY with ===STORY 1===, no preamble or explanations.`;
}

export async function generateStory(
  topic: string,
  model: string,
  nicheName?: string,
  targetWords?: number,
  isShort?: boolean,
  langInstr?: string,
): Promise<StoryData | null> {
  const [nicheId, niche] = selectNiche(nicheName);
  const prompt = buildPrompt(topic, niche, nicheId, targetWords ?? null, isShort ?? false, langInstr ?? "");
  const internalConfig = "";

  // System prompt: inject language requirement so model takes it seriously
  const systemPrompt = langInstr
    ? `You are a viral content writer. ${langInstr} You write ONLY in the required language.`
    : "You are a viral content writer.";

  const response = await streamText(model, systemPrompt, prompt);
  if (!response) return null;

  let result = parseStoryResponse(response, nicheId, niche);
  if (result && !storyTooShort(result)) return result;

  // Fallback 2: simpler prompt
  const langBlock = langInstr ? `CRITICAL: You MUST write ENTIRELY in this language. ${langInstr}\n\n` : "";
  const lengthRule = targetWords ? `~${targetWords} words.` : (isShort ? "80-110 words." : "300-450 words.");
  const simplePrompt = `${langBlock}Write a viral short story for YouTube/TikTok.
Topic/niche: ${niche.nombre}
${topic ? "Direction: " + topic : ''}
Length: ${lengthRule}
First person ("I"). Strong hook. Twist ending.

OUTPUT FORMAT — copy exactly, fill in content:
===STORY 1===
IMAGES: 4

[Title — max 8 words]

[Full story here]

===IMAGES 1===
IMG1 0:00: [scene, photorealistic style]
IMG2 0:20: [scene]
IMG3 0:40: [scene]
IMG4 1:00: [scene]

===SFX 1===
0:20: wind`;

  const response2 = await streamText(model, "You are a creative writer.", simplePrompt);
  if (response2) {
    result = parseStoryResponse(response2, nicheId, niche);
    if (result && !storyTooShort(result)) return result;
  }

  // Fallback 3: free-form, build result manually
  const wordTarget = targetWords || (isShort ? 90 : 400);
  const subject = topic || niche.nombre;
  const langNote = langInstr ? `\nCRITICAL LANGUAGE INSTRUCTION: ${langInstr}` : "";
  const freePrompt = `Write a ${wordTarget}-word first-person story about: ${subject}.${langNote}\nStrong hook. One twist. No headers, no bullet points, just the story text.`;

  const storyText = await streamText(model, langInstr ? `You are a storyteller. ${langInstr} You write ONLY in the required language.` : "You are a storyteller.", freePrompt);
  if (storyText.length < 30) return null;

  const firstSent = storyText.split(/[.!?\n]/)[0].trim();
  const freeTitle = firstSent ? firstSent.split(" ").slice(0, 8).join(" ") : (topic || "Untitled");

  const numImgs = 4;
  const duration = wordTarget / 135;
  const style = niche.imagen_estilo;
  const sentences = storyText.split(/[.!?]/).map((s) => s.trim()).filter((s) => s.length > 20);
  const imgData: ImagePrompt[] = [];
  for (let i = 0; i < numImgs; i++) {
    const secs = i * duration * 60 / Math.max(numImgs - 1, 1);
    const mm = Math.floor(secs / 60);
    const ss = Math.floor(secs % 60);
    const ts = `${mm}:${String(ss).padStart(2, "0")}`;
    const si = Math.floor(i * sentences.length / numImgs);
    const base = sentences[si] || subject;
    imgData.push({ prompt: `${base.slice(0, 80)}, ${style}`, timestamp: ts, seconds: Math.floor(secs) });
  }

  return {
    title: freeTitle, story: storyText, nicheId, niche,
    imagePrompts: imgData, sfxCues: [], hasTimestamps: true,
  };
}
