import { Ionicons } from "@expo/vector-icons";
import {
  formatAuthors,
  highlightQuote,
  LEVEL_STEPS,
  pageLabel,
  sourceLink,
  translateDynamic,
  type Citation,
  type EvidenceLevelId,
  type InsightSummary,
  type PlatformStatus,
  type SafetyAssessment,
} from "@stepwell/shared";
import * as WebBrowser from "expo-web-browser";
import { useState, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSettings } from "@/lib/settings";
import { levelColor, radius, space } from "@/lib/theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export function Txt({ variant = "body", style, ...rest }: TextProps & { variant?: "title" | "h2" | "body" | "small" | "muted" | "label" }) {
  const { colors } = useSettings();
  const base: Record<string, TextStyle> = {
    title: { fontSize: 28, fontWeight: "700", color: colors.ink, letterSpacing: -0.4 },
    h2: { fontSize: 19, fontWeight: "600", color: colors.ink },
    body: { fontSize: 16, lineHeight: 24, color: colors.ink },
    small: { fontSize: 14, lineHeight: 20, color: colors.ink2 },
    muted: { fontSize: 13, lineHeight: 18, color: colors.ink3 },
    label: { fontSize: 14, fontWeight: "600", color: colors.ink2 },
  };
  return <Text maxFontSizeMultiplier={1.8} style={[base[variant], style]} {...rest} />;
}

export function Screen({ children, scroll = true, padded = true }: { children: ReactNode; scroll?: boolean; padded?: boolean }) {
  const { colors } = useSettings();
  const content = <View style={[padded && { padding: space(4), gap: space(4) }, { paddingBottom: space(10) }]}>{children}</View>;
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{content}</ScrollView> : children}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useSettings();
  return (
    <View style={[{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: space(4), gap: space(2) }, style]}>
      {children}
    </View>
  );
}

/** Icons that point along the reading direction are mirrored in right-to-left languages. */
const MIRRORED = new Set<string>(["chevron-forward", "chevron-back", "arrow-forward", "arrow-back", "send"]);
export function mirrorStyle(rtl: boolean, name: string) {
  return rtl && MIRRORED.has(name) ? { transform: [{ scaleX: -1 }] } : undefined;
}

/** Lays a subtree out right to left for Arabic. Modals are separate roots, so each one applies it too. */
export function directionStyle(rtl: boolean) {
  return rtl ? ({ direction: "rtl" } as const) : undefined;
}

export function Button({
  label,
  onPress,
  icon,
  variant = "primary",
  disabled,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors, rtl } = useSettings();
  const primary = variant === "primary";
  const fg = primary ? colors.onBrand : variant === "danger" ? colors.critical : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: space(2),
        paddingHorizontal: space(4),
        borderRadius: radius.pill,
        backgroundColor: primary ? colors.brand : "transparent",
        borderWidth: primary ? 0 : 1,
        borderColor: variant === "danger" ? colors.critical : colors.border,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {icon ? <Ionicons name={icon} size={18} color={fg} style={mirrorStyle(rtl, icon)} /> : null}
      <Text style={{ color: fg, fontWeight: "600", fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, icon, selected, onPress }: { label: string; icon?: IconName; selected?: boolean; onPress?: () => void }) {
  const { colors } = useSettings();
  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: space(3),
        paddingVertical: 6,
        borderRadius: radius.pill,
        backgroundColor: selected ? colors.brandSoft : colors.surface2,
        borderWidth: 1,
        borderColor: selected ? colors.brand : colors.border,
      }}
    >
      {icon ? <Ionicons name={icon} size={13} color={colors.ink2} /> : null}
      <Text style={{ fontSize: 13, color: selected ? colors.ink : colors.ink2, fontWeight: "500" }}>{label}</Text>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!selected }} hitSlop={6}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function EvidenceMeter({ level, size = 1 }: { level: EvidenceLevelId; size?: number }) {
  const { scheme, colors } = useSettings();
  const filled = LEVEL_STEPS[level];
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2 }} accessible={false}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            width: 7 * size,
            height: (6 + i * 3) * size,
            borderRadius: 2,
            backgroundColor: i < filled ? levelColor(scheme, level) : colors.track,
          }}
        />
      ))}
    </View>
  );
}

