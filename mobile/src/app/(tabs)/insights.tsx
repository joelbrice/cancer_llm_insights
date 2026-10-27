import { DICTIONARIES, translateDynamic, type Audience, type OfflinePack } from "@stepwell/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";

import { OfflineBanner } from "@/components/personal";
import { Card, Chip, ErrorNote, InsightRow, Loading, Screen, StatusCard, Txt } from "@/components/ui";
import { readOfflinePack } from "@/lib/offline";
import { useSettings } from "@/lib/settings";
import { radius, space } from "@/lib/theme";
import { useApi } from "@/lib/useApi";

export default function Insights() {
  const { t, api, locale, colors } = useSettings();
  const params = useLocalSearchParams<{ audience?: string }>();
  const [category, setCategory] = useState<string | undefined>();
  const [q, setQ] = useState("");
  const audience = params.audience as Audience | undefined;
  const list = useApi(() => api.insights({ lang: locale, category, audience, q: q || undefined, page_size: 50 }), [api, locale, category, audience, q]);
  const status = useApi(() => api.status(), [api]);
  // offline: fall back to the saved pack (filtered locally like the live list)
  const [pack, setPack] = useState<OfflinePack | null>(null);
  useEffect(() => {
    if (list.error) void readOfflinePack(locale).then(setPack);
  }, [list.error, locale]);
  const needle = q.trim().toLowerCase();
  const saved = list.error && pack
    ? pack.list.filter(
        (i) =>
          (!category || i.category === category) &&
          (!audience || i.audience.includes(audience)) &&
          (!needle || `${i.title} ${i.question} ${i.summary}`.toLowerCase().includes(needle)),
      )
    : null;
  const categories = Object.keys(DICTIONARIES.en.categories);
  return (
    <Screen>
      <Txt variant="title">{t("insights.title")}</Txt>
      <Txt variant="small">{t("insights.subtitle")}</Txt>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder={t("insights.searchPlaceholder")}
        placeholderTextColor={colors.ink3}
        style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.md, minHeight: 44, paddingHorizontal: space(3), fontSize: 16, color: colors.ink }}
        accessibilityLabel={t("common.search")}
        returnKeyType="search"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label={t("common.all")} selected={!category} onPress={() => setCategory(undefined)} />
        {categories.map((c) => (
          <Chip key={c} label={translateDynamic(t, "categories", c)} selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </ScrollView>
      {audience ? <Chip label={`${t("insights.audience")}: ${t(`audiences.${audience}`)}`} selected onPress={() => router.setParams({ audience: undefined })} /> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.error && !saved ? <ErrorNote message={list.error} onRetry={list.reload} /> : null}
      {saved && pack ? <OfflineBanner savedAt={pack.saved_at} /> : null}
      {saved?.map((insight) => (
        <InsightRow key={insight.id} insight={insight} onPress={() => router.push(`/insight/${encodeURIComponent(insight.id)}`)} />
      ))}
      {list.data && !list.data.items.length ? (
        <View style={{ gap: space(3) }}>
          {status.data && status.data.data_status !== "ready" ? <StatusCard status={status.data} /> : null}
          <Card>
            <Txt style={{ fontWeight: "600" }}>{category || q ? t("insights.noMatch") : t("insights.emptyTitle")}</Txt>
            {!category && !q ? <Txt variant="small">{t("insights.emptyBody")}</Txt> : null}
          </Card>
        </View>
      ) : null}
      {list.data?.items.map((insight) => (
        <InsightRow key={insight.id} insight={insight} onPress={() => router.push(`/insight/${encodeURIComponent(insight.id)}`)} />
      ))}
    </Screen>
  );
}
