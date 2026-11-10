import { formatNumber, type Cell, type MessageKey } from "@stepwell/shared";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { Card, Chip, ErrorNote, Loading, Screen, Txt } from "@/components/ui";
import { useSettings } from "@/lib/settings";
import { useApi } from "@/lib/useApi";

/** Public quarterly community moderation report: aggregate counts only, small numbers suppressed. */
export default function Transparency() {
  const { t, api, locale } = useSettings();
  const [quarter, setQuarter] = useState<string | undefined>();
  const report = useApi(() => api.transparency(quarter), [api, quarter]);
  if (report.loading && !report.data) return <Loading />;
  if (!report.data) return <ErrorNote message={report.error ?? t("common.error")} onRetry={report.reload} />;
  const r = report.data;
  const n = (v: Cell) => (v === null ? t("transparency.fewer", { n: r.min_cell }) : formatNumber(locale, v));
  const hours = (v: number | null) => (v === null ? t("transparency.notEnough") : t("transparency.hours", { n: formatNumber(locale, v) }));
  const reason = (code: string) => {
    const key = `transparency.reasons.${code}` as MessageKey;
    const text = t(key);
    return text === key ? t("transparency.reasons.other") : text;
  };
  const Row = ({ label, value }: { label: string; value: string }) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }} accessible accessibilityLabel={`${label}: ${value}`}>
      <Txt variant="small" style={{ flex: 1 }}>
        {label}
      </Txt>
      <Txt style={{ fontWeight: "700" }}>{value}</Txt>
    </View>
  );
  const Breakdown = ({ title, rows }: { title: string; rows: Record<string, Cell> }) => (
    <Card>
      <Txt variant="label">{title}</Txt>
      {Object.keys(rows).length ? (
        Object.entries(rows)
          .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
          .map(([code, v]) => <Row key={code} label={reason(code)} value={n(v)} />)
      ) : (
        <Txt variant="small">{t("transparency.none")}</Txt>
      )}
    </Card>
  );
  const pct = (v: number) => `${Math.round(v * 100)} %`;

  return (
    <Screen>
      <Txt variant="small">{t("transparency.subtitle")}</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {r.available.map((q) => (
          <Chip key={q} label={q} selected={q === r.quarter} onPress={() => setQuarter(q)} />
        ))}
      </ScrollView>
      {!r.complete ? <Txt variant="muted">{t("transparency.inProgress")}</Txt> : null}
      <Card>
        <Txt variant="h2">
          {t("transparency.activity")} · {r.quarter}
        </Txt>
        <Row label={t("transparency.submitted")} value={n(r.posts.submitted)} />
        <Row label={t("transparency.held")} value={n(r.posts.held_for_review)} />
        <Row label={t("transparency.returned")} value={n(r.posts.returned_to_author)} />
        <Row label={t("transparency.hidden")} value={n(r.posts.hidden_after_reports)} />
      </Card>
      <Breakdown title={t("transparency.heldByReason")} rows={r.held_by_reason} />
      <Breakdown title={t("transparency.returnedByReason")} rows={r.returned_by_reason} />
      <Breakdown title={t("transparency.reportsByReason")} rows={r.reports_by_reason} />
      <Card>
        <Txt variant="h2">{t("transparency.decisions")}</Txt>
        <Row label={t("transparency.approved")} value={n(r.decisions.approved)} />
        <Row label={t("transparency.removed")} value={n(r.decisions.removed)} />
        <Row label={t("transparency.medianHours")} value={hours(r.decisions.median_hours_to_decision)} />
        <Row label={t("transparency.medianSafety")} value={hours(r.decisions.median_hours_safety_items)} />
      </Card>
      <Card>
        <Txt variant="h2">{t("transparency.appeals")}</Txt>
        <Row label={t("transparency.appealsReceived")} value={n(r.appeals.received)} />
        <Row label={t("transparency.overturned")} value={n(r.appeals.overturned)} />
        <Row label={t("transparency.upheld")} value={n(r.appeals.upheld)} />
        <Row label={t("transparency.suspensions")} value={n(r.suspensions)} />
      </Card>
      <Card>
        <Txt variant="h2">{t("transparency.feltSupported")}</Txt>
        <Txt variant="small">
          {r.felt_supported
            ? t("transparency.feltSupportedValue", {
                yes: pct(r.felt_supported.yes),
                somewhat: pct(r.felt_supported.somewhat),
                no: pct(r.felt_supported.no),
                n: formatNumber(locale, r.felt_supported.responses),
              })
            : t("transparency.notEnough")}
        </Txt>
      </Card>
      <Txt variant="muted">{t("transparency.method", { n: r.min_cell })}</Txt>
    </Screen>
  );
}