export function EvidenceBadge({ level, grade, compact }: { level: EvidenceLevelId; grade: string; compact?: boolean }) {
  const { t, colors } = useSettings();
  const label = t(`levels.${level}`);
  const gradeText = level === "insufficient" || !grade ? "" : t("levels.gradeLabel", { grade });
  return (
    <View
      accessible
      accessibilityLabel={`${gradeText ? `${gradeText}, ` : ""}${label}`}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
    >
      <EvidenceMeter level={level} />
      <Text style={{ color: colors.ink, fontWeight: "600", fontSize: 13 }}>
        {!compact && gradeText ? <Text style={{ color: colors.ink2 }}>{gradeText} · </Text> : null}
        {label}
      </Text>
    </View>
  );
}

export function SupportMeter({ citation }: { citation: Citation }) {
  const { t, colors, scheme } = useSettings();
  const pct = Math.round((citation.support ?? 0) * 100);
  const color = citation.support_label === "strong" ? levelColor(scheme, "high") : levelColor(scheme, "low");
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ width: 56, height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: "hidden" }}>
        <View style={{ width: `${pct}%`, height: 6, backgroundColor: color }} />
      </View>
      <Txt variant="muted">{t(`insights.support.${citation.support_label}`)}</Txt>
    </View>
  );
}

export function CitationCard({ citation, onDocument }: { citation: Citation; onDocument?: () => void }) {
  const { t, colors } = useSettings();
  const [open, setOpen] = useState(false);
  const s = citation.source;
  const link = sourceLink(s);
  const [before, quote, after] = highlightQuote(citation);
  const page = pageLabel(citation);
  return (
    <Card>
      <View style={{ flexDirection: "row", gap: space(3) }}>
        <View style={{ minWidth: 24, height: 22, borderRadius: 6, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.brand, fontWeight: "700", fontSize: 12 }}>{citation.n}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt style={{ fontWeight: "600" }}>{s.title}</Txt>
          <Txt variant="small">{[formatAuthors(s.authors), s.journal || s.publisher, s.year].filter(Boolean).join(" · ")}</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
            <Chip label={translateDynamic(t, "designs", s.source_type)} />
            <Chip label={translateDynamic(t, "credibility", s.credibility)} />
            {page ? <Chip label={t("insights.page", { page })} /> : null}
          </View>
        </View>
      </View>
      <View style={{ borderStartWidth: 2, borderStartColor: colors.series, paddingStart: space(3), marginTop: space(1) }}>
        <Txt accessibilityLabel={`${t("insights.quote")}: ${citation.quote}`}>“{citation.quote}”</Txt>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <SupportMeter citation={citation} />
        <View style={{ flexDirection: "row", gap: space(4) }}>
          {citation.passage && citation.passage !== citation.quote ? (
            <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" hitSlop={8}>
              <Txt style={{ color: colors.brand, fontWeight: "600", fontSize: 14 }}>{t("insights.context")}</Txt>
            </Pressable>
          ) : null}
          {onDocument ? (
            <Pressable onPress={onDocument} accessibilityRole="link" hitSlop={8}>
              <Txt style={{ color: colors.brand, fontWeight: "600", fontSize: 14 }}>{t("library.passages")}</Txt>
            </Pressable>
          ) : null}
          {link ? (
            <Pressable onPress={() => void WebBrowser.openBrowserAsync(link)} accessibilityRole="link" hitSlop={8}>
              <Txt style={{ color: colors.brand, fontWeight: "600", fontSize: 14 }}>{t("insights.openSource")}</Txt>
            </Pressable>
          ) : null}
        </View>
      </View>
      {open ? (
        <View style={{ backgroundColor: colors.surface2, borderRadius: radius.md, padding: space(3) }}>
          <Txt variant="small">
            {before}
            <Text style={{ backgroundColor: colors.brandSoft, color: colors.ink }}>{quote}</Text>
            {after}
          </Txt>
        </View>
      ) : null}
    </Card>
  );
}

