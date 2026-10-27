import { Ionicons } from "@expo/vector-icons";
import type { BlockedMember, CommunityMeta, MemberMe, ModerationOutcome, Post } from "@stepwell/shared";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Share, View } from "react-native";

import { Composer, JoinCommunity, ModerationNotice, PostCard } from "@/components/community";
import { MyModeration, SurveyCard } from "@/components/communityExtras";
import { Button, Card, Chip, ErrorNote, Loading, Screen, Txt } from "@/components/ui";
import { communityMessage, isAuthError, useCommunityToken } from "@/lib/community";
import { useSettings } from "@/lib/settings";
import { space } from "@/lib/theme";

function Account({ me, token, onSignedOut }: { me: MemberMe; token: string; onSignedOut: (message?: string) => void }) {
  const { t, api, colors } = useSettings();
  const [copied, setCopied] = useState(false);
  const [blocks, setBlocks] = useState<BlockedMember[] | null>(null);
  const toggleBlocks = () =>
    blocks ? setBlocks(null) : void api.community.blocks(token).then(setBlocks, () => setBlocks([]));
  return (
    <Card>
      <Txt variant="label">{t("community.account")}</Txt>
      <Txt variant="small">{t("community.signedInAs", { handle: me.member.handle })}</Txt>
      <Txt variant="muted">{t("community.accessKeyHelp")}</Txt>
      <Button variant="ghost" icon={copied ? "checkmark" : "key-outline"} label={copied ? t("common.copied") : t("community.copyKey")} onPress={() => void Clipboard.setStringAsync(token).then(() => setCopied(true))} />
      <Button variant="ghost" icon="ban-outline" label={t("community.blockedMembers")} onPress={toggleBlocks} />
      {blocks ? (
        blocks.length ? (
          blocks.map((b) => (
            <View key={b.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 }}>
              <Txt variant="small">{b.handle}</Txt>
              <Pressable
                onPress={() => void api.community.unblock(token, b.id).then(() => setBlocks((list) => (list ?? []).filter((x) => x.id !== b.id)))}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Txt style={{ color: colors.brand, fontWeight: "600", fontSize: 14 }}>{t("community.unblock")}</Txt>
              </Pressable>
            </View>
          ))
        ) : (
          <Txt variant="muted">{t("community.noBlocks")}</Txt>
        )
      ) : null}
      <Button
        variant="ghost"
        icon="download-outline"
        label={t("community.exportData")}
        onPress={() => void api.community.exportMe(token).then((data) => Share.share({ message: JSON.stringify(data, null, 2) }), () => undefined)}
      />
      <Button
        variant="ghost"
        icon="log-out-outline"
        label={t("community.signOut")}
        onPress={() => Alert.alert(t("community.signOut"), t("community.signOutConfirm"), [{ text: t("common.cancel"), style: "cancel" }, { text: t("community.signOut"), onPress: () => onSignedOut() }])}
      />
      <Button
        variant="danger"
        icon="trash-outline"
        label={t("community.leave")}
        onPress={() =>
          Alert.alert(t("community.leave"), t("community.leaveConfirm"), [
            { text: t("common.cancel"), style: "cancel" },
            { text: t("common.delete"), style: "destructive", onPress: () => void api.community.eraseMe(token).then(() => onSignedOut(t("community.left"))) },
          ])
        }
      />
      {me.member.status === "suspended" ? <Txt style={{ color: colors.warningInk }}>{t("community.errors.member_suspended")}</Txt> : null}
    </Card>
  );
}

