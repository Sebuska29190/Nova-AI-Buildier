// Circuit breaker — per-provider failure isolation (1:1 z CheetahClaws)
type State = "CLOSED" | "OPEN" | "HALF_OPEN";

interface BreakerState {
  state: State;
  failures: number;
  lastFailureTime: number;
}

const breakers = new Map<string, BreakerState>();
const FAILURE_THRESHOLD = 3;
const RECOVERY_TIMEOUT = 60000;

export function getBreaker(providerId: string): { allowRequest: () => boolean; recordSuccess: () => void; recordFailure: () => void } {
  if (!breakers.has(providerId)) {
    breakers.set(providerId, { state: "CLOSED", failures: 0, lastFailureTime: 0 });
  }

  return {
    allowRequest: () => {
      const b = breakers.get(providerId)!;
      if (b.state === "CLOSED") return true;
      if (b.state === "OPEN") {
        if (Date.now() - b.lastFailureTime >= RECOVERY_TIMEOUT) {
          b.state = "HALF_OPEN";
          return true;
        }
        return false;
      }
      // HALF_OPEN — allow one request
      return true;
    },
    recordSuccess: () => {
      const b = breakers.get(providerId)!;
      b.failures = 0;
      b.state = "CLOSED";
    },
    recordFailure: () => {
      const b = breakers.get(providerId)!;
      b.failures++;
      b.lastFailureTime = Date.now();
      if (b.failures >= FAILURE_THRESHOLD) b.state = "OPEN";
    },
  };
}

export function resetBreaker(providerId: string): void {
  breakers.set(providerId, { state: "CLOSED", failures: 0, lastFailureTime: 0 });
}
