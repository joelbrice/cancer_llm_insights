import { DESIGN_TIER, LEVEL_GRADE, translateDynamic, type EvidenceLevelId } from "@vitacite/shared";
import type { Metadata } from "next";

import { PageHeader } from "@/components/blocks";
import { EvidenceBadge } from "@/components/evidence";
import { Icon } from "@/components/Icon";
import { api, load } from "@/lib/api";
import { resolveLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t("methodology.title"), description: t("methodology.intro") };
}

const TIER_FILL = ["var(--ev-high)", "var(--ev-moderate)", "var(--ev-low)", "var(--ev-very-low)", "var(--surface-3)", "var(--surface-3)"];
const FALLBACK_WEIGHTS: Record<string, number> = {
  umbrella_review: 1, meta_analysis: 1, systematic_review: 0.95, guideline: 0.95, rct: 0.85, cohort: 0.65,
  case_control: 0.55, cross_sectional: 0.4, narrative_review: 0.45, institutional_web: 0.6, case_series: 0.25,
  expert_opinion: 0.3, preclinical: 0.15, news: 0.2, blog: 0.15, unknown: 0.2,
};

export default async function MethodologyPage({ params }: { params: Promise<{ lang: string }> }) {
  const { t } = await resolveLocale(params);
  const meta = await load(() => api.meta());
  const weights: Record<string, number> = meta.data
    ? Object.fromEntries(meta.data.study_designs.map((d) => [d.id, d.weight]))
    : FALLBACK_WEIGHTS;
  const tiers = [1, 2, 3, 4, 5, 6].map((tier) => ({
    tier,
    designs: Object.entries(DESIGN_TIER)
      .filter(([, v]) => v === tier)
      .map(([id]) => id)
      .sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0)),
  }));
  const levels: { id: EvidenceLevelId; min: string }[] = [
    { id: "high", min: "≥ 0.75" },
    { id: "moderate", min: "≥ 0.55" },
    { id: "low", min: "≥ 0.35" },
    { id: "very_low", min: "< 0.35" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <PageHeader title={t("methodology.title")} subtitle={t("methodology.intro")} />

      <section aria-labelledby="pyramid" className="card p-5 md:p-8">
        <h2 id="pyramid" className="text-xl font-semibold">
          {t("methodology.pyramidTitle")}
        </h2>
        <p className="mt-1 text-ink-2">{t("methodology.pyramidBody")}</p>
        <ol className="mt-6 space-y-2">
          {tiers.map(({ tier, designs }) => (
            <li key={tier} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-4">
              <div className="flex justify-center" aria-hidden="true">
                <div className="h-9 rounded-md" style={{ width: `${30 + (tier - 1) * 14}%`, background: TIER_FILL[tier - 1] }} />
              </div>
              <div className="text-sm">
                {designs.map((id) => (
                  <span key={id} className="mr-3 inline-block">
                    <span className="font-medium text-ink">{translateDynamic(t, "designs", id)}</span>{" "}
                    <span className="tabular-nums text-ink-3">
                      {t("methodology.weight")} {(weights[id] ?? 0).toFixed(2)}
                    </span>
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="grading" className="grid gap-6 md:grid-cols-2">
        <div className="card p-5">
          <h2 id="grading" className="text-lg font-semibold">
            {t("methodology.gradingTitle")}
          </h2>
          <p className="mt-2 text-ink-2">{t("methodology.gradingBody")}</p>
          <p className="mt-3 rounded-xl bg-surface-2 p-3 font-mono text-xs leading-relaxed text-ink-2">
            q = design × credibility × recency
            <br />
            score = 0.65·max(e) + 0.35·(1 − Π(1 − 0.6·e))
          </p>
        </div>
        <div className="card p-5">
          <h2 className="text-lg font-semibold">{t("methodology.levelsTitle")}</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {levels.map((l) => (
                <tr key={l.id} className="border-t border-line first:border-t-0">
                  <td className="py-2 pr-2">
                    <EvidenceBadge level={l.id} grade={LEVEL_GRADE[l.id]} t={t} size="sm" />
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 tabular-nums text-ink-3">{l.min}</td>
                  <td className="py-2 text-ink-2">{t(`levels.${l.id}Desc`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="caps" className="card p-5">
        <h2 id="caps" className="text-lg font-semibold">
          {t("methodology.capsTitle")}
        </h2>
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {(["cap1", "cap2", "cap3", "cap4"] as const).map((k) => (
            <li key={k} className="flex gap-2 text-ink-2">
              <Icon name="shield" size={18} className="mt-0.5 shrink-0 text-brand" />
              {t(`methodology.${k}`)}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {([
          ["verificationTitle", "verificationBody", "check"],
          ["abstentionTitle", "abstentionBody", "info"],
          ["safetyTitle", "safetyBody", "heart"],
        ] as const).map(([title, body, icon]) => (
          <div key={title} className="card p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Icon name={icon} />
            </span>
            <h2 className="mt-3 font-semibold">{t(`methodology.${title}`)}</h2>
            <p className="mt-1 text-sm text-ink-2">{t(`methodology.${body}`)}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
