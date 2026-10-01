import { Ionicons } from "@expo/vector-icons";
import { isoWeek, removeFromPlan, STORAGE_KEYS, streak, toggleCheckin, type PlanItem, type Profile } from "@stepwell/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Button, Card, EvidenceBadge, Loading, Screen, Txt } from "@/components/ui";
import { useSettings } from "@/lib/settings";
import { communityMessage, useCommunityToken } from "@/lib/community";
import { readJSON, useStored } from "@/lib/storage";
import { radius } from "@/lib/theme";

export default function Plan() {
  const { t, colors, api, locale } = useSettings();
  const [plan, setPlan, loaded] = useStored<PlanItem[]>(STORAGE_KEYS.plan, []);
  const [token] = useCommunityToken();
  const [shared, setShared] = useState<Record<string, string>>({});
  const share = async (item: PlanItem, weeks: number) => {
    if (!token) return;
    const profile = await readJSON<Profile>(STORAGE_KEYS.profile, {});
    try {
      await api.community.post(token, { circle: profile.audience ?? "prevention", kind: "milestone", body: t("community.milestoneText", { n: weeks, text: item.text }), language: locale }, profile.country ?? null);
      setShared((s) => ({ ...s, [item.id]: t("community.milestoneShared") }));
    } catch (e) {
      setShared((s) => ({ ...s, [item.id]: communityMessage(t, e) }));
    }
  };
  const week = isoWeek();
  if (!loaded) return <Loading />;
  return (
    <Screen>
      <Txt variant="small">{t("plan.subtitle")}</Txt>
      {!plan.length ? (
        <Card>
          <Txt>{t("plan.empty")}</Txt>
          <Button icon="sparkles-outline" label={t("nav.insights")} onPress={() => router.push("/insights")} />
        </Card>
      ) : null}
      {plan.map((item) => {
        const done = item.checkins.includes(week);
        const n = streak(item, week);
        return (
          <Card key={item.id}>
            <Pressable
              onPress={() => setPlan((prev) => toggleCheckin(prev, item.id, week))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done }}
              accessibilityLabel={`${item.text} — ${t("plan.doneThisWeek")}`}
              style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: radius.sm,
                  borderWidth: 2,
                  borderColor: done ? colors.brand : colors.ink3,
                  backgroundColor: done ? colors.brand : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 2,
                }}
              >
                {done ? <Ionicons name="checkmark" size={18} color={colors.onBrand} /> : null}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Txt>{item.text}</Txt>
                <Txt variant="muted">{t("plan.doneThisWeek")}</Txt>
              </View>
            </Pressable>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <EvidenceBadge level={item.evidenceLevel} grade="" compact />
              {n ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="flame" size={14} color={colors.warningInk} />
                  <Txt variant="small">{t("plan.streak", { n })}</Txt>
                </View>
              ) : null}
            </View>
            <Pressable onPress={() => router.push(`/insight/${encodeURIComponent(item.insightId)}`)} accessibilityRole="link">
              <Txt variant="small" style={{ color: colors.brand }}>
                {t("plan.fromInsight", { title: item.insightTitle })}
              </Txt>
            </Pressable>
            {token && n > 0 && !shared[item.id] ? (
              <Button variant="ghost" icon="people-outline" label={t("community.shareMilestone")} onPress={() => void share(item, n)} />
            ) : shared[item.id] ? (
              <Txt variant="small">{shared[item.id]}</Txt>
            ) : null}
            <Button variant="ghost" icon="close" label={t("plan.remove")} onPress={() => setPlan((prev) => removeFromPlan(prev, item.id))} />
          </Card>
        );
      })}
    </Screen>
  );
}
