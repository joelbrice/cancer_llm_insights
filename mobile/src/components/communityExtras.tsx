import { STORAGE_KEYS, type MessageKey, type ModeratedPost, type SafetyAssessment, type SurveyAnswer } from "@stepwell/shared";
import { useCallback, useEffect, useState } from "react";
import { TextInput, View } from "react-native";

import { communityMessage } from "@/lib/community";
import { useSettings } from "@/lib/settings";
import { useStored } from "@/lib/storage";
import { radius, space } from "@/lib/theme";

import { Button, Card, SafetyBanner, Txt } from "./ui";

const HELD = ["crisis", "emergency", "urgent", "medical_claim", "solicitation", "abuse", "reported", "new_member"];

/** The member's own held and removed posts: why, the decision, and a once-per-post request for review. */
export function MyModeration({ token, country }: { token: string; country?: string | null }) {
  const { t, api, colors } = useSettings();
  const [items, setItems] = useState<ModeratedPost[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [safety, setSafety] = useState<SafetyAssessment | null>(null);
  const refresh = useCallback(() => void api.community.myModeration(token).then(setItems, () => setItems([])), [api, token]);
  useEffect(refresh, [refresh]);
  if (!items) return null;

  const send = async (postId: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await api.community.appeal(token, postId, text.trim(), country);
      setSafety(result.safety);
      setMessage(t("community.appealSent"));
      setOpen(null);
      setText("");
      refresh();
    } catch (e) {
      setMessage(communityMessage(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Txt variant="label">{t("community.myModeration")}</Txt>
      {safety ? <SafetyBanner safety={safety} /> : null}
      {!items.length ? <Txt variant="small">{t("community.myModerationEmpty")}</Txt> : null}
      {items.map((item) => {
        const reason = item.reason && HELD.includes(item.reason) ? item.reason : "default";
        return (
          <View key={item.post.id} style={{ gap: 6, backgroundColor: colors.surface2, borderRadius: radius.md, padding: space(3) }}>
            <Txt variant="label">{item.post.status === "removed" ? t("community.removedByModerator") : t("community.heldForReview")}</Txt>
            <Txt numberOfLines={4}>{item.post.body}</Txt>
            <Txt variant="small">{t("community.reasonLabel", { reason: t(`community.held.${reason}` as MessageKey) })}</Txt>
            {item.appeal ? (
              <>
                <Txt style={{ fontWeight: "600" }}>{t(`community.appealStatus.${item.appeal.status}`)}</Txt>
                {item.appeal.response ? (
                  <Txt variant="small">
                    {t("community.appealResponse")}: {item.appeal.response}
                  </Txt>
                ) : null}
              </>
            ) : item.can_appeal ? (
              open === item.post.id ? (
                <>
                  <Txt variant="label">{t("community.appealTitle")}</Txt>
                  <Txt variant="muted">{t("community.appealHelp")}</Txt>
                  <TextInput
                    value={text}
                    onChangeText={setText}
                    multiline
                    maxLength={1000}
                    placeholder={t("community.appealPlaceholder")}
                    placeholderTextColor={colors.ink3}
                    accessibilityLabel={t("community.appealTitle")}
                    style={{ minHeight: 80, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space(3), color: colors.ink, backgroundColor: colors.surface, fontSize: 16, textAlignVertical: "top" }}
                  />
                  <Button label={t("community.appealSend")} disabled={busy || text.trim().length < 10} onPress={() => void send(item.post.id)} />
                  <Button variant="ghost" label={t("common.cancel")} onPress={() => setOpen(null)} />
                </>
              ) : (
                <Button variant="ghost" icon="scale-outline" label={t("community.appeal")} onPress={() => (setOpen(item.post.id), setText(""), setMessage(null))} />
              )
            ) : null}
          </View>
        );
      })}
      {message ? <Txt variant="small" accessibilityLiveRegion="polite">{message}</Txt> : null}
    </Card>
  );
}

const ANSWERS: SurveyAnswer[] = ["yes", "somewhat", "no"];

/** "Did you feel supported here this month?" — optional, at most monthly, counted only in anonymous totals. */
export function SurveyCard({ token }: { token: string }) {
  const { t, api } = useSettings();
  const [snoozedUntil, setSnoozedUntil, loaded] = useStored<string | null>(STORAGE_KEYS.surveySnooze, null);
  const [due, setDue] = useState(false);
  const [thanks, setThanks] = useState(false);
  const snoozed = !!snoozedUntil && new Date(snoozedUntil).getTime() > Date.now();
  useEffect(() => {
    if (!loaded || snoozed) return;
    let alive = true;
    void api.community.survey(token).then((s) => alive && setDue(s.due), () => undefined);
    return () => {
      alive = false;
    };
  }, [api, token, loaded, snoozed]);
  if (thanks) return <Txt variant="small" accessibilityLiveRegion="polite">{t("community.surveyThanks")}</Txt>;
  if (!due || snoozed) return null;
  return (
    <Card>
      <Txt variant="h2">{t("community.surveyTitle")}</Txt>
      <Txt variant="small">{t("community.surveyHelp")}</Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {ANSWERS.map((value) => (
          <Button
            key={value}
            variant="ghost"
            label={t(`community.survey.${value}`)}
            onPress={() => (setThanks(true), void api.community.answerSurvey(token, value).catch(() => undefined))}
          />
        ))}
        <Button variant="ghost" label={t("community.surveyLater")} onPress={() => (setSnoozedUntil(new Date(Date.now() + 30 * 86_400_000).toISOString()), setDue(false))} />
      </View>
    </Card>
  );
}
