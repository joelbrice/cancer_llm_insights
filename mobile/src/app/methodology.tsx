import { DESIGN_TIER, translateDynamic, type EvidenceLevelId } from "@vitacite/shared";
import { View } from "react-native";

import { Card, Disclaimer, EvidenceMeter, Screen, Txt } from "@/components/ui";
import { useSettings } from "@/lib/settings";

const LEVELS: EvidenceLevelId[] = ["high", "moderate", "low", "very_low"];

export default function Methodology() {
  const { t, colors } = useSettings();
  const tiers = new Map<number, string[]>();
  for (const [id, tier] of Object.entries(DESIGN_TIER)) if (id !== "unknown") tiers.set(tier, [...(tiers.get(tier) ?? []), id]);
  return (
    <Screen>
      <Txt>{t("methodology.intro")}</Txt>
      <Card>
        <Txt variant="h2">{t("methodology.pyramidTitle")}</Txt>
        <Txt variant="small">{t("methodology.pyramidBody")}</Txt>
        {[...tiers.entries()].map(([tier, ids]) => (
          <View key={tier} style={{ alignSelf: "center", width: `${40 + tier * 10}%`, backgroundColor: colors.surface2, borderRadius: 8, padding: 8 }}>
            <Txt variant="small" style={{ textAlign: "center", color: colors.ink }}>
              {ids.map((id) => translateDynamic(t, "designs", id)).join(" · ")}
            </Txt>
          </View>
        ))}
      </Card>
      <Card>
        <Txt variant="h2">{t("methodology.levelsTitle")}</Txt>
        {LEVELS.map((l) => (
          <View key={l} style={{ flexDirection: "row", gap: 12, alignItems: "center" }} accessible accessibilityLabel={`${t(`levels.${l}`)}: ${t(`levels.${l}Desc`)}`}>
            <EvidenceMeter level={l} />
            <View style={{ flex: 1 }}>
              <Txt style={{ fontWeight: "700" }}>{t(`levels.${l}`)}</Txt>
              <Txt variant="small">{t(`levels.${l}Desc`)}</Txt>
            </View>
          </View>
        ))}
      </Card>
      {(
        [
          ["methodology.gradingTitle", "methodology.gradingBody"],
          ["methodology.verificationTitle", "methodology.verificationBody"],
          ["methodology.abstentionTitle", "methodology.abstentionBody"],
          ["methodology.safetyTitle", "methodology.safetyBody"],
        ] as const
      ).map(([title, body]) => (
        <Card key={title}>
          <Txt variant="h2">{t(title)}</Txt>
          <Txt variant="small">{t(body)}</Txt>
        </Card>
      ))}
      <Card>
        <Txt variant="h2">{t("methodology.capsTitle")}</Txt>
        {(["methodology.cap1", "methodology.cap2", "methodology.cap3", "methodology.cap4"] as const).map((k) => (
          <Txt key={k} variant="small">
            • {t(k)}
          </Txt>
        ))}
      </Card>
      <Disclaimer />
    </Screen>
  );
}
