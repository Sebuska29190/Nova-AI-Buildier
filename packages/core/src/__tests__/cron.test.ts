// Cron scheduler tests
import { describe, it, expect } from "bun:test";
import { addCronJob, listCronJobs, removeCronJob } from "../cron/scheduler.ts";

describe("Cron Scheduler", () => {
  it("adds cron jobs", () => {
    const job = addCronJob("test-job", "every_5m", "Run test");
    expect(job.name).toBe("test-job");
    expect(job.schedule).toBe("every_5m");
  });

  it("lists cron jobs", () => {
    const jobs = listCronJobs();
    expect(jobs.length).toBeGreaterThanOrEqual(1);
  });

  it("removes cron jobs", () => {
    const result = removeCronJob("test-job");
    expect(result).toBe(true);
    const jobs = listCronJobs();
    expect(jobs.find((j) => j.name === "test-job")).toBeUndefined();
  });
});
