/**
 * Opt-in weekly check-in reminder (roadmap 1.1). On mobile it is a local notification scheduled on the device; on
 * the web it is a recurring calendar event (.ics) the person adds to their own calendar. Nothing is sent to us.
 */
export interface ReminderPrefs {
  enabled: boolean;
  /** ISO weekday: 1 = Monday … 7 = Sunday. */
  weekday: number;
  hour: number;
  minute: number;
}

export const DEFAULT_REMINDER: ReminderPrefs = { enabled: false, weekday: 7, hour: 18, minute: 0 };

const BYDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

/** Localised weekday names, Monday first (Intl, so every language is covered). */
export function weekdayNames(locale: string): string[] {
  const monday = new Date(Date.UTC(2024, 0, 1, 12)); // 1 Jan 2024 was a Monday
  return Array.from({ length: 7 }, (_, i) =>
    new Date(monday.getTime() + i * 86_400_000).toLocaleDateString(locale, { weekday: "long", timeZone: "UTC" }),
  );
}

export function formatReminderTime(prefs: ReminderPrefs, locale: string): string {
  return new Date(2024, 0, 1, prefs.hour, prefs.minute).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

/** The next local date/time matching the reminder (today counts if the time has not passed yet). */
export function nextOccurrence(prefs: ReminderPrefs, now: Date = new Date()): Date {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), prefs.hour, prefs.minute, 0, 0);
  const isoToday = now.getDay() || 7;
  let days = (prefs.weekday - isoToday + 7) % 7;
  if (days === 0 && next.getTime() <= now.getTime()) days = 7;
  next.setDate(next.getDate() + days);
  return next;
}

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 line folding: at most 75 octets per line (counted in UTF-8 bytes). */
function fold(line: string): string {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = ch.codePointAt(0)! < 0x80 ? 1 : ch.codePointAt(0)! < 0x800 ? 2 : ch.codePointAt(0)! < 0x10000 ? 3 : 4;
    if (bytes + size > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

const pad = (n: number) => String(n).padStart(2, "0");
const floating = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const utc = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/**
 * A weekly, 10-minute calendar event in the person's local time (floating time, so it follows them across time
 * zones) with an alarm at the start.
 */
export function buildWeeklyIcs(opts: {
  prefs: ReminderPrefs;
  title: string;
  description: string;
  url?: string;
  app: string;
  now?: Date;
}): string {
  const now = opts.now ?? new Date();
  const start = nextOccurrence(opts.prefs, now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${escapeText(opts.app)}//Weekly check-in//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:weekly-checkin-${opts.prefs.weekday}-${pad(opts.prefs.hour)}${pad(opts.prefs.minute)}@${opts.app.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
    `DTSTAMP:${utc(now)}`,
    `DTSTART:${floating(start)}`,
    "DURATION:PT10M",
    `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[(opts.prefs.weekday + 6) % 7]}`,
    `SUMMARY:${escapeText(opts.title)}`,
    `DESCRIPTION:${escapeText(opts.url ? `${opts.description}\n${opts.url}` : opts.description)}`,
    ...(opts.url ? [`URL:${opts.url}`] : []),
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(opts.title)}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
