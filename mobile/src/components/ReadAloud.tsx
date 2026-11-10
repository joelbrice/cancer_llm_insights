import { speechChunks, speechLanguage } from "@stepwell/shared";
import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";

import { useSettings } from "@/lib/settings";

import { Button } from "./ui";

type State = "idle" | "speaking" | "paused";

/** Read-aloud with the device's own text-to-speech (expo-speech): nothing is sent anywhere. */
export function ReadAloud({ text }: { text: string }) {
  const { t, locale } = useSettings();
  const [state, setState] = useState<State>("idle");
  const queue = useRef<string[]>([]);
  const run = useRef(0);

  useEffect(
    () => () => {
      run.current += 1;
      void Speech.stop();
    },
    [],
  );

  const next = (id: number) => {
    if (id !== run.current) return;
    const chunk = queue.current.shift();
    if (!chunk) {
      setState("idle");
      return;
    }
    Speech.speak(chunk, {
      language: speechLanguage(locale),
      rate: 0.95,
      onDone: () => next(id),
      onError: () => {
        if (id === run.current) setState("idle");
      },
    });
  };
  const start = () => {
    run.current += 1;
    void Speech.stop();
    queue.current = speechChunks(text, 400);
    setState("speaking");
    next(run.current);
  };
  const stop = () => {
    run.current += 1;
    queue.current = [];
    void Speech.stop();
    setState("idle");
  };

  if (state === "idle") return <Button variant="ghost" icon="volume-high-outline" label={t("readAloud.listen")} onPress={start} />;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {Platform.OS === "ios" ? (
        state === "speaking" ? (
          <Button variant="ghost" icon="pause" label={t("readAloud.pause")} onPress={() => (void Speech.pause(), setState("paused"))} />
        ) : (
          <Button variant="ghost" icon="play" label={t("readAloud.resume")} onPress={() => (void Speech.resume(), setState("speaking"))} />
        )
      ) : null}
      <Button variant="ghost" icon="stop" label={t("readAloud.stop")} onPress={stop} />
    </View>
  );
}
