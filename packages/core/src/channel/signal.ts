/**
 * Nova Signal Bridge — signal-cli integration
 *
 * Uses signal-cli (Java CLI daemon) for Signal messaging.
 * First-time setup requires phone number verification via SMS/call.
 *
 * Setup:
 *   1. Download signal-cli: https://github.com/AsamK/signal-cli/releases
 *   2. Register: signal-cli -u +1234567890 register
 *   3. Verify:  signal-cli -u +1234567890 verify <CODE>
 *
 * Config:
 *   SIGNAL_PHONE — registered phone number (+1234567890)
 *   SIGNAL_CLI_PATH — path to signal-cli binary (default: "signal-cli")
 */

import { execSync, exec } from "node:child_process";

interface SignalMessage {
  source: string;
  body: string;
  timestamp: number;
  isGroup: boolean;
  groupId?: string;
}

function getPhone(): string {
  const phone = process.env.SIGNAL_PHONE;
  if (!phone) throw new Error("Signal not configured. Set SIGNAL_PHONE in .env");
  return phone;
}

function getCliPath(): string {
  return process.env.SIGNAL_CLI_PATH || "signal-cli";
}

function execSignal(args: string, timeout = 15000): string {
  const cli = getCliPath();
  const phone = getPhone();
  try {
    return execSync(`"${cli}" -u "${phone}" ${args}`, {
      encoding: "utf-8",
      timeout,
      maxBuffer: 5 * 1024 * 1024,
    }).trim();
  } catch (e: any) {
    throw new Error(`Signal CLI error:\nstdout: ${e.stdout?.toString().trim() || ""}\nstderr: ${e.stderr?.toString().trim() || e.message}`);
  }
}

/**
 * Check if signal-cli is available and registered
 */
export async function signalStatus(): Promise<string> {
  try {
    const version = execSync(`"${getCliPath()}" --version`, { encoding: "utf-8", timeout: 5000 }).trim();
    const user = getPhone();
    return `Signal CLI ${version}\nRegistered user: ${user}`;
  } catch {
    return "Signal CLI not found. Install signal-cli from https://github.com/AsamK/signal-cli";
  }
}

/**
 * Send a Signal message
 */
export async function signalSend(recipient: string, message: string): Promise<string> {
  // recipient can be phone number or group ID
  const isGroup = recipient.startsWith("group.");
  const arg = isGroup ? `-g "${recipient.replace("group.", "")}"` : `"${recipient}"`;

  try {
    execSignal(`send ${arg} -m "${message.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`);
    return `Signal message sent to ${recipient}`;
  } catch (e: any) {
    // Try with stdin for longer messages
    try {
      const cli = getCliPath();
      const phone = getPhone();
      const escaped = message.replace(/"/g, '\\"');
      if (isGroup) {
        execSync(`echo "${escaped}" | "${cli}" -u "${phone}" send ${arg}`, {
          encoding: "utf-8", timeout: 15000, shell: "cmd",
        });
      } else {
        execSync(`echo "${escaped}" | "${cli}" -u "${phone}" send ${arg}`, {
          encoding: "utf-8", timeout: 15000, shell: "cmd",
        });
      }
      return `Signal message sent to ${recipient}`;
    } catch (e2: any) {
      throw new Error(`Signal send failed: ${e2.message}`);
    }
  }
}

/**
 * Receive recent messages
 */
export async function signalReceive(limit = 10): Promise<SignalMessage[]> {
  try {
    const output = execSignal(`receive --timeout 5`, 15000);

    // Parse signal-cli JSON output
    const messages: SignalMessage[] = [];
    const lines = output.split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.envelope && parsed.envelope.dataMessage) {
          messages.push({
            source: parsed.envelope.source || "(unknown)",
            body: parsed.envelope.dataMessage.message || "",
            timestamp: parsed.envelope.timestamp || Date.now(),
            isGroup: !!parsed.envelope.dataMessage.groupInfo,
            groupId: parsed.envelope.dataMessage.groupInfo?.groupId,
          });
        }
      } catch {
        // Skip non-JSON lines
        continue;
      }
    }

    return messages.slice(0, limit);
  } catch (e: any) {
    if (e.message.includes("No results")) return [];
    throw new Error(`Signal receive failed: ${e.message}`);
  }
}

/**
 * List Signal groups
 */
export async function signalListGroups(): Promise<{ id: string; name: string; memberCount: number }[]> {
  try {
    const output = execSignal("listGroups", 10000);
    const groups: { id: string; name: string; memberCount: number }[] = [];
    const lines = output.split("\n");

    for (const line of lines) {
      // Format: "Group: Name (id: abc123) members: 5"
      const match = line.match(/Group:\s*(.*?)\s*\(id:\s*([^)]+)\)\s*members:\s*(\d+)/);
      if (match) {
        groups.push({ name: match[1].trim(), id: match[2].trim(), memberCount: parseInt(match[3]) });
      }
    }

    return groups;
  } catch {
    return [];
  }
}

/**
 * Register a new Signal account (first-time setup)
 */
export async function signalRegister(phone?: string): Promise<string> {
  const number = phone || getPhone();
  try {
    execSignal(`register`, 30000);
    return `Registration SMS sent to ${number}. Check your phone for the verification code.`;
  } catch (e: any) {
    throw new Error(`Signal registration failed: ${e.message}`);
  }
}

/**
 * Verify Signal account with code from SMS
 */
export async function signalVerify(code: string, phone?: string): Promise<string> {
  const number = phone || getPhone();
  try {
    execSignal(`verify "${code}"`, 30000);
    return `Signal account ${number} verified successfully!`;
  } catch (e: any) {
    throw new Error(`Signal verification failed: ${e.message}`);
  }
}
