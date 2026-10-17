import { useState } from "react";
import { View } from "react-native";

import { useSettings } from "@/lib/settings";

import { Button, Txt } from "./ui";

/** Thumbs up/down sent to /feedback (best effort; no personal data is attached). */
export function Feedback({ targetType, targetId }: { targetType: "insight" | "answer"; targetId: string }) {
  const { t, api, locale } = useSettings();
  const [sent, setSent] = useState(false);
  const send = async (rating: 1 | -1) => {
    setSent(true);
    try {
      await api.feedback({ target_type: targetType, target_id: targetId, rating, language: locale });
    } catch {
      /* best effort */
    }
  };
  if (sent) return <Txt variant="small">{t("ask.thanks")}</Txt>;
  return (
    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
      <Button variant="ghost" icon="thumbs-up-outline" label={t("ask.helpful")} onPress={() => void send(1)} />
      <Button variant="ghost" icon="thumbs-down-outline" label={t("ask.notHelpful")} onPress={() => void send(-1)} />
    </View>
  );
}
