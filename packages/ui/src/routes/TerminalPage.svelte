<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Terminal } from "@xterm/xterm";
  import { FitAddon } from "@xterm/addon-fit";
  import { WebLinksAddon } from "@xterm/addon-web-links";
  import { SearchAddon } from "@xterm/addon-search";
  import "@xterm/xterm/css/xterm.css";

  let connected = $state(false);
  let showSearch = $state(false);
  let searchText = $state("");

  let termEl: HTMLDivElement;
  let terminal: Terminal;
  let fitAddon: FitAddon;
  let searchAddon: SearchAddon;
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const WS_URL = `ws://${window.location.host}/terminal`;

  onMount(() => {
    initTerminal();
    connect();
  });

  onDestroy(() => {
    disconnect();
    if (reconnectTimer) clearTimeout(reconnectTimer);
    terminal?.dispose();
  });

  function initTerminal() {
    terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
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

    fitAddon = new FitAddon();
    searchAddon = new SearchAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(new WebLinksAddon());

    terminal.open(termEl);

    setTimeout(() => fitAddon.fit(), 100);

    terminal.onData((data) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    window.addEventListener("resize", handleResize);
  }

  function handleResize() {
    try { fitAddon.fit(); } catch {}
  }

  function connect() {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    try {
      ws = new WebSocket(WS_URL);
    } catch (e) {
      terminal?.writeln(`\x1b[31m[WebSocket Error]: ${(e as Error).message}\x1b[0m`);
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      connected = true;
      terminal?.clear();
      terminal?.writeln("\x1b[36m═══════════════════════════════════════\x1b[0m");
      terminal?.writeln("\x1b[36m  Connected to nova-builder terminal    \x1b[0m");
      terminal?.writeln("\x1b[36m  Type 'help' for available commands    \x1b[0m");
      terminal?.writeln("\x1b[36m═══════════════════════════════════════\x1b[0m");
      try { fitAddon.fit(); } catch {}
    };

    ws.onmessage = (evt) => {
      terminal?.write(evt.data);
    };

    ws.onerror = () => {
      connected = false;
    };

    ws.onclose = () => {
      connected = false;
      terminal?.writeln("\r\n\x1b[33m[Connection closed — reconnecting in 5s...]\x1b[0m");
      scheduleReconnect();
    };
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      ws.close();
      ws = null;
    }
    connected = false;
    window.removeEventListener("resize", handleResize);
  }

  function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      if (!connected) connect();
    }, 5000);
  }

  function reconnect() {
    disconnect();
    setTimeout(() => connect(), 500);
  }

  function clearTerm() {
    terminal?.clear();
  }

  function toggleSearch() {
    showSearch = !showSearch;
    if (showSearch) {
      setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>('[data-terminal-search]');
        input?.focus();
      }, 50);
    }
  }

  function doSearch(dir: "next" | "prev" = "next") {
    if (!searchText.trim()) return;
    try {
      if (dir === "next") {
        searchAddon.findNext(searchText);
      } else {
        searchAddon.findPrevious(searchText);
      }
    } catch {}
  }
</script>

<div class="max-w-5xl mx-auto w-full">
  <div class="mb-6">
    <h2 class="text-lg font-bold text-white">System Terminal</h2>
    <p class="text-xs text-slate-400">Direct CLI access for system builds, testing environments, and localized docker structures.</p>
  </div>

  <!-- Terminal Controls -->
  <div class="glass-panel rounded-xl overflow-hidden border border-slate-800">
    <div class="bg-slate-950 px-4 py-2 border-b border-slate-850 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full {connected ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
        <span class="w-3 h-3 rounded-full bg-amber-500/80"></span>
        <span class="w-3 h-3 rounded-full bg-emerald-500/80"></span>
        <span class="text-[11px] font-mono text-slate-500 ml-2">bash — core@nova-builder</span>
      </div>
      <div class="flex items-center gap-1.5">
        <button
          onclick={toggleSearch}
          class="text-[10px] px-2 py-1 rounded border border-slate-800 bg-[#020408]/60 text-slate-400 hover:text-white hover:border-slate-600 transition-all"
          title="Toggle Search"
        >
          🔍
        </button>
        <button
          onclick={clearTerm}
          class="text-[10px] px-2 py-1 rounded border border-slate-800 bg-[#020408]/60 text-slate-400 hover:text-white hover:border-slate-600 transition-all"
          title="Clear Terminal"
        >✕</button>
        <button
          onclick={reconnect}
          class="text-[10px] px-2 py-1 rounded border border-slate-800 bg-[#020408]/60 text-slate-400 hover:text-white hover:border-slate-600 transition-all"
          title="Reconnect"
        >⟳</button>
      </div>
    </div>

    <!-- Search Bar -->
    {#if showSearch}
      <div class="bg-[#0b0f19] px-4 py-2 border-b border-slate-800 flex items-center gap-2">
        <input
          type="text"
          bind:value={searchText}
          onkeydown={(e) => { if (e.key === "Enter") doSearch(); if (e.key === "Escape") toggleSearch(); }}
          data-terminal-search
          placeholder="Search terminal output..."
          class="flex-1 bg-[#020408]/60 border border-slate-800 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-[#00f2fe]"
        />
        <button onclick={() => doSearch("prev")} class="text-[10px] px-2 py-1 rounded border border-slate-800 bg-[#020408]/60 text-slate-400 hover:text-white transition-all" title="Previous">▲</button>
        <button onclick={() => doSearch("next")} class="text-[10px] px-2 py-1 rounded border border-slate-800 bg-[#020408]/60 text-slate-400 hover:text-white transition-all" title="Next">▼</button>
        <button onclick={toggleSearch} class="text-[10px] px-2 py-1 rounded border border-slate-800 bg-[#020408]/60 text-slate-400 hover:text-white transition-all">Esc</button>
      </div>
    {/if}

    <!-- Terminal Element -->
    <div
      bind:this={termEl}
      class="w-full"
      style="height: 480px;"
    ></div>

    <!-- Connection Bar -->
    <div class="bg-slate-950 px-4 py-1.5 border-t border-slate-800 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full {connected ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
        <span class="text-[9px] font-mono {connected ? 'text-emerald-400' : 'text-rose-400'}">
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>
      {#if !connected}
        <button onclick={reconnect} class="btn-premium px-3 py-0.5 rounded text-[9px] font-semibold">Reconnect</button>
      {/if}
    </div>
  </div>
</div>
