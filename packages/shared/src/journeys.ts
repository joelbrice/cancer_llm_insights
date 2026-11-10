import type { Audience } from "./types";

/** The four journeys Stepwell serves — every insight, circle and profile is tagged with one or more. */
export const AUDIENCES: readonly Audience[] = ["prevention", "in_treatment", "after_treatment", "caregivers"] as const;

/** Icon names shared by web (Icon.tsx) and mobile (Ionicons mapping). */
export const JOURNEY_ICON: Record<Audience, "leaf" | "heart" | "sunrise" | "people"> = {
  prevention: "leaf",
  in_treatment: "heart",
  after_treatment: "sunrise",
  caregivers: "people",
};
