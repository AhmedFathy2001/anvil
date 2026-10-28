import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { clanEventQuestions } from '@/db/schema';
import { SURVEY_QUESTION_TYPES, isChoiceType, toQuestionView, type SurveyQuestionType, type SurveyQuestionView, type SurveyStage } from '@/lib/survey';

// A clan event's own questions: on its sign-up form ('signup') and in the survey after ('post'). The
// same model, builder and answer checks as a board's (lib/survey) — only where they're kept differs.

export async function loadQuestions(clanId: number, eventId: number, stage: SurveyStage): Promise<SurveyQuestionView[]> {
  const rows = await db
    .select()
    .from(clanEventQuestions)
    .where(and(eq(clanEventQuestions.clanId, clanId), eq(clanEventQuestions.clanEventId, eventId), eq(clanEventQuestions.stage, stage)));
  return rows.sort((a, b) => a.position - b.position).map(toQuestionView);
}

interface Incoming {
  id?: unknown;
  type?: unknown;
  prompt?: unknown;
  options?: unknown;
  required?: unknown;
}

/**
 * Save a stage's whole set: ids that come back keep their row (and so the answers given to them),
 * anything missing is deleted. Scoped to the one stage, so saving the sign-up form can't touch the survey.
 */
export async function saveQuestions(clanId: number, eventId: number, stage: SurveyStage, incoming: unknown): Promise<{ ok: true; questions: SurveyQuestionView[] } | { ok: false; error: string }> {
  const list: Incoming[] = Array.isArray(incoming) ? incoming.slice(0, 40) : [];
  const normalized = [];
  for (const [i, q] of list.entries()) {
    const type = (SURVEY_QUESTION_TYPES as readonly string[]).includes(String(q.type)) ? (q.type as SurveyQuestionType) : null;
    if (!type) return { ok: false, error: `Question ${i + 1}: invalid type` };
    const prompt = typeof q.prompt === 'string' ? q.prompt.trim().slice(0, 500) : '';
    if (!prompt) return { ok: false, error: `Question ${i + 1}: prompt is required` };
    let options: string | null = null;
    if (isChoiceType(type)) {
      const opts = (Array.isArray(q.options) ? q.options : []).map((o) => (typeof o === 'string' ? o.trim() : '')).filter(Boolean);
      if (opts.length < 2) return { ok: false, error: `Question ${i + 1}: choice questions need at least 2 options` };
      options = JSON.stringify(opts.slice(0, 20));
    }
    normalized.push({ id: typeof q.id === 'number' ? q.id : null, position: i, type, prompt, options, required: q.required === true });
  }

  const scope = and(eq(clanEventQuestions.clanId, clanId), eq(clanEventQuestions.clanEventId, eventId), eq(clanEventQuestions.stage, stage));
  // clan-scope: this clan -- `scope` above carries clanId.
  const existing = new Set((await db.select({ id: clanEventQuestions.id }).from(clanEventQuestions).where(scope)).map((r) => r.id));
  const kept = new Set(normalized.flatMap((q) => (q.id != null && existing.has(q.id) ? [q.id] : [])));
  const gone = [...existing].filter((id) => !kept.has(id));
  if (gone.length) await db.delete(clanEventQuestions).where(and(scope, inArray(clanEventQuestions.id, gone)));
  for (const q of normalized) {
    const { id, ...fields } = q;
    if (id != null && kept.has(id)) await db.update(clanEventQuestions).set(fields).where(and(scope, eq(clanEventQuestions.id, id)));
    else await db.insert(clanEventQuestions).values({ clanId, clanEventId: eventId, stage, ...fields });
  }
  return { ok: true, questions: await loadQuestions(clanId, eventId, stage) };
}
