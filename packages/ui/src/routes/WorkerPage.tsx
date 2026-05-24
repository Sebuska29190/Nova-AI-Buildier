import { useState, useEffect, useRef } from "react";

export function WorkerPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [tasksText, setTasksText] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [creating, setCreating] = useState(false);
  const sseRef = useRef<EventSource | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadJobs();
    loadModels();
    connectSSE();
    return () => {
      sseRef.current?.close();
      sseRef.current = null;
    };
  }, []);

  async function loadJobs() {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/worker/jobs");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setJobs(data.jobs || data || []);
    } catch (e: any) {
      setErrorMsg("Failed to load jobs: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function loadModels() {
    try {
      const res = await fetch("/v1/models");
      if (!res.ok) return;
      const data = await res.json();
      const models = data.data || data || [];
      setAvailableModels(models.map((m: any) => {
        const id = m?.id || m?.name;
        return id ? String(id) : null;
      }).filter(Boolean));
    } catch { /* models are optional */ }
  }

  async function startJob() {
    if (!title.trim() || !tasksText.trim()) return;
    setCreating(true);
    setErrorMsg("");
    try {
      const body: Record<string, any> = {
        title: title.trim(),
        tasks: tasksText.trim().split("\n").map((t) => t.trim()).filter(Boolean),
      };
      if (selectedModel) body.model = selectedModel;

      const res = await fetch("/api/worker/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setTitle("");
      setTasksText("");
      setSelectedModel("");
      await loadJobs();
    } catch (e: any) {
      setErrorMsg("Failed to start job: " + (e.message || e));
    } finally {
      setCreating(false);
    }
  }

  async function cancelJob(id: string) {
    try {
      const res = await fetch(`/api/worker/jobs/${id}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      await loadJobs();
    } catch (e: any) {
      setErrorMsg("Failed to cancel job: " + (e.message || e));
    }
  }

  async function deleteJob(id: string) {
    try {
      const res = await fetch(`/api/worker/jobs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await loadJobs();
    } catch (e: any) {
      setErrorMsg("Failed to delete job: " + (e.message || e));
    }
  }

  function connectSSE() {
    try {
      const sse = new EventSource("/api/worker/jobs/stream");
      sseRef.current = sse;
      sse.onopen = () => setSseConnected(true);
      sse.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.jobs) setJobs(data.jobs);
        } catch { /* ignore */ }
      };
      sse.onerror = () => setSseConnected(false);
    } catch {
      setSseConnected(false);
    }
  }

  function jobStatusColor(status: string) {
    switch (status) {
      case "running": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "completed": case "done": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "failed": case "error": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "cancelled": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "pending": return "bg-slate-500/20 text-slate-400 border-slate-500/30";
      default: return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  }

  function progressPercent(job: any): number {
    if (!job.tasks || job.tasks.length === 0) return job.progress || 0;
    const done = job.tasks.filter((t: any) => t.status === "completed" || t.status === "done").length;
    return Math.round((done / job.tasks.length) * 100);
  }

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Worker — Long-Running Tasks</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {sseConnected ? (
              <span className="text-emerald-400">● Live</span>
            ) : (
              <span className="text-slate-500">● Disconnected</span>
            )}
            &middot; {jobs.length} job{jobs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button className="btn-premium px-4 py-1.5 rounded-lg text-sm"
          onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth" })}>
          + New Job
        </button>
      </div>

      {errorMsg && (
        <div className="glass-panel rounded-xl p-3 mb-4 border border-red-500/30">
          <p className="text-xs text-red-400">{errorMsg}</p>
        </div>
      )}

      {/* Create Job Form */}
      <div ref={formRef} id="create-job-form" className="glass-panel rounded-xl p-5 mb-6">
        <h3 className="text-sm font-bold text-white mb-4">Create New Job</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-slate-400 font-medium">Job Title</label>
            <input className="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-500 mt-1"
              placeholder="e.g. Batch article generation" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 font-medium">Tasks (one per line)</label>
            <textarea className="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-500 mt-1 resize-none font-mono"
              rows={5} placeholder="Write an article about AI trends&#10;Translate the article to Spanish&#10;Generate social media posts"
              value={tasksText} onChange={(e) => setTasksText(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 font-medium">Model (optional)</label>
            <select className="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white mt-1"
              value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
              <option value="">Default model</option>
              {availableModels.map((model) => (
                <option key={String(model)} value={String(model)}>{String(model)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-800 hover:bg-slate-900 transition-all"
            onClick={() => { setTitle(""); setTasksText(""); setSelectedModel(""); }}>Clear</button>
          <button className="btn-premium px-4 py-1.5 rounded-lg text-xs"
            onClick={startJob} disabled={creating || !title.trim() || !tasksText.trim()}>
            {creating ? "Starting..." : "Start Job"}
          </button>
        </div>
      </div>

      {/* Job List */}
      {loading ? (
        <div className="glass-panel rounded-xl p-8 flex items-center justify-center">
          <p className="text-sm text-slate-400">Loading jobs...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 flex flex-col items-center justify-center gap-2">
          <p className="text-sm text-slate-400">No jobs yet</p>
          <p className="text-xs text-slate-500">Create a job above to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="glass-panel rounded-xl p-5 transition-all hover:border-indigo-500/30">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white truncate">{String(job.title || job.name || "Untitled")}</h3>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${jobStatusColor(job.status)}`}>
                      {String(job.status || "pending")}
                    </span>
                  </div>
                  {(job.created_at || job.createdAt) && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Created {new Date(job.created_at || job.createdAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-3">
                  {(job.status === "running" || job.status === "pending") && (
                    <button className="px-2 py-1 rounded text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-all"
                      onClick={() => cancelJob(job.id)}>Cancel</button>
                  )}
                  <button className="px-2 py-1 rounded text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all"
                    onClick={() => deleteJob(job.id)}>Delete</button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-500">Progress</span>
                  <span className="text-[10px] text-slate-500">{progressPercent(job)}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                    style={{ width: `${progressPercent(job)}%` }} />
                </div>
              </div>

              {/* Tasks */}
              {job.tasks?.length > 0 && (
                <div className="space-y-1">
                  {job.tasks.map((task: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-[10px]">
                      <span className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                        task.status === "completed" || task.status === "done" ? "bg-emerald-500/20 text-emerald-400" :
                        task.status === "running" ? "bg-indigo-500/20 text-indigo-400" :
                        task.status === "failed" ? "bg-red-500/20 text-red-400" :
                        "bg-slate-800 text-slate-500"
                      }`}>
                        {task.status === "completed" || task.status === "done" ? "✓" :
                         task.status === "running" ? "●" :
                         task.status === "failed" ? "✗" : (i + 1)}
                      </span>
                      <span className="text-slate-400 truncate">{String(task.title || task.name || task.description || `Task ${i + 1}`)}</span>
                      {task.result && <span className="text-slate-500 ml-auto shrink-0">done</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Error info */}
              {(job.error || job.error_message) && (
                <div className="mt-2 p-2 rounded bg-red-950/30 border border-red-900/30">
                  <p className="text-[10px] text-red-400 font-mono">{String(job.error || job.error_message || "")}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
