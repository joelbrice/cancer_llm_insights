import { Ionicons } from "@expo/vector-icons";
import {
  bmiOption,
  CHECK_ITEMS,
  evaluateCheck,
  FRAMEWORKS,
  STORAGE_KEYS,
  type CheckAnswers,
  type CheckStatus,
  type TopicStatus,
} from "@vitacite/shared";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { Button, Card, Chip, Loading, Screen, Txt, type IconName } from "@/components/ui";
import { useSettings } from "@/lib/settings";
import { useStored } from "@/lib/storage";
import { radius, space, type Colors } from "@/lib/theme";

const STATUS: Record<CheckStatus, { icon: IconName; key: "aligned" | "partly" | "notAligned" | "info"; color: (c: Colors) => string }> = {
  aligned: { icon: "checkmark-circle", key: "aligned", color: (c) => c.good },
  partly: { icon: "alert-circle", key: "partly", color: (c) => c.warningInk },
  not_aligned: { icon: "locate", key: "notAligned", color: (c) => c.critical },
  info: { icon: "information-circle", key: "info", color: (c) => c.ink2 },
};

export default function Check() {
  const { t, locale, api, colors } = useSettings();
  const [answers, setAnswers, loaded] = useStored<CheckAnswers>(STORAGE_KEYS.check, {});
  const [step, setStep] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [topics, setTopics] = useState<Record<string, TopicStatus>>({});
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  useEffect(() => {
    if (loaded && Object.keys(answers).length >= CHECK_ITEMS.length) setShowResults(true);
    // only when the saved answers first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);
  useEffect(() => {
    api
      .topics(locale)
      .then((list) => setTopics(Object.fromEntries(list.map((x) => [x.id, x]))))
      .catch(() => setTopics({}));
  }, [api, locale]);

  const result = useMemo(() => evaluateCheck(answers), [answers]);
  const total = CHECK_ITEMS.length;
  const item = CHECK_ITEMS[Math.min(step, total - 1)]!;
  if (!loaded) return <Loading />;

  if (showResults) {
    return (
      <Screen>
        <Txt variant="title">{t("check.resultTitle")}</Txt>
        <Card>
          <Txt>{t("check.summary", { aligned: result.counts.aligned, total: result.answered })}</Txt>
          <View style={{ flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", backgroundColor: colors.surface3 }} accessible={false}>
            {(["aligned", "partly", "info", "not_aligned"] as CheckStatus[]).map((s) =>
              result.counts[s] ? (
                <View key={s} style={{ flex: result.counts[s], backgroundColor: STATUS[s].color(colors), borderRightWidth: 2, borderRightColor: colors.surface }} />
              ) : null,
            )}
          </View>
          {(["aligned", "partly", "not_aligned", "info"] as CheckStatus[]).map((s) => (
            <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name={STATUS[s].icon} size={16} color={STATUS[s].color(colors)} />
              <Txt variant="small">
                {t(`check.${STATUS[s].key}`)}: <Txt style={{ fontWeight: "700" }}>{result.counts[s]}</Txt>
              </Txt>
            </View>
          ))}
        </Card>
        <Card style={{ backgroundColor: colors.surface2 }}>
          <Txt variant="small">{t("check.notRiskScore")}</Txt>
        </Card>
        {result.items.map(({ item: it, option, status }) => {
          const topic = topics[it.topicId];
          const style = STATUS[status];
          return (
            <Card key={it.id}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name={style.icon} size={16} color={style.color(colors)} />
                <Txt style={{ color: style.color(colors), fontWeight: "600", fontSize: 14 }}>{t(`check.${style.key}`)}</Txt>
              </View>
              <Txt style={{ fontWeight: "600" }}>{it.question[locale]}</Txt>
              <Txt variant="small">→ {option.label[locale]}</Txt>
              <Txt>{it.advice[locale]}</Txt>
              <Txt variant="muted">{t("check.framework", { framework: FRAMEWORKS[it.framework] })}</Txt>
              {topic?.status === "published" && topic.insight_id ? (
                <Button variant="ghost" icon="document-text-outline" label={t("check.seeEvidence")} onPress={() => router.push(`/insight/${encodeURIComponent(topic.insight_id!)}`)} />
              ) : (
                <Chip label={t("insights.awaitingEvidence")} />
              )}
            </Card>
          );
        })}
        <Button
          variant="ghost"
          icon="refresh"
          label={t("check.restart")}
          onPress={() => {
            setAnswers({});
            setStep(0);
            setShowResults(false);
          }}
        />
      </Screen>
    );
  }

  const selected = answers[item.id];
  return (
    <Screen>
      <Txt variant="title">{t("check.title")}</Txt>
      <Txt variant="small">{t("check.privacy")}</Txt>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Txt variant="small">{t("check.progress", { current: step + 1, total })}</Txt>
          <Txt variant="small">{Math.round((step / total) * 100)}%</Txt>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surface3, overflow: "hidden" }}>
          <View style={{ height: 6, width: `${(step / total) * 100}%`, backgroundColor: colors.brand, borderRadius: 3 }} />
        </View>
        <Txt variant="h2" accessibilityRole="header">
          {item.question[locale]}
        </Txt>
        {item.id === "weight" ? (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: colors.surface2, padding: space(3), borderRadius: radius.md }}>
            {[
              { value: height, set: setHeight, unit: "cm", placeholder: "170" },
              { value: weight, set: setWeight, unit: "kg", placeholder: "68" },
            ].map((f) => (
              <TextInput
                key={f.unit}
                value={f.value}
                onChangeText={f.set}
                placeholder={`${f.placeholder} ${f.unit}`}
                placeholderTextColor={colors.ink3}
                keyboardType="decimal-pad"
                accessibilityLabel={f.unit}
                style={{ flex: 1, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 10, color: colors.ink, backgroundColor: colors.surface }}
              />
            ))}
            <Button
              variant="ghost"
              label="BMI"
              onPress={() => {
                const option = bmiOption(Number(height.replace(",", ".")), Number(weight.replace(",", ".")));
                if (option) setAnswers((prev) => ({ ...prev, weight: option }));
              }}
            />
          </View>
        ) : null}
        <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
          {item.options.map((option) => {
            const on = selected === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setAnswers((prev) => ({ ...prev, [item.id]: option.id }))}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  minHeight: 48,
                  paddingHorizontal: space(4),
                  paddingVertical: space(3),
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: on ? colors.brand : colors.border,
                  backgroundColor: on ? colors.brandSoft : colors.surface,
                }}
              >
                <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={20} color={on ? colors.brand : colors.ink3} />
                <Txt style={{ flex: 1 }}>{option.label[locale]}</Txt>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <Button variant="ghost" icon="arrow-back" label={t("check.back")} disabled={step === 0} onPress={() => setStep((s) => s - 1)} />
          {step < total - 1 ? (
            <Button label={t("check.next")} disabled={!selected} onPress={() => setStep((s) => s + 1)} />
          ) : (
            <Button label={t("check.finish")} disabled={!selected} onPress={() => setShowResults(true)} />
          )}
        </View>
      </Card>
      <Txt variant="muted">{t("check.notRiskScore")}</Txt>
    </Screen>
  );
}
