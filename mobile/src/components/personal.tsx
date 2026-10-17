import { Ionicons } from "@expo/vector-icons";
import {
  addCustomQuestion,
  deleteRemoteCopy,
  DEFAULT_REMINDER,
  EMPTY_APPOINTMENT,
  formatDate,
  formatNumber,
  formatReminderTime,
  generateSyncCode,
  normalizeSyncCode,
  STORAGE_KEYS,
  weekdayNames,
  type AppointmentState,
  type OfflinePack,
  type ReminderPrefs,
  type SyncState,
} from "@stepwell/shared";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { Pedometer } from "expo-sensors";
import { useEffect, useState } from "react";
import { Alert, AppState, Linking, Platform, Switch, TextInput, View } from "react-native";

import { getHealthStore } from "@/lib/health";
import type { HealthStore } from "@/lib/health-types";
import { readOfflinePack, removeOfflinePacks, saveOfflinePack } from "@/lib/offline";
import { cancelWeeklyReminder, remindersSupported, scheduleWeeklyReminder } from "@/lib/reminders";
import { useSettings } from "@/lib/settings";
import { onStoredChange, removeKeys, useStored, writeJSON } from "@/lib/storage";
import { isApplyingSync, randomBytes, runSync, SYNCED_KEYS } from "@/lib/sync";
import { radius, space } from "@/lib/theme";

import { Button, Card, Chip, Txt } from "./ui";

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const { colors } = useSettings();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 44 }}>
      <Txt style={{ flex: 1 }}>{label}</Txt>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: colors.brand, false: colors.track }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

// ── weekly reminder (local notification) ────────────────────────────────────────────────────────────────────
const HOURS = [7, 9, 12, 18, 20];

export function ReminderCard() {
  const { t, locale } = useSettings();
  const [prefs, setPrefs, loaded] = useStored<ReminderPrefs>(STORAGE_KEYS.reminder, DEFAULT_REMINDER);
  const [message, setMessage] = useState<string | null>(null);
  if (!remindersSupported || !loaded) return null;
  const days = weekdayNames(locale);

  const save = async (next: ReminderPrefs) => {
    setPrefs(next);
    setMessage(null);
    if (!next.enabled) {
      await cancelWeeklyReminder();
      return;
    }
    const ok = await scheduleWeeklyReminder(next, {
      title: t("reminders.notificationTitle"),
      body: t("reminders.notificationBody"),
      channel: t("reminders.title"),
    });
    if (ok) setMessage(t("reminders.saved"));
    else {
      setPrefs({ ...next, enabled: false });
      setMessage(t("reminders.permissionDenied"));
    }
  };

  return (
    <Card>
      <Txt variant="h2">{t("reminders.title")}</Txt>
      <Txt variant="small">{t("reminders.intro")}</Txt>
      <Toggle label={t("reminders.enable")} value={prefs.enabled} onChange={(enabled) => void save({ ...prefs, enabled })} />
      {prefs.enabled ? (
        <>
          <Txt variant="label">{t("reminders.day")}</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {days.map((name, i) => (
              <Chip key={name} label={name} selected={prefs.weekday === i + 1} onPress={() => void save({ ...prefs, weekday: i + 1 })} />
            ))}
          </View>
          <Txt variant="label">{t("reminders.time")}</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {HOURS.map((hour) => (
              <Chip
                key={hour}
                label={formatReminderTime({ ...prefs, hour, minute: 0 }, locale)}
                selected={prefs.hour === hour && prefs.minute === 0}
                onPress={() => void save({ ...prefs, hour, minute: 0 })}
              />
            ))}
          </View>
          <Txt variant="small">{t("reminders.on", { day: days[prefs.weekday - 1] ?? "", time: formatReminderTime(prefs, locale) })}</Txt>
        </>
      ) : null}
      {message ? <Txt variant="small" accessibilityLiveRegion="polite">{message}</Txt> : null}
    </Card>
  );
}

// ── steps (on-device pedometer, opt-in; optionally the phone's health store) ──────────────────────────────────
interface Day {
  label: string;
  steps: number;
}

interface StepsPrefs {
  enabled: boolean;
  /** "health": read the step history from Apple Health / Health Connect instead of the motion sensor. */
  source?: "health";
}

