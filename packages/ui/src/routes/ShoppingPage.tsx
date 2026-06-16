import { useState, useEffect } from "react";
import { Search, SlidersHorizontal, X, Heart, ShoppingBag, ExternalLink, ArrowUpDown } from "lucide-react";

const SITES = [
  { label: "All Sites", value: "" }, { label: "Amazon", value: "amazon" },
  { label: "eBay", value: "ebay" }, { label: "Etsy", value: "etsy" },
  { label: "Walmart", value: "walmart" }, { label: "AliExpress", value: "aliexpress" },
  { label: "Best Buy", value: "bestbuy" }, { label: "Target", value: "target" },
  { label: "Shopify", value: "shopify" }, { label: "Leroy Merlin", value: "leroymerlin" },
  { label: "Cdiscount", value: "cdiscount" },
];

const SORT_OPTIONS = [
  { label: "Most Relevant", value: "relevance" }, { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" }, { label: "Newest First", value: "newest" },
  { label: "Best Rating", value: "rating" }, { label: "Most Reviews", value: "reviews" },
];

const CATEGORIES = [
  { label: "All", value: "" }, { label: "Electronics", value: "electronics" }, { label: "Fashion", value: "fashion" },
  { label: "Home & Garden", value: "home" }, { label: "Sports", value: "sports" }, { label: "Books", value: "books" },
  { label: "Toys", value: "toys" }, { label: "Automotive", value: "automotive" },
  { label: "Health & Beauty", value: "beauty" }, { label: "Food & Grocery", value: "grocery" },
];

interface Product {
  id: string; title: string; price: number; currency: string;
  source: string; image: string; url: string; description: string;
  rating?: number; reviews?: number;
}

export function ShoppingPage() {
  const [query, setQuery] = useState("");
  const [minPrice, setMinPrice] = useState(""); const [maxPrice, setMaxPrice] = useState("");
  const [selectedSite, setSelectedSite] = useState(""); const [selectedCategory, setSelectedCategory] = useState("");
  const [sortBy, setSortBy] = useState("relevance"); const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false); const [loadingMore, setLoadingMore] = useState(false);
  const [products, setProducts] = useState<Product[]>([]); const [error, setError] = useState("");
  const [totalResults, setTotalResults] = useState(0); const [hasMore, setHasMore] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("shoppingWishlist") || "[]"); } catch { return []; }
  });
  const [compareList, setCompareList] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<"search" | "wishlist">("search");
  const [quickView, setQuickView] = useState<Product | null>(null);

  useEffect(() => { localStorage.setItem("shoppingWishlist", JSON.stringify(wishlist)); }, [wishlist]);
  useEffect(() => {
    const saved = localStorage.getItem("shoppingHistory");
    if (saved) { try { setSearchHistory(JSON.parse(saved)); } catch {} }
  }, []);

  function saveHistory(q: string) {
    if (!q.trim()) return;
    const updated = [q.trim(), ...searchHistory.filter((s) => s !== q.trim())].slice(0, 10);
    setSearchHistory(updated); localStorage.setItem("shoppingHistory", JSON.stringify(updated));
  }

  function resetFilters() {
    setQuery(""); setMinPrice(""); setMaxPrice(""); setSelectedSite(""); setSelectedCategory("");
    setSortBy("relevance"); setLimit(20); setProducts([]); setError(""); setTotalResults(0); setHasMore(false);
  }

  async function search() {
    if (!query.trim()) return;
    setLoading(true); setError(""); setProducts([]); setTotalResults(0); setHasMore(false);
    saveHistory(query);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      if (selectedSite) params.set("site", selectedSite);
      if (selectedCategory) params.set("category", selectedCategory);
      if (sortBy) params.set("sortBy", sortBy);
      if (limit) params.set("limit", String(limit));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch("/api/shopping/products?" + params.toString(), { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error("API " + res.status);
      const data = await res.json();
      setProducts(data.products || data.results || []);
      setTotalResults(data.total || (data.products || data.results || []).length);
      setHasMore(data.hasMore || false);
    } catch (e: any) { setError(e.message || "Failed to search"); setProducts([]); }
    finally { setLoading(false); }
  }

  async function loadMore() {
    if (!hasMore || loadingMore || !query.trim()) return; setLoadingMore(true);
    try {
      const params = new URLSearchParams({ q: query.trim(), sort: sortBy, limit: String(limit), offset: String(products.length) });
      if (minPrice) params.set("minPrice", minPrice); if (maxPrice) params.set("maxPrice", maxPrice);
      if (selectedSite) params.set("site", selectedSite); if (selectedCategory) params.set("category", selectedCategory);
      const res = await fetch(`/api/shopping/products?${params}`);
      if (res.ok) { const data = await res.json(); const newItems = data.products || data.items || []; setProducts((prev) => [...prev, ...newItems]); setHasMore(data.hasMore || false); setTotalResults(data.total || totalResults); }
    } catch {}
    setLoadingMore(false);
  }

  function openProduct(url: string) { if (url) window.open(url, "_blank", "noopener,noreferrer"); }
  function handleSearchKeydown(e: React.KeyboardEvent<HTMLInputElement>) { if (e.key === "Enter") { e.preventDefault(); search(); } }
  function toggleWishlist(id: string) { setWishlist((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]); }
  function toggleCompare(id: string) { setCompareList((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]); }
  function clearCompare() { setCompareList([]); }

  const wishlistProducts = products.filter((p) => wishlist.includes(p.id));
  const fullWishlist = wishlist.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[];

  return (
    <div className="max-w-6xl mx-auto w-full flex flex-col h-full">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">Smart Shopping</h2>
        <p className="text-xs text-gray-500 mt-0.5">Search, compare, and track products across 11 global marketplaces.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5">
        <button onClick={() => setActiveTab("search")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === "search" ? "bg-#6366f1/10 text-#818cf8 border border-#6366f1/20" : "text-gray-500 hover:text-white border border-transparent"}`}>
          <Search size={14} className="inline mr-1.5" />Search
        </button>
        <button onClick={() => setActiveTab("wishlist")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === "wishlist" ? "bg-#6366f1/10 text-#818cf8 border border-#6366f1/20" : "text-gray-500 hover:text-white border border-transparent"}`}>
          <Heart size={14} className="inline mr-1.5" />Wishlist {wishlist.length > 0 && <span className="ml-1 text-#818cf8">({wishlist.length})</span>}
        </button>
      </div>

      {activeTab === "wishlist" ? (
        /* ─── WISHLIST VIEW ─── */
        <div className="flex-1">
          {fullWishlist.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Heart size={40} className="text-gray-700 mb-4" />
              <p className="text-sm text-gray-500 mb-1">Your wishlist is empty</p>
              <p className="text-xs text-gray-600">Search for products and click the heart icon to save them here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fullWishlist.map((product) => (
                <ProductCard key={product.id} product={product} wishlist={wishlist} compareList={compareList}
                  onWishlist={toggleWishlist} onCompare={toggleCompare} onOpen={openProduct} onQuickView={setQuickView} />
              ))}
            </div>
          )}
          {fullWishlist.length > 0 && (
            <div className="flex justify-between items-center mt-4 p-3 bg-[#161b22] border border-gray-800 rounded-xl">
              <span className="text-xs text-gray-500">{fullWishlist.length} saved items</span>
              <button onClick={() => { setWishlist([]); localStorage.removeItem("shoppingWishlist"); }}
                className="text-xs text-red-400 hover:text-red-300 transition-colors">Clear all</button>
            </div>
          )}
        </div>
      ) : (
        /* ─── SEARCH VIEW ─── */
        <>
          {/* Search Bar */}
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 mb-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-4 top-3 text-gray-500" />
                <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleSearchKeydown}
                  placeholder="Search 11 marketplaces... e.g. wireless headphones, leather bag, running shoes"
                  className="w-full bg-[#0a0c10] border border-gray-800 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-#6366f1/50 transition-all" />
              </div>
              <button onClick={() => setShowFilters(!showFilters)}
                className={`p-2.5 rounded-xl border transition-all ${showFilters ? "bg-#6366f1/10 border-#6366f1/30 text-#818cf8" : "bg-[#0a0c10] border-gray-800 text-gray-500 hover:text-white"}`}>
                <SlidersHorizontal size={18} />
              </button>
              <button onClick={search} disabled={loading || !query.trim()}
                className="bg-#6366f1 hover:bg-#6366f1 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40">
                {loading ? "Searching..." : "Search"}
              </button>
            </div>

            {/* Filters */}
            {showFilters && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-4 border-t border-gray-800">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Min Price (€)</label>
                  <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="0"
                    className="w-full bg-[#0a0c10] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-#6366f1/50" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Max Price (€)</label>
                  <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="999"
                    className="w-full bg-[#0a0c10] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-#6366f1/50" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Site</label>
                  <select value={selectedSite} onChange={(e) => setSelectedSite(e.target.value)}
                    className="w-full bg-[#0a0c10] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-#6366f1/50">
                    {SITES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Category</label>
                  <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full bg-[#0a0c10] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-#6366f1/50">
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Sort</label>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                    className="w-full bg-[#0a0c10] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-#6366f1/50">
                    {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* History */}
          {searchHistory.length > 0 && products.length === 0 && !loading && (
            <div className="bg-[#161b22] border border-gray-800 rounded-xl p-3 mb-5 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Recent:</span>
              {searchHistory.map((term) => (
                <button key={term} onClick={() => { setQuery(term); }}
                  className="text-xs px-2.5 py-1 rounded-lg bg-[#0a0c10] border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-all">{term}</button>
              ))}
              <button onClick={() => { setSearchHistory([]); localStorage.removeItem("shoppingHistory"); }}
                className="text-[10px] text-red-400 hover:underline ml-auto">Clear</button>
            </div>
          )}

          {/* Results */}
          <div className="flex-1 flex flex-col min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin w-6 h-6 border-2 border-#6366f1 border-t-transparent rounded-full" />
                <span className="text-xs text-gray-500 ml-3">Searching {selectedSite || "all marketplaces"}...</span>
              </div>
            ) : error ? (
              <div className="bg-[#161b22] border border-red-900/50 rounded-xl p-6 text-center">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            ) : products.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-gray-500"><strong className="text-white">{totalResults}</strong> results found ({products.length} shown)</span>
                  <div className="flex items-center gap-3">
                    <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}
                      className="bg-[#0a0c10] border border-gray-800 rounded-lg px-2 py-1 text-[10px] text-gray-400 focus:outline-none focus:border-#6366f1/50">
                      <option value={10}>10/page</option><option value={20}>20/page</option><option value={50}>50/page</option>
                    </select>
                    <button onClick={resetFilters} className="text-[10px] text-#6366f1 hover:underline">New Search</button>
                  </div>
                </div>

                <div className="flex-grow overflow-y-auto pr-1 space-y-3">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} wishlist={wishlist} compareList={compareList}
                      onWishlist={toggleWishlist} onCompare={toggleCompare} onOpen={openProduct} onQuickView={setQuickView} />
                  ))}
                  {hasMore && (
                    <div className="text-center pt-3 pb-4">
                      <button onClick={loadMore} disabled={loadingMore}
                        className="bg-[#161b22] hover:bg-[#1c2333] border border-gray-800 text-white px-8 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40">
                        {loadingMore ? "Loading..." : "Load More Products"}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <ShoppingBag size={40} className="text-gray-700 mb-4" />
                <p className="text-sm text-gray-500 mb-1">Start your search</p>
                <p className="text-xs text-gray-600">Enter a product name and browse results from 11 global marketplaces.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Compare bar */}
      {compareList.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#161b22] border border-gray-800 rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-3">
          <span className="text-xs text-gray-400">{compareList.length} selected for comparison</span>
          {compareList.length >= 2 && (
            <button onClick={clearCompare} className="text-xs bg-#6366f1 hover:bg-#6366f1 text-white px-4 py-1.5 rounded-lg font-semibold transition-all">
              Compare
            </button>
          )}
          <button onClick={clearCompare} className="text-xs text-gray-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Quick View modal */}
      {quickView && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setQuickView(null)}>
          <div className="bg-[#0e1117] border border-gray-800 max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              {quickView.image ? (
                <img src={quickView.image} alt={quickView.title} className="w-full h-48 object-cover bg-[#161b22]" />
              ) : (
                <div className="w-full h-48 bg-[#161b22] flex items-center justify-center"><ShoppingBag size={48} className="text-gray-700" /></div>
              )}
              <button onClick={() => setQuickView(null)} className="absolute top-3 right-3 p-1.5 bg-black/50 rounded-lg text-white hover:bg-black/70">
                <X size={16} />
              </button>
            </div>
            <div className="p-5">
              <h3 className="text-base font-bold text-white mb-1">{quickView.title}</h3>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-lg font-bold text-#818cf8">{quickView.price > 0 ? `${quickView.currency || "€"}${quickView.price.toFixed(2)}` : "See site"}</span>
                {quickView.rating && <span className="text-xs text-amber-400">⭐ {quickView.rating.toFixed(1)}</span>}
              </div>
              {quickView.description && <p className="text-xs text-gray-400 mb-4 leading-relaxed">{quickView.description}</p>}
              <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-4">
                <span className="bg-[#0a0c10] px-2 py-1 rounded font-mono">{quickView.source}</span>
                {quickView.reviews && <span>{quickView.reviews} reviews</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { openProduct(quickView.url); }} className="flex-1 bg-#6366f1 hover:bg-#6366f1 text-white py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2">
                  <ExternalLink size={14} /> View Deal
                </button>
                <button onClick={() => { toggleWishlist(quickView.id); }}
                  className={`p-2.5 rounded-xl border transition-all ${wishlist.includes(quickView.id) ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-[#0a0c10] border-gray-800 text-gray-500 hover:text-white"}`}>
                  <Heart size={16} fill={wishlist.includes(quickView.id) ? "currentColor" : "none"} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compare modal */}
      {compareList.length >= 2 && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={clearCompare}>
          <div className="bg-[#0e1117] border border-gray-800 max-w-4xl w-full rounded-2xl shadow-2xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="font-bold text-white text-sm">Compare Products</h3>
              <button onClick={clearCompare} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 overflow-auto max-h-[65vh]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left py-2 pr-4 w-32"></th>
                    {compareList.map((id) => {
                      const p = products.find((x) => x.id === id) || fullWishlist.find((x) => x.id === id);
                      return <th key={id} className="py-2 pr-4 text-white font-semibold text-sm">{p?.title || "?"}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Price", get: (id: string) => { const p = products.find(x => x.id === id) || fullWishlist.find(x => x.id === id); return p ? (p.price > 0 ? `${p.currency || "€"}${p.price.toFixed(2)}` : "See site") : "-"; } },
                    { label: "Rating", get: (id: string) => { const p = products.find(x => x.id === id) || fullWishlist.find(x => x.id === id); return p?.rating ? `⭐ ${p.rating.toFixed(1)}` : "-"; } },
                    { label: "Source", get: (id: string) => { const p = products.find(x => x.id === id) || fullWishlist.find(x => x.id === id); return p?.source || "-"; } },
                    { label: "Reviews", get: (id: string) => { const p = products.find(x => x.id === id) || fullWishlist.find(x => x.id === id); return p?.reviews ? `${p.reviews}` : "-"; } },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-gray-800/50">
                      <td className="py-3 pr-4 text-gray-500 font-medium">{row.label}</td>
                      {compareList.map((id) => <td key={id} className="py-3 pr-4 text-gray-300">{row.get(id)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end px-5 py-3 border-t border-gray-800">
              <button onClick={clearCompare} className="px-4 py-2 rounded-lg text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, wishlist, compareList, onWishlist, onCompare, onOpen, onQuickView }: {
  product: Product; wishlist: string[]; compareList: string[];
  onWishlist: (id: string) => void; onCompare: (id: string) => void; onOpen: (url: string) => void; onQuickView: (p: Product | null) => void;
}) {
  return (
    <div className="bg-[#161b22] border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-all group">
      <div className="relative h-40 bg-[#0a0c10] flex items-center justify-center cursor-pointer" onClick={() => onQuickView(product)}>
        {product.image ? (
          <img src={product.image} alt={product.title} className="w-full h-full object-contain p-3" loading="lazy" />
        ) : (
          <ShoppingBag size={36} className="text-gray-700" />
        )}
        <button onClick={(e) => { e.stopPropagation(); onWishlist(product.id); }}
          className={`absolute top-2 right-2 p-1.5 rounded-lg transition-all ${wishlist.includes(product.id) ? "bg-red-500/20 text-red-400" : "bg-black/40 text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100"}`}>
          <Heart size={16} fill={wishlist.includes(product.id) ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-xs font-semibold text-white truncate flex-1 cursor-pointer hover:text-#818cf8 transition-colors" onClick={() => onQuickView(product)}>
            {product.title || "Untitled"}
          </h3>
          <span className="text-xs font-bold text-#818cf8 whitespace-nowrap">
            {product.price > 0 ? `${product.currency || "€"}${product.price.toFixed(2)}` : "See site"}
          </span>
        </div>
        {product.description && <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{product.description}</p>}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800/40">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono text-gray-600">{product.source}</span>
            {product.rating && <span className="text-[9px] text-amber-400">★{product.rating.toFixed(1)}</span>}
          </div>
          <div className="flex gap-1">
            <button onClick={(e) => { e.stopPropagation(); onCompare(product.id); }}
              className={`p-1 rounded text-[9px] transition-colors ${compareList.includes(product.id) ? "text-#818cf8" : "text-gray-600 hover:text-#818cf8"}`}>
              {compareList.includes(product.id) ? "✓ Added" : "+ Compare"}
            </button>
            <button onClick={() => onOpen(product.url)} className="bg-#6366f1 hover:bg-#6366f1 text-white px-2.5 py-1 rounded-lg text-[9px] font-semibold transition-all flex items-center gap-1">
              <ExternalLink size={10} /> Deal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
