/**
 * "Questions to bring to your appointment" (roadmap 1.2). A curated, individual-facing question bank per journey
 * plus the person's own questions and notes. Questions help people talk with their care team; they never contain
 * advice. Stored on the device (and in encrypted sync when the person turns it on).
 */
import type { MessageKey, Translate } from "./i18n";
import type { Audience } from "./types";

export type QuestionGroupId = "general" | Audience;

/** Question ids map to `appointment.q.<id>` in every dictionary (checked at compile time). */
export const APPOINTMENT_QUESTIONS = {
  general: ["g_plain_words", "g_who_contact", "g_bring_someone", "g_reliable_info"],
  prevention: [
    "p_screening", "p_family_history", "p_vaccines", "p_symptoms",
    "p_quit_support", "p_weight_activity", "p_medicines", "p_hormones",
  ],
  in_treatment: [
    "t_goal", "t_options", "t_side_effects", "t_urgent_contact", "t_exercise", "t_food",
    "t_work", "t_fertility", "t_emotional", "t_trials", "t_second_opinion",
  ],
  after_treatment: [
    "a_followup", "a_recurrence", "a_late_effects", "a_activity", "a_diet_weight",
    "a_return_work", "a_fear", "a_care_plan",
  ],
  caregivers: ["c_how_help", "c_warning_signs", "c_information", "c_practical", "c_own_health", "c_respite"],
} as const satisfies Record<QuestionGroupId, readonly string[]>;

export type QuestionId = (typeof APPOINTMENT_QUESTIONS)[QuestionGroupId][number];

export interface CustomQuestion {
  id: string;
  text: string;
}

export interface AppointmentState {
  /** Bank questions and custom question ids, in the order the person added them. */
  selected: string[];
  custom: CustomQuestion[];
  /** Notes taken during or after the appointment, by question id. */
  notes: Record<string, string>;
}

export const EMPTY_APPOINTMENT: AppointmentState = { selected: [], custom: [], notes: {} };
export const MAX_CUSTOM_QUESTION = 300;

/** Groups in display order: the person's journey first, then general, then the others. */
export function questionGroups(journey: Audience | null | undefined): QuestionGroupId[] {
  const all: QuestionGroupId[] = ["prevention", "in_treatment", "after_treatment", "caregivers"];
  return journey ? [journey, "general", ...all.filter((g) => g !== journey)] : ["general", ...all];
}

export function questionText(t: Translate, state: AppointmentState, id: string): string | null {
  const custom = state.custom.find((c) => c.id === id);
  if (custom) return custom.text;
  const known = Object.values(APPOINTMENT_QUESTIONS).some((ids) => (ids as readonly string[]).includes(id));
  return known ? t(`appointment.q.${id}` as MessageKey) : null;
}

export function toggleQuestion(state: AppointmentState, id: string): AppointmentState {
  return state.selected.includes(id)
    ? { ...state, selected: state.selected.filter((x) => x !== id) }
    : { ...state, selected: [...state.selected, id] };
}

function customId(text: string): string {
  let hash = 0;
  for (const ch of text) hash = (Math.imul(31, hash) + ch.charCodeAt(0)) | 0;
  return `c_${(hash >>> 0).toString(36)}`;
}

export function addCustomQuestion(state: AppointmentState, text: string): AppointmentState {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, MAX_CUSTOM_QUESTION);
  if (clean.length < 3) return state;
  const id = customId(clean.toLowerCase());
  if (state.custom.some((c) => c.id === id)) {
    return state.selected.includes(id) ? state : { ...state, selected: [...state.selected, id] };
  }
  return { ...state, custom: [...state.custom, { id, text: clean }], selected: [...state.selected, id] };
}

export function removeQuestion(state: AppointmentState, id: string): AppointmentState {
  const { [id]: _removed, ...notes } = state.notes;
  return {
    selected: state.selected.filter((x) => x !== id),
    custom: state.custom.filter((c) => c.id !== id),
    notes,
  };
}

export function moveQuestion(state: AppointmentState, id: string, delta: -1 | 1): AppointmentState {
  const i = state.selected.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= state.selected.length) return state;
  const selected = [...state.selected];
  [selected[i], selected[j]] = [selected[j]!, selected[i]!];
  return { ...state, selected };
}

export function setNote(state: AppointmentState, id: string, note: string): AppointmentState {
  const notes = { ...state.notes };
  if (note.trim()) notes[id] = note.slice(0, 2000);
  else delete notes[id];
  return { ...state, notes };
}

/** Plain text for printing, sharing or copying. */
export function formatQuestionList(t: Translate, state: AppointmentState, date: Date = new Date(), locale = "en"): string {
  const lines = [`${t("appointment.listHeading")} — ${date.toLocaleDateString(locale, { dateStyle: "long" })}`, ""];
  let n = 0;
  for (const id of state.selected) {
    const text = questionText(t, state, id);
    if (!text) continue;
    n += 1;
    lines.push(`${n}. ${text}`);
    const note = state.notes[id];
    if (note) lines.push(`   ${t("appointment.notes")}: ${note}`);
  }
  lines.push("", `${t("disclaimer.short")}`);
  return lines.join("\n");
}
