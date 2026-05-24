import { useState, useEffect, useMemo } from "react";
import { api } from "../lib/api";

export function ModelsPage() {
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    api.models()
      .then((m: any[]) => setModels(m))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredModels = useMemo(() => {
    let list = models;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (m) =>
          m.id?.toLowerCase().includes(q) ||
          m.name?.toLowerCase().includes(q) ||
          m.provider?.toLowerCase().includes(q) ||
          m.owned_by?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [models, searchQuery]);

  const groupedByProvider = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const m of filteredModels) {
      const provider = m.provider || m.owned_by || "unknown";
      if (!groups[provider]) groups[provider] = [];
      groups[provider].push(m);
    }
    return groups;
  }, [filteredModels]);

  const providerOrder = useMemo(() => Object.keys(groupedByProvider).sort(), [groupedByProvider]);

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Available Models</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            <span className="text-slate-500">{models.length} model{models.length !== 1 ? "s" : ""}</span>
          </p>
        </div>
        <div className="relative w-64">
          <input
            className="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-500"
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
              onClick={() => setSearchQuery("")}
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="glass-panel rounded-xl p-8 flex items-center justify-center">
          <p className="text-sm text-slate-400">Loading models...</p>
        </div>
      ) : filteredModels.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 flex flex-col items-center justify-center gap-2">
          <p className="text-sm text-slate-400">No models found</p>
          {searchQuery ? (
            <p className="text-xs text-slate-500">Try a different search term</p>
          ) : (
            <p className="text-xs text-slate-500">No models available</p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {providerOrder.map((provider) => {
            const providerModels = groupedByProvider[provider];
            return (
              <div key={provider} className="glass-panel rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white capitalize">{provider}</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-indigo-950/50 text-indigo-400 border-indigo-500/30">
                    {providerModels.length} model{providerModels.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {providerModels.map((model: any) => (
                    <div key={model.id || model.name} className="bg-slate-900/30 rounded-lg p-3 border border-slate-800/50 hover:border-indigo-500/30 transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white truncate">{model.id || model.name}</p>
                          {model.description && (
                            <p className="text-[10px] text-slate-500 mt-0.5 truncate">{model.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {model.type && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{model.type}</span>
                        )}
                        {model.object && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{model.object}</span>
                        )}
                        {model.created && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                            {new Date(model.created * 1000).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
