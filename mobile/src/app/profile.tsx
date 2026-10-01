import { AUDIENCES, STORAGE_KEYS, type Profile } from "@stepwell/shared";
import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";

import { Button, Card, Chip, Loading, Screen, Txt } from "@/components/ui";
import { useSettings } from "@/lib/settings";
import { useStored } from "@/lib/storage";
import { radius, space } from "@/lib/theme";

const AGES = ["<30", "30-39", "40-49", "50-59", "60-69", "70+"] as const;
const SEXES = ["female", "male", "intersex", "prefer_not_to_say"] as const;
const PHASES = ["pre_treatment", "in_treatment", "post_treatment", "advanced", "survivorship"] as const;

function Choice<T extends string>({ label, options, value, onChange, render }: { label: string; options: readonly T[]; value: T | null | undefined; onChange: (v: T | null) => void; render: (v: T) => string }) {
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="label">{label}</Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => (
          <Chip key={o} label={render(o)} selected={value === o} onPress={() => onChange(value === o ? null : o)} />
        ))}
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { t, colors } = useSettings();
  const [saved, setSaved, loaded] = useStored<Profile>(STORAGE_KEYS.profile, {});
  const [draft, setDraft] = useState<Profile>({});
  const [types, setTypes] = useState("");
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (loaded) {
      setDraft(saved);
      setTypes((saved.cancer_types ?? []).join(", "));
    }
    // initialise the form once the saved profile is read
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);
  if (!loaded) return <Loading />;
  const set = (patch: Partial<Profile>) => (setDraft((d) => ({ ...d, ...patch })), setOk(false));
  const input = { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space(3), color: colors.ink, backgroundColor: colors.surface, fontSize: 16 };
  return (
    <Screen>
      <Card style={{ backgroundColor: colors.surface2 }}>
        <Txt variant="small">{t("profile.privacy")}</Txt>
      </Card>
      <Choice label={t("profile.audience")} options={AUDIENCES} value={draft.audience} onChange={(audience) => set({ audience })} render={(a) => t(`audiences.${a}`)} />
      <Choice label={t("profile.ageRange")} options={AGES} value={draft.age_range} onChange={(age_range) => set({ age_range })} render={(a) => a} />
      <Choice label={t("profile.sex")} options={SEXES} value={draft.sex} onChange={(sex) => set({ sex })} render={(s) => t(`profile.sexes.${s}`)} />
      {draft.audience && draft.audience !== "prevention" ? (
        <Choice label={t("profile.phase")} options={PHASES} value={draft.treatment_phase} onChange={(treatment_phase) => set({ treatment_phase })} render={(p) => t(`profile.phases.${p}`)} />
      ) : null}
      <View style={{ gap: 6 }}>
        <Txt variant="label">{t("profile.cancerTypes")}</Txt>
        <TextInput value={types} onChangeText={(v) => (setTypes(v), setOk(false))} placeholder="breast, colorectal" placeholderTextColor={colors.ink3} style={input} accessibilityLabel={t("profile.cancerTypes")} />
        <Txt variant="muted">{t("profile.cancerTypesHelp")}</Txt>
      </View>
      <View style={{ gap: 6 }}>
        <Txt variant="label">{t("profile.country")}</Txt>
        <TextInput
          value={draft.country ?? ""}
          onChangeText={(v) => set({ country: v.toUpperCase().slice(0, 2) || null })}
          placeholder="FR"
          autoCapitalize="characters"
          maxLength={2}
          placeholderTextColor={colors.ink3}
          style={[input, { width: 90 }]}
          accessibilityLabel={t("profile.country")}
        />
      </View>
      <Button
        icon={ok ? "checkmark" : "save-outline"}
        label={ok ? t("common.saved") : t("common.save")}
        onPress={() => {
          const cancer_types = types.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 10);
          setSaved({ ...draft, cancer_types });
          setOk(true);
        }}
      />
      <Button
        variant="danger"
        icon="trash-outline"
        label={t("profile.clear")}
        onPress={() => {
          setSaved({});
          setDraft({});
          setTypes("");
          setOk(false);
        }}
      />
    </Screen>
  );
}
