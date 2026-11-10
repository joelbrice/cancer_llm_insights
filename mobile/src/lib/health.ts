import type { HealthStore } from "./health-types";

/** Web (and any platform without a health store): nothing to read. See health.ios.ts and health.android.ts. */
export async function getHealthStore(): Promise<HealthStore | null> {
  return null;
}