export function SafetyBanner({ safety }: { safety: SafetyAssessment }) {
  const { t, colors } = useSettings();
  if (safety.level === "none" || !safety.notices.length) return null;
  const severe = safety.level === "emergency" || safety.level === "urgent";
  const title = safety.level === "emergency" ? t("ask.emergencyTitle") : safety.level === "urgent" ? t("ask.urgentTitle") : t("ask.cautionTitle");
  return (
    <View
      accessibilityRole="alert"
      style={{ borderRadius: radius.lg, borderWidth: 1, padding: space(4), gap: space(2), borderColor: severe ? colors.critical : colors.warning, backgroundColor: severe ? colors.criticalSoft : colors.warningSoft }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name={severe ? "alert-circle" : "warning"} size={20} color={severe ? colors.critical : colors.warningInk} />
        <Txt style={{ fontWeight: "700", color: severe ? colors.critical : colors.warningInk }}>{title}</Txt>
      </View>
      {safety.notices.map((n) => (
        <Txt key={n.rule}>{n.message}</Txt>
      ))}
      {safety.resources.length ? (
        <View style={{ gap: 4, marginTop: 4 }}>
          <Txt variant="label">{t("ask.crisisResources")}</Txt>
          {safety.resources.map((r) => (
            <View key={r.name} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <Ionicons name="call" size={16} color={colors.ink} />
              <Txt style={{ fontWeight: "700", flexShrink: 1 }}>
                {r.contact} <Txt variant="small">— {r.name}</Txt>
              </Txt>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function InsightRow({ insight, onPress }: { insight: InsightSummary; onPress: () => void }) {
  const { t, colors, rtl } = useSettings();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <Txt variant="muted" style={{ textTransform: "uppercase", fontWeight: "600", letterSpacing: 0.4, flexShrink: 1 }}>
            {translateDynamic(t, "categories", insight.category)}
          </Txt>
          <EvidenceBadge level={insight.evidence_level} grade={insight.evidence_grade} compact />
        </View>
        <Txt variant="h2">{insight.title}</Txt>
        <Txt variant="small" numberOfLines={3}>
          {insight.summary}
        </Txt>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Txt variant="muted">{insight.n_sources === 1 ? t("common.source") : t("common.sources", { n: insight.n_sources })}</Txt>
          <Ionicons name="chevron-forward" size={18} color={colors.ink3} style={mirrorStyle(rtl, "chevron-forward")} />
        </View>
      </Card>
    </Pressable>
  );
}

export function StatusCard({ status }: { status: PlatformStatus }) {
  const { t, colors } = useSettings();
  if (status.data_status === "ready") {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.good }} />
        <Txt variant="small">{t("status.ready", { documents: status.documents, insights: status.insights })}</Txt>
      </View>
    );
  }
  return (
    <Card style={{ flexDirection: "row", gap: space(3), alignItems: "flex-start" }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="server-outline" size={22} color={colors.brand} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Txt style={{ fontWeight: "600" }}>{t("status.awaitingTitle")}</Txt>
        <Txt variant="small">
          {status.data_status === "indexing" && status.active_job
            ? t("status.indexing", { progress: `${Math.round(status.active_job.progress * 100)}%` })
            : t("status.awaitingBody")}
        </Txt>
      </View>
    </Card>
  );
}

export function Loading() {
  const { colors } = useSettings();
  return <ActivityIndicator color={colors.brand} style={{ marginTop: space(6) }} />;
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t, colors } = useSettings();
  return (
    <Card style={{ flexDirection: "row", gap: space(3), alignItems: "center" }}>
      <Ionicons name="cloud-offline-outline" size={22} color={colors.warningInk} />
      <View style={{ flex: 1, gap: 6 }}>
        <Txt variant="small">{message}</Txt>
        {onRetry ? (
          <Pressable onPress={onRetry} accessibilityRole="button">
            <Txt style={{ color: colors.brand, fontWeight: "600" }}>{t("common.retry")}</Txt>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

export function Disclaimer() {
  const { t, colors } = useSettings();
  return (
    <View style={{ flexDirection: "row", gap: 8, backgroundColor: colors.surface2, borderRadius: radius.md, padding: space(3) }}>
      <Ionicons name="information-circle-outline" size={18} color={colors.ink2} />
      <Txt variant="small" style={{ flex: 1 }}>
        {t("disclaimer.short")}
      </Txt>
    </View>
  );
}