export function StepsCard() {
  const { t, locale, colors } = useSettings();
  const [prefs, setPrefs, loaded] = useStored<StepsPrefs>(STORAGE_KEYS.steps, { enabled: false });
  const [status, setStatus] = useState<"checking" | "ok" | "unavailable" | "denied">("checking");
  const [days, setDays] = useState<Day[]>([]);
  const [live, setLive] = useState(0);
  // undefined while looking; null when this build or phone has no health store (Expo Go, web, older Android)
  const [store, setStore] = useState<HealthStore | null | undefined>(undefined);
  const [healthStatus, setHealthStatus] = useState<"checking" | "ok" | "denied" | "error">("checking");
  const wantsHealth = prefs.source === "health";
  const useHealth = wantsHealth && store?.status === "available";
  const waitingForStore = wantsHealth && store === undefined;

  useEffect(() => {
    if (!prefs.enabled || Platform.OS === "web") return;
    let alive = true;
    getHealthStore()
      .then((found) => alive && setStore(found))
      .catch(() => alive && setStore(null));
    return () => {
      alive = false;
    };
  }, [prefs.enabled]);

  useEffect(() => {
    if (!prefs.enabled || !useHealth || !store) return;
    let alive = true;
    setDays([]);
    setHealthStatus("checking");
    void (async () => {
      if (!(await store.requestAccess().catch(() => false))) return alive && setHealthStatus("denied");
      const totals = await store.dailySteps(7).catch(() => null);
      if (!alive) return;
      if (!totals) return setHealthStatus("error");
      const today = new Date();
      setDays(
        totals.map((steps, i) => {
          const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (totals.length - 1 - i));
          return { label: day.toLocaleDateString(locale, { weekday: "short" }), steps };
        }),
      );
      setHealthStatus("ok");
    })();
    return () => {
      alive = false;
    };
  }, [prefs.enabled, useHealth, store, locale]);

  useEffect(() => {
    // The motion sensor, as before, unless the person chose their health store (and it can be used here)
    if (!prefs.enabled || Platform.OS === "web" || useHealth || waitingForStore) return;
    let alive = true;
    let subscription: { remove: () => void } | null = null;
    void (async () => {
      if (!(await Pedometer.isAvailableAsync())) return alive && setStatus("unavailable");
      const permission = await Pedometer.requestPermissionsAsync();
      if (!permission.granted) return alive && setStatus("denied");
      setStatus("ok");
      if (Platform.OS === "ios") {
        const out: Day[] = [];
        const midnight = new Date();
        midnight.setHours(0, 0, 0, 0);
        for (let i = 6; i >= 0; i -= 1) {
          const start = new Date(midnight.getTime() - i * 86_400_000);
          const end = i === 0 ? new Date() : new Date(start.getTime() + 86_400_000);
          const { steps } = await Pedometer.getStepCountAsync(start, end);
          out.push({ label: start.toLocaleDateString(locale, { weekday: "short" }), steps });
        }
        if (alive) setDays(out);
      } else {
        // Android exposes live counts only (history needs Health Connect): counted while this screen is open
        subscription = Pedometer.watchStepCount((result) => alive && setLive(result.steps));
      }
    })();
    return () => {
      alive = false;
      subscription?.remove();
    };
  }, [prefs.enabled, locale, useHealth, waitingForStore]);

  if (!loaded || Platform.OS === "web") return null;
  const max = Math.max(1, ...days.map((d) => d.steps));
  const average = days.length ? Math.round(days.reduce((sum, d) => sum + d.steps, 0) / days.length) : 0;
  return (
    <Card>
      <Txt variant="h2">{t("steps.title")}</Txt>
      <Txt variant="small">{t("steps.intro")}</Txt>
      <Toggle label={t("steps.enable")} value={prefs.enabled} onChange={(enabled) => setPrefs({ ...prefs, enabled })} />
      {prefs.enabled && store ? (
        <>
          <Toggle
            label={t("steps.useHealth", { source: store.name })}
            value={wantsHealth}
            onChange={(on) => {
              setDays([]);
              setPrefs({ enabled: true, source: on ? "health" : undefined });
            }}
          />
          <Txt variant="muted">{t("steps.healthHelp")}</Txt>
        </>
      ) : null}
      {prefs.enabled && wantsHealth && store?.status === "needs-install" ? (
        <>
          <Txt variant="small">{t("steps.healthInstall", { source: store.name })}</Txt>
          {store.installUrl ? (
            <Button variant="ghost" icon="download-outline" label={t("steps.healthGet", { source: store.name })} onPress={() => void Linking.openURL(store.installUrl!)} />
          ) : null}
        </>
      ) : null}
      {prefs.enabled && useHealth && healthStatus === "denied" ? <Txt variant="small">{t("steps.healthDenied", { source: store!.name })}</Txt> : null}
      {prefs.enabled && useHealth && healthStatus === "error" ? <Txt variant="small">{t("steps.healthError", { source: store!.name })}</Txt> : null}
      {prefs.enabled && !useHealth && status === "unavailable" ? <Txt variant="small">{t("steps.unavailable")}</Txt> : null}
      {prefs.enabled && !useHealth && status === "denied" ? <Txt variant="small">{t("steps.denied")}</Txt> : null}
      {prefs.enabled && (useHealth ? healthStatus === "ok" : status === "ok") && days.length ? (
        <>
          <Txt>{t("steps.today", { n: formatNumber(locale, days.at(-1)?.steps ?? 0) })}</Txt>
          <View
            accessible
            accessibilityLabel={`${t("steps.week")}: ${days.map((d) => `${d.label} ${d.steps}`).join(", ")}`}
            style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 96 }}
          >
            {days.map((d) => (
              <View key={d.label} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                <View style={{ width: "70%", height: Math.max(3, (d.steps / max) * 72), backgroundColor: colors.brand, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                <Txt variant="muted">{d.label}</Txt>
              </View>
            ))}
          </View>
          <Txt variant="small">{t("steps.average", { n: formatNumber(locale, average) })}</Txt>
        </>
      ) : null}
      {prefs.enabled && !useHealth && status === "ok" && Platform.OS === "android" ? (
        <>
          <Txt>{t("steps.sinceOpened", { n: formatNumber(locale, live) })}</Txt>
          <Txt variant="muted">{t("steps.liveOnly")}</Txt>
        </>
      ) : null}
      {prefs.enabled ? <Txt variant="muted">{t("steps.note")}</Txt> : null}
    </Card>
  );
}

