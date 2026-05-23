<script lang="ts">
  import { onMount } from "svelte";

  const SITES = [
    { label: "All Sites", value: "" },
    { label: "Amazon", value: "amazon" },
    { label: "eBay", value: "ebay" },
    { label: "Etsy", value: "etsy" },
    { label: "Walmart", value: "walmart" },
    { label: "AliExpress", value: "aliexpress" },
    { label: "Best Buy", value: "bestbuy" },
    { label: "Target", value: "target" },
    { label: "Shopify", value: "shopify" },
    { label: "Leroy Merlin", value: "leroymerlin" },
    { label: "Cdiscount", value: "cdiscount" },
  ];

  const SORT_OPTIONS = [
    { label: "Most Relevant", value: "relevance" },
    { label: "Price: Low to High", value: "price_asc" },
    { label: "Price: High to Low", value: "price_desc" },
    { label: "Newest First", value: "newest" },
    { label: "Best Rating", value: "rating" },
    { label: "Most Reviews", value: "reviews" },
  ];

  const CATEGORIES = [
    { label: "All", value: "" },
    { label: "Electronics", value: "electronics" },
    { label: "Fashion", value: "fashion" },
    { label: "Home & Garden", value: "home" },
    { label: "Sports", value: "sports" },
    { label: "Books", value: "books" },
    { label: "Toys", value: "toys" },
    { label: "Automotive", value: "automotive" },
    { label: "Health & Beauty", value: "beauty" },
    { label: "Food & Grocery", value: "grocery" },
  ];

  let query = $state("");
  let minPrice = $state("");
  let maxPrice = $state("");
  let selectedSite = $state("");
  let selectedCategory = $state("");
  let sortBy = $state("relevance");
  let limit = $state(20);
  let loading = $state(false);
  let loadingMore = $state(false);
  let products = $state<Array<{
    id: string; title: string; price: number; currency: string;
    source: string; image: string; url: string; description: string;
    rating?: number; reviews?: number;
  }>>([]);
  let error = $state("");
  let searchCount = $state(0);
  let totalResults = $state(0);
  let hasMore = $state(false);
  let searchHistory = $state<string[]>([]);

  onMount(() => {
    const saved = localStorage.getItem("shoppingHistory");
    if (saved) {
      try { searchHistory = JSON.parse(saved); } catch {}
    }
  });

  function saveHistory(q: string) {
    if (!q.trim()) return;
    const updated = [q.trim(), ...searchHistory.filter((s) => s !== q.trim())].slice(0, 10);
    searchHistory = updated;
    localStorage.setItem("shoppingHistory", JSON.stringify(updated));
  }

  function clearHistory() {
    searchHistory = [];
    localStorage.removeItem("shoppingHistory");
  }

  function resetFilters() {
    query = "";
    minPrice = "";
    maxPrice = "";
    selectedSite = "";
    selectedCategory = "";
    sortBy = "relevance";
    limit = 20;
    products = [];
    error = "";
    searchCount = 0;
    totalResults = 0;
    hasMore = false;
  }

  async function search() {
    if (!query.trim()) return;
    loading = true;
    error = "";
    products = [];
    searchCount = 0;
    totalResults = 0;
    hasMore = false;
    saveHistory(query);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      if (selectedSite && selectedSite !== "all") params.set("site", selectedSite);
      if (selectedCategory) params.set("category", selectedCategory);
      if (sortBy) params.set("sortBy", sortBy);
      if (limit) params.set("limit", String(limit));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch("/api/shopping/products?" + params.toString(), { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error("API " + res.status);
      const data = await res.json();
      products.splice(0, products.length, ...(data.products || data.results || []));
      totalResults = data.total || products.length;
      hasMore = data.hasMore || false;
      searchCount = products.length;
    } catch (e: any) {
      error = e.message || "Failed to search";
      products = [];
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    if (!hasMore || loadingMore || !query.trim()) return;
    loadingMore = true;
    try {
      const params = new URLSearchParams({
        q: query.trim(),
        sort: sortBy,
        limit: String(limit),
        offset: String(products.length),
      });
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      if (selectedSite) params.set("site", selectedSite);
      if (selectedCategory) params.set("category", selectedCategory);
      const res = await fetch(`/api/shopping/products?${params}`);
      if (res.ok) {
        const data = await res.json();
        const newItems = data.products || data.items || [];
        products = [...products, ...newItems];
        hasMore = data.hasMore || false;
        searchCount = products.length;
        totalResults = data.total || totalResults;
      }
    } catch {}
    loadingMore = false;
  }

  function openProduct(url: string) {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleSearchKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      search();
    }
  }
</script>

<div class="max-w-5xl mx-auto w-full flex flex-col h-full">
  <div class="mb-6">
    <h2 class="text-lg font-bold text-white">Smart Shopping - Global Aggregation</h2>
    <p class="text-xs text-slate-400">Scrape, analyze, filter, and compare product inventories across global marketplaces in milliseconds.</p>
  </div>

  <!-- Search Parameters -->
  <div class="glass-panel rounded-xl p-5 mb-6">
    <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
      <div class="col-span-2">
        <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Search Phrase</label>
        <div class="relative">
          <i data-lucide="search" class="absolute left-3 top-2.5 w-4 h-4 text-slate-500"></i>
          <input
            type="text"
            bind:value={query}
            onkeydown={handleSearchKeydown}
            placeholder="e.g. SAC A MAIN FEMMES"
            class="w-full bg-[#020408]/60 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-[#00f2fe]"
          />
        </div>
      </div>
      <div>
        <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Min Price (€)</label>
        <input type="number" bind:value={minPrice} min="0" placeholder="0" class="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00f2fe]" />
      </div>
      <div>
        <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Max Price (€)</label>
        <input type="number" bind:value={maxPrice} min="0" placeholder="99999" class="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00f2fe]" />
      </div>
      <div>
        <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Site</label>
        <select bind:value={selectedSite} class="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00f2fe]">
          {#each SITES as site}
            <option value={site.value}>{site.label}</option>
          {/each}
        </select>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
      <div>
        <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Category</label>
        <select bind:value={selectedCategory} class="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00f2fe]">
          {#each CATEGORIES as cat}
            <option value={cat.value}>{cat.label}</option>
          {/each}
        </select>
      </div>
      <div>
        <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Sort By</label>
        <select bind:value={sortBy} class="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00f2fe]">
          {#each SORT_OPTIONS as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>
      <div>
        <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Results Per Page</label>
        <select bind:value={limit} class="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00f2fe]">
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
      <div class="flex items-end gap-2">
        <button onclick={resetFilters} class="flex-1 bg-[#0b0f19] hover:bg-[#121926] text-white px-3 py-2 rounded-lg text-[10px] font-semibold border border-slate-800 transition-all">Reset</button>
        <button onclick={search} disabled={loading || !query.trim()} class="btn-premium flex-1 px-3 py-2 rounded-lg text-[10px] font-semibold disabled:opacity-40">Search</button>
      </div>
    </div>
  </div>

  <!-- History -->
  {#if searchHistory.length > 0 && products.length === 0}
    <div class="glass-panel rounded-xl p-3 mb-4 flex items-center gap-2 flex-wrap">
      <span class="text-[9px] text-slate-500 uppercase tracking-wider">Recent:</span>
      {#each searchHistory as term}
        <button
          onclick={() => { query = term; search(); }}
          class="text-[10px] px-2 py-0.5 rounded-md bg-[#020408]/60 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-600 transition-all"
        >{term}</button>
      {/each}
      <button onclick={clearHistory} class="text-[9px] text-rose-400 hover:underline ml-auto">Clear</button>
    </div>
  {/if}

  <!-- Results -->
  <div class="flex-1 flex flex-col min-h-0">
    {#if loading}
      <div class="flex items-center justify-center py-12">
        <div class="animate-spin w-6 h-6 border-2 border-[#00f2fe] border-t-transparent rounded-full"></div>
        <span class="text-xs text-slate-400 ml-3">Searching {selectedSite || "all"}...</span>
      </div>
    {:else if error}
      <div class="glass-panel rounded-xl p-4 text-center">
        <i data-lucide="alert-circle" class="w-6 h-6 text-rose-400 mx-auto mb-2"></i>
        <p class="text-xs text-rose-400">{error}</p>
      </div>
    {:else if products.length > 0}
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs text-slate-400 font-mono">Found: <strong class="text-white">{totalResults || searchCount}</strong> listing{totalResults !== 1 ? "s" : ""} ({searchCount} shown)</span>
        <button onclick={resetFilters} class="text-[10px] text-[#00f2fe] hover:underline">New Search</button>
      </div>

      <div class="flex-grow overflow-y-auto pr-2 space-y-3" style="max-height: 520px;">
        {#each products as product}
          <div class="glass-panel rounded-xl p-4 flex gap-4 hover:border-[#00f2fe]/40 transition-all cursor-pointer" onclick={() => openProduct(product.url)}>
            <div class="w-20 h-20 rounded-lg bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-800 flex-shrink-0 overflow-hidden flex items-center justify-center">
              {#if product.image}
                <img src={product.image} alt={product.title} class="w-full h-full object-cover" loading="lazy" onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.innerHTML = '<i class=\"w-7 h-7 text-slate-600\" data-lucide=\"shopping-bag\"></i>'; }} />
              {:else}
                <i data-lucide="shopping-bag" class="w-7 h-7 text-slate-600"></i>
              {/if}
            </div>
            <div class="flex-1 flex flex-col justify-between min-w-0">
              <div>
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-bold text-indigo-400 font-mono truncate">{product.title || "Untitled"}</span>
                  <span class="text-xs font-bold text-[#00f2fe] whitespace-nowrap">{product.price > 0 ? ((product.currency || "€") + product.price.toFixed(2)) : "See site"}</span>
                </div>
                {#if product.description}
                  <p class="text-[11px] text-slate-400 mt-1 line-clamp-2">{product.description}</p>
                {/if}
                {#if product.rating}
                  <div class="flex items-center gap-2 mt-1">
                    <span class="text-[10px] text-amber-400">{product.rating.toFixed(1)}</span>
                    {#if product.reviews}
                      <span class="text-[9px] text-slate-500">({product.reviews} reviews)</span>
                    {/if}
                  </div>
                {/if}
              </div>
              <div class="flex justify-between items-center mt-2 pt-2 border-t border-slate-800/40">
                <span class="text-[9px] font-mono text-slate-500">Source: {product.source || "unknown"}</span>
                <button onclick={(e) => { e.stopPropagation(); openProduct(product.url); }} class="btn-premium px-3 py-1 rounded text-[10px]">View Deal</button>
              </div>
            </div>
          </div>
        {/each}

        <!-- Load More -->
        {#if hasMore}
          <div class="text-center pt-2 pb-4">
            <button
              onclick={loadMore}
              disabled={loadingMore}
              class="btn-premium px-6 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
            >{loadingMore ? "Loading..." : "Load More Products"}</button>
          </div>
        {/if}
      </div>
    {:else}
      <div class="flex flex-col items-center justify-center py-16 text-center">
        <div class="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3">
          <i data-lucide="shopping-bag" class="w-6 h-6 text-slate-600"></i>
        </div>
        <p class="text-sm text-slate-400 mb-1">Ready to search</p>
        <p class="text-xs text-slate-600">Enter a search phrase and hit Search to start aggregating products.</p>
      </div>
    {/if}
  </div>
</div>
