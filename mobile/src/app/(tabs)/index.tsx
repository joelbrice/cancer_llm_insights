import { Ionicons } from "@expo/vector-icons";
import { brandName, type Audience } from "@stepwell/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, TextInput, View } from "react-native";

import { Button, Card, Disclaimer, ErrorNote, InsightRow, mirrorStyle, Screen, StatusCard, Txt, type IconName } from "@/components/ui";
import { useSettings } from "@/lib/settings";
import { radius, space } from "@/lib/theme";
import { useApi } from "@/lib/useApi";

export default function Home() {
  const { t, api, locale, colors, rtl } = useSettings();
  const [q, setQ] = useState("");
  const status = useApi(() => api.status(), [api]);
  const featured = useApi(() => api.insights({ lang: locale, page_size: 4 }), [api, locale]);
  const paths: { key: "prevention" | "treatment" | "after" | "caregivers"; audience: Audience; icon: IconName }[] = [
    { key: "prevention", audience: "prevention", icon: "leaf-outline" },
    { key: "treatment", audience: "in_treatment", icon: "heart-outline" },
    { key: "after", audience: "after_treatment", icon: "sunny-outline" },
    { key: "caregivers", audience: "caregivers", icon: "people-outline" },
  ];
  const ask = () => {
    if (!q.trim()) return;
    router.push({ pathname: "/ask", params: { q: q.trim() } });
    setQ("");
  };
  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Image source={require("../../../assets/icon.png")} style={{ width: 34, height: 34, borderRadius: 9 }} accessibilityIgnoresInvertColors />
        <View>
          <Txt variant="h2">{brandName()}</Txt>
          <Txt variant="muted">{t("app.descriptor")}</Txt>
        </View>
      </View>
      <View style={{ gap: space(2) }}>
        <Txt style={{ color: colors.brand, fontWeight: "600" }}>{t("app.tagline")}</Txt>
        <Txt variant="title">{t("home.heroTitle")}</Txt>
        <Txt variant="small">{t("home.heroSubtitle")}</Txt>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingStart: space(4), paddingEnd: 6, paddingVertical: 6 }}>
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
          <Ionicons name="send" size={18} color={colors.onBrand} style={mirrorStyle(rtl, "send")} />
        </Pressable>
      </View>
      {status.data ? <StatusCard status={status.data} /> : status.error ? <ErrorNote message={status.error} onRetry={status.reload} /> : null}

      <Txt variant="h2">{t("home.pathsTitle")}</Txt>
      {paths.map((p) => (
        <Pressable key={p.key} onPress={() => router.push({ pathname: "/insights", params: { audience: p.audience } })} accessibilityRole="button">
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

      <Card style={{ backgroundColor: colors.brandSoft, borderColor: colors.brandSoft }}>
        <View style={{ flexDirection: "row", gap: space(3), alignItems: "center" }}>
          <Ionicons name="people" size={26} color={colors.brand} />
          <Txt variant="h2" style={{ flex: 1 }}>
            {t("home.communityTitle")}
          </Txt>
        </View>
        <Txt variant="small">{t("home.communityBody")}</Txt>
        <Button label={t("home.communityCta")} icon="people-outline" onPress={() => router.push("/community")} />
      </Card>

      <Card>
        <Txt style={{ fontWeight: "600" }}>{t("home.checkTitle")}</Txt>
        <Txt variant="small">{t("home.checkBody")}</Txt>
        <Button label={t("home.checkCta")} icon="clipboard-outline" onPress={() => router.push("/check")} />
      </Card>
      <Disclaimer />
    </Screen>
  );
}
