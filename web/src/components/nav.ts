import type { IconName } from "./Icon";

export interface NavItem {
  path: string;
  key:
    | "home" | "ask" | "insights" | "community" | "library" | "check" | "plan" | "appointment" | "methodology" | "profile"
    | "admin" | "about";
  icon: IconName;
}

/** Bottom navigation on phones (5 items max). */
export const PRIMARY_NAV: NavItem[] = [
  { path: "/", key: "home", icon: "home" },
  { path: "/ask", key: "ask", icon: "chat" },
  { path: "/insights", key: "insights", icon: "spark" },
  { path: "/community", key: "community", icon: "users" },
  { path: "/plan", key: "plan", icon: "target" },
];

export const SECONDARY_NAV: NavItem[] = [
  { path: "/check", key: "check", icon: "clipboard" },
  { path: "/library", key: "library", icon: "layers" },
  { path: "/appointment", key: "appointment", icon: "help" },
  { path: "/methodology", key: "methodology", icon: "shield" },
  { path: "/profile", key: "profile", icon: "user" },
  { path: "/admin", key: "admin", icon: "database" },
  { path: "/about", key: "about", icon: "info" },
];

/** Header links on wide screens. */
export const HEADER_NAV: NavItem[] = [...PRIMARY_NAV.slice(1, 4), SECONDARY_NAV[0]!, PRIMARY_NAV[4]!, SECONDARY_NAV[1]!];

export function isActive(pathname: string, lang: string, path: string): boolean {
  const base = path === "/" ? `/${lang}` : `/${lang}${path}`;
  return path === "/" ? pathname === base : pathname === base || pathname.startsWith(`${base}/`);
}
