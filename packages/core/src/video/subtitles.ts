import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import type { TranscriptionSegment } from "../voice/stt.ts";

function fmtTime(raw: number): string {
  const h = Math.floor(raw / 3600);
  const m = Math.floor((raw % 3600) / 60);
  const s = Math.floor(raw % 60);
  const ms = Math.floor((raw - Math.floor(raw)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function splitSubtitleChunks(text: string, maxWords = 8, maxCjkChars = 18): string[] {
  const cjkCount = [...text].filter((c) => c >= "\u4e00" && c <= "\u9fff" || c >= "\u3040" && c <= "\u30ff" || c >= "\uac00" && c <= "\ud7a3").length;
  const isCJK = cjkCount > text.length * 0.3;
  if (isCJK) {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += maxCjkChars) chunks.push(text.slice(i, i + maxCjkChars));
    return chunks;
  }
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) chunks.push(words.slice(i, i + maxWords).join(" "));
  return chunks;
}

function audioDurationFast(filePath: string): number {
  try {
    const ff = process.env.FFMPEG_PATH || "ffmpeg";
    const out = execSync(`"${ff}" -i "${filePath}" -f null - 2>&1`, { encoding: "utf-8", timeout: 10000, windowsHide: true, shell: "cmd.exe" });
    const m = out.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
    if (m) {
      const val = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]) + parseInt(m[4]) / 100;
      console.log(`[srt] duration: ${val}s from ${filePath}`);
      if (val > 0) return val;
    } else {
      console.log(`[srt] no duration match in: ${out.slice(0, 200)}`);
    }
  } catch (e: any) {
    console.log(`[srt] audioDurationFast error: ${e.message?.slice(0, 100)}`);
  }
  return 120;
}

export async function textToSrt(
  text: string,
  audioPath: string,
  srtPath: string,
  segments?: TranscriptionSegment[],
): Promise<boolean> {
  try {
    const dur = audioDurationFast(audioPath);
    if (!text.trim() || dur <= 0) return false;

    // If we have word-level timestamps from Whisper, use them
    if (segments && segments.length > 0) {
      return srtFromTimestamps(segments, dur, srtPath);
    }

    // Fallback: even distribution
    return srtEvenDistribution(text, dur, srtPath);
  } catch {
    return false;
  }
}

/** Generate SRT from Whisper segment timestamps */
function srtFromTimestamps(segments: TranscriptionSegment[], totalDur: number, srtPath: string): boolean {
  const srtLines: string[] = [];
  let idx = 1;

  for (const seg of segments) {
    if (!seg.text.trim()) continue;

    const chunks = splitSubtitleChunks(seg.text, 7, 16);

    if (chunks.length === 1) {
      const start = Math.max(0, seg.start);
      const end = Math.min(seg.end, totalDur);
      if (end > start) {
        srtLines.push(`${idx}`);
        srtLines.push(`${fmtTime(start)} --> ${fmtTime(end)}`);
        srtLines.push(chunks[0]);
        srtLines.push("");
        idx++;
      }
    } else {
      const segDuration = seg.end - seg.start;
      const chunkDur = segDuration / chunks.length;
      let t = seg.start;
      for (const chunk of chunks) {
        const start = Math.max(0, t);
        const end = Math.min(t + chunkDur, totalDur);
        if (end > start) {
          srtLines.push(`${idx}`);
          srtLines.push(`${fmtTime(start)} --> ${fmtTime(end)}`);
          srtLines.push(chunk);
          srtLines.push("");
          idx++;
        }
        t += chunkDur;
      }
    }
  }

  if (srtLines.length === 0) return srtEvenDistribution(segments.map(s => s.text).join(" "), totalDur, srtPath);

  writeFileSync(srtPath, srtLines.join("\n"), "utf-8");
  return true;
}

/** Fallback: split text evenly across total duration */
function srtEvenDistribution(text: string, dur: number, srtPath: string): boolean {
  const paras = text.split("\n").filter(Boolean);
  const totalChars = text.length;
  const totalCjk = [...text].filter((c) => c >= "\u4e00" && c <= "\u9fff" || c >= "\u3040" && c <= "\u30ff" || c >= "\uac00" && c <= "\ud7a3").length;
  const isCJK = totalCjk > totalChars * 0.3;

  const srtLines: string[] = [];
  let idx = 1;
  let currentTime = 0;

  for (const para of paras) {
    const chunks = splitSubtitleChunks(para);
    const paraDuration = isCJK
      ? (para.length / totalChars) * dur
      : (para.split(/\s+/).filter(Boolean).length / text.split(/\s+/).filter(Boolean).length) * dur;

    const chunkDur = paraDuration / Math.max(chunks.length, 1);

    for (const chunk of chunks) {
      const startTime = Math.max(0, currentTime);
      const endTime = Math.min(currentTime + chunkDur, dur);
      if (startTime < dur && endTime > startTime) {
        srtLines.push(`${idx}`);
        srtLines.push(`${fmtTime(startTime)} --> ${fmtTime(endTime)}`);
        srtLines.push(chunk);
        srtLines.push("");
        idx++;
      }
      currentTime += chunkDur;
    }
  }

  writeFileSync(srtPath, srtLines.join("\n"), "utf-8");
  return true;
}
