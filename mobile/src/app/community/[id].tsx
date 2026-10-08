import { STORAGE_KEYS, type CommunityMeta, type ModerationOutcome, type Post, type PostThread, type Profile } from "@stepwell/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";

import { ModerationNotice, PostCard, useInputStyle } from "@/components/community";
import { Button, Card, ErrorNote, Loading, Screen } from "@/components/ui";
import { communityMessage, useCommunityToken } from "@/lib/community";
import { useSettings } from "@/lib/settings";
import { readJSON } from "@/lib/storage";
import { space } from "@/lib/theme";

export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, api, locale, colors } = useSettings();
  const input = useInputStyle();
  const [token, , loaded] = useCommunityToken();
  const [meta, setMeta] = useState<CommunityMeta | null>(null);
  const [thread, setThread] = useState<PostThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ModerationOutcome | null>(null);

  useEffect(() => {
    api.community.meta(locale).then(setMeta, () => undefined);
  }, [api, locale]);
  useEffect(() => {
    if (token) api.community.thread(token, String(id)).then(setThread, (e) => setError(communityMessage(t, e)));
  }, [api, token, id, t]);

  if (!loaded || (!thread && !error) || !meta) return <Loading />;
  if (!token || !thread) return <ErrorNote message={error ?? t("community.joinTitle")} />;

  const update = (post: Post) =>
    setThread((th) => (th ? (post.id === th.post.id ? { ...th, post } : { ...th, replies: th.replies.map((r) => (r.id === post.id ? post : r)) }) : th));
  const send = async () => {
    setBusy(true);
    try {
      const profile = await readJSON<Profile>(STORAGE_KEYS.profile, {});
      const result = await api.community.reply(token, String(id), { body, language: locale }, profile.country ?? null);
      setThread((th) => (th ? { ...th, replies: [...th.replies, result.post] } : th));
      setOutcome(result.moderation);
      setBody("");
      setError(null);
    } catch (e) {
      setError(communityMessage(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <PostCard post={thread.post} token={token} reactions={meta.reactions} onChange={update} onDeleted={() => router.back()} onBlocked={() => router.back()} threadLink={false} />
      <View style={{ gap: space(3), borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: space(3) }}>
        {thread.replies.map((reply) => (
          <PostCard
            key={reply.id}
            post={reply}
            token={token}
            reactions={meta.reactions}
            onChange={update}
            onDeleted={(rid) => setThread((th) => (th ? { ...th, replies: th.replies.filter((r) => r.id !== rid) } : th))}
            onBlocked={(handle) => setThread((th) => (th ? { ...th, replies: th.replies.filter((r) => r.author?.handle !== handle) } : th))}
            threadLink={false}
          />
        ))}
      </View>
      {thread.post.status === "published" ? (
        <Card>
          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={meta.limits.reply_chars ?? 1000}
            placeholder={t("community.replyPlaceholder")}
            placeholderTextColor={colors.ink3}
            accessibilityLabel={t("community.replyPlaceholder")}
            style={[input, { minHeight: 80, textAlignVertical: "top" }]}
          />
          <Button label={t("community.reply")} onPress={() => void send()} disabled={busy || body.trim().length < 2} />
        </Card>
      ) : null}
      {outcome ? <ModerationNotice outcome={outcome} /> : null}
      {error ? <ErrorNote message={error} /> : null}
    </Screen>
  );
}
