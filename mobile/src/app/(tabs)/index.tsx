import { Ionicons } from "@expo/vector-icons";
import { brandName } from "@vitacite/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { Button, Card, Disclaimer, ErrorNote, InsightRow, Screen, StatusCard, Txt, type IconName } from "@/components/ui";
import { useSettings } from "@/lib/settings";
import { radius, space } from "@/lib/theme";
import { useApi } from "@/lib/useApi";

export default function Home() {
  const { t, api, locale, colors } = useSettings();
  const [q, setQ] = useState("");
  const status = useApi(() => api.status(), [api]);
  const featured = useApi(() => api.insights({ lang: locale, page_size: 4 }), [api, locale]);
  const paths: { key: "prevention" | "living" | "caregivers"; icon: IconName }[] = [
    { key: "prevention", icon: "leaf-outline" },
    { key: "living", icon: "heart-outline" },
    { key: "caregivers", icon: "people-outline" },
  ];
  const ask = () => {
    if (!q.trim()) return;
    router.push({ pathname: "/ask", params: { q: q.trim() } });
    setQ("");
  };
  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
          <Txt style={{ color: colors.onBrand, fontWeight: "800" }}>V</Txt>
        </View>
        <Txt variant="h2">{brandName()}</Txt>
      </View>
      <View style={{ gap: space(2) }}>
        <Txt style={{ color: colors.brand, fontWeight: "600" }}>{t("app.tagline")}</Txt>
        <Txt variant="title">{t("home.heroTitle")}</Txt>
        <Txt variant="small">{t("home.heroSubtitle")}</Txt>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingLeft: space(4), paddingRight: 6, paddingVertical: 6 }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t("home.askPlaceholder")}
          placeholderTextColor={colors.ink3}
          style={{ flex: 1, fontSize: 16, color: colors.ink, minHeight: 40 }}
          returnKeyType="send"
          onSubmitEditing={ask}
          accessibilityLabel={t("ask.placeholder")}
        />
        <Pressable onPress={ask} accessibilityRole="button" accessibilityLabel={t("ask.send")} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="send" size={18} color={colors.onBrand} />
        </Pressable>
      </View>
      {status.data ? <StatusCard status={status.data} /> : status.error ? <ErrorNote message={status.error} onRetry={status.reload} /> : null}

      <Txt variant="h2">{t("home.pathsTitle")}</Txt>
      {paths.map((p) => (
        <Pressable key={p.key} onPress={() => router.push({ pathname: "/insights", params: { audience: p.key === "living" ? "living_with_cancer" : p.key } })} accessibilityRole="button">
          <Card style={{ flexDirection: "row", gap: space(3), alignItems: "center" }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={p.icon} size={22} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt style={{ fontWeight: "600" }}>{t(`home.${p.key}Title`)}</Txt>
              <Txt variant="small">{t(`home.${p.key}Body`)}</Txt>
            </View>
          </Card>
        </Pressable>
      ))}

      {featured.data?.items.length ? (
        <>
          <Txt variant="h2">{t("home.featured")}</Txt>
          {featured.data.items.map((insight) => (
            <InsightRow key={insight.id} insight={insight} onPress={() => router.push(`/insight/${encodeURIComponent(insight.id)}`)} />
          ))}
        </>
      ) : null}

      <Card>
        <Txt style={{ fontWeight: "600" }}>{t("home.checkTitle")}</Txt>
        <Txt variant="small">{t("home.checkBody")}</Txt>
        <Button label={t("home.checkCta")} icon="clipboard-outline" onPress={() => router.push("/check")} />
      </Card>
      <Disclaimer />
    </Screen>
  );
}
