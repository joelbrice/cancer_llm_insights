import { Ionicons } from "@expo/vector-icons";
import {
  ApiError,
  splitCitations,
  STORAGE_KEYS,
  type ChatResponse,
  type Citation,
  type ClaimCheck,
  type Profile,
  type SafetyAssessment,
} from "@vitacite/shared";
import { router, useLocalSearchParams } from "expo-router";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Feedback } from "@/components/Feedback";
import { Card, Chip, CitationCard, EvidenceBadge, SafetyBanner, Txt } from "@/components/ui";
import { useSettings } from "@/lib/settings";
import { readJSON } from "@/lib/storage";
import { radius, space } from "@/lib/theme";

interface Turn {
  id: string;
  role: "user" | "assistant";
  content: string;
  stage?: "searching" | "found" | "writing" | "done" | "error";
  found?: number;
  safety?: SafetyAssessment;
  response?: ChatResponse;
  error?: string;
}

let counter = 0;
const uid = () => `${Date.now()}-${++counter}`;

function AnswerText({ response, onCite }: { response: ChatResponse; onCite: (c: Citation) => void }) {
  const { colors, t } = useSettings();
  const citations = new Map(response.citations.map((c) => [c.n, c]));
  const render = (text: string, key: string, claim?: ClaimCheck): ReactNode => {
    const flagged = claim && ["unsupported", "no_citation", "partial"].includes(claim.label);
    const style = flagged
      ? { textDecorationLine: "underline" as const, textDecorationColor: claim?.label === "unsupported" ? colors.critical : colors.warning }
      : undefined;
    return (
      <Text key={key} style={style} accessibilityHint={
          flagged ? t(claim?.label === "unsupported" ? "ask.claimUnsupported" : claim?.label === "no_citation" ? "ask.claimUncited" : "ask.claimPartial") : undefined
        }>
        {splitCitations(text).map((seg, i) => (
          <Fragment key={i}>
            {seg.text}
            {seg.citations.map((n) => {
              const c = citations.get(n);
              return (
                <Text
                  key={n}
                  onPress={c ? () => onCite(c) : undefined}
                  accessibilityRole="button"
                  accessibilityLabel={`${t("ask.sources")} ${n}`}
                  style={{ color: colors.brand, fontWeight: "700", fontSize: 13 }}
                >
                  {" "}[{n}]
                </Text>
              );
            })}
          </Fragment>
        ))}
      </Text>
    );
  };
  const answer = response.answer;
  const claims = [...(response.verification?.claims ?? [])].sort((a, b) => a.start - b.start);
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const claim of claims) {
    if (claim.start < cursor) continue;
    if (claim.start > cursor) parts.push(render(answer.slice(cursor, claim.start), `g${cursor}`));
    parts.push(render(answer.slice(claim.start, claim.end), `c${claim.start}`, claim));
    cursor = claim.end;
  }
  if (cursor < answer.length) parts.push(render(answer.slice(cursor), "tail"));
  return <Txt>{parts}</Txt>;
}

