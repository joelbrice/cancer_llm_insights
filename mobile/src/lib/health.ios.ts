import { dayRanges, type HealthStore } from "./health-types";

const STEPS = "HKQuantityTypeIdentifierStepCount";

/** Apple Health (HealthKit). Null in Expo Go, which does not include the native module, or on a device without
 * HealthKit (some iPads). Only step counts are requested, read-only. */
export async function getHealthStore(): Promise<HealthStore | null> {
  let hk: typeof import("@kingstinct/react-native-healthkit");
  try {
    hk = await import("@kingstinct/react-native-healthkit");
    if (!(await hk.isHealthDataAvailableAsync())) return null;
  } catch {
    return null;
  }
  return {
    name: "Apple Health",
    status: "available",
    // HealthKit never reveals whether read access was refused: a refusal simply reads as no steps.
    requestAccess: () => hk.requestAuthorization({ toRead: [STEPS] }),
    async dailySteps(days) {
      const out: number[] = [];
      for (const { start, end } of dayRanges(days)) {
        // A statistics query de-duplicates steps counted by both the phone and a watch.
        const result = await hk.queryStatisticsForQuantity(STEPS, ["cumulativeSum"], {
          filter: { date: { startDate: start, endDate: end } },
          unit: "count",
        });
        out.push(Math.round(result.sumQuantity?.quantity ?? 0));
      }
      return out;
    },
  };
}
