<script lang="ts">
  import { marked } from "marked";
  import hljs from "highlight.js";
  import { api } from "../lib/api.ts";

  marked.setOptions({
    highlight: (code: string, lang: string) => {
      if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value;
      return hljs.highlightAuto(code).value;
    },
    breaks: true,
    gfm: true,
  } as any);

  let { model = "deepseek/deepseek-chat", models = [], skills = [], resumeSessionId = "", onResolved = () => {}, onSessionChange = () => {}, sessionKey: externalSessionKey = "", onSessionKeyChange = (_key: string) => {} }: {
    model: string; models: Array<{ id: string }>; skills: any[]; resumeSessionId?: string; onResolved?: () => void; onSessionChange?: () => void; sessionKey?: string; onSessionKeyChange?: (key: string) => void;
  } = $props();

  let messages = $state<Array<{ role: string; content: string; timestamp: string }>>([]);
  let input = $state("");
  let loading = $state(false);
  let streaming = $state(false);
  let streamContent = $state("");

  const commands = [
    "@workspace_get_state", "@workspace_list_files", "@workspace_read_file", "@workspace_write_file",
    "@browser_launch", "@browser_navigate",
    "@coingecko_price", "@fetch_crypto_news",
    "@search_products", "@whatsapp_send", "@email_send",
  ];

  async function send() {
    if (!input.trim() || loading) return;
    const text = input.trim();
    input = "";
    messages.push({ role: "user", content: text, timestamp: new Date().toISOString() });
    loading = true; streaming = true; streamContent = "";
    try {
      const sessionId = resumeSessionId || crypto.randomUUID();
      const result = await api.chatSend(text, model, sessionId, (chunk) => { streamContent = chunk; });
      messages.push({ role: "assistant", content: result.text, timestamp: new Date().toISOString() });
      if (result.sessionKey) resumeSessionId = result.sessionKey;
    } catch (e: unknown) {
      messages.push({ role: "assistant", content: `Error: ${(e as Error).message}`, timestamp: new Date().toISOString() });
    } finally {
      loading = false; streaming = false; streamContent = "";
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }
</script>

<div class="h-full flex flex-col justify-between max-w-5xl mx-auto w-full">
  <!-- Messages / Welcome -->
  <div class="flex-1 flex flex-col overflow-y-auto scrollbar-none">
    {#if messages.length === 0}
      <!-- Welcome Screen -- New Design -->
      <div class="flex-1 flex flex-col items-center justify-center text-center px-4 py-12">
        <!-- Gradient sparkle icon -->
        <div class="relative mb-8">
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00f2fe]/20 to-[#6366f1]/20 border border-[#00f2fe]/30 flex items-center justify-center shadow-[0_0_40px_rgba(0,242,254,0.15)]">
            <i data-lucide="sparkles" class="w-7 h-7 text-[#00f2fe]"></i>
          </div>
          <div class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#00f2fe] animate-pulse shadow-[0_0_10px_rgba(0,242,254,0.6)]"></div>
        </div>

        <h2 class="text-2xl font-bold tracking-tight text-white mb-3">How can we empower your build today?</h2>
        <p class="text-sm text-slate-400 max-w-md mx-auto mb-10 leading-relaxed">
          Command your autonomous workspace. Deploy agents, trade crypto, edit video, analyze markets — all from one chat.
        </p>

        <!-- Command Badges Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-lg mx-auto w-full mb-10">
          {#each commands as cmd}
            <button
              onclick={() => { input = cmd + " "; document.querySelector<HTMLInputElement>('[data-chat-input]')?.focus(); }}
              class="custom-badge bg-nova-card border border-nova-border-2 hover:border-[#00f2fe]/40 hover:bg-nova-card-hover text-slate-300 hover:text-white transition-all duration-200 text-left truncate"
            >
              <span class="text-[#00f2fe] mr-1 opacity-70">~</span>{cmd}
            </button>
          {/each}
        </div>

        <!-- Model / Skills chips -->
        <div class="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500">
          {#if model}
            <span class="custom-badge bg-nova-card border border-nova-border-2 text-slate-400">
              <i data-lucide="cpu" class="w-3 h-3 mr-1.5 text-[#00f2fe]"></i>
              {model}
            </span>
          {/if}
          {#each skills.filter((s: any) => s.enabled !== false).slice(0, 4) as skill}
            <span class="custom-badge bg-nova-card border border-nova-border-2 text-slate-400">
              <i data-lucide="puzzle" class="w-3 h-3 mr-1.5 text-[#6366f1]"></i>
              {skill.name || skill.id}
            </span>
          {/each}
          {#if skills.filter((s: any) => s.enabled !== false).length > 4}
            <span class="text-slate-600">+{skills.filter((s: any) => s.enabled !== false).length - 4} more</span>
          {/if}
        </div>
      </div>
    {:else}
      <!-- Messages List -->
      <div class="flex-1 space-y-4 px-1 py-4">
        {#each messages as msg, i}
          <div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in">
            {#if msg.role === 'user'}
              <div class="max-w-[80%] glass-panel rounded-xl p-4 border border-nova-border-2">
                <div class="text-xs text-slate-500 mb-1.5 font-mono flex items-center gap-1.5">
                  <i data-lucide="user" class="w-3 h-3 text-[#00f2fe]"></i>
                  You
                </div>
                <div class="text-sm text-white leading-relaxed whitespace-pre-wrap">{msg.content}</div>
              </div>
            {:else}
              <div class="max-w-[85%] glass-panel rounded-xl p-4">
                <div class="text-xs text-slate-500 mb-1.5 font-mono flex items-center gap-1.5">
                  <i data-lucide="bot" class="w-3 h-3 text-[#6366f1]"></i>
                  Nova
                  {#if msg.timestamp}
                    <span class="text-slate-600 font-normal">· {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {/if}
                </div>
                <div class="prose prose-invert prose-sm max-w-none text-sm text-slate-200 leading-relaxed [&_pre]:bg-nova-bg [&_pre]:border [&_pre]:border-nova-border-2 [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto [&_code]:text-[#00f2fe] [&_code]:bg-nova-card [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-slate-200 [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_strong]:text-white [&_a]:text-[#00f2fe] [&_a:hover]:underline [&_blockquote]:border-l-[#00f2fe] [&_blockquote]:text-slate-400 [&_ul]:text-slate-200 [&_ol]:text-slate-200">
                  {@html marked.parse(msg.content)}
                </div>
              </div>
            {/if}
          </div>
        {/each}

        <!-- Streaming message -->
        {#if streaming && streamContent}
          <div class="flex justify-start animate-fade-in">
            <div class="max-w-[85%] glass-panel rounded-xl p-4">
              <div class="text-xs text-slate-500 mb-1.5 font-mono flex items-center gap-1.5">
                <i data-lucide="bot" class="w-3 h-3 text-[#6366f1]"></i>
                Nova
                <span class="w-1.5 h-1.5 rounded-full bg-[#00f2fe] animate-pulse ml-1"></span>
              </div>
              <div class="prose prose-invert prose-sm max-w-none text-sm text-slate-200 leading-relaxed [&_pre]:bg-nova-bg [&_pre]:border [&_pre]:border-nova-border-2 [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto [&_code]:text-[#00f2fe] [&_code]:bg-nova-card [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-slate-200">
                {streamContent}
              </div>
            </div>
          </div>
        {/if}

        <!-- Loading indicator (no stream yet) -->
        {#if loading && !streamContent}
          <div class="flex justify-start animate-fade-in">
            <div class="glass-panel rounded-xl p-4">
              <div class="flex items-center gap-2.5 text-slate-400 text-xs">
                <span class="w-2 h-2 rounded-full bg-[#00f2fe] animate-pulse"></span>
                <span>Nova is thinking...</span>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Input Bar -- New Design -->
  <div class="glass-panel rounded-xl p-4 mb-2 border border-nova-border-2">
    <div class="flex items-center gap-3">
      <input
        type="text"
        bind:value={input}
        onkeydown={handleKeydown}
        placeholder="Instruct Nova... (Use @ to tag system tools, / for command shortcuts)"
        class="flex-1 bg-transparent border-none text-xs text-white focus:outline-none placeholder-slate-600"
        disabled={loading}
        data-chat-input
      />
      <button onclick={send} disabled={loading || !input.trim()} class="btn-premium px-5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity">
        <span>Execute</span>
        <i data-lucide="send-horizontal" class="w-3.5 h-3.5"></i>
      </button>
    </div>
  </div>
</div>
