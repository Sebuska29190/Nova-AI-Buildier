/**
 * Trajectory Compression — automatically compress long conversations
 * to stay within context window limits. Summarizes older messages
 * while preserving key facts, decisions, and file changes.
 */
import { sessionManager, SessionData } from "../session/manager.ts";
import { safeMessage } from "../errors.ts";

interface CompressedMessage {
  originalIndex: number;
  summary: string;
  preserved: boolean; // true = kept verbatim (recent), false = compressed
}

const COMPRESSION_THRESHOLD = 40; // Number of messages before compression triggers
const KEEP_RECENT = 10; // Most recent messages to keep verbatim
const MAX_COMPRESSION_RATIO = 0.5; // Target: compress to 50% of original size

/**
 * Analyze a session transcript and compress if needed.
 * Returns true if compression was applied.
 */
export async function maybeCompressSession(sessionId: string, modelRef?: string): Promise<boolean> {
  try {
    const transcript = sessionManager.getTranscript(sessionId);
    if (!transcript || transcript.length < COMPRESSION_THRESHOLD) return false;

    const session = sessionManager.getSession(sessionId);
    if (!session) return false;

    const msgCount = transcript.length;
    const targetCount = Math.max(KEEP_RECENT, Math.floor(msgCount * MAX_COMPRESSION_RATIO));

    // If already compressed, skip
    if (session._compressed) return false;

    // Split: keep recent messages, compress older ones
    const recentMessages = transcript.slice(-KEEP_RECENT);
    const oldMessages = transcript.slice(0, -KEEP_RECENT);

    // Generate a summary of the old messages
    const summary = await summarizeMessages(oldMessages, modelRef);

    // Prepend the summary to the recent messages in the session
    // We do this by replacing old messages with a single compressed message
    const compressedEntry = {
      role: "system" as const,
      content: `[Compressed conversation history — ${oldMessages.length} previous messages]\n\n${summary}`,
      timestamp: new Date().toISOString(),
    };

    // Store compression metadata on the session
    (session as any)._compressed = true;
    (session as any)._compressedAt = new Date().toISOString();
    (session as any)._originalMessageCount = msgCount;

    // Replace the transcript with compressed version
    // This uses the sessionManager's internal storage - we need to rebuild
    rebuildTranscript(sessionId, compressedEntry, recentMessages);

    return true;
  } catch (e) {
    console.warn(`[Compression] Failed to compress session ${sessionId}: ${safeMessage(e)}`);
    return false;
  }
}

async function summarizeMessages(
  messages: Array<{ role: string; content: string }>,
  modelRef?: string,
): Promise<string> {
  const text = messages
    .map(m => `[${m.role}]: ${m.content.slice(0, 500)}`)
    .join("\n\n");

  // Truncate if too long for summarization
  const input = text.length > 8000 ? text.slice(0, 8000) + "\n... [truncated]" : text;

  // For now, use a simple heuristic summary instead of an LLM call
  // Extract key patterns: file paths, decisions, errors, tool results
  const fileChanges = extractPattern(text, /✅\s*(?:Written|Edited|Deleted).*?(?:\n|$)/g);
  const errors = extractPattern(text, /(?:Error|❌).*?(?:\n|$)/g);
  const decisions = extractPattern(text, /(?:decided|changed|switched|added|removed).*?(?:\n|$)/gi);
  const userRequests = messages.filter(m => m.role === "user").map(m => m.content.slice(0, 200));

  const parts: string[] = [];
  parts.push(`**User requests:** ${userRequests.length}`);
  if (userRequests.length > 0) {
    parts.push(`Latest: "${userRequests[userRequests.length - 1]}"`);
  }
  if (fileChanges.length > 0) {
    parts.push(`**Files changed:** ${fileChanges.slice(0, 5).join(", ")}`);
  }
  if (errors.length > 0) {
    parts.push(`**Errors encountered:** ${errors.slice(0, 3).join("; ")}`);
  }
  if (decisions.length > 0) {
    parts.push(`**Key decisions:** ${decisions.slice(0, 3).join("; ")}`);
  }

  return parts.join("\n");
}

function extractPattern(text: string, pattern: RegExp): string[] {
  const results: string[] = [];
  let m;
  while ((m = pattern.exec(text)) !== null) {
    results.push(m[0].trim());
    if (results.length >= 10) break;
  }
  return results;
}

function rebuildTranscript(
  sessionId: string,
  compressedEntry: { role: "system"; content: string; timestamp: string },
  recentMessages: Array<{ role: string; content: string }>,
): void {
  try {
    // The sessionManager stores transcripts via append.
    // For rebuild: clear and re-append with compressed + recent
    // We'll use the internal storage mechanism
    const db = (sessionManager as any).getDb?.();
    if (!db) return;

    // Delete old messages for this session
    db.run("DELETE FROM messages WHERE session_id = ?", [sessionId]);

    // Insert compressed summary and recent messages
    const insert = db.prepare("INSERT INTO messages (session_id, role, content, timestamp, tool_call_id, name) VALUES (?, ?, ?, ?, ?, ?)");

    // Insert compressed summary
    insert.run(sessionId, compressedEntry.role, compressedEntry.content, compressedEntry.timestamp, null, null);

    // Insert recent messages
    for (const msg of recentMessages) {
      insert.run(sessionId, msg.role, msg.content.slice(0, 5000), new Date().toISOString(), null, null);
    }
  } catch (e) {
    console.warn(`[Compression] Rebuild failed:`, e);
  }
}
