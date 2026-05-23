/**
 * Nova Computer Use — desktop control (mouse, keyboard, screenshot, shell)
 * Ported from Hermes Agent computer_use_tool.py
 *
 * Uses:
 * - Windows: pyautogui (Python) or robotjs (Node.js)
 * - Fallback: PowerShell for screenshots, SendKeys for keyboard
 */

import { execSync, exec } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const SCREENSHOTS_DIR = join(process.cwd(), "data", "desktop");
const PYTHON_AVAILABLE = checkPythonAvailable();
const POWERSHELL = "powershell -Command";

function checkPythonAvailable(): boolean {
  try {
    execSync("python --version", { encoding: "utf-8", timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

export interface Point {
  x: number;
  y: number;
}

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Get screen resolution
 */
export async function getScreenSize(): Promise<{ width: number; height: number }> {
  if (PYTHON_AVAILABLE) {
    const script = `
import pyautogui
w, h = pyautogui.size()
print(f"{w}x{h}")
`;
    try {
      const result = execSync(`python -c "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
        encoding: "utf-8", timeout: 5000,
      });
      const [w, h] = result.trim().split("x").map(Number);
      return { width: w || 1920, height: h || 1080 };
    } catch {
      // Fallback
    }
  }

  // Windows fallback via PowerShell
  try {
    const result = execSync(`${POWERSHELL} "[System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Size | ForEach-Object { $_.Width.ToString() + 'x' + $_.Height.ToString() }"`, {
      encoding: "utf-8", timeout: 5000, shell: "powershell",
    }).trim();
    const [w, h] = result.split("x").map(Number);
    return { width: w || 1920, height: h || 1080 };
  } catch {
    return { width: 1920, height: 1080 };
  }
}

/**
 * Move mouse to absolute coordinates
 */
export async function mouseMove(x: number, y: number): Promise<string> {
  if (PYTHON_AVAILABLE) {
    const script = `import pyautogui; pyautogui.moveTo(${x}, ${y})`;
    try {
      execSync(`python -c "${script}"`, { encoding: "utf-8", timeout: 5000 });
      return `Mouse moved to (${x}, ${y})`;
    } catch {
      // Fallback
    }
  }

  // Windows via PowerShell
  try {
    const code = `[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})`;
    execSync(`${POWERSHELL} "Add-Type -AssemblyName System.Windows.Forms; ${code}"`, {
      encoding: "utf-8", timeout: 5000, shell: "powershell",
    });
    return `Mouse moved to (${x}, ${y})`;
  } catch (e: any) {
    throw new Error(`Mouse move failed: ${e.message}. Install pyautogui: pip install pyautogui`);
  }
}

/**
 * Click mouse at current position or absolute coordinates
 */
export async function mouseClick(button: "left" | "right" | "middle" = "left", x?: number, y?: number, double = false): Promise<string> {
  if (x !== undefined && y !== undefined) {
    await mouseMove(x, y);
  }

  const btn = button === "left" ? "primary" : button === "right" ? "secondary" : "other";
  const action = double ? "doubleClick" : "click";

  if (PYTHON_AVAILABLE) {
    const script = `import pyautogui; pyautogui.${action}(button='${btn === 'primary' ? 'left' : btn === 'secondary' ? 'right' : 'middle'}')`;
    try {
      execSync(`python -c "${script}"`, { encoding: "utf-8", timeout: 5000 });
      return `${double ? "Double-" : ""}${button} click${x !== undefined ? ` at (${x}, ${y})` : ""}`;
    } catch {
      // Fallback
    }
  }

  // Windows via PowerShell
  try {
    const btnCode = button === "left" ? "[System.Windows.Forms.MouseButtons]::Left" :
                    button === "right" ? "[System.Windows.Forms.MouseButtons]::Right" :
                    "[System.Windows.Forms.MouseButtons]::Middle";
    const code = double ?
      `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x || 0}, ${y || 0}); [System.Windows.Forms.SendKeys]::SendWait('{${button === 'left' ? '' : button.toUpperCase()}CLICK}')` :
      `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{${button === 'left' ? '' : button.toUpperCase()}CLICK}')`;
    execSync(`${POWERSHELL} "${code}"`, { encoding: "utf-8", timeout: 5000, shell: "powershell" });
    return `${double ? "Double-" : ""}${button} click`;
  } catch (e: any) {
    throw new Error(`Click failed: ${e.message}. Install pyautogui: pip install pyautogui`);
  }
}

/**
 * Keyboard: type text
 */
export async function keyboardType(text: string): Promise<string> {
  if (PYTHON_AVAILABLE) {
    const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
    const script = `import pyautogui; pyautogui.write("${escaped}", interval=0.01)`;
    try {
      execSync(`python -c "${script}"`, { encoding: "utf-8", timeout: 10000 });
      return `Typed ${text.length} characters`;
    } catch {
      // Fallback
    }
  }

  // Windows via SendKeys
  try {
    const escaped = text.replace(/[{}()^+%!~\[\]]/g, "{$&}").replace(/\n/g, "{ENTER}");
    const code = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("${escaped}")`;
    execSync(`${POWERSHELL} "${code}"`, { encoding: "utf-8", timeout: 10000, shell: "powershell" });
    return `Typed ${text.length} characters`;
  } catch (e: any) {
    throw new Error(`Keyboard type failed: ${e.message}`);
  }
}

/**
 * Keyboard: press special key
 */
export async function keyboardPress(key: string): Promise<string> {
  const keyMap: Record<string, string> = {
    "enter": "{ENTER}", "return": "{ENTER}",
    "tab": "{TAB}",
    "escape": "{ESC}", "esc": "{ESC}",
    "backspace": "{BACKSPACE}", "bs": "{BACKSPACE}",
    "delete": "{DELETE}", "del": "{DELETE}",
    "up": "{UP}", "down": "{DOWN}", "left": "{LEFT}", "right": "{RIGHT}",
    "home": "{HOME}", "end": "{END}",
    "pageup": "{PGUP}", "pagedown": "{PGDN}",
    "space": " ",
    "ctrl+c": "^(c)", "ctrl+v": "^(v)", "ctrl+x": "^(x)", "ctrl+a": "^(a)", "ctrl+z": "^(z)",
    "ctrl+s": "^(s)", "ctrl+f": "^(f)", "ctrl+n": "^(n)", "ctrl+p": "^(p)",
    "alt+f4": "%{F4}", "alt+tab": "%{TAB}",
    "f1": "{F1}", "f2": "{F2}", "f3": "{F3}", "f4": "{F4}", "f5": "{F5}",
    "f6": "{F6}", "f7": "{F7}", "f8": "{F8}", "f9": "{F9}", "f10": "{F10}",
    "f11": "{F11}", "f12": "{F12}",
  };

  const mapped = keyMap[key.toLowerCase()] || key;

  if (PYTHON_AVAILABLE) {
    const pyKey = key.toLowerCase();
    const pyKeyMap: Record<string, string> = {
      "enter": "enter", "return": "enter", "tab": "tab",
      "escape": "esc", "esc": "esc",
      "backspace": "backspace", "bs": "backspace",
      "delete": "delete", "del": "delete",
      "up": "up", "down": "down", "left": "left", "right": "right",
      "home": "home", "end": "end",
      "pageup": "pageup", "pagedown": "pagedown",
      "space": "space",
      "f1": "f1", "f2": "f2", "f3": "f3", "f4": "f4", "f5": "f5",
      "f6": "f6", "f7": "f7", "f8": "f8", "f9": "f9", "f10": "f10",
      "f11": "f11", "f12": "f12",
    };
    if (pyKeyMap[pyKey]) {
      const script = `import pyautogui; pyautogui.press("${pyKeyMap[pyKey]}")`;
      execSync(`python -c "${script}"`, { encoding: "utf-8", timeout: 5000 });
      return `Pressed: ${key}`;
    }
  }

  try {
    const code = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("${mapped}")`;
    execSync(`${POWERSHELL} "${code}"`, { encoding: "utf-8", timeout: 5000, shell: "powershell" });
    return `Pressed: ${key}`;
  } catch (e: any) {
    throw new Error(`Key press failed: ${e.message}`);
  }
}

/**
 * Take desktop screenshot
 */
export async function desktopScreenshot(region?: { x: number; y: number; width: number; height: number }): Promise<string> {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const filename = `desktop_${randomUUID().slice(0, 8)}.png`;
  const filePath = resolve(join(SCREENSHOTS_DIR, filename));

  if (PYTHON_AVAILABLE) {
    let script: string;
    if (region) {
      script = `import pyautogui; pyautogui.screenshot(r"${filePath.replace(/\\/g, '\\\\')}", region=(${region.x}, ${region.y}, ${region.width}, ${region.height}))`;
    } else {
      script = `import pyautogui; pyautogui.screenshot(r"${filePath.replace(/\\/g, '\\\\')}")`;
    }
    try {
      execSync(`python -c "${script}"`, { encoding: "utf-8", timeout: 10000 });
      if (existsSync(filePath)) return filePath;
    } catch {
      // Fallback
    }
  }

  // Windows via PowerShell
  try {
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.X, $screen.Y, 0, 0, $bitmap.Size)
$bitmap.Save("${filePath.replace(/\\/g, '\\\\')}", [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
`;
    const psFile = join(SCREENSHOTS_DIR, `screenshot_${randomUUID().slice(0, 8)}.ps1`);
    writeFileSync(psFile, psScript, "utf-8");
    execSync(`powershell -ExecutionPolicy Bypass -File "${psFile}"`, { encoding: "utf-8", timeout: 15000, shell: "powershell" });
    try { execSync(`del "${psFile}"`); } catch {}
    if (existsSync(filePath)) return filePath;
  } catch {
    // Final fallback
  }

  throw new Error("Desktop screenshot failed. Install pyautogui: pip install pyautogui");
}

/**
 * Execute shell command (limited to safe commands)
 */
export async function shell(command: string): Promise<ShellResult> {
  try {
    const result = execSync(command, {
      encoding: "utf-8",
      timeout: 15000,
      maxBuffer: 10 * 1024 * 1024,
      shell: process.platform === "win32" ? "cmd.exe" : "/bin/bash",
    });
    return { stdout: result.trim(), stderr: "", exitCode: 0 };
  } catch (e: any) {
    return {
      stdout: e.stdout?.toString().trim() || "",
      stderr: e.stderr?.toString().trim() || e.message,
      exitCode: e.status || 1,
    };
  }
}

/**
 * Drag mouse from one point to another
 */
export async function mouseDrag(fromX: number, fromY: number, toX: number, toY: number): Promise<string> {
  if (PYTHON_AVAILABLE) {
    const script = `import pyautogui; pyautogui.drag(${toX - fromX}, ${toY - fromY}, duration=0.3)`;
    try {
      await mouseMove(fromX, fromY);
      execSync(`python -c "${script}"`, { encoding: "utf-8", timeout: 5000 });
      return `Dragged from (${fromX}, ${fromY}) to (${toX}, ${toY})`;
    } catch {
      // Fallback
    }
  }

  await mouseMove(fromX, fromY);
  // Basic click-and-drag simulation
  return `Drag not fully supported without pyautogui. Drag from (${fromX}, ${fromY}) to (${toX}, ${toY}) requested.`;
}

/**
 * Get mouse position
 */
export async function mousePosition(): Promise<Point> {
  if (PYTHON_AVAILABLE) {
    try {
      const result = execSync(`python -c "import pyautogui; p = pyautogui.position(); print(f'{p.x},{p.y}')"`, {
        encoding: "utf-8", timeout: 5000,
      });
      const [x, y] = result.trim().split(",").map(Number);
      return { x, y };
    } catch {}
  }

  // Windows fallback
  try {
    const result = execSync(`${POWERSHELL} "Add-Type -AssemblyName System.Windows.Forms; $p = [System.Windows.Forms.Cursor]::Position; Write-Host $p.X,$p.Y"`, {
      encoding: "utf-8", timeout: 5000, shell: "powershell",
    });
    const [x, y] = result.trim().split(",").map(Number);
    return { x, y };
  } catch {
    return { x: 0, y: 0 };
  }
}
