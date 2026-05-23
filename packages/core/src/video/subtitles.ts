import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

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
    const out = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, { encoding: "utf-8", timeout: 5000 });
    const val = parseFloat(out.trim());
    if (!isNaN(val) && val > 0) return val;
  } catch { /* fall through */ }
  return 120;
}

export async function textToSrt(text: string, audioPath: string, srtPath: string): Promise<boolean> {
  try {
    const dur = audioDurationFast(audioPath);
    if (!text.trim() || dur <= 0) return false;

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
        // Add 300ms delay so subtitles appear slightly after audio starts speaking
        const subDelay = 0.3;
        const startTime = Math.max(0, currentTime + subDelay);
        const endTime = Math.min(currentTime + chunkDur + subDelay, dur);

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

    // If the last entry ends before the audio, extend it
    if (srtLines.length >= 4) {
      const lastEndIdx = srtLines.length - 2;
      const lastEndMatch = srtLines[lastEndIdx]?.match(/--> (\d{2}:\d{2}:\d{2},\d{3})/);
      if (lastEndMatch) {
        const lastEnd = parseTime(lastEndMatch[1]);
        if (lastEnd < dur - 0.5) {
          srtLines[lastEndIdx] = srtLines[lastEndIdx].replace(/-->.*/, `--> ${fmtTime(dur)}`);
        }
      }
    }

    writeFileSync(srtPath, srtLines.join("\n"), "utf-8");
    return true;
  } catch {
    return false;
  }
}

function parseTime(ts: string): number {
  const m = ts.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
  if (!m) return 0;
  return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]) + parseInt(m[4]) / 1000;
}
