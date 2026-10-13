import { Ionicons } from "@expo/vector-icons";
import { brandName, STORAGE_KEYS } from "@stepwell/shared";
import { Image, Modal, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSettings } from "@/lib/settings";
import { useStored } from "@/lib/storage";
import { radius, space } from "@/lib/theme";

import { Button, directionStyle, Txt, type IconName } from "./ui";

const POINTS: { key: "evidence" | "notAdvice" | "emergency" | "privacy"; icon: IconName }[] = [
  { key: "evidence", icon: "shield-checkmark-outline" },
  { key: "notAdvice", icon: "information-circle-outline" },
  { key: "emergency", icon: "call-outline" },
  { key: "privacy", icon: "lock-closed-outline" },
];

/** First-launch notice (BUILD_SPEC §11.3): educational, not medical advice; emergencies; privacy. Shown once. */
export function WelcomeNotice() {
  const { t, colors, rtl } = useSettings();
  const [seen, setSeen, loaded] = useStored<boolean>(STORAGE_KEYS.welcome, false);
  if (!loaded || seen) return null;
  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={() => undefined}>
      <SafeAreaView style={[{ flex: 1, backgroundColor: colors.bg }, directionStyle(rtl)]}>
        <ScrollView contentContainerStyle={{ padding: space(6), gap: space(4) }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Image source={require("../../assets/icon.png")} style={{ width: 44, height: 44, borderRadius: 12 }} />
            <Txt variant="title" accessibilityRole="header" style={{ flex: 1 }}>
              {t("welcome.title", { app: brandName() })}
            </Txt>
          </View>
          <Txt variant="small">{t("welcome.intro")}</Txt>
          {POINTS.map((p) => (
            <View key={p.key} style={{ flexDirection: "row", gap: 12 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.sm,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: p.key === "emergency" ? colors.criticalSoft : colors.brandSoft,
                }}
              >
                <Ionicons name={p.icon} size={18} color={p.key === "emergency" ? colors.critical : colors.brand} />
              </View>
              <Txt style={{ flex: 1 }}>{t(`welcome.${p.key}`)}</Txt>
            </View>
          ))}
          <Button label={t("welcome.accept")} onPress={() => setSeen(true)} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
