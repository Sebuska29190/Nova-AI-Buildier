/**
 * Nova Browser Fingerprint — stealth spoofing for bot detection evasion
 * Ported from Hermes Agent browser_camofox.py (fingerprint generation)
 *
 * Generates realistic browser fingerprints: user-agent, viewport,
 * WebGL vendor, canvas noise, audio context, timezone, locale.
 */

import { Page } from "playwright";

export interface Fingerprint {
  userAgent: string;
  locale: string;
  timezone: string;
  platform: string;
  deviceScaleFactor: number;
  hasTouch: boolean;
  isMobile: boolean;
  webglVendor: string;
  webglRenderer: string;
}

// Realistic user-agent pool by browser
const USER_AGENTS: Record<string, string[]> = {
  chromium: [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  ],
  firefox: [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0",
  ],
  webkit: [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  ],
};

const LOCALES = ["en-US", "en-GB", "en-CA", "en-AU", "pl-PL", "de-DE", "fr-FR", "ja-JP", "zh-CN"];
const TIMEZONES = ["America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Europe/Warsaw", "Europe/Berlin", "Asia/Tokyo", "Asia/Shanghai"];
const PLATFORMS = ["Win32", "MacIntel", "Linux x86_64"];

const WEBGL_VENDORS = ["Google Inc.", "Intel Inc.", "NVIDIA Corporation", "AMD", "Apple"];
const WEBGL_RENDERERS = [
  "ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)",
  "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)",
  "ANGLE (AMD, AMD Radeon Graphics Direct3D11 vs_5_0 ps_5_0)",
  "Apple M2",
  "Intel Iris OpenGL Engine",
];

export function generateFingerprint(browser: string = "chromium"): Fingerprint {
  const uaPool = USER_AGENTS[browser] || USER_AGENTS.chromium;
  const randomIndex = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];

  // Windows → Win32, Mac → MacIntel, etc.
  const ua = randomIndex(uaPool);
  let platform = "Win32";
  if (ua.includes("Macintosh")) platform = "MacIntel";
  else if (ua.includes("Linux")) platform = "Linux x86_64";

  const isMobile = ua.includes("Mobile");
  const hasTouch = isMobile;

  return {
    userAgent: ua,
    locale: randomIndex(LOCALES),
    timezone: randomIndex(TIMEZONES),
    platform,
    deviceScaleFactor: isMobile ? 2 : 1,
    hasTouch,
    isMobile,
    webglVendor: randomIndex(WEBGL_VENDORS),
    webglRenderer: randomIndex(WEBGL_RENDERERS),
  };
}

export async function applyFingerprint(page: Page, fp: Fingerprint): Promise<void> {
  // Override navigator properties via page.addInitScript
  await page.addInitScript((fingerprint: Fingerprint) => {
    const fp = fingerprint;

    // Override navigator.webdriver
    Object.defineProperty(navigator, "webdriver", { get: () => false, configurable: true });

    // Override navigator.platform
    Object.defineProperty(navigator, "platform", { get: () => fp.platform, configurable: true });

    // Override navigator.language / languages
    Object.defineProperty(navigator, "language", { get: () => fp.locale, configurable: true });
    Object.defineProperty(navigator, "languages", { get: () => [fp.locale], configurable: true });

    // Override navigator.hardwareConcurrency
    Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8, configurable: true });

    // Override navigator.deviceMemory
    Object.defineProperty(navigator, "deviceMemory", { get: () => 8, configurable: true });

    // Override navigator.connection
    if ((navigator as any).connection) {
      Object.defineProperty(navigator, "connection", {
        get: () => ({ effectiveType: "4g", rtt: 50, downlink: 10, saveData: false }),
        configurable: true,
      });
    }

    // Override navigator.maxTouchPoints
    Object.defineProperty(navigator, "maxTouchPoints", { get: () => (fp.hasTouch ? 5 : 0), configurable: true });

    // Override navigator.userAgent (chrome/firefox only)
    try {
      Object.defineProperty(navigator, "userAgent", {
        get: () => fp.userAgent,
        configurable: true,
      });
    } catch {
      // Some browsers don't allow redefining userAgent
    }

    // Override WebGL vendor
    const getParameterProxy = (gl: any, originalGetParameter: Function) => {
      return function(p: any) {
        if (p === 37445) return fp.webglVendor; // UNMASK_VENDOR_WEBGL
        if (p === 37446) return fp.webglRenderer; // UNMASK_RENDERER_WEBGL
        return originalGetParameter.call(gl, p);
      };
    };

    const patchWebGL = (canvas: any) => {
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (gl) {
        const orig = gl.getParameter.bind(gl);
        gl.getParameter = getParameterProxy(gl, orig);
      }
    };

    // Apply to existing and future canvases
    const origCreateElement = document.createElement.bind(document);
    document.createElement = function(tag: string, options?: any) {
      const el = origCreateElement(tag, options);
      if (tag.toLowerCase() === "canvas") {
        setTimeout(() => patchWebGL(el), 0);
      }
      return el;
    };
  }, fp);
}
