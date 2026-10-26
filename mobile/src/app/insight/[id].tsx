import { Ionicons } from "@expo/vector-icons";
import {
  addToPlan,
  formatDate,
  insightSpeech,
  planItemId,
  sortedDesigns,
  splitCitations,
  STORAGE_KEYS,
  translateDynamic,
  type Insight,
  type InsightPoint,
  type Locale,
  type OfflinePack,
  type PlanItem,
} from "@stepwell/shared";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Share, Text, View } from "react-native";

import { Feedback } from "@/components/Feedback";
import { AddQuestionButton, OfflineBanner } from "@/components/personal";
import { ReadAloud } from "@/components/ReadAloud";
import { Button, Card, Chip, CitationCard, Disclaimer, ErrorNote, EvidenceBadge, EvidenceMeter, Loading, Screen, Txt } from "@/components/ui";
import { readOfflinePack } from "@/lib/offline";
import { useSettings } from "@/lib/settings";
import { useStored } from "@/lib/storage";
import { levelColor, space } from "@/lib/theme";
import { useApi } from "@/lib/useApi";

function PointText({ point }: { point: InsightPoint }) {
  const { colors, t } = useSettings();
  const partial = point.label === "partial";
  return (
    <Txt
      style={partial ? { textDecorationLine: "underline", textDecorationColor: colors.warning } : undefined}
      accessibilityHint={partial ? t("ask.claimPartial") : undefined}
    >
      {point.text}
      {point.citations.map((n) => (
        <Text key={n} style={{ color: colors.brand, fontWeight: "700", fontSize: 13 }}>
          {" "}[{n}]
        </Text>
      ))}
    </Txt>
  );
}

