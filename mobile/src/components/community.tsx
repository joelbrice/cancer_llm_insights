import { Ionicons } from "@expo/vector-icons";
import {
  AUDIENCES,
  POST_KINDS,
  REACTION_EMOJI,
  relativeTime,
  STORAGE_KEYS,
  suggestHandle,
  type Audience,
  type CircleInfo,
  type CommunityMeta,
  type ModerationOutcome,
  type Post,
  type PostKind,
  type Profile,
  type ReactionKind,
  type ReportReason,
} from "@stepwell/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { communityMessage } from "@/lib/community";
import { useSettings } from "@/lib/settings";
import { readJSON } from "@/lib/storage";
import { levelColor, radius, space } from "@/lib/theme";

import { Button, Card, Chip, EvidenceMeter, SafetyBanner, Txt } from "./ui";

const REASONS: ReportReason[] = ["harmful_medical", "crisis", "harassment", "spam", "privacy", "other"];

export function Avatar({ handle }: { handle: string | null }) {
  const hue = handle ? [...handle].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7) : 0;
  return (
    <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: handle ? `hsl(${hue}, 45%, 88%)` : "#ddd" }}>
      <Text style={{ fontWeight: "800", color: handle ? `hsl(${hue}, 55%, 25%)` : "#555" }}>{handle ? handle.trim().charAt(0).toUpperCase() : "·"}</Text>
    </View>
  );
}

export function useInputStyle() {
  const { colors } = useSettings();
  return { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space(3), paddingVertical: 10, color: colors.ink, backgroundColor: colors.surface, fontSize: 16 } as const;
}

export function ModerationNotice({ outcome }: { outcome: ModerationOutcome }) {
  const { t, colors } = useSettings();
  if (outcome.status !== "held") return null;
  const reason = outcome.reason ?? "default";
  const known = ["crisis", "emergency", "urgent", "medical_claim", "solicitation", "abuse", "reported", "new_member"].includes(reason);
  return (
    <View style={{ gap: space(2) }} accessibilityLiveRegion="polite">
      {outcome.safety ? <SafetyBanner safety={outcome.safety} /> : null}
      <Card style={{ backgroundColor: colors.surface2 }}>
        <Txt style={{ fontWeight: "600" }}>{t("community.heldTitle")}</Txt>
        <Txt variant="small">{t(`community.held.${known ? (reason as "crisis") : "default"}`)}</Txt>
      </Card>
    </View>
  );
}