export default function Community() {
  const { t, api, locale, colors } = useSettings();
  const [token, setToken, loaded] = useCommunityToken();
  const [meta, setMeta] = useState<CommunityMeta | null>(null);
  const [me, setMe] = useState<MemberMe | null>(null);
  const [circle, setCircle] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ModerationOutcome | null>(null);

  useEffect(() => {
    api.community.meta(locale).then(setMeta, () => setError(t("community.unavailable")));
  }, [api, locale, t]);

  const signOut = useCallback((message?: string) => {
    setToken(null);
    setMe(null);
    setPosts([]);
    setNotice(message ?? null);
  }, [setToken]);

  const refreshMe = useCallback(() => {
    if (token) api.community.me(token).then(setMe, (e) => (isAuthError(e) ? signOut() : undefined));
  }, [api, token, signOut]);
  useEffect(refreshMe, [refreshMe]);

  const load = useCallback(
    async (reset: boolean) => {
      if (!token) return;
      setLoading(true);
      try {
        const page = await api.community.feed(token, { circle: circle ?? undefined, cursor: reset ? null : cursor, limit: 15 });
        setPosts((prev) => (reset ? page.items : [...prev, ...page.items]));
        setCursor(page.next_cursor);
        setError(null);
      } catch (e) {
        if (isAuthError(e)) signOut();
        else setError(communityMessage(t, e));
      } finally {
        setLoading(false);
      }
    },
    [api, token, circle, cursor, signOut, t],
  );
  useEffect(() => {
    void load(true);
    // reload when the circle or the account changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, circle]);

  if (!loaded || (!meta && !error)) return <Loading />;
  if (!meta) return <ErrorNote message={error ?? t("community.unavailable")} />;
  const current = meta.circles.find((c) => c.id === circle) ?? null;
  const fresh = me ? me.activity.new_replies + me.activity.new_reactions : 0;

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Txt variant="title">{t("community.title")}</Txt>
          <Txt variant="small">{t("community.subtitle")}</Txt>
        </View>
        <Pressable onPress={() => router.push("/guidelines")} accessibilityRole="link" accessibilityLabel={t("community.guidelinesTitle")} hitSlop={8}>
          <Ionicons name="shield-checkmark-outline" size={26} color={colors.brand} />
        </Pressable>
      </View>
      {notice ? (
        <Card style={{ backgroundColor: colors.brandSoft }}>
          <Txt variant="small">{notice}</Txt>
        </Card>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label={t("community.allCircles")} selected={!circle} onPress={() => setCircle(null)} />
        {meta.circles.map((c) => (
          <Chip key={c.id} label={c.title} selected={circle === c.id} onPress={() => setCircle(c.id)} />
        ))}
      </ScrollView>

      {!token ? (
        <>
          <JoinCommunity meta={meta} onToken={(tok) => (setToken(tok), setNotice(null))} />
          <Txt variant="muted">{t("community.membersOnly")}</Txt>
        </>
      ) : (
        <>
          {me && fresh ? (
            <Card style={{ flexDirection: "row", alignItems: "center", gap: space(3) }}>
              <Ionicons name="notifications-outline" size={20} color={colors.brand} />
              <Txt variant="small" style={{ flex: 1 }}>
                {t("community.newActivity", { replies: me.activity.new_replies, reactions: me.activity.new_reactions })}
              </Txt>
              <Pressable onPress={() => void api.community.markSeen(token).then(refreshMe)} accessibilityRole="button" hitSlop={8}>
                <Txt style={{ color: colors.brand, fontWeight: "600", fontSize: 14 }}>{t("community.markSeen")}</Txt>
              </Pressable>
            </Card>
          ) : null}
          {current ? (
            <Card style={{ backgroundColor: colors.brandSoft, borderColor: colors.brandSoft }}>
              <Txt variant="small">{current.description}</Txt>
              <Txt variant="label" style={{ color: colors.brand }}>
                {t("community.promptOfWeek")}
              </Txt>
              <Txt style={{ fontWeight: "700", fontSize: 18 }}>{current.prompt}</Txt>
            </Card>
          ) : null}
          {me?.member.status === "active" ? (
            <Composer
              token={token}
              circles={meta.circles}
              circle={circle}
              limit={meta.limits.post_chars ?? 2000}
              onPosted={(post, result) => {
                setOutcome(result);
                setPosts((list) => [post, ...list]);
              }}
            />
          ) : null}
          {outcome ? <ModerationNotice outcome={outcome} /> : null}
          {me ? <SurveyCard token={token} /> : null}
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              token={token}
              reactions={meta.reactions}
              onChange={(p) => setPosts((list) => list.map((x) => (x.id === p.id ? p : x)))}
              onDeleted={(id) => setPosts((list) => list.filter((x) => x.id !== id))}
              onBlocked={(handle) => {
                setPosts((list) => list.filter((x) => x.author?.handle !== handle));
                setNotice(t("community.blocked"));
              }}
            />
          ))}
          {!posts.length && !loading ? (
            <Card>
              <Txt variant="small">{t("community.empty")}</Txt>
            </Card>
          ) : null}
          {loading ? <Loading /> : null}
          {error ? <Txt style={{ color: colors.critical }}>{error}</Txt> : null}
          {cursor ? <Button variant="ghost" label={t("community.loadMore")} onPress={() => void load(false)} disabled={loading} /> : null}
          {me ? <Account me={me} token={token} onSignedOut={signOut} /> : null}
          {me ? <MyModeration token={token} /> : null}
          <Button variant="ghost" icon="stats-chart-outline" label={t("community.transparencyLink")} onPress={() => router.push("/transparency")} />
          <Txt variant="muted">{t("community.g5")}</Txt>
        </>
      )}
    </Screen>
  );
}
