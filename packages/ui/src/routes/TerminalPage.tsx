import { useState, useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

const WS_URL = `ws://${window.location.host}/terminal`;

export function TerminalPage() {
  const [connected, setConnected] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState("");

  const termRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Disconnect (cleanup) ── */
  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  /* ── Schedule auto-reconnect ── */
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(() => {
      if (!connected) connect();
    }, 5000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  /* ── Handle window resize ── */
  const handleResize = useCallback(() => {
    try { fitAddonRef.current?.fit(); } catch { /* noop */ }
  }, []);

  /* ── Connect WebSocket ── */
  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
    } catch (e) {
      terminalRef.current?.writeln(
        `\x1b[31m[WebSocket Error]: ${(e as Error).message}\x1b[0m`
      );
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      setConnected(true);
      terminalRef.current?.clear();
      terminalRef.current?.writeln(
        "\x1b[36m═══════════════════════════════════════\x1b[0m"
      );
      terminalRef.current?.writeln(
        "\x1b[36m  Connected to nova-builder terminal    \x1b[0m"
      );
      terminalRef.current?.writeln(
        "\x1b[36m  Type 'help' for available commands    \x1b[0m"
      );
      terminalRef.current?.writeln(
        "\x1b[36m═══════════════════════════════════════\x1b[0m"
      );
      try { fitAddonRef.current?.fit(); } catch { /* noop */ }
    };

    ws.onmessage = (evt) => {
      terminalRef.current?.write(evt.data);
    };

    ws.onerror = () => {
      setConnected(false);
    };

    ws.onclose = () => {
      setConnected(false);
      terminalRef.current?.writeln(
        "\r\n\x1b[33m[Connection closed — reconnecting in 5s...]\x1b[0m"
      );
      scheduleReconnect();
    };

    wsRef.current = ws;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleReconnect]);

  /* ── Explicit reconnect ── */
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => connect(), 500);
  }, [disconnect, connect]);

  /* ── Clear terminal ── */
  const clearTerm = useCallback(() => {
    terminalRef.current?.clear();
  }, []);

  /* ── Toggle search bar ── */
  const toggleSearch = useCallback(() => {
    setShowSearch((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => {
          const input = document.querySelector<HTMLInputElement>(
            "[data-terminal-search]"
          );
          input?.focus();
        }, 50);
      }
      return next;
    });
  }, []);

  /* ── Execute search ── */
  const doSearch = useCallback(
    (dir: "next" | "prev" = "next") => {
      if (!searchText.trim()) return;
      try {
        if (dir === "next") {
          searchAddonRef.current?.findNext(searchText);
        } else {
          searchAddonRef.current?.findPrevious(searchText);
        }
      } catch { /* noop */ }
    },
    [searchText]
  );

  /* ── Init terminal on mount ── */
  useEffect(() => {
    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize: 13,
      fontFamily:
        "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
      theme: {
        background: "#020408",
        foreground: "#34d399",
        cursor: "#00f2fe",
        cursorAccent: "#020408",
        selectionBackground: "#00f2fe33",
        black: "#020408",
        red: "#f43f5e",
        green: "#34d399",
        yellow: "#fbbf24",
        blue: "#6366f1",
        magenta: "#a78bfa",
        cyan: "#00f2fe",
        white: "#e2e8f0",
        brightBlack: "#475569",
        brightRed: "#fb7185",
        brightGreen: "#6ee7b7",
        brightYellow: "#fde68a",
        brightBlue: "#818cf8",
        brightMagenta: "#c4b5fd",
        brightCyan: "#67e8f9",
        brightWhite: "#f8fafc",
      },
      allowProposedApi: true,
      convertEol: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(new WebLinksAddon());

    if (termRef.current) {
      terminal.open(termRef.current);
    }

    // Fit after mount
    setTimeout(() => fitAddon.fit(), 100);

    // Forward terminal input to WebSocket
    terminal.onData((data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(data);
      }
    });

    window.addEventListener("resize", handleResize);

    // Store refs
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    // Connect
    connect();

    return () => {
      disconnect();
      window.removeEventListener("resize", handleResize);
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white">System Terminal</h2>
        <p className="text-xs text-slate-400">
          Direct CLI access for system builds, testing environments, and
          localized docker structures.
        </p>
      </div>

      {/* Terminal Panel */}
      <div className="glass-panel rounded-xl overflow-hidden border border-slate-800">
        {/* Controls Bar — Mac-style dots */}
        <div className="bg-slate-950 px-4 py-2 border-b border-slate-850 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                connected ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
            <span className="w-3 h-3 rounded-full bg-amber-500/80" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <span className="text-[11px] font-mono text-slate-500 ml-2">
              bash — core@nova-builder
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleSearch}
              className="text-[10px] px-2 py-1 rounded border border-slate-800 bg-[#020408]/60 text-slate-400 hover:text-white hover:border-slate-600 transition-all"
              title="Toggle Search"
            >
              🔍
            </button>
            <button
              onClick={clearTerm}
              className="text-[10px] px-2 py-1 rounded border border-slate-800 bg-[#020408]/60 text-slate-400 hover:text-white hover:border-slate-600 transition-all"
              title="Clear Terminal"
            >
              ✕
            </button>
            <button
              onClick={reconnect}
              className="text-[10px] px-2 py-1 rounded border border-slate-800 bg-[#020408]/60 text-slate-400 hover:text-white hover:border-slate-600 transition-all"
              title="Reconnect"
            >
              ⟳
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="bg-[#0b0f19] px-4 py-2 border-b border-slate-800 flex items-center gap-2">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") doSearch();
                if (e.key === "Escape") toggleSearch();
              }}
              data-terminal-search
              placeholder="Search terminal output..."
              className="flex-1 bg-[#020408]/60 border border-slate-800 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-[#00f2fe]"
            />
            <button
              onClick={() => doSearch("prev")}
              className="text-[10px] px-2 py-1 rounded border border-slate-800 bg-[#020408]/60 text-slate-400 hover:text-white transition-all"
              title="Previous"
            >
              ▲
            </button>
            <button
              onClick={() => doSearch("next")}
              className="text-[10px] px-2 py-1 rounded border border-slate-800 bg-[#020408]/60 text-slate-400 hover:text-white transition-all"
              title="Next"
            >
              ▼
            </button>
            <button
              onClick={toggleSearch}
              className="text-[10px] px-2 py-1 rounded border border-slate-800 bg-[#020408]/60 text-slate-400 hover:text-white transition-all"
            >
              Esc
            </button>
          </div>
        )}

        {/* Terminal Element */}
        <div ref={termRef} className="w-full" style={{ height: 480 }} />

        {/* Connection Status Bar */}
        <div className="bg-slate-950 px-4 py-1.5 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                connected ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
            <span
              className={`text-[9px] font-mono ${
                connected ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
          {!connected && (
            <button
              onClick={reconnect}
              className="btn-premium px-3 py-0.5 rounded text-[9px] font-semibold"
            >
              Reconnect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
