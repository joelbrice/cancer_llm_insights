import { formatAuthors, translateDynamic, type DocumentQuery } from "@vitacite/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";

import { Card, Chip, ErrorNote, Loading, Screen, Txt } from "@/components/ui";
import { useSettings } from "@/lib/settings";
import { radius, space } from "@/lib/theme";
import { useApi } from "@/lib/useApi";

export default function Library() {
  const { t, api, colors } = useSettings();
  const [q, setQ] = useState("");
  const [type, setType] = useState<string | undefined>();
  const [sort, setSort] = useState<NonNullable<DocumentQuery["sort"]>>("quality");
  const res = useApi(() => api.documents({ q: q || undefined, source_type: type, sort, page_size: 50 }), [api, q, type, sort]);
  const facets = Object.entries(res.data?.facets.source_type ?? {}).sort((a, b) => b[1] - a[1]);
  return (
    <Screen>
      <Txt variant="small">{t("library.subtitle")}</Txt>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder={t("common.search")}
        placeholderTextColor={colors.ink3}
        returnKeyType="search"
        accessibilityLabel={t("common.search")}
        style={{ minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space(3), color: colors.ink, backgroundColor: colors.surface, fontSize: 16 }}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label={t("common.all")} selected={!type} onPress={() => setType(undefined)} />
        {facets.map(([id, n]) => (
          <Chip key={id} label={`${translateDynamic(t, "designs", id)} · ${n}`} selected={type === id} onPress={() => setType(id)} />
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Txt variant="muted">{t("library.sort")}:</Txt>
        {(["quality", "year", "title"] as const).map((s) => (
          <Chip key={s} label={t(s === "quality" ? "library.sortQuality" : s === "year" ? "library.sortYear" : "library.sortTitle")} selected={sort === s} onPress={() => setSort(s)} />
        ))}
      </View>
      {res.loading && !res.data ? <Loading /> : null}
      {res.error ? <ErrorNote message={res.error} onRetry={res.reload} /> : null}
      {res.data && !res.data.items.length ? (
        <Card>
          <Txt>{t("library.empty")}</Txt>
        </Card>
      ) : null}
      {res.data?.items.map((d) => (
        <Pressable key={d.id} onPress={() => router.push(`/document/${encodeURIComponent(d.id)}`)} accessibilityRole="link">
          <Card>
            <Txt style={{ fontWeight: "600" }}>{d.title}</Txt>
            <Txt variant="small">{[formatAuthors(d.authors), d.journal || d.publisher, d.year].filter(Boolean).join(" · ")}</Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <Chip label={translateDynamic(t, "designs", d.source_type)} />
              <Chip label={translateDynamic(t, "credibility", d.credibility)} />
              {d.retracted ? <Chip icon="warning-outline" label={t("library.retracted")} /> : null}
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
