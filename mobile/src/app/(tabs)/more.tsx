import { Ionicons } from "@expo/vector-icons";
import { brandName, LOCALE_NAMES, LOCALES, STORAGE_KEYS } from "@vitacite/shared";
import Constants from "expo-constants";
import { router, type Href } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";

import { Button, Card, Chip, Disclaimer, Screen, Txt, type IconName } from "@/components/ui";
import { API_URL_KEY, useSettings } from "@/lib/settings";
import { removeKeys } from "@/lib/storage";
import { radius, space } from "@/lib/theme";

export default function More() {
  const { t, locale, setLocale, themePref, setThemePref, apiUrl, setApiUrl, colors } = useSettings();
  const [url, setUrl] = useState(apiUrl);
  const links: { href: Href; icon: IconName; label: string }[] = [
    { href: "/plan", icon: "checkbox-outline", label: t("nav.plan") },
    { href: "/profile", icon: "person-circle-outline", label: t("nav.profile") },
    { href: "/library", icon: "library-outline", label: t("library.title") },
  ];
  const clearAll = () =>
    Alert.alert(t("profile.clear"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          await removeKeys([STORAGE_KEYS.profile, STORAGE_KEYS.plan, STORAGE_KEYS.check, STORAGE_KEYS.conversation, STORAGE_KEYS.locale, STORAGE_KEYS.theme, API_URL_KEY]);
          Alert.alert(t("profile.cleared"));
        },
      },
    ]);
  return (
    <Screen>
      <Txt variant="title">{t("nav.settings")}</Txt>
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
