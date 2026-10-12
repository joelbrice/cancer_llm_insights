import { Ionicons } from "@expo/vector-icons";
import { brandName, deleteRemoteCopy, LOCALE_NAMES, LOCALES, STORAGE_KEYS, type SyncState } from "@stepwell/shared";
import Constants from "expo-constants";
import { router, type Href } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";

import { OfflineCard } from "@/components/personal";
import { Button, Card, Chip, Disclaimer, Screen, Txt, type IconName } from "@/components/ui";
import { offlinePackKeys } from "@/lib/offline";
import { cancelWeeklyReminder } from "@/lib/reminders";
import { API_URL_KEY, useSettings } from "@/lib/settings";
import { readJSON, removeKeys } from "@/lib/storage";
import { radius, space } from "@/lib/theme";

export default function Me() {
  const { t, locale, setLocale, themePref, setThemePref, apiUrl, setApiUrl, colors, api } = useSettings();
  const [url, setUrl] = useState(apiUrl);
  const links: { href: Href; icon: IconName; label: string }[] = [
    { href: "/plan", icon: "checkbox-outline", label: t("nav.plan") },
    { href: "/check", icon: "clipboard-outline", label: t("nav.check") },
    { href: "/appointment", icon: "help-circle-outline", label: t("nav.appointment") },
    { href: "/profile", icon: "person-circle-outline", label: t("nav.profile") },
    { href: "/library", icon: "library-outline", label: t("library.title") },
    { href: "/methodology", icon: "school-outline", label: t("nav.methodology") },
    { href: "/guidelines", icon: "shield-checkmark-outline", label: t("nav.guidelines") },
    { href: "/transparency", icon: "stats-chart-outline", label: t("nav.transparency") },
  ];
  const clearAll = () =>
    Alert.alert(t("profile.clear"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          // the encrypted sync copy and a scheduled reminder are this person's data too
          const sync = await readJSON<SyncState | null>(STORAGE_KEYS.sync, null);
          if (sync) await deleteRemoteCopy(api, sync.code).catch(() => undefined);
          await cancelWeeklyReminder();
          await removeKeys([STORAGE_KEYS.profile, STORAGE_KEYS.plan, STORAGE_KEYS.check, STORAGE_KEYS.conversation, STORAGE_KEYS.locale, STORAGE_KEYS.theme, STORAGE_KEYS.communityToken, API_URL_KEY,
            STORAGE_KEYS.appointment, STORAGE_KEYS.reminder, STORAGE_KEYS.sync, STORAGE_KEYS.steps, STORAGE_KEYS.surveySnooze, ...offlinePackKeys()]);
          Alert.alert(t("profile.cleared"));
        },
      },
    ]);
  return (
    <Screen>
      <Txt variant="title">{t("nav.me")}</Txt>
      <Card style={{ padding: 0, gap: 0 }}>
        {links.map((l, i) => (
          <Pressable
            key={String(l.href)}
            onPress={() => router.push(l.href)}
            accessibilityRole="link"
            style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: space(4), borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}
          >
            <Ionicons name={l.icon} size={22} color={colors.brand} />
            <Txt style={{ flex: 1 }}>{l.label}</Txt>
            <Ionicons name="chevron-forward" size={18} color={colors.ink3} />
          </Pressable>
        ))}
      </Card>

      <OfflineCard />

      <Card>
        <Txt variant="label">{t("common.language")}</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {LOCALES.map((l) => (
            <Chip key={l} label={LOCALE_NAMES[l]} selected={l === locale} onPress={() => setLocale(l)} />
          ))}
        </View>
        <Txt variant="label">{t("common.theme")}</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(["system", "light", "dark"] as const).map((p) => (
            <Chip
              key={p}
              icon={p === "system" ? "phone-portrait-outline" : p === "light" ? "sunny-outline" : "moon-outline"}
              label={t(p === "system" ? "common.themeSystem" : p === "light" ? "common.themeLight" : "common.themeDark")}
              selected={themePref === p}
              onPress={() => setThemePref(p)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <Txt variant="label">API</Txt>
        <TextInput
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          accessibilityLabel="API URL"
          style={{ minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space(3), color: colors.ink, backgroundColor: colors.surface2 }}
        />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button label={t("common.save")} onPress={() => setApiUrl(url.trim() || null)} disabled={!/^https?:\/\/\S+$/.test(url.trim())} />
          <Button variant="ghost" label={t("common.clear")} onPress={() => (setApiUrl(null), setUrl(""))} />
        </View>
      </Card>

      <Card>
        <Txt variant="h2">{t("about.title")}</Txt>
        <Txt variant="small">{t("about.mission")}</Txt>
        <Txt style={{ fontWeight: "600" }}>{t("about.nameTitle")}</Txt>
        <Txt variant="small">{t("about.name")}</Txt>
        <Txt style={{ fontWeight: "600" }}>{t("about.forTitle")}</Txt>
        <Txt variant="small">{t("about.for")}</Txt>
        <Txt style={{ fontWeight: "600" }}>{t("about.privacyTitle")}</Txt>
        <Txt variant="small">{t("about.privacy")}</Txt>
        <Txt style={{ fontWeight: "600" }}>{t("about.safetyTitle")}</Txt>
        <Txt variant="small">{t("about.safety")}</Txt>
        <Txt variant="muted">
          {brandName()} · {t("about.version", { version: Constants.expoConfig?.version ?? "0.1.0" })} · {t("about.openSource")}
        </Txt>
      </Card>
      <Button variant="danger" icon="trash-outline" label={t("profile.clear")} onPress={clearAll} />
      <Disclaimer />
    </Screen>
  );
}
