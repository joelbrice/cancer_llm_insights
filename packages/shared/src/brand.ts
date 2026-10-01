/** Brand constants. The product name is a single value so it can be changed without touching translations. */
export const BRAND = {
  name: "VitaCite",
  /** Short name for home screens (keeps the word "cancer" off the user's phone for privacy). */
  shortName: "VitaCite",
  themeColor: "#0f6e64",
  backgroundColor: "#f7f6f2",
  repository: "https://github.com/joelbrice/cancer_llm_insights",
} as const;

let currentName: string = BRAND.name;

/** Apps call this once at startup (e.g. with NEXT_PUBLIC_APP_NAME / EXPO_PUBLIC_APP_NAME) to rebrand. */
export function configureBrand(options: { name?: string | null }): void {
  if (options.name && options.name.trim()) currentName = options.name.trim();
}

export function brandName(): string {
  return currentName;
}