export default function Ask() {
  const { t, api, locale, colors } = useSettings();
  const params = useLocalSearchParams<{ q?: string }>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [cite, setCite] = useState<Citation | null>(null);
  const abort = useRef<AbortController | null>(null);
  const scroll = useRef<ScrollView>(null);
  const handled = useRef<string | null>(null);

  const patch = useCallback((id: string, update: (turn: Turn) => Partial<Turn>) => {
    setTurns((all) => all.map((turn) => (turn.id === id ? { ...turn, ...update(turn) } : turn)));
  }, []);

  const send = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || busy) return;
      const user: Turn = { id: uid(), role: "user", content: text };
      const assistantId = uid();
      const history = [...turns, user]
        .filter((x) => x.role === "user" || x.response)
        .slice(-12)
        .map((x) => ({ role: x.role, content: x.role === "user" ? x.content : (x.response?.answer ?? "") }))
        .filter((m) => m.content);
      setTurns((all) => [...all, user, { id: assistantId, role: "assistant", content: "", stage: "searching" }]);
      setInput("");
      setBusy(true);
      const controller = new AbortController();
      abort.current = controller;
      const profile = await readJSON<Profile | null>(STORAGE_KEYS.profile, null);
      try {
        await api.chatStream(
          { messages: history, ui_language: locale, profile: profile ?? undefined },
          (event) => {
            if (event.type === "meta") patch(assistantId, () => ({ safety: event.data.safety }));
            else if (event.type === "evidence") patch(assistantId, () => ({ stage: "found", found: event.data.evidence.length }));
            else if (event.type === "delta") patch(assistantId, (turn) => ({ stage: "writing", content: turn.content + event.data.text }));
            else if (event.type === "final") patch(assistantId, () => ({ stage: "done", response: event.data, safety: event.data.safety }));
          },
          controller.signal,
        );
      } catch (err) {
        const message = err instanceof ApiError && err.isRateLimited ? t("ask.rateLimited") : (err as Error).name === "AbortError" ? t("ask.errorStream") : t("common.apiUnreachable");
        patch(assistantId, (turn) => (turn.response ? {} : { stage: "error", error: message }));
      } finally {
        setBusy(false);
        abort.current = null;
      }
    },
    [api, busy, locale, patch, t, turns],
  );

  useEffect(() => {
    if (params.q && handled.current !== params.q) {
      handled.current = params.q;
      void send(params.q);
    }
  }, [params.q, send]);

  const stageLabel = (turn: Turn) =>
    turn.stage === "searching" ? t("ask.searching") : turn.stage === "found" ? t("ask.found", { n: turn.found ?? 0 }) : t("ask.writing");

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={scroll} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} contentContainerStyle={{ padding: space(4), gap: space(4) }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Txt variant="title">{t("ask.title")}</Txt>
              <Txt variant="small">{t("ask.subtitle")}</Txt>
            </View>
            {turns.length ? (
              <Pressable onPress={() => (abort.current?.abort(), setTurns([]))} accessibilityRole="button" accessibilityLabel={t("ask.newChat")} hitSlop={8}>
                <Ionicons name="add-circle-outline" size={28} color={colors.brand} />
              </Pressable>
            ) : null}
          </View>
          {!turns.length ? (
            <Card>
              <Txt variant="label">{t("ask.suggestions")}</Txt>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[t("ask.s1"), t("ask.s2"), t("ask.s3"), t("ask.s4")].map((s) => (
                  <Chip key={s} label={s} onPress={() => void send(s)} />
                ))}
              </View>
            </Card>
          ) : null}
          {turns.map((turn) =>
            turn.role === "user" ? (
              <View key={turn.id} style={{ alignSelf: "flex-end", maxWidth: "85%", backgroundColor: colors.brand, borderRadius: radius.lg, borderBottomRightRadius: 4, paddingHorizontal: space(4), paddingVertical: space(3) }}>
                <Text style={{ color: colors.onBrand, fontSize: 16 }}>{turn.content}</Text>
              </View>
            ) : (
              <View key={turn.id} style={{ gap: space(3) }}>
                {turn.safety ? <SafetyBanner safety={turn.safety} /> : null}
                {turn.response?.abstain_reason === "safety" ? null : (
                  <Card>
                    {turn.stage === "error" ? (
                      <Txt>{turn.error}</Txt>
                    ) : !turn.response ? (
                      <>
                        {turn.content ? <Txt>{turn.content}</Txt> : null}
                        <Txt variant="muted">{stageLabel(turn)}</Txt>
                      </>
                    ) : turn.response.abstained ? (
                      <>
                        <Txt style={{ fontWeight: "600" }}>{t("ask.abstainedTitle")}</Txt>
                        <Txt variant="small">{turn.response.answer}</Txt>
                      </>
                    ) : (
                      <>
                        <AnswerText response={turn.response} onCite={setCite} />
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: space(2) }}>
                          {turn.response.evidence ? <EvidenceBadge level={turn.response.evidence.level} grade={turn.response.evidence.grade} /> : null}
                          {turn.response.verification ? (
                            <Chip icon="checkmark" label={t("ask.grounded", { pct: Math.round(turn.response.verification.grounded_ratio * 100) })} />
                          ) : null}
                        </View>
                        {turn.response.evidence?.rationale.map((r) => (
                          <Txt key={r.code} variant="small">
                            • {r.text}
                          </Txt>
                        ))}
                      </>
                    )}
                  </Card>
                )}
                {turn.response?.citations?.map((c) => (
                  <CitationCard key={c.n} citation={c} onDocument={() => router.push(`/document/${encodeURIComponent(c.source.document_id)}`)} />
                ))}
                {turn.response && !turn.response.abstained ? <Feedback targetType="answer" targetId={turn.response.id} /> : null}
                {turn.response?.related_insights?.length ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {turn.response.related_insights.map((r) => (
                      <Chip key={r.id} icon="sparkles-outline" label={r.title} onPress={() => router.push(`/insight/${encodeURIComponent(r.id)}`)} />
                    ))}
                  </View>
                ) : null}
              </View>
            ),
          )}
        </ScrollView>
        <View style={{ padding: space(3), borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={t("ask.placeholder")}
              placeholderTextColor={colors.ink3}
              multiline
              maxLength={4000}
              style={{ flex: 1, maxHeight: 120, minHeight: 44, fontSize: 16, color: colors.ink, backgroundColor: colors.surface2, borderRadius: radius.xl, paddingHorizontal: space(4), paddingTop: 11, paddingBottom: 11 }}
              accessibilityLabel={t("ask.placeholder")}
            />
            <Pressable
              onPress={() => (busy ? abort.current?.abort() : void send(input))}
              accessibilityRole="button"
              accessibilityLabel={busy ? t("ask.stop") : t("ask.send")}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", opacity: !busy && !input.trim() ? 0.5 : 1 }}
            >
              <Ionicons name={busy ? "stop" : "send"} size={18} color={colors.onBrand} />
            </Pressable>
          </View>
          <Txt variant="muted" style={{ textAlign: "center" }}>
            {t("disclaimer.short")}
          </Txt>
        </View>
      </KeyboardAvoidingView>
      <Modal visible={!!cite} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCite(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: space(4) }}>
            <Txt variant="label">{t("ask.sources")}</Txt>
            <Pressable onPress={() => setCite(null)} accessibilityRole="button" accessibilityLabel={t("common.close")} hitSlop={10}>
              <Ionicons name="close" size={26} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: space(4) }}>{cite ? <CitationCard citation={cite} /> : null}</ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
