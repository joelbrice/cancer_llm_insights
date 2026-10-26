# Regulatory qualification memo (EU MDR and AI Act): DRAFT

> **Status: draft for regulatory counsel.** It sets out how the software is built and why it is designed to fall
> outside the medical device definition. The qualification decision and the final wording belong to counsel and
> the manufacturer. Prepared October 2026 from BUILD_SPEC §5–§10 and the code.

## 1. Product and intended purpose

Stepwell is web and mobile software that gives evidence-based information about lifestyle and cancer and hosts a
moderated peer-support community.

**Intended purpose** (BUILD_SPEC §10.4, to be used unchanged in all labelling and marketing):

> General, evidence-based health education and peer support for adults about lifestyle and wellbeing in relation
> to cancer. It is not intended to diagnose, treat, monitor, predict or prevent disease in an individual, nor to
> inform clinical management.

## 2. MDR qualification (Regulation (EU) 2017/745, MDCG 2019-11)

| MDCG 2019-11 step | Assessment |
|---|---|
| 1. Is it software? | Yes. |
| 2. Is it an Annex XVI product, an accessory, or software driving or influencing a device? | No. |
| 3. Does it act on data beyond storage, archiving, communication, simple search or lossless compression? | Yes: it retrieves, ranks, summarises and grades published research. |
| 4. Is that action for the benefit of individual patients? | **The key question.** The output is general information drawn from published literature: the same evidence and grades for anyone asking the same question. Profile fields (journey, cancer type, treatment phase) only steer which general topics are relevant; they do not produce patient-specific findings, scores or recommendations. MDCG 2019-11 treats software that gives general medical knowledge (literature, knowledge bases) and software for general wellbeing as not medical devices. |
| 5. Is the intended purpose one of those in Art. 2(1)? | Not as designed. There is no diagnosis, prognosis, prediction, monitoring or treatment of an individual. "Prevention" appears only as population-level health education (for example the European Code Against Cancer), not as prevention of disease in a specific person. |

**Provisional conclusion (for counsel):** as designed and labelled, Stepwell is not a medical device software
(MDSW). If it were, Rule 11 would apply: information used for decisions with diagnostic or therapeutic purposes is
at least class IIa. This is why the design boundaries below matter.

### Design features that keep the product outside the definition

| Feature | Control in the software |
|---|---|
| No individual risk calculation | The lifestyle check compares habits with public recommendations, says "not a risk score" on every result, and shows no numbers or probabilities (hazard H7) |
| No symptom interpretation or diagnosis | `diagnosis_request` and `oncologic_urgent` safety rules redirect to the care team or emergency services before any answer (H2, H6) |
| No treatment recommendations | `treatment_decision`, `supplement_interaction` and `harmful_alternative` rules; output rules block cure and stop-treatment claims; a care-team note on treatment questions (H5) |
| General, cited information only | Answers are built only from the library, verified statement by statement, graded for evidence strength, with abstention when the evidence is insufficient (H3, H4) |
| Clear labelling | First-launch notice, disclaimer on every page and answer, terms of use (§ "What Stepwell is, and what it is not"), store descriptions |

### Changes that would require re-qualification before development

- Any personal risk estimate, score or probability, for example "your risk of colorectal cancer".
- Symptom checking or triage beyond redirecting to care.
- Recommendations about a specific person's treatment, dose, drug interactions or screening schedule.
- Monitoring of health data over time with alerts (for example reacting to step counts or symptoms).
- Use by healthcare professionals for decisions about patients.
- Marketing claims that the app prevents or detects cancer for the user.

Changes to safety rules, topic guidance and models go through the CSO (BUILD_SPEC §8). Product changes from the
list above go to regulatory counsel first.

### Points for counsel to confirm

1. **Store subtitle.** "Cancer prevention & support" (and its translations) should not read as a preventive claim
   for the individual. Options: keep it, given the intended purpose and the disclaimers, or use "Cancer prevention
   info & support". Texts: `mobile/store.config.json`, `mobile/store/google-play/`.
2. **Profile-based tailoring** of general answers (journey, cancer type, treatment phase): confirm that it stays
   on the non-device side of step 4.
3. **UK (MHRA) and US (FDA General Wellness / CDS criteria) positions** if those markets are planned.

## 3. EU AI Act (Regulation (EU) 2024/1689)

- **Not a high-risk AI system.**
  - Not under Art. 6(1): it is not a safety component of, or itself, a product needing third-party conformity
    assessment under Annex I legislation, given the MDR conclusion above.
  - Not under Art. 6(2) / Annex III: the community's crisis screening holds posts and orders the moderation queue
    within the service. It does not triage emergency calls or dispatch emergency services (Annex III point 5(d)).
  - **Re-assess if the MDR qualification changes.**
- **Transparency obligations (Art. 50), applicable since 2 August 2026:**
  - **Interacting with AI (Art. 50(1)).** People asking questions are told the answers are generated with AI (terms
    of use; the answer view).
  - **AI-generated text published to inform the public (Art. 50(4)).** Insights are generated with AI.
    - Disclosure is required unless the text has undergone human review or editorial control, with a person
      holding editorial responsibility.
    - With `INSIGHT_REVIEW_REQUIRED=true`, every insight is clinically reviewed and signed off by a named
      reviewer before publication. Counsel to confirm whether this meets the exception, or whether to also label
      insights as AI-generated (recommended either way for trust).
- **General-purpose AI model obligations** stay with the model provider (Meta, Llama). QLoRA fine-tuning uses far
  less compute than the threshold in the Commission's guidelines for a modification that makes the modifier a new
  provider; counsel to confirm. The Llama licence terms (attribution "Built with Llama", acceptable use policy)
  are met in the product.

## 4. Sign-off

- [ ] Regulatory counsel: qualification decision and wording of the intended purpose.
- [ ] Manufacturer and CSO: the design boundaries above are part of change control.
- [ ] Review: on every change to features, claims or target markets, and at least yearly.
