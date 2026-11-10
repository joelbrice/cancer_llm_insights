import { LEVEL_COLORS, type EvidenceLevelId } from "@stepwell/shared";

/** Same tokens as the web app (globals.css) so both platforms read as one product. */
export const palette = {
  light: {
    bg: "#f7f6f2",
    surface: "#fcfcfb",
    surface2: "#f0efea",
    surface3: "#e6e5df",
    ink: "#0b0b0b",
    ink2: "#52514e",
    ink3: "#6f6e69",
    border: "rgba(11,11,11,0.12)",
    brand: "#0f6e64",
    brandSoft: "#e3f1ee",
    onBrand: "#ffffff",
    series: "#2a78d6",
    track: "#e6e5df",
    critical: "#d03b3b",
    criticalSoft: "#fbeaea",
    warning: "#fab219",
    warningInk: "#7a5200",
    warningSoft: "#fdf3dc",
    good: "#006300",
  },
  dark: {
    bg: "#0d0d0d",
    surface: "#1a1a19",
    surface2: "#232321",
    surface3: "#2c2c2a",
    ink: "#ffffff",
    ink2: "#c3c2b7",
    ink3: "#a3a29a",
    border: "rgba(255,255,255,0.12)",
    brand: "#43b8a7",
    brandSoft: "#14302c",
    onBrand: "#04201c",
    series: "#3987e5",
    track: "#2c2c2a",
    critical: "#e66767",
    criticalSoft: "#3a1c1c",
    warning: "#fab219",
    warningInk: "#fab219",
    warningSoft: "#33280f",
    good: "#0ca30c",
  },
} as const;

export type Colors = { [K in keyof typeof palette.light]: string };

export function levelColor(scheme: "light" | "dark", level: EvidenceLevelId): string {
  return LEVEL_COLORS[scheme][level];
}

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };
export const space = (n: number) => n * 4;
