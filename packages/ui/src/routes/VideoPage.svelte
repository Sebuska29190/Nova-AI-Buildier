<script lang="ts">
  import { onMount } from "svelte";

  const LANGUAGES = [
    { value: "en", label: "English" },
    { value: "fr", label: "French" },
    { value: "es", label: "Spanish" },
    { value: "de", label: "German" },
    { value: "it", label: "Italian" },
    { value: "ja", label: "Japanese" },
    { value: "zh", label: "Chinese" },
    { value: "pt", label: "Portuguese" },
    { value: "ru", label: "Russian" },
    { value: "ar", label: "Arabic" },
  ];

  const NICHES: Array<{ name: string; prompt: string }> = [
    { name: "Custom", prompt: "" },
    { name: "Travel Vlog", prompt: "Create a cinematic travel vlog showcasing beautiful landscapes, local culture, and adventure activities." },
    { name: "Tech Review", prompt: "Create an engaging tech review video highlighting product features, specs, performance benchmarks, and value comparison." },
    { name: "Cooking Tutorial", prompt: "Create a step-by-step cooking tutorial with ingredient prep, cooking techniques, plating presentation, and taste test." },
    { name: "Fitness Workout", prompt: "Create a high-energy fitness workout video demonstrating exercises, proper form, sets/reps, and cool-down stretches." },
    { name: "Gaming Montage", prompt: "Create an epic gaming montage with intense gameplay moments, kill streaks, and cinematic transitions." },
    { name: "Educational Explain", prompt: "Create an educational explainer video breaking down complex concepts with clear visuals and analogies." },
    { name: "Product Showcase", prompt: "Create a professional product showcase highlighting design, functionality, use cases, and unique selling points." },
    { name: "Nature Documentary", prompt: "Create a serene nature documentary capturing wildlife, landscapes, and natural phenomena." },
    { name: "Music Lyric Video", prompt: "Create a dynamic music lyric video with synchronized text, atmospheric visuals, and mood-matched color grading." },
    { name: "News Summary", prompt: "Create a concise news summary video covering top headlines with clear narration and supporting b-roll." },
    { name: "Fashion Lookbook", prompt: "Create a stylish fashion lookbook video showcasing outfits, accessories, and styling tips." },
  ];

  const ALL_EFFECTS = [
    "vignette", "glitch", "vhs", "grain", "bloom",
    "sepia", "invert", "color_shift", "pixelate",
  ];

  const ANIMATION_STYLES = [
    { value: "cinematic-zoom", label: "Cinematic", icon: "🎬" },
    { value: "zoom", label: "Animated", icon: "🎨" },
    { value: "fade", label: "Modern", icon: "✨" },
    { value: "vhs", label: "Retro", icon: "📺" },
    { value: "none", label: "Minimal", icon: "◻️" },
    { value: "blur-zoom", label: "Dramatic", icon: "🔥" },
    { value: "slide", label: "Corporate", icon: "💼" },
    { value: "ken-burns", label: "Storybook", icon: "📖" },
  ];

  let topic = $state("");
  let nicheName = $state("Custom");
  let langIdx = $state(0);
  let isShort = $state(false);
  let durationMin = $state(1);
  let ttsEngine = $state("edge");
  let imageEngine = $state("auto");
  let quality = $state("standard");
  let subMode = $state("off");
  let scriptText = $state("");
  let imageCount = $state(4);
  let animationStyle = $state("cinematic");
  let imageStyle = $state("photorealistic");
  let selectedEffects = $state<string[]>([]);
  let jobs = $state<Array<{ id: string; status: string; topic: string; progress: number; error?: string; output?: string }>>([]);
  let loading = $state(false);

  onMount(() => {
    loadJobs();
  });

  function toggleEffect(effect: string) {
    if (selectedEffects.includes(effect)) {
      selectedEffects = selectedEffects.filter((e) => e !== effect);
    } else {
      selectedEffects = [...selectedEffects, effect];
    }
  }

  function handleNicheChange(name: string) {
    nicheName = name;
    if (name !== "Custom") {
      const niche = NICHES.find((n) => n.name === name);
      if (niche && niche.prompt) {
        topic = niche.prompt;
      }
    }
  }

  async function generateVideo() {
    if (!topic.trim() && !scriptText.trim()) return;
    loading = true;
    try {
      const payload = {
        topic: topic.trim() || scriptText.trim().slice(0, 60),
        nicheName: nicheName === "Custom" ? undefined : nicheName,
        language: LANGUAGES[langIdx]?.value || "en",
        isShort: isShort,
        durationMin: durationMin,
        ttsEngine: ttsEngine === "auto" ? undefined : ttsEngine,
        imageEngine: undefined,
        quality,
        subtitleMode: subMode === "off" ? "none" : "story",
        scriptText: scriptText.trim() || undefined,
        imageCount: imageCount,
        animationStyle: animationStyle,
        imageStyle: imageStyle || undefined,
        effects: selectedEffects.length > 0 ? selectedEffects.join(",") : undefined,
      };
      const res = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      await loadJobs();
    } catch (e: any) {
      console.error("Generate failed:", e);
    }
    loading = false;
  }

  async function loadJobs() {
    try {
      const res = await fetch("/api/video/jobs");
      if (res.ok) {
        const data = await res.json();
        jobs = data.jobs || [];
      }
    } catch {}
  }