export function PostCard({ post, token, reactions, onChange, onDeleted, threadLink = true }: {
  post: Post;
  token: string;
  reactions: ReactionKind[];
  onChange: (post: Post) => void;
  onDeleted: (id: string) => void;
  threadLink?: boolean;
}) {
  const { t, api, locale, colors, scheme } = useSettings();
  const [message, setMessage] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const mine = post.author?.is_me ?? false;
  const deleted = post.status === "deleted";

  const toggle = async (kind: ReactionKind) => {
    if (mine || post.status !== "published") return;
    try {
      const r = await api.community.react(token, post.id, kind, !post.my_reactions.includes(kind));
      onChange({ ...post, reactions: r.reactions, my_reactions: r.my_reactions });
    } catch (e) {
      setMessage(communityMessage(t, e));
    }
  };
  const report = async (reason: ReportReason) => {
    setReporting(false);
    try {
      await api.community.report(token, post.id, reason);
      setMessage(t("community.reportSent"));
    } catch (e) {
      setMessage(communityMessage(t, e));
    }
  };
  const remove = () =>
    Alert.alert(t("community.deleteConfirm"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("community.delete"),
        style: "destructive",
        onPress: () => void api.community.remove(token, post.id).then(() => onDeleted(post.id), (e) => setMessage(communityMessage(t, e))),
      },
    ]);

  return (
    <Card style={post.status === "held" ? { borderStyle: "dashed" } : undefined}>
      <View style={{ flexDirection: "row", gap: space(3), alignItems: "center" }}>
        <Avatar handle={post.author?.handle ?? null} />
        <View style={{ flex: 1 }}>
          <Txt style={{ fontWeight: "700" }}>
            {post.author ? (mine ? `${post.author.handle} (${t("community.you")})` : post.author.handle) : t("community.formerMember")}
          </Txt>
          <Txt variant="muted">
            {[post.author?.journey ? t(`audiences.${post.author.journey}`) : null, post.kind !== "reply" ? t(`community.kinds.${post.kind}`) : null, relativeTime(locale, post.created_at)]
              .filter(Boolean)
              .join(" · ")}
          </Txt>
        </View>
      </View>
      {post.status === "held" ? (
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: space(2) }}>
          <Ionicons name="lock-closed" size={14} color={colors.warningInk} />
          <Txt variant="small" style={{ color: colors.warningInk, flex: 1 }}>
            {t("community.pending")}
          </Txt>
        </View>
      ) : null}
      {deleted ? <Txt variant="muted">{t("community.deleted")}</Txt> : <Txt>{post.body}</Txt>}
      {post.notes.includes("care_team") && !deleted ? (
        <View style={{ flexDirection: "row", gap: 8, backgroundColor: colors.surface2, borderRadius: radius.md, padding: space(3) }}>
          <Ionicons name="information-circle-outline" size={18} color={colors.ink2} />
          <Txt variant="small" style={{ flex: 1 }}>
            {t("community.careTeamNote")}
          </Txt>
        </View>
      ) : null}
      {post.related_insight && !deleted ? (
        <Pressable
          onPress={() => router.push(`/insight/${encodeURIComponent(post.related_insight!.id)}`)}
          accessibilityRole="link"
          style={{ gap: 4, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, borderRadius: radius.md, padding: space(3) }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="sparkles-outline" size={16} color={colors.brand} />
            <Txt style={{ color: colors.brand, fontWeight: "700", fontSize: 14 }}>{t("community.researchSays")}</Txt>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Txt style={{ flex: 1 }}>{post.related_insight.title}</Txt>
            <EvidenceMeter level={post.related_insight.evidence_level} />
            <Text style={{ color: levelColor(scheme, post.related_insight.evidence_level), fontWeight: "700", fontSize: 13 }}>
              {t(`levels.${post.related_insight.evidence_level}`)}
            </Text>
          </View>
        </Pressable>
      ) : null}
      {!deleted ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          {reactions.map((kind) => {
            const count = post.reactions[kind] ?? 0;
            const on = post.my_reactions.includes(kind);
            return (
              <Pressable
                key={kind}
                onPress={() => void toggle(kind)}
                disabled={mine || post.status !== "published"}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${t(`community.reactions.${kind}`)}${count ? ` (${count})` : ""}`}
                hitSlop={4}
                style={{ flexDirection: "row", alignItems: "center", gap: 4, minHeight: 36, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandSoft : "transparent" }}
              >
                <Text>{REACTION_EMOJI[kind]}</Text>
                {count ? <Text style={{ color: colors.ink, fontSize: 13 }}>{count}</Text> : null}
              </Pressable>
            );
          })}
          <View style={{ flex: 1 }} />
          {threadLink && !post.parent_id && post.status === "published" ? (
            <Pressable onPress={() => router.push(`/community/${encodeURIComponent(post.id)}`)} accessibilityRole="link" hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="chatbubble-outline" size={16} color={colors.brand} />
              <Txt style={{ color: colors.brand, fontWeight: "600", fontSize: 14 }}>
                {post.reply_count === 1 ? t("community.oneReply") : post.reply_count ? t("community.replies", { n: post.reply_count }) : t("community.reply")}
              </Txt>
            </Pressable>
          ) : null}
          {mine ? (
            <Pressable onPress={remove} accessibilityRole="button" accessibilityLabel={t("community.delete")} hitSlop={10}>
              <Ionicons name="trash-outline" size={18} color={colors.ink2} />
            </Pressable>
          ) : post.status === "published" ? (
            <Pressable onPress={() => setReporting(true)} accessibilityRole="button" accessibilityLabel={t("community.report")} hitSlop={10}>
              <Ionicons name="flag-outline" size={18} color={colors.ink2} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {message ? <Txt variant="small">{message}</Txt> : null}
      <Modal visible={reporting} transparent animationType="fade" onRequestClose={() => setReporting(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }} onPress={() => setReporting(false)}>
          <SafeAreaView edges={["bottom"]} style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space(4), gap: space(2) }}>
            <Txt variant="h2">{t("community.reportTitle")}</Txt>
            {REASONS.map((reason) => (
              <Button key={reason} variant="ghost" label={t(`community.reportReasons.${reason}`)} onPress={() => void report(reason)} />
            ))}
            <Button variant="ghost" label={t("common.cancel")} onPress={() => setReporting(false)} />
          </SafeAreaView>
        </Pressable>
      </Modal>
    </Card>
  );
}

export function Composer({ token, circles, circle, limit, onPosted }: { token: string; circles: CircleInfo[]; circle: string | null; limit: number; onPosted: (post: Post, outcome: ModerationOutcome) => void }) {
  const { t, api, locale, colors } = useSettings();
  const input = useInputStyle();
  const [kind, setKind] = useState<PostKind>("win");
  const [target, setTarget] = useState(circle ?? circles[0]?.id ?? "prevention");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const profile = await readJSON<Profile>(STORAGE_KEYS.profile, {});
      const result = await api.community.post(token, { circle: circle ?? target, kind, body, language: locale }, profile.country ?? null);
      setBody("");
      onPosted(result.post, result.moderation);
    } catch (e) {
      setError(communityMessage(t, e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <Txt variant="label">{t("community.composerTitle")}</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {POST_KINDS.map((k) => (
          <Chip key={k} label={t(`community.kinds.${k}`)} selected={kind === k} onPress={() => setKind(k)} />
        ))}
      </ScrollView>
      {!circle ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {circles.map((c) => (
            <Chip key={c.id} icon="ellipse-outline" label={c.title} selected={target === c.id} onPress={() => setTarget(c.id)} />
          ))}
        </ScrollView>
      ) : null}
      <TextInput
        value={body}
        onChangeText={setBody}
        maxLength={limit}
        multiline
        placeholder={t("community.composerPlaceholder")}
        placeholderTextColor={colors.ink3}
        accessibilityLabel={t("community.composerPlaceholder")}
        style={[input, { minHeight: 96, textAlignVertical: "top" }]}
      />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Txt variant="muted">
          {body.length}/{limit}
        </Txt>
        <Button label={t("community.post")} onPress={() => void submit()} disabled={busy || body.trim().length < 2} />
      </View>
      {error ? <Txt style={{ color: colors.critical, fontSize: 14 }}>{error}</Txt> : null}
    </Card>
  );
}

export function JoinCommunity({ meta, onToken }: { meta: CommunityMeta; onToken: (token: string) => void }) {
  const { t, api, locale, colors } = useSettings();
  const input = useInputStyle();
  const [handle, setHandle] = useState("");
  const [journey, setJourney] = useState<Audience | null>(null);
  const [checks, setChecks] = useState({ age: false, rules: false, consent: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [key, setKey] = useState("");

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const s = await api.community.join({ handle, language: locale, journey, accept_guidelines: checks.rules, confirm_age: checks.age, consent_health_data: checks.consent });
      onToken(s.token);
    } catch (e) {
      setError(communityMessage(t, e));
    } finally {
      setBusy(false);
    }
  };
  const restore = async () => {
    setBusy(true);
    try {
      await api.community.me(key.trim());
      onToken(key.trim());
    } catch {
      setError(t("community.invalidKey"));
    } finally {
      setBusy(false);
    }
  };
  const box = (k: keyof typeof checks, label: string) => (
    <Pressable
      key={k}
      onPress={() => setChecks((c) => ({ ...c, [k]: !c[k] }))}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: checks[k] }}
      style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space(3) }}
    >
      <Ionicons name={checks[k] ? "checkbox" : "square-outline"} size={22} color={checks[k] ? colors.brand : colors.ink3} />
      <Txt variant="small" style={{ flex: 1, color: colors.ink }}>
        {label}
      </Txt>
    </Pressable>
  );

  return (
    <Card>
      <Txt variant="h2">{t("community.joinTitle")}</Txt>
      <Txt variant="small">{t("community.joinIntro")}</Txt>
      {restoring ? (
        <>
          <Txt variant="label">{t("community.accessKey")}</Txt>
          <TextInput value={key} onChangeText={setKey} autoCapitalize="none" autoCorrect={false} style={input} accessibilityLabel={t("community.accessKey")} />
          <Button icon="key-outline" label={t("community.restore")} onPress={() => void restore()} disabled={busy || key.trim().length < 20} />
          <Button variant="ghost" label={t("common.back")} onPress={() => (setRestoring(false), setError(null))} />
        </>
      ) : (
        <>
          <Txt variant="label">{t("community.handle")}</Txt>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput value={handle} onChangeText={setHandle} maxLength={24} autoCorrect={false} style={[input, { flex: 1 }]} accessibilityLabel={t("community.handle")} />
            <Pressable onPress={() => setHandle(suggestHandle(locale))} accessibilityRole="button" accessibilityLabel={t("community.suggest")} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="shuffle" size={20} color={colors.brand} />
            </Pressable>
          </View>
          <Txt variant="muted">{t("community.handleHelp")}</Txt>
          <Txt variant="label">{t("community.journey")}</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Chip label={t("community.journeyNone")} selected={journey === null} onPress={() => setJourney(null)} />
            {AUDIENCES.map((a) => (
              <Chip key={a} label={t(`audiences.${a}`)} selected={journey === a} onPress={() => setJourney(a)} />
            ))}
          </View>
          {box("age", t("community.confirmAge", { age: meta.min_age }))}
          {box("rules", t("community.acceptGuidelines"))}
          {box("consent", t("community.consentHealth"))}
          <Pressable onPress={() => router.push("/guidelines")} accessibilityRole="link">
            <Txt style={{ color: colors.brand, fontWeight: "600" }}>{t("community.guidelinesTitle")} →</Txt>
          </Pressable>
          <Button label={t("community.join")} onPress={() => void join()} disabled={busy || handle.trim().length < 3 || !(checks.age && checks.rules && checks.consent)} />
          <Button variant="ghost" icon="key-outline" label={t("community.haveKey")} onPress={() => (setRestoring(true), setError(null))} />
        </>
      )}
      {error ? <Txt style={{ color: colors.critical, fontSize: 14 }}>{error}</Txt> : null}
    </Card>
  );
}
