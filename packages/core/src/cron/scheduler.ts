import { emitEvent } from "../event-bus/index.ts";

interface CronJob {
  id: string; name: string;
  schedule: string; // "every_Xm" or "daily_HH:MM"
  action: string; // message to send
  lastRun?: string;
}

const jobs = new Map<string, CronJob>();
let timer: ReturnType<typeof setInterval> | null = null;

export function addCronJob(name: string, schedule: string, action: string): CronJob {
  const id = name.toLowerCase().replace(/\s+/g, "-");
  const job: CronJob = { id, name, schedule, action };
  jobs.set(id, job);
  if (!timer) startScheduler();
  return job;
}

export function listCronJobs(): CronJob[] {
  return [...jobs.values()];
}

export function removeCronJob(id: string): boolean {
  return jobs.delete(id);
}

function startScheduler(): void {
  timer = setInterval(() => {
    const now = new Date();
    for (const job of jobs.values()) {
      if (job.schedule.startsWith("every_")) {
        const min = parseInt(job.schedule.replace("every_", "").replace("m", ""));
        if (isNaN(min)) continue;
        const lastRun = job.lastRun ? new Date(job.lastRun).getTime() : 0;
        if (now.getTime() - lastRun >= min * 60 * 1000) {
          job.lastRun = now.toISOString();
          emitEvent({ type: "event", kind: "message", sessionId: "cron", data: { text: `[CRON] ${job.name}: ${job.action}` } });
        }
      }
    }
  }, 30000); // check every 30s
}
