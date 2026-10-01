"use client";

import { AUDIENCES, STORAGE_KEYS, type Profile } from "@stepwell/shared";
import { useState } from "react";

import { useT } from "@/lib/i18n-client";
import { removeLocal, useLocalState } from "@/lib/storage";

import { Icon } from "./Icon";

const AGE = ["<30", "30-39", "40-49", "50-59", "60-69", "70+"] as const;
const SEX = ["female", "male", "intersex", "prefer_not_to_say"] as const;
const PHASE = ["pre_treatment", "in_treatment", "post_treatment", "advanced", "survivorship"] as const;

export function ProfileForm() {
  const t = useT();
  const [profile, setProfile, loaded] = useLocalState<Profile>(STORAGE_KEYS.profile, {});
  const [message, setMessage] = useState<string | null>(null);
  if (!loaded) return <p className="text-ink-2">{t("common.loading")}</p>;
  const update = (patch: Partial<Profile>) => {
    setProfile((prev) => ({ ...prev, ...patch }));
    setMessage(t("common.saved"));
  };
  return (
    <form className="card space-y-5 p-5 md:p-8" onSubmit={(e) => e.preventDefault()}>
      <fieldset>
        <legend className="label">{t("profile.audience")}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {AUDIENCES.map((a) => (
            <label key={a} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 ${profile.audience === a ? "border-brand bg-brand-soft" : "border-line-strong"}`}>
              <input type="radio" name="audience" className="accent-[var(--brand)]" checked={profile.audience === a} onChange={() => update({ audience: a })} />
              {t(`audiences.${a}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="p-age">
            {t("profile.ageRange")}
          </label>
          <select id="p-age" className="field" value={profile.age_range ?? ""} onChange={(e) => update({ age_range: (e.target.value || null) as Profile["age_range"] })}>
            <option value="">{t("profile.notSet")}</option>
            {AGE.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="p-sex">
            {t("profile.sex")}
          </label>
          <select id="p-sex" className="field" value={profile.sex ?? ""} onChange={(e) => update({ sex: (e.target.value || null) as Profile["sex"] })}>
            <option value="">{t("profile.notSet")}</option>
            {SEX.map((s) => (
              <option key={s} value={s}>
                {t(`profile.sexes.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="p-phase">
            {t("profile.phase")}
          </label>
          <select id="p-phase" className="field" value={profile.treatment_phase ?? ""} onChange={(e) => update({ treatment_phase: (e.target.value || null) as Profile["treatment_phase"] })}>
            <option value="">{t("profile.notSet")}</option>
            {PHASE.map((p) => (
              <option key={p} value={p}>
                {t(`profile.phases.${p}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="p-country">
            {t("profile.country")}
          </label>
          <input
            id="p-country"
            className="field uppercase"
            maxLength={2}
            placeholder="FR"
            value={profile.country ?? ""}
            onChange={(e) => update({ country: e.target.value.replace(/[^a-z]/gi, "").toUpperCase() || null })}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="p-types">
          {t("profile.cancerTypes")}
        </label>
        <input
          id="p-types"
          className="field"
          defaultValue={(profile.cancer_types ?? []).join(", ")}
          onBlur={(e) => update({ cancer_types: e.target.value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 5) })}
          aria-describedby="p-types-help"
        />
        <p id="p-types-help" className="mt-1 text-xs text-ink-3">
          {t("profile.cancerTypesHelp")}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <p className="text-sm text-ink-2" role="status">
          {message}
        </p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            for (const key of Object.values(STORAGE_KEYS)) removeLocal(key);
            setProfile({});
            setMessage(t("profile.cleared"));
          }}
        >
          <Icon name="trash" size={18} />
          {t("profile.clear")}
        </button>
      </div>
    </form>
  );
}
