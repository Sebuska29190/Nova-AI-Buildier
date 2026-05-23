/**
 * Nova TTS (Text-to-Speech) Engine
 * Supports: Edge TTS (free), OpenAI TTS, ElevenLabs, local gTTS
 * Ported from Hermes Agent tts_tool.py
 */

import { execSync } from "node:child_process";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export type TTSProvider = "edge" | "openai" | "elevenlabs" | "gtts";

export interface TTSOptions {
  text: string;
  provider?: TTSProvider;
  voice?: string;
  speed?: number;
  outputFile?: string;
}

const TTS_OUTPUT_DIR = join(process.cwd(), "data", "tts");

// Voice mappings
const VOICES: Record<TTSProvider, string[]> = {
  edge: [
    "en-US-JennyNeural", "en-US-GuyNeural", "en-GB-SoniaNeural",
    "en-AU-NatashaNeural", "pl-PL-AgnieszkaNeural", "pl-PL-MarekNeural",
    "de-DE-KatjaNeural", "fr-FR-DeniseNeural", "ja-JP-NanamiNeural",
    "zh-CN-XiaoxiaoNeural", "ko-KR-SunHiNeural",
  ],
  openai: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
  elevenlabs: ["21m00Tcm4TlvDq8ikWAM", "AZnzlk1XvdvUeBnXmlld", "EXAVITQu4vr2SDJZ",
    "ODq5zmih8GrVes37Dizd", "TxGEqnHWrfWFTfGW9XjX", "VR6AewLTigWG4x2lNf7i"],
  gtts: ["com", "com.au", "co.uk", "ca", "co.in", "ie"],
};

const DEFAULT_VOICES: Record<TTSProvider, string> = {
  edge: "en-US-JennyNeural",
  openai: "nova",
  elevenlabs: "21m00Tcm4TlvDq8ikWAM",
  gtts: "com",
};

export async function synthesizeSpeech(options: TTSOptions): Promise<string> {
  const provider = options.provider || "edge";
  const voice = options.voice || DEFAULT_VOICES[provider];
  const speed = options.speed || 1.0;

  mkdirSync(TTS_OUTPUT_DIR, { recursive: true });

  const outputFile = resolve(options.outputFile || join(TTS_OUTPUT_DIR, `tts_${randomUUID().slice(0, 8)}.mp3`));

  switch (provider) {
    case "edge": {
      // Edge TTS — free, works offline-ish, best voices
      try {
        execSync(
          `edge-tts --voice "${voice}" --text "${options.text.replace(/"/g, '\\"')}" --write-media "${outputFile}" --rate=${speed > 1 ? "+" : ""}${Math.round((speed - 1) * 100)}%`,
          { encoding: "utf-8", timeout: 30000 }
        );
      } catch {
        // Fallback: try without edge-tts, use gTTS
        return synthesizeSpeech({ ...options, provider: "gtts" });
      }
      break;
    }

    case "openai": {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY in .env");
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "tts-1",
          input: options.text,
          voice,
          speed,
          response_format: "mp3",
        }),
      });
      if (!res.ok) throw new Error(`OpenAI TTS error: ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      writeFileSync(outputFile, buffer);
      break;
    }

    case "elevenlabs": {
      const key = process.env.ELEVENLABS_API_KEY;
      if (!key) throw new Error("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env");
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ text: options.text, model_id: "eleven_monolingual_v1", voice_settings: { stability: 0.5, similarity_boost: 0.5 } }),
      });
      if (!res.ok) throw new Error(`ElevenLabs TTS error: ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      writeFileSync(outputFile, buffer);
      break;
    }

    case "gtts": {
      // gTTS fallback
      const tld = voice;
      const pyScript = `
import sys
sys.path.insert(0, '.')
try:
    from gtts import gTTS
    tts = gTTS(text="""${options.text.replace(/"/g, '\\"').replace(/\n/g, '\\n')}""", lang="en", tld="${tld}")
    tts.save(r"${outputFile.replace(/\\/g, '\\\\')}")
    print("OK")
except ImportError:
    print("gTTS not installed")
`;
      const pyFp = join(TTS_OUTPUT_DIR, `tts_${randomUUID().slice(0, 8)}.py`);
      writeFileSync(pyFp, pyScript, "utf-8");
      try {
        execSync(`python "${pyFp}"`, { encoding: "utf-8", timeout: 30000 });
      } finally {
        try { execSync(`del "${pyFp}"`); } catch {}
      }
      break;
    }
  }

  if (!existsSync(outputFile)) throw new Error("TTS synthesis failed — no output file produced");
  return outputFile;
}

export function listVoices(provider?: TTSProvider): Record<string, string[]> {
  if (provider) return { [provider]: VOICES[provider] || [] };
  return VOICES as unknown as Record<string, string[]>;
}
