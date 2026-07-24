// Shared survey types + pure helpers used by both the admin builder/results and the participant form.
// Question types: 'rating' (1–5), 'text' (free response), 'single' (one choice), 'multi' (many choices).

export const SURVEY_QUESTION_TYPES = ['rating', 'text', 'single', 'multi'] as const;
export type SurveyQuestionType = (typeof SURVEY_QUESTION_TYPES)[number];

export const RATING_MAX = 5;

export function isChoiceType(type: string): boolean {
  return type === 'single' || type === 'multi';
}

// A question as it travels to clients (options parsed out of the stored JSON string).
export interface SurveyQuestionView {
  id: number;
  position: number;
  type: SurveyQuestionType;
  prompt: string;
  options: string[]; // [] for rating/text
  required: boolean;
}

// One submission's answer map: questionId → the value for that question.
//  rating → number (1..RATING_MAX); text → string; single → string; multi → string[].
export type SurveyAnswerMap = Record<number, number | string | string[]>;

// Has the event finished, so the survey should open? Force-ended counts; otherwise the end date must
// have passed. (Uses `new Date()` — fine in server code / route handlers.)
export function isEventEnded(event: { forceEndedAt?: string | null; endDate?: string | null }): boolean {
  if (event.forceEndedAt) return true;
  if (event.endDate && new Date(event.endDate) <= new Date()) return true;
  return false;
}

// Parse a stored options JSON blob into a string[] (defensive: bad/absent → []).
export function parseOptions(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((o): o is string => typeof o === 'string') : [];
  } catch {
    return [];
  }
}

// Normalize a raw question row into a client view.
export function toQuestionView(row: {
  id: number;
  position: number;
  type: string;
  prompt: string;
  options: string | null;
  required: boolean;
}): SurveyQuestionView {
  const type = (SURVEY_QUESTION_TYPES as readonly string[]).includes(row.type)
    ? (row.type as SurveyQuestionType)
    : 'text';
  return {
    id: row.id,
    position: row.position,
    type,
    prompt: row.prompt,
    options: isChoiceType(type) ? parseOptions(row.options) : [],
    required: !!row.required,
  };
}

// Validate one submitted answer map against the question set. Returns an error string (first problem)
// or null when everything is acceptable. Coerces/whitelists values so a client can't inject junk:
// rating must be an int 1..RATING_MAX, single must be one of the options, multi a subset of them.
export function validateAnswers(
  questions: SurveyQuestionView[],
  answers: unknown,
): { ok: true; clean: SurveyAnswerMap } | { ok: false; error: string } {
  if (typeof answers !== 'object' || answers === null || Array.isArray(answers)) {
    return { ok: false, error: 'Malformed answers' };
  }
  const raw = answers as Record<string, unknown>;
  const clean: SurveyAnswerMap = {};

  for (const q of questions) {
    const v = raw[String(q.id)];
    const empty =
      v === undefined ||
      v === null ||
      (typeof v === 'string' && v.trim() === '') ||
      (Array.isArray(v) && v.length === 0);

    if (empty) {
      if (q.required) return { ok: false, error: `"${q.prompt}" is required` };
      continue;
    }

    if (q.type === 'rating') {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isInteger(n) || n < 1 || n > RATING_MAX) {
        return { ok: false, error: `"${q.prompt}" must be a rating from 1 to ${RATING_MAX}` };
      }
      clean[q.id] = n;
    } else if (q.type === 'text') {
      if (typeof v !== 'string') return { ok: false, error: `"${q.prompt}" must be text` };
      clean[q.id] = v.trim().slice(0, 4000);
    } else if (q.type === 'single') {
      if (typeof v !== 'string' || !q.options.includes(v)) {
        return { ok: false, error: `"${q.prompt}" has an invalid selection` };
      }
      clean[q.id] = v;
    } else {
      // multi
      const arr = Array.isArray(v) ? v : [v];
      const picked = arr.filter((o): o is string => typeof o === 'string' && q.options.includes(o));
      if (picked.length === 0) return { ok: false, error: `"${q.prompt}" has an invalid selection` };
      clean[q.id] = Array.from(new Set(picked));
    }
  }
  return { ok: true, clean };
}

// ── Results aggregation (staff view) ────────────────────────────────────────────────────────────

// One respondent's full submission, attributed (staff-only). Powers the "By person" results view;
// name is null for detached (deleted-user) rows.
export interface SurveyRespondentView {
  userId: number | null;
  name: string | null;
  submittedAt: string;
  answers: SurveyAnswerMap;
}

export interface QuestionResult {
  question: SurveyQuestionView;
  answered: number;
  // rating: average + count per star (keys '1'..'5'). single/multi: count per option. text: null.
  average: number | null;
  counts: Record<string, number> | null;
  // text answers, attributed (staff-only) — respondentName is null for detached (deleted-user) rows.
  texts: { respondentName: string | null; text: string }[] | null;
}

// Build per-question results from the questions + parsed responses. `nameFor` resolves a userId to a
// display name for text-answer attribution (staff-only).
export function aggregateSurvey(
  questions: SurveyQuestionView[],
  responses: { userId: number | null; answers: SurveyAnswerMap }[],
  nameFor: (userId: number | null) => string | null,
): QuestionResult[] {
  return questions.map((q) => {
    const answered = responses.filter((r) => {
      const v = r.answers[q.id];
      return v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0) && v !== '';
    });

    if (q.type === 'text') {
      return {
        question: q,
        answered: answered.length,
        average: null,
        counts: null,
        texts: answered.map((r) => ({ respondentName: nameFor(r.userId), text: String(r.answers[q.id]) })),
      };
    }

    if (q.type === 'rating') {
      const nums = answered.map((r) => Number(r.answers[q.id])).filter((n) => Number.isFinite(n));
      const counts: Record<string, number> = {};
      for (let i = 1; i <= RATING_MAX; i++) counts[String(i)] = 0;
      nums.forEach((n) => { counts[String(n)] = (counts[String(n)] ?? 0) + 1; });
      const average = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : null;
      return { question: q, answered: answered.length, average, counts, texts: null };
    }

    // single / multi
    const counts: Record<string, number> = {};
    for (const opt of q.options) counts[opt] = 0;
    for (const r of answered) {
      const v = r.answers[q.id];
      const picks = Array.isArray(v) ? v : [v];
      for (const p of picks) {
        const key = String(p);
        if (key in counts) counts[key] += 1;
      }
    }
    return { question: q, answered: answered.length, average: null, counts, texts: null };
  });
}
