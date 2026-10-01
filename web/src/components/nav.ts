import type { IconName } from "./Icon";

export interface NavItem {
  path: string;
  key: "home" | "ask" | "insights" | "library" | "check" | "plan" | "methodology" | "profile" | "admin" | "about";
  icon: IconName;
}

export const PRIMARY_NAV: NavItem[] = [
  { path: "/", key: "home", icon: "home" },
  { path: "/ask", key: "ask", icon: "chat" },
  { path: "/insights", key: "insights", icon: "spark" },
  { path: "/check", key: "check", icon: "clipboard" },
  { path: "/plan", key: "plan", icon: "target" },
];

export const SECONDARY_NAV: NavItem[] = [
  { path: "/library", key: "library", icon: "layers" },
  { path: "/methodology", key: "methodology", icon: "shield" },
  { path: "/profile", key: "profile", icon: "user" },
  { path: "/admin", key: "admin", icon: "database" },
  { path: "/about", key: "about", icon: "info" },
];

export function isActive(pathname: string, lang: string, path: string): boolean {
  const base = path === "/" ? `/${lang}` : `/${lang}${path}`;
  return path === "/" ? pathname === base : pathname === base || pathname.startsWith(`${base}/`);
}