function DesignBars({ insight }: { insight: Insight }) {
  const { t, colors, scheme } = useSettings();
  const rows = sortedDesigns(insight.evidence.design_breakdown);
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <View style={{ gap: 8 }} accessibilityLabel={rows.map((r) => `${translateDynamic(t, "designs", r.id)}: ${r.count}`).join(", ")}>
      {rows.map((r) => (
        <View key={r.id} style={{ gap: 2 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Txt variant="small">{translateDynamic(t, "designs", r.id)}</Txt>
            <Txt variant="small" style={{ fontWeight: "700", color: colors.ink }}>
              {r.count}
            </Txt>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.track }}>
            <View style={{ height: 8, width: `${(r.count / max) * 100}%`, borderRadius: 4, backgroundColor: levelColor(scheme, "moderate") }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** The saved offline copy of an insight, used only when the live one cannot be loaded. */
function useOfflineInsight(id: string, locale: Locale, wanted: boolean): { insight: Insight; savedAt: string } | null {
  const [pack, setPack] = useState<OfflinePack | null>(null);
  useEffect(() => {
    if (wanted) void readOfflinePack((id.split(".").pop() as Locale) || locale).then(setPack);
  }, [id, locale, wanted]);
  const insight = pack?.insights[id];
  return insight && pack ? { insight, savedAt: pack.saved_at } : null;
}

export default function InsightScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, api, locale, colors } = useSettings();
  const res = useApi(() => api.insight(String(id)), [api, id]);
  const [plan, setPlan, planLoaded] = useStored<PlanItem[]>(STORAGE_KEYS.plan, []);
  const offline = useOfflineInsight(String(id), locale, !res.loading && !res.data);
  if (res.loading && !res.data) return <Loading />;
  if (!res.data && !offline) return <ErrorNote message={res.error ?? t("common.error")} onRetry={res.reload} />;
  const insight = res.data ?? offline!.insight;
  const ev = insight.evidence;
  const summary = splitCitations(insight.summary).map((s) => s.text).join("");
  return (
    <Screen>
      <Stack.Screen
        options={{
          title: translateDynamic(t, "categories", insight.category),
          headerRight: () => (
            <Ionicons
              name="share-outline"
              size={22}
              color={colors.brand}
              accessibilityLabel={t("common.share")}
              onPress={() =>
                void Share.share({
                  message: `${insight.title}\n\n${summary}\n\n${insight.citations.map((c) => `[${c.n}] ${c.source.title}`).join("\n")}`,
                })
              }
            />
          ),
        }}
      />
      {!res.data && offline ? <OfflineBanner savedAt={offline.savedAt} /> : null}
      <Txt variant="title">{insight.title}</Txt>
      <Txt variant="small">{insight.question}</Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <EvidenceBadge level={insight.evidence_level} grade={insight.evidence_grade} />
        <Chip label={ev.n_sources === 1 ? t("common.source") : t("common.sources", { n: ev.n_sources })} />
        {insight.audience.map((a) => (
          <Chip key={a} label={t(`audiences.${a}`)} />
        ))}
        {insight.reviewed_at ? <Chip icon="shield-checkmark-outline" label={t("insights.reviewed", { date: formatDate(locale, insight.reviewed_at) })} /> : null}
      </View>
      {insight.status === "published" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <ReadAloud text={insightSpeech(insight, t)} />
          <AddQuestionButton title={insight.title} />
        </View>
      ) : null}
      {summary ? <Txt style={{ fontSize: 17, lineHeight: 26 }}>{summary}</Txt> : null}

      {insight.key_points.length ? (
        <>
          <Txt variant="h2">{t("insights.keyPoints")}</Txt>
          {insight.key_points.map((p, i) => (
            <Card key={i} style={{ flexDirection: "row", gap: space(3) }}>
              <Ionicons name="checkmark" size={18} color={colors.brand} style={{ marginTop: 3 }} />
              <View style={{ flex: 1 }}>
                <PointText point={p} />
              </View>
            </Card>
          ))}
        </>
      ) : null}

      {insight.recommendations.length ? (
        <>
          <Txt variant="h2">{t("insights.recommendations")}</Txt>
          {insight.recommendations.map((p, i) => {
            const inPlan = plan.some((x) => x.id === planItemId(insight.id, p.text));
            return (
              <Card key={i}>
                <PointText point={p} />
                <Button
                  variant={inPlan ? "ghost" : "primary"}
                  icon={inPlan ? "checkmark" : "add"}
                  label={inPlan ? t("insights.inPlan") : t("insights.addToPlan")}
                  disabled={!planLoaded || inPlan}
                  onPress={() =>
                    setPlan((prev) => addToPlan(prev, { insightId: insight.id, insightTitle: insight.title, text: p.text, evidenceLevel: insight.evidence_level }))
                  }
                />
              </Card>
            );
          })}
        </>
      ) : null}

      {insight.limitations.length ? (
        <Card style={{ backgroundColor: colors.surface2 }}>
          <Txt style={{ fontWeight: "600" }}>{t("insights.limitations")}</Txt>
          {insight.limitations.map((l) => (
            <Txt key={l} variant="small">
              • {l}
            </Txt>
          ))}
        </Card>
      ) : null}

      <Card>
        <Txt variant="h2">{t("insights.profile")}</Txt>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <EvidenceMeter level={insight.evidence_level} size={1.5} />
          <View>
            <Txt style={{ fontWeight: "700" }}>{t(`levels.${insight.evidence_level}`)}</Txt>
            <Txt variant="muted">{t("levels.gradeLabel", { grade: insight.evidence_grade })}</Txt>
          </View>
        </View>
        <Txt style={{ fontWeight: "600", marginTop: space(2) }}>{t("insights.whyGrade")}</Txt>
        {ev.rationale.map((r) => (
          <Txt key={r.code} variant="small">
            • {r.text}
          </Txt>
        ))}
        <Txt style={{ fontWeight: "600", marginTop: space(2) }}>{t("insights.designs")}</Txt>
        <DesignBars insight={insight} />
        {ev.year_range ? (
          <Txt variant="muted">
            {t("insights.timeline")}: {ev.year_range[0]}–{ev.year_range[1]}
          </Txt>
        ) : null}
        <Button variant="ghost" icon="school-outline" label={t("nav.methodology")} onPress={() => router.push("/methodology")} />
      </Card>

      <Txt variant="h2">{t("insights.sourcesTitle")}</Txt>
      {insight.citations.map((c) => (
        <CitationCard key={c.n} citation={c} onDocument={() => router.push(`/document/${encodeURIComponent(c.source.document_id)}`)} />
      ))}

      <Feedback targetType="insight" targetId={insight.id} />
      <Button variant="ghost" icon="chatbubbles-outline" label={t("insights.askFollowUp")} onPress={() => router.push({ pathname: "/ask", params: { q: insight.question } })} />
      <Txt variant="muted">
        {t("insights.aiGenerated")} {t("insights.generated", { date: formatDate(locale, insight.generated_at), version: insight.version })} · {insight.model}
      </Txt>
      <Disclaimer />
    </Screen>
  );
}
