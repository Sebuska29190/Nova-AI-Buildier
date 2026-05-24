/**
 * Computer Use — agent controls mouse, keyboard, and takes screenshots.
 * Uses PowerShell on Windows for native input simulation.
 */
import { execSync } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SCREENSHOT_DIR = join(process.cwd(), "data", "screenshots");
const PS_SCRIPTS_DIR = join(process.cwd(), "data", "ps-scripts");

if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });
if (!existsSync(PS_SCRIPTS_DIR)) mkdirSync(PS_SCRIPTS_DIR, { recursive: true });

function runPS(script: string): string {
  const scriptPath = join(PS_SCRIPTS_DIR, `cu_${Date.now()}.ps1`);
  writeFileSync(scriptPath, script, "utf-8");
  try {
    const result = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
      { timeout: 30000, shell: true, encoding: "utf-8", windowsHide: true, maxBuffer: 10 * 1024 * 1024 }
    );
    return (result || "").trim();
  } finally {
    try { require("fs").unlinkSync(scriptPath); } catch {}
  }
}

export interface ScreenshotResult {
  path: string;
  width: number;
  height: number;
}

export function takeScreenshot(): ScreenshotResult {
  const filename = `screen_${Date.now()}.png`;
  const filePath = join(SCREENSHOT_DIR, filename);
  const ps = `
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bitmap = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CopyFromScreen($screen.X, $screen.Y, 0, 0, $bitmap.Size)
    $bitmap.Save("${filePath.replace(/\\/g, '\\\\')}", [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()
    Write-Output "$($screen.Width)x$($screen.Height)"
  `;
  const dims = runPS(ps);
  const [w, h] = dims.split("x").map(Number);
  return { path: filePath, width: w || 1920, height: h || 1080 };
}

export function mouseMove(x: number, y: number): string {
  const ps = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class WinAPI {
        [DllImport("user32.dll")]
        public static extern bool SetCursorPos(int x, int y);
      }
"@
    [WinAPI]::SetCursorPos(${Math.round(x)}, ${Math.round(y)})
    Write-Output "ok"
  `;
  return runPS(ps);
}

export function mouseClick(button: "left" | "right" | "middle" = "left"): string {
  const btnFlags = { left: "0x2,0x4", right: "0x8,0x10", middle: "0x20,0x40" };
  const flags = btnFlags[button];
  const ps = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class WinAPI {
        [DllImport("user32.dll")]
        public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
      }
"@
    [WinAPI]::mouse_event(${flags.Split(",")[0]}, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 50
    [WinAPI]::mouse_event(${flags.Split(",")[1]}, 0, 0, 0, 0)
    Write-Output "clicked ${button}"
  `;
  return runPS(ps);
}

export function typeText(text: string): string {
  // Escape special characters for SendKeys
  const escaped = text
    .replace(/\+/g, "{+}")
    .replace(/\^/g, "{^}")
    .replace(/~/g, "{~}")
    .replace(/\(/g, "{(}").replace(/\)/g, "{)}")
    .replace(/\[/g, "{[}").replace(/\]/g, "{]}")
    .replace(/\{/g, "{{}").replace(/\}/g, "{}}");
  const ps = `
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.SendKeys]::SendWait("${escaped.replace(/"/g, '`"')}")
    Write-Output "typed ${text.length} chars"
  `;
  return runPS(ps);
}

export function keyPress(key: string): string {
  const keyMap: Record<string, string> = {
    "enter": "{ENTER}", "tab": "{TAB}", "escape": "{ESC}", "backspace": "{BACKSPACE}",
    "delete": "{DELETE}", "up": "{UP}", "down": "{DOWN}", "left": "{LEFT}", "right": "{RIGHT}",
    "home": "{HOME}", "end": "{END}", "pageup": "{PGUP}", "pagedown": "{PGDN}",
    "space": " ", "ctrl_c": "^c", "ctrl_v": "^v", "ctrl_x": "^x", "ctrl_a": "^a", "ctrl_z": "^z",
    "ctrl_s": "^s", "alt_tab": "%{TAB}", "win_d": "^{ESCAPE}", "win_r": "^{ESCAPE}",
  };
  const send = keyMap[key.toLowerCase()] || `{${key.toUpperCase()}}`;
  const ps = `
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.SendKeys]::SendWait("${send.replace(/"/g, '`"')}")
    Write-Output "pressed ${key}"
  `;
  return runPS(ps);
}

export function getScreenSize(): { width: number; height: number } {
  const ps = `
    Add-Type -AssemblyName System.Windows.Forms
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    Write-Output "$($screen.Width)x$($screen.Height)"
  `;
  const dims = runPS(ps);
  const [w, h] = dims.split("x").map(Number);
  return { width: w || 1920, height: h || 1080 };
}

export function getCursorPos(): { x: number; y: number } {
  const ps = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class WinAPI {
        [DllImport("user32.dll")]
        public static extern bool GetCursorPos(out System.Drawing.Point lpPoint);
      }
"@
    $pt = New-Object System.Drawing.Point
    [WinAPI]::GetCursorPos([ref]$pt)
    Write-Output "$($pt.X),$($pt.Y)"
  `;
  const pos = runPS(ps);
  const [x, y] = pos.split(",").map(Number);
  return { x: x || 0, y: y || 0 };
}

export function scroll(amount: number): string {
  const ps = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class WinAPI {
        [DllImport("user32.dll")]
        public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
      }
"@
    # 0x0800 = wheel, dwData = scroll amount (positive=up, negative=down)
    [WinAPI]::mouse_event(0x0800, 0, 0, ${Math.round(amount)}, 0)
    Write-Output "scrolled ${amount}"
  `;
  return runPS(ps);
}

/**
 * Drag mouse from (x1,y1) to (x2,y2) with optional steps for smooth movement.
 */
export function mouseDrag(x1: number, y1: number, x2: number, y2: number, steps: number = 10): string {
  mouseMove(x1, y1);
  const ps = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class WinAPI {
        [DllImport("user32.dll")]
        public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
        [DllImport("user32.dll")]
        public static extern bool SetCursorPos(int x, int y);
      }
"@
    $steps = ${Math.max(1, steps)}
    for($i = 1; $i -le $steps; $i++) {
      $x = ${x1} + (${x2} - ${x1}) * $i / $steps
      $y = ${y1} + (${y2} - ${y1}) * $i / $steps
      [WinAPI]::SetCursorPos([int]$x, [int]$y)
      Start-Sleep -Milliseconds 10
    }
    # Mouse down then up (left button)
    [WinAPI]::mouse_event(0x2, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 50
    [WinAPI]::mouse_event(0x4, 0, 0, 0, 0)
    Write-Output "dragged (${x1},${y1})->(${x2},${y2})"
  `;
  return runPS(ps);
}