</script>

<div class="max-w-5xl mx-auto w-full">
  <div class="mb-6">
    <h2 class="text-lg font-bold text-white">Video Factory — Story to MP4</h2>
    <p class="text-xs text-slate-400 mt-1">Generate AI-powered narrated videos from any text prompt. Choose from preset niches or craft custom cinematic stories.</p>
  </div>

  <!-- Generation Form -->
  <div class="glass-panel rounded-xl p-5 mb-6">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
      <!-- Left Column -->
      <div class="space-y-4">
        <!-- Niche -->
        <div>
          <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Niche / Template</label>
          <div class="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {#each NICHES as niche}
              <button
                onclick={() => handleNicheChange(niche.name)}
                class="text-[10px] px-2 py-1.5 rounded-lg border transition-all truncate {nicheName === niche.name ? 'border-[#00f2fe] bg-[#00f2fe]/10 text-[#00f2fe]' : 'border-slate-800 bg-[#020408]/60 text-slate-400 hover:border-slate-600'}"
              >{niche.name}</button>
            {/each}
          </div>
        </div>

        <!-- Topic -->
        <div>
          <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Topic / Prompt</label>
          <textarea
            bind:value={topic}
            placeholder="Describe your video concept in detail..."
            rows="4"
            class="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00f2fe] resize-none"
          ></textarea>
        </div>

        <!-- Script -->
        <div>
          <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Narration Script (optional — overrides auto-script)</label>
          <textarea
            bind:value={scriptText}
            placeholder="Write custom narration text..."
            rows="3"
            class="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00f2fe] resize-none"
          ></textarea>
        </div>
      </div>

      <!-- Right Column -->
      <div class="space-y-4">
        <!-- Language & Duration -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Language</label>
            <select bind:value={langIdx} class="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
              {#each LANGUAGES as lang, i}
                <option value={i}>{lang.label}</option>
              {/each}
            </select>
          </div>
          <div>
            <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Duration (min)</label>
            <input type="number" bind:value={durationMin} min="0.5" max="10" step="0.5" class="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white" />
          </div>
        </div>

        <!-- TTS & Image Engine -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Voice Engine</label>
            <select bind:value={ttsEngine} class="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
              <option value="edge">Microsoft Edge TTS</option>
              <option value="gtts">Google TTS</option>
              <option value="elevenlabs">ElevenLabs</option>
              <option value="openai">OpenAI TTS</option>
            </select>
          </div>
          <div>
            <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Image Engine</label>
            <select bind:value={imageEngine} class="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
              <option value="auto">Auto (Web Search)</option>
            </select>
          </div>
        </div>

        <!-- Short & Quality -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Format</label>
            <div class="flex gap-2">
              <button
                onclick={() => { isShort = false; }}
                class="flex-1 text-[10px] px-2 py-1.5 rounded-lg border transition-all {!isShort ? 'border-[#00f2fe] bg-[#00f2fe]/10 text-[#00f2fe]' : 'border-slate-800 bg-[#020408]/60 text-slate-400'}"
              >Standard</button>
              <button
                onclick={() => { isShort = true; }}
                class="flex-1 text-[10px] px-2 py-1.5 rounded-lg border transition-all {isShort ? 'border-[#00f2fe] bg-[#00f2fe]/10 text-[#00f2fe]' : 'border-slate-800 bg-[#020408]/60 text-slate-400'}"
              >Short (9:16)</button>
            </div>
          </div>
          <div>
            <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Quality</label>
            <select bind:value={quality} class="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
              <option value="draft">Draft</option>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
            </select>
          </div>
        </div>

        <!-- Image Count & Style -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Images</label>
            <input type="number" bind:value={imageCount} min="1" max="20" class="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white" />
          </div>
          <div>
            <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Image Style</label>
            <select bind:value={imageStyle} class="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
              <option value="photorealistic">Photorealistic</option>
              <option value="cinematic">Cinematic</option>
              <option value="anime">Anime</option>
              <option value="oil_painting">Oil Painting</option>
              <option value="watercolor">Watercolor</option>
              <option value="sketch">Sketch</option>
              <option value="3d_render">3D Render</option>
              <option value="pixel_art">Pixel Art</option>
            </select>
          </div>
        </div>

        <!-- Subtitle Mode -->
        <div>
          <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Subtitles</label>
          <select bind:value={subMode} class="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
            <option value="off">Off</option>
            <option value="burned">Burned In</option>
            <option value="srt">SRT File</option>
            <option value="both">Burned + SRT</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Animation Style -->
    <div class="mt-4">
      <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Animation Style</label>
      <div class="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {#each ANIMATION_STYLES as style}
          <button
            onclick={() => { animationStyle = style.value; }}
            class="flex flex-col items-center gap-1 text-[10px] px-2 py-2 rounded-lg border transition-all {animationStyle === style.value ? 'border-[#00f2fe] bg-[#00f2fe]/10 text-[#00f2fe]' : 'border-slate-800 bg-[#020408]/60 text-slate-400 hover:border-slate-600'}"
          >
            <span class="text-base">{style.icon}</span>
            <span>{style.label}</span>
          </button>
        {/each}
      </div>
    </div>

    <!-- Effects Multi-Select -->
    <div class="mt-4">
      <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Visual Effects</label>
      <div class="flex flex-wrap gap-1.5">
        {#each ALL_EFFECTS as effect}
          <button
            onclick={() => toggleEffect(effect)}
            class="text-[10px] px-2 py-1 rounded-lg border transition-all capitalize {selectedEffects.includes(effect) ? 'border-[#00f2fe] bg-[#00f2fe]/10 text-[#00f2fe]' : 'border-slate-800 bg-[#020408]/60 text-slate-400 hover:border-slate-600'}"
          >{effect.replace(/_/g, " ")}</button>
        {/each}
      </div>
    </div>

    <!-- Submit -->
    <div class="flex justify-end mt-5">
      <button
        onclick={generateVideo}
        disabled={loading || (!topic.trim() && !scriptText.trim())}
        class="btn-premium px-6 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-40"
      >
        {loading ? "Generating..." : "Generate Video"}
      </button>
    </div>
  </div>

  <!-- Job List -->
  <div>
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-bold text-white">Generation Jobs</h3>
      <button onclick={loadJobs} class="text-[10px] text-[#00f2fe] hover:underline">Refresh</button>
    </div>
    {#if jobs.length === 0}
      <p class="text-xs text-slate-500 text-center py-8">No jobs yet. Generate your first video above.</p>
    {:else}
      <div class="space-y-2">
        {#each jobs as job}
          <div class="glass-panel rounded-xl px-4 py-3 flex items-center justify-between">
            <div class="flex-1 min-w-0">
              <p class="text-xs text-white truncate">{job.topic}</p>
              <p class="text-[10px] text-slate-500 font-mono mt-0.5">#{job.id.slice(0, 8)}</p>
            </div>
            <div class="flex items-center gap-3">
              {#if job.status === "running" || job.status === "processing"}
                <div class="flex items-center gap-2">
                  <div class="w-20 bg-slate-800 rounded-full h-1.5">
                    <div class="bg-[#00f2fe] h-1.5 rounded-full transition-all" style="width: {job.progress || 0}%"></div>
                  </div>
                  <span class="text-[10px] text-[#00f2fe] font-mono">{job.progress || 0}%</span>
                </div>
              {:else if job.status === "completed"}
                <span class="text-[10px] text-emerald-400 font-mono">Done</span>
              {:else if job.status === "failed"}
                <span class="text-[10px] text-rose-400 font-mono" title={job.error}>Failed</span>
              {:else}
                <span class="text-[10px] text-slate-400 font-mono">{job.status}</span>
              {/if}
              {#if job.output}
                <a
                  href={job.output}
                  target="_blank"
                  class="text-[10px] text-[#00f2fe] hover:underline"
                >View</a>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
