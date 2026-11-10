/** The phone's health store (Apple Health or Health Connect), read on the device only. */
export interface HealthStore {
  /** Product name, shown as is in every language. */
  name: string;
  /** "needs-install": Health Connect must be installed or updated first (Android 9–13). */
  status: "available" | "needs-install";
  /** Where to get or update the store app, when it is missing. */
  installUrl?: string;
  /** Asks for read access to step counts only. Resolves false when access is refused. */
  requestAccess(): Promise<boolean>;
  /** Total steps per calendar day for the last `days` days, oldest first, ending today. */
  dailySteps(days: number): Promise<number[]>;
}

/** Start of each of the last `days` local calendar days (oldest first) and the end of each (today ends now). */
export function dayRanges(days: number, now = new Date()): { start: Date; end: Date }[] {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, k) => {
    const i = days - 1 - k;
    const start = new Date(midnight);
    start.setDate(midnight.getDate() - i);
    const end = i === 0 ? new Date(now) : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    return { start, end };
  });
}
