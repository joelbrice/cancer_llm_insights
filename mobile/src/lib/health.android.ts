import { Platform } from "react-native";

import { dayRanges, type HealthStore } from "./health-types";

const PLAY_STORE = "market://details?id=com.google.android.apps.healthdata&url=healthconnect%3A%2F%2Fonboarding";

/** Health Connect (Android 9+; built in from Android 14). Null in Expo Go, which does not include the native
 * module, and on older Android versions. Only step counts are requested, read-only. */
export async function getHealthStore(): Promise<HealthStore | null> {
  if (Number(Platform.Version) < 28) return null;
  let hc: typeof import("react-native-health-connect");
  let status: number;
  try {
    hc = await import("react-native-health-connect");
    status = await hc.getSdkStatus();
  } catch {
    return null;
  }
  if (status === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE) return null;
  return {
    name: "Health Connect",
    status: status === hc.SdkAvailabilityStatus.SDK_AVAILABLE ? "available" : "needs-install",
    installUrl: PLAY_STORE,
    async requestAccess() {
      if (!(await hc.initialize())) return false;
      const readsSteps = (list: { accessType?: string; recordType?: string }[]) =>
        list.some((p) => p.accessType === "read" && p.recordType === "Steps");
      // Ask only once: the permission screen opens again on every request, even when access was already granted
      if (readsSteps(await hc.getGrantedPermissions())) return true;
      return readsSteps(await hc.requestPermission([{ accessType: "read", recordType: "Steps" }]));
    },
    async dailySteps(days) {
      if (!(await hc.initialize())) return [];
      const out: number[] = [];
      for (const { start, end } of dayRanges(days)) {
        // Aggregation de-duplicates steps recorded by several apps and devices.
        const result = await hc.aggregateRecord({
          recordType: "Steps",
          timeRangeFilter: { operator: "between", startTime: start.toISOString(), endTime: end.toISOString() },
        });
        out.push(result.COUNT_TOTAL ?? 0);
      }
      return out;
    },
  };
}
