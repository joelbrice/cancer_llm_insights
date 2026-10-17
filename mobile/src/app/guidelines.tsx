import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { View } from "react-native";

import { Button, Card, Screen, Txt, type IconName } from "@/components/ui";
import { useSettings } from "@/lib/settings";
import { space } from "@/lib/theme";

const RULES: { key: "g1" | "g2" | "g3" | "g4" | "g5" | "g6"; icon: IconName }[] = [
  { key: "g1", icon: "heart-outline" },
  { key: "g2", icon: "chatbubbles-outline" },
  { key: "g3", icon: "lock-closed-outline" },
  { key: "g4", icon: "close-circle-outline" },
  { key: "g5", icon: "call-outline" },
  { key: "g6", icon: "shield-checkmark-outline" },
];

export default function Guidelines() {
  const { t, colors } = useSettings();
  return (
    <Screen>
      <Txt variant="small">{t("community.subtitle")}</Txt>
      {RULES.map((rule, i) => (
        <Card key={rule.key} style={{ flexDirection: "row", gap: space(3) }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={rule.icon} size={20} color={colors.brand} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Txt style={{ fontWeight: "700" }}>
              {i + 1}. {t(`community.${rule.key}Title`)}
            </Txt>
            <Txt variant="small">{t(`community.${rule.key}`)}</Txt>
          </View>
        </Card>
      ))}
      <Txt variant="muted">{t("community.membersOnly")}</Txt>
      <Button variant="ghost" icon="stats-chart-outline" label={t("community.transparencyLink")} onPress={() => router.push("/transparency")} />
    </Screen>
  );
}