// ── encrypted sync ──────────────────────────────────────────────────────────────────────────────────────────
export function SyncCard() {
  const { t, api, locale, colors } = useSettings();
  const [state, , loaded] = useStored<SyncState | null>(STORAGE_KEYS.sync, null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [entering, setEntering] = useState(false);
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void api.sync.meta().then((m) => setAvailable(m.enabled), () => setAvailable(false));
  }, [api]);

  const sync = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await runSync(api);
    } catch {
      setMessage(t("sync.failed"));
    } finally {
      setBusy(false);
    }
  };
  const start = async (value: string) => {
    await writeJSON(STORAGE_KEYS.sync, { code: value, version: 0, base: null, last_synced_at: null } satisfies SyncState);
    setShow(true);
    await sync();
  };
  const connect = () => {
    const normalized = normalizeSyncCode(code);
    if (!normalized) return setMessage(t("sync.invalidCode"));
    setEntering(false);
    setCode("");
    void start(normalized);
  };
  const turnOff = () =>
    state &&
    Alert.alert(t("sync.turnOff"), t("sync.turnOffConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("sync.turnOff"),
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await deleteRemoteCopy(api, state.code);
          } catch {
            /* offline: the copy expires on the server */
          }
          await removeKeys([STORAGE_KEYS.sync]);
          setBusy(false);
          setMessage(t("sync.off"));
        },
      },
    ]);

  if (!loaded || available === null) return null;
  return (
    <Card>
      <Txt variant="h2">{t("sync.title")}</Txt>
      <Txt variant="small">{t("sync.intro")}</Txt>
      {!available ? (
        <Txt variant="muted">{t("sync.unavailable")}</Txt>
      ) : !state ? (
        <>
          <Button icon="lock-closed-outline" label={t("sync.turnOn")} disabled={busy} onPress={() => void start(generateSyncCode(randomBytes))} />
          <Button variant="ghost" icon="key-outline" label={t("sync.haveCode")} onPress={() => setEntering((v) => !v)} />
          {entering ? (
            <>
              <TextInput
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel={t("sync.enterCode")}
                placeholder={t("sync.enterCode")}
                placeholderTextColor={colors.ink3}
                style={{ minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space(3), color: colors.ink, backgroundColor: colors.surface2, fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }) }}
              />
              <Button label={t("sync.connect")} onPress={connect} />
            </>
          ) : null}
        </>
      ) : (
        <>
          <View style={{ backgroundColor: colors.surface2, borderRadius: radius.md, padding: space(3), gap: 8 }}>
            <Txt variant="label">{t("sync.code")}</Txt>
            <Txt selectable style={{ fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }), letterSpacing: 1 }}>
              {show ? state.code : state.code.replace(/[0-9A-Z]/g, "•")}
            </Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button variant="ghost" icon={show ? "eye-off-outline" : "eye-outline"} label={show ? t("sync.hide") : t("sync.show")} onPress={() => setShow((v) => !v)} />
              <Button variant="ghost" icon="copy-outline" label={t("common.copy")} onPress={() => void Clipboard.setStringAsync(state.code)} />
            </View>
            <Txt variant="muted">{t("sync.codeHelp")}</Txt>
          </View>
          <Txt variant="small" accessibilityLiveRegion="polite">
            {busy ? t("sync.syncing") : state.last_synced_at ? t("sync.lastSynced", { date: formatDate(locale, state.last_synced_at) }) : t("sync.notYet")}
          </Txt>
          <Button variant="ghost" icon="sync-outline" label={t("sync.syncNow")} disabled={busy} onPress={() => void sync()} />
          <Button variant="danger" icon="close-circle-outline" label={t("sync.turnOff")} disabled={busy} onPress={turnOff} />
        </>
      )}
      {message ? <Txt variant="small" accessibilityLiveRegion="polite">{message}</Txt> : null}
    </Card>
  );
}

