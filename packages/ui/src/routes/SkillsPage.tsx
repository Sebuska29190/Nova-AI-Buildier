import { useMemo } from "react";

interface SkillsPageProps {
  skills?: any[];
  onRefresh?: () => void;
}

export function SkillsPage({ skills = [], onRefresh = () => {} }: SkillsPageProps) {
  const filter = "all";
  const searchQuery = "";
  const hubQuery = "";
  const hubResults: any[] = [];
  const hubLoading = false;
  const hubMsg = "";

  const filteredSkills = useMemo(() => {
    let list = skills;
    if (filter === "auto-generated") {
      list = list.filter(s => s.source === "auto-generated");
    } else if (filter !== "all") {
      list = list.filter(s => s.type === filter || s.category === filter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.tags?.some((t: string) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [skills, filter, searchQuery]);

  function paramBadgeColor(kind: string) {
    switch (kind) {
      case "required": return "bg-red-950/40 text-red-400 border-red-900/30";
      case "optional": return "bg-slate-800 text-slate-400 border-slate-700";
      default: return "bg-slate-800 text-slate-400 border-slate-700";
    }
  }

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Agent Skills Library ({skills.length})</h2>
          <p className="text-xs text-slate-400 mt-0.5">Manage functional blocks, tool schemas, and executable script capabilities.</p>
        </div>
        <button className="btn-premium px-3 py-1.5 rounded text-xs flex items-center gap-1.5" onClick={onRefresh}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      {filteredSkills.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 flex flex-col items-center justify-center gap-2">
          <p className="text-sm text-slate-400">No skills found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSkills.map((skill: any) => (
            <div key={skill.name} className="glass-panel rounded-xl p-5 flex flex-col transition-all hover:border-indigo-500/30">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-sm text-white">{skill.name}</h3>
                <div className="flex gap-1">
                  {skill.source === "auto-generated" && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded border bg-green-950/50 text-green-400 border-green-500/30">🤖 AI</span>
                  )}
                  {(skill.type || skill.category) && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded border bg-indigo-950/50 text-indigo-400 border-indigo-500/30">
                      {skill.type || skill.category}
                    </span>
                  )}
                </div>
              </div>
              {skill.description && (
                <p className="text-xs text-slate-400 mb-3 leading-relaxed">{skill.description}</p>
              )}

              {skill.parameters?.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Parameters</p>
                  <div className="space-y-1">
                    {skill.parameters.map((param: any, i: number) => (
                      <div key={i}>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-slate-300">{param.name}</span>
                          {param.required && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${paramBadgeColor("required")}`}>required</span>
                          )}
                          {param.type && <span className="text-[9px] text-slate-500">{param.type}</span>}
                        </div>
                        {param.description && <p className="text-[10px] text-slate-500 ml-1">{param.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {skill.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-auto pt-2 border-t border-slate-800">
                  {skill.tags.map((tag: string, i: number) => (
                    <span key={i} className="custom-badge text-[9px]">{tag?.name ?? tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
