import type { AuthProfile } from "@nova/sdk";

class AuthProfileManager {
  private profiles = new Map<string, AuthProfile[]>();
  private cooldownMs = 60_000;

  addProfile(providerId: string, profile: Omit<AuthProfile, "id"|"failures">): AuthProfile {
    const p: AuthProfile = { ...profile, id: `${providerId}-${Date.now()}`, failures: 0 };
    const list = this.profiles.get(providerId) ?? [];
    list.push(p);
    this.profiles.set(providerId, list);
    return p;
  }

  getProfiles(providerId: string): AuthProfile[] {
    return this.profiles.get(providerId) ?? [];
  }

  getActiveProfile(providerId: string): AuthProfile | undefined {
    const list = this.profiles.get(providerId) ?? [];
    const now = Date.now();
    return list.find((p) => !p.cooldownUntil || p.cooldownUntil < now);
  }

  recordFailure(profileId: string): void {
    for (const [, list] of this.profiles) {
      const p = list.find((x) => x.id === profileId);
      if (p) {
        p.failures++;
        p.cooldownUntil = Date.now() + this.cooldownMs * Math.min(p.failures, 10);
        break;
      }
    }
  }

  recordSuccess(profileId: string): void {
    for (const [, list] of this.profiles) {
      const p = list.find((x) => x.id === profileId);
      if (p) { p.failures = 0; p.cooldownUntil = undefined; break; }
    }
  }
}

export const authProfileManager = new AuthProfileManager();
