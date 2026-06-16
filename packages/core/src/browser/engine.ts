/**
 * Nova Browser Engine — Playwright wrapper with stealth fingerprinting
 * Ported from Hermes Agent browser_camofox.py
 *
 * Supports: chromium (default), firefox, webkit
 * Stealth: user-agent rotation, viewport spoofing, WebGL, canvas, audio
 */

import { Browser, BrowserContext, Page, launch, chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { generateFingerprint, Fingerprint, applyFingerprint } from "./fingerprint.ts";

export interface BrowserOptions {
  headless?: boolean;
  width?: number;
  height?: number;
  userAgent?: string;
  locale?: string;
  fingerprint?: Fingerprint;
  proxy?: string;
  timeout?: number;
}

export interface TabInfo {
  id: number;
  url: string;
  title: string;
}

const SCREENSHOTS_DIR = join(process.cwd(), "data", "screenshots");
const DEFAULT_TIMEOUT = 30000;

let _browser: Browser | null = null;
let _context: BrowserContext | null = null;
let _page: Page | null = null;
let _options: BrowserOptions = {};

export function getCurrentPage(): Page | null {
  return _page;
}

export function getCurrentContext(): BrowserContext | null {
  return _context;
}

export async function launchBrowser(options: BrowserOptions = {}): Promise<string> {
  _options = { ...options };

  const headless = options.headless !== false;
  const width = options.width || 1280;
  const height = options.height || 800;
  const fp = options.fingerprint || generateFingerprint("chromium");

  try {
    _browser = await chromium.launch({
      headless,
      args: [
        `--window-size=${width},${height}`,
        "--disable-blink-features=AutomationControlled",
        "--disable-automation",
        "--no-sandbox",
      ],
    });

    _context = await _browser.newContext({
      viewport: { width, height },
      userAgent: options.userAgent || fp.userAgent,
      locale: options.locale || fp.locale,
      timezoneId: fp.timezone,
      deviceScaleFactor: fp.deviceScaleFactor,
      hasTouch: fp.hasTouch,
      isMobile: fp.isMobile,
      bypassCSP: true,
      ignoreHTTPSErrors: true,
    });

    _page = await _context.newPage();

    // Apply stealth scripts to evade bot detection
    await applyFingerprint(_page, fp);

    // Set default timeout
    _page.setDefaultTimeout(options.timeout || DEFAULT_TIMEOUT);

    return `Browser launched (${headless ? "headless" : "visible"}, ${width}x${height}, ${fp.userAgent.slice(0, 40)}...)`;
  } catch (e: any) {
    await closeBrowser();
    throw new Error(`Failed to launch browser: ${e.message}`);
  }
}

export async function closeBrowser(): Promise<string> {
  try {
    if (_page) await _page.close().catch(() => {});
    if (_context) await _context.close().catch(() => {});
    if (_browser) await _browser.close().catch(() => {});
  } finally {
    _page = null;
    _context = null;
    _browser = null;
  }
  return "Browser closed";
}

export async function navigate(url: string, options?: { waitUntil?: "load" | "domcontentloaded" | "networkidle" }): Promise<string> {
  if (!_page) throw new Error("Browser not launched. Call browser_navigate first.");

  // Auto-prepend https:// if no protocol
  const fullUrl = url.startsWith("http") ? url : `https://${url}`;

  try {
    const resp = await _page.goto(fullUrl, {
      waitUntil: options?.waitUntil || "networkidle",
      timeout: DEFAULT_TIMEOUT,
    });

    const status = resp?.status() || 0;
    const title = await _page.title();
    return `Navigated to ${fullUrl}\nStatus: ${status}\nTitle: ${title}\nURL: ${_page.url()}`;
  } catch (e: any) {
    // Even on timeout, we might have partial content
    const title = await _page.title().catch(() => "(no title)");
    return `Navigation to ${fullUrl} completed (${e.message})\nTitle: ${title}\nURL: ${_page.url()}`;
  }
}

export async function click(selector: string, options?: { timeout?: number }): Promise<string> {
  if (!_page) throw new Error("Browser not launched");
  await _page.waitForSelector(selector, { timeout: options?.timeout || DEFAULT_TIMEOUT });
  await _page.click(selector);
  return `Clicked: ${selector}`;
}

export async function typeText(selector: string, text: string, options?: { delay?: number }): Promise<string> {
  if (!_page) throw new Error("Browser not launched");
  await _page.waitForSelector(selector, { timeout: DEFAULT_TIMEOUT });
  await _page.fill(selector, ""); // clear first
  await _page.type(selector, text, { delay: options?.delay || 10 });
  return `Typed "${text.slice(0, 100)}${text.length > 100 ? "..." : ""}" into ${selector}`;
}

export async function screenshot(fullPage = false, name?: string): Promise<string> {
  if (!_page) throw new Error("Browser not launched");
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const filename = name ? `${name.replace(/[^a-zA-Z0-9_-]/g, "_")}.png` : `screenshot_${randomUUID().slice(0, 8)}.png`;
  const filePath = resolve(join(SCREENSHOTS_DIR, filename));

  await _page.screenshot({ path: filePath, fullPage });
  return filePath;
}

export async function extractText(selector?: string): Promise<string> {
  if (!_page) throw new Error("Browser not launched");
  if (selector) {
    const el = await _page.$(selector);
    if (!el) return `Element not found: ${selector}`;
    return await el.textContent() || "";
  }
  return await _page.textContent() || "";
}

export async function extractHtml(selector?: string): Promise<string> {
  if (!_page) throw new Error("Browser not launched");
  if (selector) {
    const el = await _page.$(selector);
    if (!el) return `Element not found: ${selector}`;
    return await el.innerHTML();
  }
  return await _page.content();
}

export async function evaluate(script: string): Promise<any> {
  if (!_page) throw new Error("Browser not launched");
  try {
    // Try as JS expression first
    return await _page.evaluate(`(() => { ${script} })()`);
  } catch {
    try {
      return await _page.evaluate(script);
    } catch (e: any) {
      return `Evaluation error: ${e.message}`;
    }
  }
}

export async function scroll(deltaX = 0, deltaY = 300): Promise<string> {
  if (!_page) throw new Error("Browser not launched");
  await _page.evaluate(({ dx, dy }: { dx: number; dy: number }) => window.scrollBy(dx, dy), { dx: deltaX, dy: deltaY });
  return `Scrolled by (${deltaX}, ${deltaY})`;
}

export async function wait(ms = 1000): Promise<string> {
  if (!_page) throw new Error("Browser not launched");
  await _page.waitForTimeout(ms);
  return `Waited ${ms}ms`;
}

export async function listTabs(): Promise<TabInfo[]> {
  if (!_context) return [];
  const pages = _context.pages();
  const result: TabInfo[] = [];
  for (let i = 0; i < pages.length; i++) {
    try {
      const title = await pages[i].title();
      result.push({ id: i, url: pages[i].url(), title });
    } catch {
      result.push({ id: i, url: pages[i].url(), title: "(unavailable)" });
    }
  }
  return result;
}

export async function switchTab(index: number): Promise<string> {
  if (!_context) throw new Error("Browser not launched");
  const pages = _context.pages();
  if (index < 0 || index >= pages.length) throw new Error(`Tab index ${index} out of range (0-${pages.length - 1})`);
  _page = pages[index];
  await _page.bringToFront();
  return `Switched to tab ${index}: ${_page.url()}`;
}

export async function pressKey(key: string): Promise<string> {
  if (!_page) throw new Error("Browser not launched");
  await _page.keyboard.press(key);
  return `Pressed: ${key}`;
}

export async function isBrowserOpen(): Promise<boolean> {
  return _browser !== null && _context !== null && _page !== null;
}
