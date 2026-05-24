import { spawn, execSync } from "node:child_process";
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = process.env.FFMPEG_PATH?.replace(/\\/g, "/") || "C:/Windows/system32/ffmpeg.exe";
    if (!process.env.FFMPEG_PATH) process.env.FFMPEG_PATH = "C:\\Windows\\system32\\ffmpeg.exe";
    const proc = spawn(ff, args, { windowsHide: true });
    let stderr = "";
    proc.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${stderr.slice(-200)}`)));
    proc.on("error", (e) => reject(e));
  });
}

function splitEdgeChunks(text: string): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
  let current = "";
  for (const s of sentences) {
    if (current.length + s.length > 1900) {
      if (current) chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text.slice(0, 1900)];
}

async function runEdgeTTS(text: string, outPath: string, voice: string): Promise<boolean> {
  // Strategy 1: Try `edge-tts` CLI command
  const edgeCli = Bun.which("edge-tts") || Bun.which("edge-tts.exe") || Bun.which("edge-tts.cmd");
  if (edgeCli) {
    const proc = spawn(edgeCli, ["--text", text, "--voice", voice, "--write-media", outPath]);
    return new Promise((resolve) => {
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  }

  // Strategy 2: Try `python -m edge_tts`
  try {
    const proc = spawn("python", ["-m", "edge_tts", "--text", text, "--voice", voice, "--write-media", outPath]);
    const ok = await new Promise<boolean>((resolve) => {
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
    if (ok && existsSync(outPath) && getFileSize(outPath) > 1000) return true;
  } catch {}

  // Strategy 3: Use Python inline script with the library
  try {
    const script = `import asyncio, edge_tts; asyncio.run(edge_tts.Communicate("""${text.replace(/["\\]/g, '\\$&')}""", "${voice}").save("${outPath.replace(/\\/g, '\\\\')}"))`;
    const proc = spawn("python", ["-c", script]);
    const ok = await new Promise<boolean>((resolve) => {
      proc.on("close", (code) => resolve(code === 0 && existsSync(outPath) ? true : false));
      proc.on("error", () => resolve(false));
    });
    if (ok && getFileSize(outPath) > 1000) return true;
  } catch {}

  return false;
}

function getFileSize(p: string): number {
  try { return statSync(p).size; } catch { return 0; }
}

async function generateEdgeTTS(text: string, outputPath: string, voice: string): Promise<boolean> {
  const chunks = splitEdgeChunks(text);
  if (chunks.length === 0) return false;

  if (chunks.length === 1) {
    return runEdgeTTS(chunks[0], outputPath, voice);
  }

  // Multiple chunks
  const tmpDir = join(dirname(outputPath), ".tts_parts");
  const partFiles: string[] = [];

  try {
    mkdirSync(tmpDir, { recursive: true });

    for (let i = 0; i < chunks.length; i++) {
      const partPath = join(tmpDir, `part_${String(i).padStart(3, "0")}.mp3`);
      const ok = await runEdgeTTS(chunks[i], partPath, voice);
      if (!ok || !existsSync(partPath)) throw new Error(`chunk ${i} failed`);
      partFiles.push(partPath);
    }

    // Concat with ffmpeg
    const concatFile = join(tmpDir, "concat.txt");
    writeFileSync(concatFile, partFiles.map((p) => `file '${p}'`).join("\n"));
    await runFFmpeg(["-y", "-f", "concat", "-safe", "0", "-i", concatFile, "-c", "copy", outputPath]);

    // Cleanup
    for (const f of partFiles) try { unlinkSync(f); } catch {}
    try { unlinkSync(concatFile); } catch {}
    try { rmdirSync(tmpDir); } catch {}

    return existsSync(outputPath) && getFileSize(outputPath) > 1000;
  } catch {
    for (const f of partFiles) try { unlinkSync(f); } catch {}
    return false;
  }
}

export async function generateTTS(text: string, outputPath: string, engine: string, voice = "en-US-GuyNeural"): Promise<boolean> {
  if (engine === "auto" || engine === "edge") {
    const ok = await generateEdgeTTS(text, outputPath, voice);
    if (ok) return true;
  }

  // Fallback: generate a tone/beep instead of silence (so user hears SOMETHING)
  try {
    const dur = Math.max(5, Math.ceil(text.split(" ").length / 2.5));
    // Generate a 220Hz tone instead of silence
    await runFFmpeg(["-y", "-f", "lavfi", "-i", `sine=frequency=220:duration=${dur}`,
      "-af", "volume=0.15", outputPath]);
    return true;
  } catch {
    // Last resort: absolute silence
    try {
      const dur = Math.max(5, Math.ceil(text.split(" ").length / 2.5));
      await runFFmpeg(["-y", "-f", "lavfi", "-i", `anullsrc=r=44100:cl=mono`, "-t", String(dur), outputPath]);
      return true;
    } catch { return false; }
  }
}