/** Background sync while sync is on: shortly after a change and when the app comes back to the foreground. */
export function SyncAgent() {
  const { api } = useSettings();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = (delay: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => void runSync(api).catch(() => undefined), delay);
    };
    const unsubscribe = onStoredChange((key) => SYNCED_KEYS.includes(key) && !isApplyingSync() && soon(3000));
    const appState = AppState.addEventListener("change", (s) => s === "active" && soon(500));
    soon(1500);
    return () => {
      clearTimeout(timer);
      unsubscribe();
      appState.remove();
    };
  }, [api]);
  return null;
}

// ── offline insight packs ───────────────────────────────────────────────────────────────────────────────────
export function OfflineCard() {
  const { t, api, locale } = useSettings();
  const [pack, setPack] = useState<OfflinePack | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void readOfflinePack(locale).then(setPack);
  }, [locale]);
  const download = async () => {
    setError(null);
    setProgress({ done: 0, total: 0 });
    try {
      setPack(await saveOfflinePack(api, locale, (done, total) => setProgress({ done, total })));
    } catch {
      setError(t("common.apiUnreachable"));
    } finally {
      setProgress(null);
    }
  };
  return (
    <Card>
      <Txt variant="h2">{t("offline.title")}</Txt>
      <Txt variant="small">{t("offline.intro")}</Txt>
      {pack ? <Txt variant="small">{t("offline.saved", { n: pack.list.length, date: formatDate(locale, pack.saved_at) })}</Txt> : null}
      {progress ? (
        <Txt variant="small" accessibilityLiveRegion="polite">
          {t("offline.downloading", { done: progress.done, total: progress.total })}
        </Txt>
      ) : (
        <Button icon="cloud-download-outline" label={pack ? t("offline.update") : t("offline.download")} onPress={() => void download()} />
      )}
      {pack && !progress ? (
        <Button variant="ghost" icon="trash-outline" label={t("offline.remove")} onPress={() => void removeOfflinePacks().then(() => setPack(null))} />
      ) : null}
      {error ? <Txt variant="small">{error}</Txt> : null}
    </Card>
  );
}

// ── appointment questions ───────────────────────────────────────────────────────────────────────────────────
export function AddQuestionButton({ title }: { title: string }) {
  const { t } = useSettings();
  const [state, setState, loaded] = useStored<AppointmentState>(STORAGE_KEYS.appointment, EMPTY_APPOINTMENT);
  const text = t("insights.aboutTopicQuestion", { title });
  const added = state.custom.some((c) => c.text === text && state.selected.includes(c.id));
  return added ? (
    <Button variant="ghost" icon="checkmark" label={t("insights.questionAdded")} onPress={() => router.push("/appointment")} />
  ) : (
    <Button variant="ghost" icon="help-circle-outline" label={t("insights.addQuestion")} disabled={!loaded} onPress={() => setState((prev) => addCustomQuestion(prev, text))} />
  );
}

/** Small "offline" banner used when a saved copy is shown. */
export function OfflineBanner({ savedAt }: { savedAt: string }) {
  const { t, locale, colors } = useSettings();
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: colors.surface2, borderRadius: radius.md, padding: space(3) }}>
      <Ionicons name="cloud-offline-outline" size={18} color={colors.ink2} />
      <Txt variant="small" style={{ flex: 1 }}>
        {t("offline.usingSaved", { date: formatDate(locale, savedAt) })}
      </Txt>
    </View>
  );
}
