// Speech-to-Text provider — Whisper via OpenAI API or local
import { readFileSync } from "node:fs";

export interface TranscriptionSegment {
  text: string;
  start: number;
  end: number;
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
}

export async function transcribeAudioWithTimestamps(audioPath: string): Promise<TranscriptionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const form = new FormData();
      const blob = new Blob([readFileSync(audioPath)]);
      form.append("file", blob, "audio.mp3");
      form.append("model", "whisper-1");
      form.append("response_format", "verbose_json");
      form.append("timestamp_granularities[]", "segment");
      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      const data: any = await res.json();
      if (data.segments && data.segments.length > 0) {
        return {
          text: data.text || "",
          segments: data.segments.map((s: any) => ({
            text: s.text?.trim() || "",
            start: s.start || 0,
            end: s.end || 0,
          })),
        };
      }
      if (data.text) {
        return { text: data.text, segments: [] };
      }
    } catch {}
  }

  // Fallback: plain transcription without timestamps
  const text = await transcribeAudio(audioPath);
  return { text, segments: [] };
}

export async function transcribeAudio(audioPath: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const form = new FormData();
      const blob = new Blob([readFileSync(audioPath)]);
      form.append("file", blob, "audio.mp3");
      form.append("model", "whisper-1");
      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      const data: any = await res.json();
      if (data.text) return data.text;
    } catch {}
  }
  
  // Try local Whisper
  try {
    const { spawn } = await import("node:child_process");
    const script = `import whisper; model = whisper.load_model("base"); result = model.transcribe("${audioPath.replace(/\\/g, "\\\\")}"); print(result["text"])`;
    const proc = spawn("python", ["-c", script]);
    return await new Promise((resolve) => {
      let out = "";
      proc.stdout?.on("data", (d: Buffer) => { out += d.toString(); });
      proc.on("close", () => resolve(out.trim() || "Transcription failed"));
    });
  } catch {
    return "Voice transcription not available";
  }
}
