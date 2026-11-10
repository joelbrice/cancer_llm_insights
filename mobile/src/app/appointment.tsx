import {
  addCustomQuestion,
  APPOINTMENT_QUESTIONS,
  EMPTY_APPOINTMENT,
  formatQuestionList,
  moveQuestion,
  questionGroups,
  questionText,
  removeQuestion,
  setNote,
  STORAGE_KEYS,
  toggleQuestion,
  type AppointmentState,
  type MessageKey,
  type Profile,
  type QuestionGroupId,
} from "@stepwell/shared";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Pressable, Share, TextInput, View } from "react-native";

import { Button, Card, Disclaimer, Loading, Screen, Txt } from "@/components/ui";
import { useSettings } from "@/lib/settings";
import { useStored } from "@/lib/storage";
import { radius, space } from "@/lib/theme";

/** "Questions to bring to your appointment": curated per journey, plus the person's own; kept on this device. */
export default function Appointment() {
  const { t, colors, locale } = useSettings();
  const [state, setState, loaded] = useStored<AppointmentState>(STORAGE_KEYS.appointment, EMPTY_APPOINTMENT);
  const [profile] = useStored<Profile>(STORAGE_KEYS.profile, {});
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState<QuestionGroupId | null>(null);
  if (!loaded) return <Loading />;
  const groups = questionGroups(profile.audience ?? null);
  const current = open ?? groups[0]!;
  const title = (g: QuestionGroupId) => (g === "general" ? t("appointment.general") : t(`audiences.${g}` as MessageKey));
  const list = state.selected.map((id) => ({ id, text: questionText(t, state, id) })).filter((q): q is { id: string; text: string } => !!q.text);
  const input = { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space(3), paddingVertical: space(2), color: colors.ink, backgroundColor: colors.surface, fontSize: 16 };

  return (
    <Screen>
      <Txt variant="small">{t("appointment.subtitle")}</Txt>
      <Card style={{ backgroundColor: colors.surface2 }}>
        <Txt variant="small">{t("appointment.notAdvice")}</Txt>
      </Card>

      {groups.map((group, index) => {
        const expanded = group === current;
        return (
          <Card key={group} style={{ gap: 0, padding: 0 }}>
            <Pressable
              onPress={() => setOpen(expanded ? null : group)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 52, paddingHorizontal: space(4) }}
            >
              <Txt style={{ flex: 1, fontWeight: "600" }}>
                {title(group)}
                {index === 0 && profile.audience ? ` · ${t("appointment.suggested")}` : ""}
              </Txt>
              <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.ink3} />
            </Pressable>
            {expanded
              ? APPOINTMENT_QUESTIONS[group].map((id) => {
                  const checked = state.selected.includes(id);
                  const text = t(`appointment.q.${id}` as MessageKey);
                  return (
                    <Pressable
                      key={id}
                      onPress={() => setState((prev) => toggleQuestion(prev, id))}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                      accessibilityLabel={text}
                      style={{ flexDirection: "row", gap: 12, paddingHorizontal: space(4), paddingVertical: space(3), borderTopWidth: 1, borderTopColor: colors.border }}
                    >
                      <Ionicons name={checked ? "checkbox" : "square-outline"} size={22} color={checked ? colors.brand : colors.ink3} />
                      <Txt style={{ flex: 1 }}>{text}</Txt>
                    </Pressable>
                  );
                })
              : null}
          </Card>
        );
      })}

      <Card>
        <Txt variant="h2">{t("appointment.yourList", { n: list.length })}</Txt>
        {!list.length ? <Txt variant="small">{t("appointment.emptyList")}</Txt> : null}
        {list.map((q, i) => (
          <View key={q.id} style={{ gap: 6, backgroundColor: colors.surface2, borderRadius: radius.md, padding: space(3) }}>
            <Txt>
              <Txt style={{ fontWeight: "700" }}>{i + 1}. </Txt>
              {q.text}
            </Txt>
            <TextInput
              value={state.notes[q.id] ?? ""}
              onChangeText={(v) => setState((prev) => setNote(prev, q.id, v))}
              placeholder={t("appointment.notesPlaceholder")}
              placeholderTextColor={colors.ink3}
              multiline
              maxLength={2000}
              accessibilityLabel={`${t("appointment.notes")} — ${q.text}`}
              style={[input, { minHeight: 60 }]}
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
              <Button variant="ghost" icon="arrow-up" label={t("appointment.moveUp")} disabled={i === 0} onPress={() => setState((prev) => moveQuestion(prev, q.id, -1))} />
              <Button variant="ghost" icon="arrow-down" label={t("appointment.moveDown")} disabled={i === list.length - 1} onPress={() => setState((prev) => moveQuestion(prev, q.id, 1))} />
              <Button variant="ghost" icon="trash-outline" label={t("appointment.remove")} onPress={() => setState((prev) => removeQuestion(prev, q.id))} />
            </View>
          </View>
        ))}
        <Txt variant="label">{t("appointment.addOwn")}</Txt>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t("appointment.addOwnPlaceholder")}
          placeholderTextColor={colors.ink3}
          maxLength={300}
          accessibilityLabel={t("appointment.addOwn")}
          style={input}
          returnKeyType="done"
          onSubmitEditing={() => (setState((prev) => addCustomQuestion(prev, draft)), setDraft(""))}
        />
        <Button icon="add" label={t("appointment.add")} disabled={draft.trim().length < 3} onPress={() => (setState((prev) => addCustomQuestion(prev, draft)), setDraft(""))} />
        {list.length ? (
          <>
            <Button
              variant="ghost"
              icon="share-outline"
              label={t("appointment.share")}
              onPress={() => void Share.share({ title: t("appointment.listHeading"), message: formatQuestionList(t, state, new Date(), locale) })}
            />
            <Button
              variant="ghost"
              icon="trash-outline"
              label={t("appointment.clear")}
              onPress={() =>
                Alert.alert(t("appointment.clear"), t("appointment.clearConfirm"), [
                  { text: t("common.cancel"), style: "cancel" },
                  { text: t("appointment.clear"), style: "destructive", onPress: () => setState(EMPTY_APPOINTMENT) },
                ])
              }
            />
          </>
        ) : null}
        <Txt variant="muted">{t("appointment.tip")}</Txt>
      </Card>
      <Disclaimer />
    </Screen>
  );
}
