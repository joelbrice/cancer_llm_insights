"use client";

import { brandName, buildWeeklyIcs, DEFAULT_REMINDER, STORAGE_KEYS, weekdayNames, type ReminderPrefs } from "@stepwell/shared";
import { useState } from "react";

import { useLocale, useT } from "@/lib/i18n-client";
import { useLocalState } from "@/lib/storage";

import { Icon } from "./Icon";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Weekly check-in reminder on the web: a recurring event the person adds to their own calendar (.ics), so it works
 * without notifications permissions or any server. The mobile app schedules a local notification instead.
 */
export function ReminderCard() {
  const t = useT();
  const lang = useLocale();
  const [prefs, setPrefs, loaded] = useLocalState<ReminderPrefs>(STORAGE_KEYS.reminder, DEFAULT_REMINDER);
  const [saved, setSaved] = useState(false);
  const days = weekdayNames(lang);

  const download = () => {
    const ics = buildWeeklyIcs({
      prefs,
      title: t("reminders.notificationTitle"),
      description: t("reminders.notificationBody"),
      url: `${window.location.origin}/${lang}/plan`,
      app: brandName(),
    });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "weekly-check-in.ics" });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setPrefs((p) => ({ ...p, enabled: true }));
    setSaved(true);
  };

  if (!loaded) return null;
  return (
    <section className="card mt-8 space-y-3 p-5" aria-labelledby="reminder">
      <h2 id="reminder" className="flex items-center gap-2 font-semibold text-ink">
        <Icon name="bell" size={18} />
        {t("reminders.title")}
      </h2>
      <p className="text-sm text-ink-2">{t("reminders.intro")}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="block font-semibold text-ink">{t("reminders.day")}</span>
          <select className="field" value={prefs.weekday} onChange={(e) => (setPrefs((p) => ({ ...p, weekday: Number(e.target.value) })), setSaved(false))}>
            {days.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-semibold text-ink">{t("reminders.time")}</span>
          <input
            type="time"
            className="field"
            value={`${pad(prefs.hour)}:${pad(prefs.minute)}`}
            onChange={(e) => {
              const [h, m] = e.target.value.split(":").map(Number);
              if (Number.isFinite(h) && Number.isFinite(m)) setPrefs((p) => ({ ...p, hour: h!, minute: m! }));
              setSaved(false);
            }}
          />
        </label>
        <button type="button" className="btn btn-primary" onClick={download}>
          <Icon name="calendar" size={16} />
          {t("reminders.addToCalendar")}
        </button>
      </div>
      <p className="text-xs text-ink-3">{t("reminders.calendarHelp")}</p>
      {saved ? (
        <p role="status" className="text-sm text-ink-2">
          {t("reminders.saved")}
        </p>
      ) : null}
    </section>
  );
}
