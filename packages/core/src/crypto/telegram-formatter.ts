import type { CuratedNews, NewsDigest } from "./types.ts";
import { channelManager } from "../channel/manager.ts";

const SENTIMENT_EMOJI: Record<string, string> = {
  bullish: "\u{1F7E2}",    // 🟢
  bearish: "\u{1F534}",    // 🔴
  neutral: "\u{1F7E1}",    // 🟡
};

const MOOD_EMOJI: Record<string, string> = {
  bullish: "\u{1F6A8} Bullish",
  bearish: "\u{1F4C9} Bearish",
  neutral: "\u{1F9D0} Neutral",
};

function formatPrice(num: number): string {
  if (num >= 1000) return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (num >= 1) return num.toFixed(2);
  return num.toFixed(4);
}

function formatChange(val: number): string {
  const sign = val >= 0 ? "+" : "";
  return `${sign}${val.toFixed(1)}%`;
}

export function formatNewsDigest(digest: NewsDigest): string {
  const lines: string[] = [];
  const date = new Date(digest.generatedAt).toLocaleDateString("pl-PL", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  // Header
  lines.push(`\u{1F4F0} *KRYPTO PRZEGL\u{0104}D* \u{2014} ${date}`);
  lines.push("\u2501".repeat(25));
  lines.push("");

  // Articles
  for (const art of digest.articles) {
    const emoji = art.rank === 1 ? "\u{1F525}" : art.rank === 2 ? "\u{26A1}" : art.rank === 3 ? "\u{1F4C9}" : "\u{1F4CC}";
    const sentimentEmoji = SENTIMENT_EMOJI[art.sentiment] || "";
    lines.push(`${emoji} #${art.rank}: *${art.title}*`);
    lines.push(`\u{1F4C8} ${formatChange(0)} | ${sentimentEmoji} ${art.sentiment === "bullish" ? "Bullish" : art.sentiment === "bearish" ? "Bearish" : "Neutral"} (${art.sentimentScore}/10)`);
    if (art.analysis) lines.push(`\u{1F4A1} ${art.analysis}`);
    lines.push(`\u{1F517} [Czytaj wi\u{0119}cej](${art.url})`);
    lines.push("\u2501".repeat(25));
    lines.push("");
  }

  // Market Mood
  const moodIcon = SENTIMENT_EMOJI[digest.marketMood] || "";
  lines.push(`\u{1F9CA} Market Mood: ${moodIcon} ${MOOD_EMOJI[digest.marketMood] || "Neutral"}`);
  lines.push(`   (${digest.moodBreakdown.bullish} bullish, ${digest.moodBreakdown.bearish} bearish, ${digest.moodBreakdown.neutral} neutral)`);

  // Top Prices
  if (digest.topPrices.length > 0) {
    lines.push(`\u{1F3C6} TOP: ${digest.topPrices.map((p) => `${p.symbol} $${formatPrice(p.price)}`).join(" | ")}`);
  }

  // Footer
  lines.push("\u2501".repeat(25));
  lines.push("Powered by @NovaAI \u2022 #crypto #news");

  return lines.join("\n");
}

export async function publishToTelegram(digest: NewsDigest): Promise<boolean> {
  const message = formatNewsDigest(digest);
  try {
    // Send via channel manager — find telegram channel
    const channels = await channelManager.list();
    const tgChannel = channels.find((c: any) => c.id === "telegram");
    if (!tgChannel) {
      console.warn("[crypto] No Telegram channel configured — message not sent");
      return false;
    }
    await channelManager.send(tgChannel.id, message);
    return true;
  } catch (e) {
    console.error("[crypto] Failed to publish to Telegram:", e);
    return false;
  }
}

export async function publishSpikeAlert(symbol: string, price: number, change1h: number): Promise<boolean> {
  const message = [
    `\u{1F6A8}\u{1F6A8}\u{1F6A8} BREAKING \u{1F6A8}\u{1F6A8}\u{1F6A8}`,
    "",
    `${symbol} VOLATILITY SPIKE`,
    `\u{1F4C8} ${symbol} zmieni\u{0142} si\u{0119} o *${formatChange(change1h)}* w ostatniej godzinie`,
    `\u{1F4B0} Aktualna cena: $${formatPrice(price)}`,
    "",
    "Powered by @NovaAI \u2022 #crypto #alert",
  ].join("\n");

  try {
    const channels = await channelManager.list();
    const tgChannel = channels.find((c: any) => c.id === "telegram");
    if (!tgChannel) return false;
    await channelManager.send(tgChannel.id, message);
    return true;
  } catch { return false; }
}

export async function publishPortfolioAlert(position: string, pnlPercent: number, pnlValue: number, oldValue: number, newValue: number): Promise<boolean> {
  const sign = pnlPercent >= 0 ? "+" : "";
  const emoji = pnlPercent < -10 ? "\u{26A0}\u{FE0F}" : pnlPercent < 0 ? "\u{1F4C9}" : "\u{1F4C8}";
  const message = [
    `${emoji} *Portfolio Alert*`,
    `${position}: ${formatChange(pnlPercent)} ($${formatPrice(pnlValue)})`,
    `$${formatPrice(oldValue)} \u{2192} $${formatPrice(newValue)}`,
    "",
    "Powered by @NovaAI",
  ].join("\n");

  try {
    const channels = await channelManager.list();
    const tgChannel = channels.find((c: any) => c.id === "telegram");
    if (!tgChannel) return false;
    await channelManager.send(tgChannel.id, message);
    return true;
  } catch { return false; }
}
