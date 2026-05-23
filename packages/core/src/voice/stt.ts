// Speech-to-Text provider — Whisper via OpenAI API or local
export async function transcribeAudio(audioPath: string): Promise<string> {
  // Try OpenAI Whisper API
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const form = new FormData();
      const blob = new Blob([await require("fs").readFileSync(audioPath)]);
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
  
  // Try local Whisper (faster-whisper or openai-whisper via Python subprocess)
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
