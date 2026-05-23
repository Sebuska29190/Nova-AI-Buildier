import type { HarnessV2 } from "@nova/sdk";

const harnesses = new Map<string, HarnessV2>();

export function registerHarness(h: HarnessV2): void {
  harnesses.set(h.id, h);
}

export function getHarness(id: string): HarnessV2 | undefined {
  return harnesses.get(id);
}

export function listHarnesses(): HarnessV2[] {
  return [...harnesses.values()];
}
