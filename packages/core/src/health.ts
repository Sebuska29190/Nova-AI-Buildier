// Health check server (1:1 z CheetahClaws health.py)
import { registry } from "./plugin/registry.ts";
import { sessionManager } from "./session/manager.ts";

const startTime = Date.now();

export function getHealthPayload() {
  return {
    status: "ok",
    version: "0.6.1",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    providers: registry.listModels().reduce((acc: any, m) => {
      if (!acc[m.providerId]) acc[m.providerId] = { models: 0 };
      acc[m.providerId].models++;
      return acc;
    }, {}),
    sessions: sessionManager.listSessions().length,
  };
}

export function getReadyzPayload() {
  return {
    status: "ok",
    db: true,
    providers: registry.providers.size,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };
}

export function getMetricsPayload() {
  return {
    uptime_s: Math.floor((Date.now() - startTime) / 1000),
    providers: registry.providers.size,
    models: registry.listModels().length,
    sessions: sessionManager.listSessions().length,
  };
}
