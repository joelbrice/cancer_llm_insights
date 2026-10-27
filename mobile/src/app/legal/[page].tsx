import { Ionicons } from "@expo/vector-icons";
import { isLegalPage, LEGAL_PAGES, renderLegal } from "@stepwell/shared";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Pressable, View } from "react-native";

import { Card, Loading, Screen, Txt } from "@/components/ui";
import { useSettings } from "@/lib/settings";
import { useApi } from "@/lib/useApi";

/** Privacy policy, terms, legal notice or accessibility statement, with the operator's details from the API.
 * The text is in the app, so it still shows (with the missing details flagged) when the API cannot be reached. */
export default function Legal() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const { t, api, locale, colors } = useSettings();
  const info = useApi(() => api.legal(), [api]);
  if (!isLegalPage(page)) return null;
  if (info.loading && !info.data && !info.error) return <Loading />;
  const doc = renderLegal(locale, page, info.data, t);
  return (
    <Screen>
      <Stack.Screen options={{ title: t(`legal.${page}`) }} />
      <Txt variant="title" accessibilityRole="header">
        {doc.title}
      </Txt>
      {doc.date ? <Txt variant="muted">{t("legal.version", { date: doc.date })}</Txt> : null}
      {doc.draft ? (
        <Card style={{ borderColor: colors.warning, backgroundColor: colors.warningSoft, flexDirection: "row", gap: 8 }}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.warningInk} />
          <Txt variant="small" style={{ flex: 1, color: colors.warningInk }}>
            {t("legal.draft")}
          </Txt>
        </Card>
      ) : null}
      {info.error ? <Txt variant="muted">{t("legal.unavailable")}</Txt> : null}
      <Txt>{doc.intro}</Txt>
      {doc.sections.map((section) => (
        <View key={section.h} style={{ gap: 8 }}>
          <Txt variant="h2" accessibilityRole="header">
            {section.h}
          </Txt>
          {section.blocks.map((block, i) =>
            block.type === "ul" ? (
              <View key={i} style={{ gap: 6 }}>
                {block.items.map((item) => (
                  <View key={item} style={{ flexDirection: "row", gap: 8 }}>
                    <Txt variant="small" aria-hidden>
                      •
                    </Txt>
                    <Txt variant="small" style={{ flex: 1 }}>
                      {item}
                    </Txt>
                  </View>
                ))}
              </View>
            ) : (
              <Txt key={i} variant="small">
                {block.text}
              </Txt>
            ),
          )}
        </View>
      ))}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, paddingTop: 8 }}>
        {LEGAL_PAGES.filter((p) => p !== page).map((p) => (
          <Pressable key={p} onPress={() => router.replace(`/legal/${p}`)} accessibilityRole="link" hitSlop={8}>
            <Txt style={{ color: colors.brand, fontWeight: "600" }}>{t(`legal.${p}`)}</Txt>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
