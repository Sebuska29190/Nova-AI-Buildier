import { useState, useEffect } from "react";

interface CronJob {
  id: string;
  description: string;
  schedule: string;
  channelId?: string;
  agentId?: string;
  nextRun: string;
  lastRun?: string;
  enabled: boolean;
  createdAt: string;
}

interface CronRun {
  id: string;
  jobId: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "completed" | "error";
  output?: string;
  error?: string;
  durationMs?: number;
}

function formatTime(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(ms: number | undefined | null): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export function CronPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formDescription, setFormDescription] = useState("");
  const [formSchedule, setFormSchedule] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [jobRuns, setJobRuns] = useState<Record<string, CronRun[]>>({});
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());
  const [editingJob, setEditingJob] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");

  useEffect(() => { loadJobs(); }, []);

  async function loadJobs() {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/cron");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (e: any) {
      setErrorMsg("Failed to load jobs: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function loadRuns(jobId: string) {
    try {
      const res = await fetch(`/api/cron/${jobId}/runs?limit=10`);
      if (!res.ok) return;
      const data = await res.json();
      setJobRuns((prev) => ({ ...prev, [jobId]: data.runs || [] }));
    } catch {}
  }

  function toggleExpand(jobId: string) {
    if (expandedJob === jobId) {
      setExpandedJob(null);
    } else {
      setExpandedJob(jobId);
      loadRuns(jobId);
    }
  }

  async function createJob() {
    if (!formDescription.trim()) return;
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const body: any = { description: formDescription.trim() };
      if (formSchedule.trim()) body.schedule = formSchedule.trim();
      const res = await fetch("/api/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setSuccessMsg("✅ Cron job created!");
      await loadJobs();
      setShowForm(false);
      setFormDescription("");
      setFormSchedule("");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e: any) {
      setErrorMsg("Failed to create job: " + (e.message || e));
    }
  }

  async function toggleJob(id: string, enabled: boolean) {
    setErrorMsg("");
    try {
      const res = await fetch(`/api/cron/${id}/enable`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadJobs();
    } catch (e: any) {
      setErrorMsg("Failed to " + (enabled ? "resume" : "pause") + " job: " + (e.message || e));
    }
  }

  async function runNow(jobId: string) {
    setErrorMsg("");
    setRunningJobs((prev) => new Set(prev).add(jobId));
    try {
      const res = await fetch(`/api/cron/${jobId}/run`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSuccessMsg(`▶️ Run triggered! Status: ${data.run?.status || "started"}`);
      await loadJobs();
      if (expandedJob === jobId) loadRuns(jobId);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (e: any) {
      setErrorMsg("Run failed: " + (e.message || e));
    } finally {
      setRunningJobs((prev) => { const next = new Set(prev); next.delete(jobId); return next; });
    }
  }

  async function deleteJob(id: string) {
    if (!confirm("Delete this cron job? This cannot be undone.")) return;
    setErrorMsg("");
    try {
      const res = await fetch("/api/cron/" + id, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setSuccessMsg("🗑️ Job deleted");
      await loadJobs();
      if (expandedJob === id) setExpandedJob(null);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e: any) {
      setErrorMsg("Failed to delete job: " + (e.message || e));
    }
  }

  async function saveEdit(id: string) {
    if (!editDescription.trim()) return;
    setErrorMsg("");
    try {
      const res = await fetch(`/api/cron/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: editDescription.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSuccessMsg("✏️ Job updated!");
      await loadJobs();
      setEditingJob(null);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e: any) {
      setErrorMsg("Failed to update job: " + (e.message || e));
    }
  }

  return (
    <div className="max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00f2fe]/20 to-[#4facfe]/20 border border-[#00f2fe]/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-[#00f2fe]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Cron Manager</h2>
              <p className="text-[10px] text-slate-500">Schedule recurring tasks — create, run, monitor</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-800">
            {jobs.length} job{ jobs.length !== 1 ? "s" : "" }
          </span>
          <button className="btn-premium px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all hover:scale-[1.02]" onClick={() => setShowForm(!showForm)}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {showForm ? "Cancel" : "New Job"}
          </button>
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="glass-panel rounded-xl p-3 mb-4 border border-red-500/30 bg-red-950/20">
          <p className="text-[11px] text-red-400">{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div className="glass-panel rounded-xl p-3 mb-4 border border-emerald-500/30 bg-emerald-950/20">
          <p className="text-[11px] text-emerald-400">{successMsg}</p>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="glass-panel rounded-xl p-5 mb-6 border border-[#00f2fe]/20 animate-fadeIn">
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Task Description</label>
              <textarea
                className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-white placeholder-slate-600 mt-1 resize-none focus:border-[#00f2fe]/40 focus:outline-none transition-all"
                rows={2}
                placeholder='e.g. "check weather every day at 8am" or "summarize news every 6 hours"'
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Cron Expression (optional)</label>
              <input
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-white placeholder-slate-600 mt-1 focus:border-[#00f2fe]/40 focus:outline-none transition-all"
                placeholder="0 */2 * * * (leave empty for auto-detect)"
                value={formSchedule}
                onChange={(e) => setFormSchedule(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { emoji: "🌤", text: "check weather every day at 8am" },
                { emoji: "📰", text: "summarize news every 6 hours" },
                { emoji: "🩺", text: "run healthcheck every 30 minutes" },
                { emoji: "💰", text: "send crypto digest daily at 9am" },
              ].map((ex) => (
                <button key={ex.text}
                  className="text-[9px] bg-slate-950/60 border border-slate-800 rounded-lg px-2 py-1 text-slate-500 hover:border-[#00f2fe]/30 hover:text-slate-300 transition-all"
                  onClick={() => { setFormDescription(ex.text); setShowForm(true); }}
                >{ex.emoji} {ex.text}</button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button className="px-3 py-1.5 rounded-lg text-[11px] text-slate-400 border border-slate-800 hover:bg-slate-900 transition-all" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn-premium px-4 py-1.5 rounded-lg text-[11px]" onClick={createJob} disabled={!formDescription.trim()}>Create Job</button>
          </div>
        </div>
      )}

      {/* Job List */}
      {loading ? (
        <div className="glass-panel rounded-xl p-12 flex flex-col items-center justify-center gap-3">
          <span className="w-5 h-5 border-2 border-[#00f2fe] border-t-transparent rounded-full animate-spin"></span>
          <span className="text-[11px] text-slate-500">Loading cron jobs...</span>
        </div>
      ) : jobs.length === 0 ? (
        <div className="glass-panel rounded-xl p-12 text-center">
          <svg className="w-10 h-10 text-slate-700 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p className="text-sm text-slate-400 font-medium">No cron jobs yet</p>
          <p className="text-[11px] text-slate-600 mt-1">Create one with natural language — no cron syntax needed.</p>
          <button className="btn-premium px-4 py-2 rounded-lg text-xs mt-4" onClick={() => setShowForm(true)}>+ Create First Job</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {jobs.map((job) => (
            <div key={job.id}>
              {/* Job Card */}
              <div className={`glass-panel rounded-xl transition-all ${job.enabled ? "border-slate-800/60" : "border-slate-900/40 opacity-70"}`}>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {editingJob === job.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <textarea
                              className="flex-1 px-2 py-1 rounded bg-slate-900/80 border border-[#00f2fe]/30 text-xs text-white resize-none"
                              rows={1}
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              autoFocus
                              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(job.id); } if (e.key === "Escape") setEditingJob(null); }}
                            />
                            <button className="text-[10px] text-emerald-400 hover:text-emerald-300 shrink-0" onClick={() => saveEdit(job.id)}>save</button>
                            <button className="text-[10px] text-slate-500 hover:text-slate-300 shrink-0" onClick={() => setEditingJob(null)}>cancel</button>
                          </div>
                        ) : (
                          <>
                            <span className="text-xs text-white font-medium truncate">{job.description}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                              job.enabled
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                                : "bg-slate-500/15 text-slate-400 border border-slate-500/25"
                            }`}>
                              {job.enabled ? "active" : "paused"}
                            </span>
                            <span className="text-[9px] font-mono text-slate-600 bg-slate-900/50 px-1.5 py-0.5 rounded shrink-0">{job.schedule}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-600 mt-1">
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="21" x2="21" y2="16"/><line x1="21" y1="21" x2="21" y2="21"/></svg>
                          Next: {formatTime(job.nextRun)}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          Last: {formatTime(job.lastRun)}
                        </span>
                        <span className="text-slate-700">ID: {job.id}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                          job.enabled
                            ? "bg-amber-950/30 text-amber-400/70 hover:bg-amber-900/40 hover:text-amber-300 border border-amber-900/30"
                            : "bg-emerald-950/30 text-emerald-400/70 hover:bg-emerald-900/40 hover:text-emerald-300 border border-emerald-900/30"
                        }`}
                        onClick={() => toggleJob(job.id, !job.enabled)}
                        title={job.enabled ? "Pause" : "Resume"}
                      >
                        {job.enabled ? (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        )}
                      </button>
                      <button
                        className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#00f2fe]/10 text-[#00f2fe]/70 hover:bg-[#00f2fe]/20 hover:text-[#00f2fe] border border-[#00f2fe]/20 transition-all disabled:opacity-40"
                        onClick={() => runNow(job.id)}
                        disabled={runningJobs.has(job.id)}
                        title="Run now"
                      >
                        {runningJobs.has(job.id) ? (
                          <span className="w-3.5 h-3.5 border-2 border-[#00f2fe] border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        )}
                      </button>
                      <button
                        className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-800/40 text-slate-500 hover:bg-slate-700/40 hover:text-slate-300 border border-slate-800 transition-all"
                        onClick={() => { setEditingJob(job.id); setEditDescription(job.description); }}
                        title="Edit"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button
                        className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-950/30 text-red-400/60 hover:bg-red-900/40 hover:text-red-300 border border-red-900/30 transition-all"
                        onClick={() => deleteJob(job.id)}
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                      <button
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                          expandedJob === job.id
                            ? "bg-[#00f2fe]/15 text-[#00f2fe] border border-[#00f2fe]/30"
                            : "bg-slate-800/40 text-slate-500 hover:bg-slate-700/40 hover:text-slate-300 border border-slate-800"
                        }`}
                        onClick={() => toggleExpand(job.id)}
                        title="Run history"
                      >
                        <svg className={`w-3.5 h-3.5 transition-transform ${expandedJob === job.id ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded: Run History */}
              {expandedJob === job.id && (
                <div className="glass-panel rounded-xl mt-1 mb-2 p-3 border border-[#00f2fe]/10 ml-4 animate-fadeIn">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Run History</span>
                    <button className="text-[9px] text-slate-600 hover:text-slate-400" onClick={() => loadRuns(job.id)}>refresh</button>
                  </div>
                  {!jobRuns[job.id] || jobRuns[job.id].length === 0 ? (
                    <p className="text-[10px] text-slate-600 text-center py-4">No runs yet</p>
                  ) : (
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {jobRuns[job.id].map((run) => (
                        <div key={run.id} className={`rounded-lg p-2 ${
                          run.status === "completed" ? "bg-emerald-950/10 border border-emerald-900/20" :
                          run.status === "error" ? "bg-red-950/10 border border-red-900/20" :
                          "bg-amber-950/10 border border-amber-900/20"
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs">
                                {run.status === "completed" ? "✅" : run.status === "error" ? "❌" : "⏳"}
                              </span>
                              <span className="text-[10px] text-slate-500">{formatTime(run.startedAt)}</span>
                              <span className={`text-[9px] px-1 py-0.5 rounded uppercase font-medium ${
                                run.status === "completed" ? "text-emerald-500 bg-emerald-500/10" :
                                run.status === "error" ? "text-red-400 bg-red-500/10" :
                                "text-amber-400 bg-amber-500/10"
                              }`}>{run.status}</span>
                            </div>
                            <span className="text-[9px] text-slate-600">{formatDuration(run.durationMs)}</span>
                          </div>
                          {run.output && (
                            <p className="text-[9px] text-slate-600 mt-1 font-mono truncate">{run.output}</p>
                          )}
                          {run.error && (
                            <p className="text-[9px] text-red-400/80 mt-1 font-mono truncate">{run.error}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
