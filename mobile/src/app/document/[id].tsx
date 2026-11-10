import { formatAuthors, sourceLink, translateDynamic } from "@stepwell/shared";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { View } from "react-native";

import { Button, Card, Chip, ErrorNote, Loading, Screen, Txt } from "@/components/ui";
import { useSettings } from "@/lib/settings";
import { space } from "@/lib/theme";
import { useApi } from "@/lib/useApi";

export default function DocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, api, colors } = useSettings();
  const res = useApi(() => api.document(String(id)), [api, id]);
  const [shown, setShown] = useState(6);
  if (res.loading && !res.data) return <Loading />;
  if (!res.data) return <ErrorNote message={res.error ?? t("common.error")} onRetry={res.reload} />;
  const doc = res.data;
  const link = sourceLink(doc);
  const basis = doc.source_type_basis ?? "none";
  return (
    <Screen>
      <Txt variant="title">{doc.title}</Txt>
      <Txt variant="small">{[formatAuthors(doc.authors), doc.journal || doc.publisher, doc.year].filter(Boolean).join(" · ")}</Txt>
      {doc.retracted ? (
        <Card style={{ borderColor: colors.critical, backgroundColor: colors.criticalSoft }}>
          <Txt style={{ color: colors.critical, fontWeight: "700" }}>{t("library.retracted")}</Txt>
        </Card>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Chip label={translateDynamic(t, "designs", doc.source_type)} />
        <Chip label={translateDynamic(t, "credibility", doc.credibility)} />
        <Chip label={`${t("library.quality")}: ${Math.round(doc.quality_score * 100)}`} />
        <Chip label={doc.language.toUpperCase()} />
      </View>
      <Txt variant="muted">{t("library.classifiedBy", { basis: translateDynamic(t, "library.basis", basis) })}</Txt>
      {link ? <Button variant="ghost" icon="open-outline" label={t("insights.openSource")} onPress={() => void WebBrowser.openBrowserAsync(link)} /> : null}
      {doc.abstract ? (
        <Card>
          <Txt variant="label">{t("library.abstract")}</Txt>
          <Txt>{doc.abstract}</Txt>
        </Card>
      ) : null}
      {doc.cited_by.length ? (
        <Card>
          <Txt variant="label">{t("library.citedBy")}</Txt>
          {doc.cited_by.map((i) => (
            <Button key={i.id} variant="ghost" icon="sparkles-outline" label={i.title} onPress={() => router.push(`/insight/${encodeURIComponent(i.id)}`)} />
          ))}
        </Card>
      ) : null}
      <Txt variant="h2">
        {t("library.passages")} ({doc.chunks.length})
      </Txt>
      {doc.chunks.slice(0, shown).map((c) => (
        <Card key={c.id}>
          {c.section || c.page_start ? (
            <Txt variant="muted">{[c.section, c.page_start ? t("insights.page", { page: c.page_start }) : null].filter(Boolean).join(" · ")}</Txt>
          ) : null}
          <Txt variant="small" style={{ color: colors.ink }}>
            {c.text}
          </Txt>
        </Card>
      ))}
      {shown < doc.chunks.length ? <Button variant="ghost" label={t("common.viewAll")} onPress={() => setShown(doc.chunks.length)} /> : null}
      <View style={{ height: space(4) }} />
    </Screen>
  );
}
