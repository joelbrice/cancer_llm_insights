"use client";

import { speechChunks, speechLanguage } from "@stepwell/shared";
import { useEffect, useRef, useState } from "react";

import { useT } from "@/lib/i18n-client";

import { Icon } from "./Icon";

type State = "idle" | "speaking" | "paused";

/**
 * Read-aloud with the browser's own speech engine (Web Speech API): nothing leaves the device. Text is spoken in
 * sentence-sized chunks because some engines stop long utterances. Hidden where speech is unavailable.
 */
export function ReadAloud({ text, lang }: { text: string; lang: string }) {
  const t = useT();
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<State>("idle");
  const queue = useRef<string[]>([]);
  const run = useRef(0); // ignores events from utterances that were cancelled

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window);
    return () => {
      run.current += 1;
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, []);

  if (!supported) return null;
  const synth = window.speechSynthesis;

  const voice = () => {
    const tag = speechLanguage(lang).toLowerCase();
    const voices = synth.getVoices();
    return voices.find((v) => v.lang.toLowerCase() === tag) ?? voices.find((v) => v.lang.toLowerCase().startsWith(lang)) ?? null;
  };

  const next = (id: number) => {
    if (id !== run.current) return;
    const chunk = queue.current.shift();
    if (!chunk) {
      setState("idle");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = speechLanguage(lang);
    const v = voice();
    if (v) utterance.voice = v;
    utterance.rate = 0.95;
    utterance.onend = () => next(id);
    utterance.onerror = () => id === run.current && setState("idle");
    synth.speak(utterance);
  };

  const start = () => {
    run.current += 1;
    synth.cancel();
    queue.current = speechChunks(text);
    setState("speaking");
    next(run.current);
  };
  const stop = () => {
    run.current += 1;
    queue.current = [];
    synth.cancel();
    setState("idle");
  };

  if (state === "idle") {
    return (
      <button type="button" className="btn btn-ghost !min-h-10 !px-3 text-sm" onClick={start}>
        <Icon name="volume" size={16} />
        {t("readAloud.listen")}
      </button>
    );
  }
  return (
    <span className="inline-flex gap-2" role="group" aria-label={t("readAloud.listen")}>
      {state === "speaking" ? (
        <button type="button" className="btn btn-ghost !min-h-10 !px-3 text-sm" onClick={() => (synth.pause(), setState("paused"))}>
          <Icon name="pause" size={16} />
          {t("readAloud.pause")}
        </button>
      ) : (
        <button type="button" className="btn btn-ghost !min-h-10 !px-3 text-sm" onClick={() => (synth.resume(), setState("speaking"))}>
          <Icon name="play" size={16} />
          {t("readAloud.resume")}
        </button>
      )}
      <button type="button" className="btn btn-ghost !min-h-10 !px-3 text-sm" onClick={stop}>
        <Icon name="stop" size={16} />
        {t("readAloud.stop")}
      </button>
    </span>
  );
}
