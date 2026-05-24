import { useState, useEffect } from "react";

export function CronPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formDescription, setFormDescription] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => { loadJobs(); }, []);

  async function loadJobs() {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/cron");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setJobs(data.jobs || data || []);
    } catch (e: any) {
      setErrorMsg("Failed to load jobs: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function createJob() {
    if (!formDescription.trim()) return;
    setErrorMsg("");
    try {
      const res = await fetch("/api/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: formDescription.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadJobs();
      setShowForm(false);
      setFormDescription("");
    } catch (e: any) {
      setErrorMsg("Failed to create job: " + (e.message || e));
    }
  }

  async function deleteJob(id: string) {
    setErrorMsg("");
    try {
      const res = await fetch("/api/cron/" + id, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await loadJobs();
    } catch (e: any) {
      setErrorMsg("Failed to delete job: " + (e.message || e));
    }
  }

  function statusBadge(enabled: boolean) {
    return enabled
      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      : "bg-slate-500/20 text-slate-400 border-slate-500/30";
  }

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Task Scheduling (Cron)</h2>
          <p className="text-xs text-slate-400 mt-1">Use natural language to schedule recurring tasks. No cron syntax needed.</p>
        </div>
        <button className="btn-premium px-4 py-1.5 rounded-lg text-sm flex items-center gap-2" onClick={() => setShowForm(!showForm)}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {showForm ? "Cancel" : "New Cron Job"}
        </button>
      </div>

      {errorMsg && (
        <div className="glass-panel rounded-xl p-4 mb-6 border border-red-500/30">
          <p className="text-xs text-red-400">{errorMsg}</p>
        </div>
      )}

      {/* NL Schedule Examples */}
      <div className="glass-panel rounded-xl p-4 mb-6 border border-slate-800">
        <p className="text-[10px] text-slate-500 mb-2">Schedule examples (just describe what and when):</p>
        <div className="flex flex-wrap gap-3">
          {[
            { emoji: "🌤", text: "check weather every day at 8am" },
            { emoji: "📰", text: "summarize news every 6 hours" },
            { emoji: "🩺", text: "run system healthcheck every 30 minutes" },
            { emoji: "💰", text: "send crypto digest daily at 9am" },
          ].map((ex) => (
            <button key={ex.text}
              className="text-[10px] bg-slate-950/60 border border-slate-800 rounded-lg px-2 py-1 text-slate-400 hover:border-[#00f2fe]/40 hover:text-slate-200 transition-all"
              onClick={() => { setFormDescription(ex.text); setShowForm(true); }}
            >
              {ex.emoji} {ex.text}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="glass-panel rounded-xl p-8 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 border-2 border-[#00f2fe] border-t-transparent rounded-full animate-spin"></span>
            <span className="text-xs text-slate-400">Loading jobs...</span>
          </div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="glass-panel rounded-xl p-12 text-center">
          <svg className="w-10 h-10 text-slate-600 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p className="text-sm text-slate-400">No scheduled tasks yet.</p>
          <p className="text-[11px] text-slate-500 mt-1">Create one using natural language — no cron syntax required.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {jobs.map((job) => (
            <div key={job.id} className="glass-panel rounded-xl p-4 flex items-center justify-between transition-all hover:border-slate-700/40">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-white font-medium">{job.description}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${statusBadge(job.enabled)}`}>
                    {job.enabled ? "active" : "paused"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-slate-500">
                  <span className="font-mono">{job.schedule}</span>
                  <span>Next: {new Date(job.nextRun).toLocaleString()}</span>
                  {job.lastRun ? (
                    <span>Last: {new Date(job.lastRun).toLocaleString()}</span>
                  ) : (
                    <span>Last: never</span>
                  )}
                </div>
              </div>
              <button className="bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/30 px-3 py-1 rounded text-[10px] transition-all ml-4 shrink-0"
                onClick={() => deleteJob(job.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="glass-panel rounded-xl p-5 mt-6 border border-[#00f2fe]/20">
          <div className="space-y-4">
            <div>
              <label className="text-[11px] text-slate-400 font-medium">Describe your recurring task</label>
              <textarea
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-500 mt-1 resize-none"
                rows={2}
                placeholder="e.g. check weather every day at 8am, summarize news every 6 hours"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Supported patterns: "every 30 minutes", "every 6 hours", "daily at 9am", "every day at 14:00"
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-800 hover:bg-slate-900 transition-all"
              onClick={() => setShowForm(false)}
            >Cancel</button>
            <button
              className="btn-premium px-3 py-1.5 rounded-lg text-xs"
              onClick={createJob}
              disabled={!formDescription.trim()}
            >Create</button>
          </div>
        </div>
      )}
    </div>
  );
}
