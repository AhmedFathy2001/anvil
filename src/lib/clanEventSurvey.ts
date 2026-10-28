import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { clanEventSignups, clanEventSurveyResponses, users } from '@/db/schema';
import { parseModules, surveyKey } from '@/lib/clanEventModules';
import { loadQuestions } from '@/lib/clanEventQuestions';
import { ACTIVE, liveClanEvent } from '@/lib/clanEventSignups';
import { aggregateSurvey, validateAnswers, type QuestionResult, type SurveyAnswerMap, type SurveyRespondentView } from '@/lib/survey';

// The survey after a clan event: it asks about the occurrence that just ended (or the series),
// once per person. When the event took sign-ups, only those on the list are asked — the same rule
// a board's survey keeps. Results are staff-only.

type Result<T> = { ok: true; value: T } | { ok: false; error: string; status: number };

/** Who may answer, and about which key; or why not. */
async function askable(clanId: number, eventId: number, userId: number, now: number): Promise<Result<{ key: string }>> {
  const e = await liveClanEvent(clanId, eventId);
  if (!e) return { ok: false, error: 'That event isn’t on any more.', status: 404 };
  const m = parseModules(e.modules);
  const key = surveyKey(m, e, now);
  if (!key) return { ok: false, error: m.survey.on ? 'The survey opens once it’s over.' : 'This event has no survey.', status: 409 };
  if (m.signups.on) {
    const signed = await db.query.clanEventSignups.findFirst({
      where: and(eq(clanEventSignups.clanId, clanId), eq(clanEventSignups.clanEventId, eventId), eq(clanEventSignups.occurrence, key), eq(clanEventSignups.userId, userId), inArray(clanEventSignups.status, ACTIVE)),
    });
    if (!signed) return { ok: false, error: 'The survey is for people who signed up.', status: 403 };
  }
  return { ok: true, value: { key } };
}

/** The survey as one person sees it: its questions, and whether they already answered. */
export async function surveyFor(clanId: number, eventId: number, userId: number, now = Date.now()) {
  const can = await askable(clanId, eventId, userId, now);
  if (!can.ok) return can;
  const questions = await loadQuestions(clanId, eventId, 'post');
  const done = await db.query.clanEventSurveyResponses.findFirst({
    where: and(eq(clanEventSurveyResponses.clanId, clanId), eq(clanEventSurveyResponses.clanEventId, eventId), eq(clanEventSurveyResponses.occurrence, can.value.key), eq(clanEventSurveyResponses.userId, userId)),
  });
  return { ok: true as const, value: { key: can.value.key, questions, answered: done != null } };
}

export async function answerSurvey(clanId: number, eventId: number, userId: number, answers: unknown, now = Date.now()): Promise<Result<null>> {
  const can = await askable(clanId, eventId, userId, now);
  if (!can.ok) return can;
  const checked = validateAnswers(await loadQuestions(clanId, eventId, 'post'), answers);
  if (!checked.ok) return { ok: false, error: checked.error, status: 400 };
  const inserted = await db
    .insert(clanEventSurveyResponses)
    .values({ clanId, clanEventId: eventId, occurrence: can.value.key, userId, answers: checked.clean })
    .onConflictDoNothing()
    .returning({ id: clanEventSurveyResponses.id });
  return inserted.length ? { ok: true, value: null } : { ok: false, error: 'You already answered.', status: 409 };
}

/** Staff: the answers under one key, per question and per person. */
export async function surveyResults(clanId: number, eventId: number, key: string): Promise<{ results: QuestionResult[]; respondents: SurveyRespondentView[]; responseCount: number }> {
  const questions = await loadQuestions(clanId, eventId, 'post');
  const rows = await db
    .select({ userId: clanEventSurveyResponses.userId, answers: clanEventSurveyResponses.answers, submittedAt: clanEventSurveyResponses.submittedAt, name: users.displayName })
    .from(clanEventSurveyResponses)
    .leftJoin(users, eq(users.id, clanEventSurveyResponses.userId))
    .where(and(eq(clanEventSurveyResponses.clanId, clanId), eq(clanEventSurveyResponses.clanEventId, eventId), eq(clanEventSurveyResponses.occurrence, key)));
  const names = new Map(rows.map((r) => [r.userId, r.name]));
  const responses = rows.map((r) => ({ userId: r.userId, answers: r.answers as SurveyAnswerMap }));
  return {
    results: aggregateSurvey(questions, responses, (id) => names.get(id) ?? null),
    respondents: rows.map((r) => ({ userId: r.userId, name: r.name, submittedAt: r.submittedAt, answers: r.answers as SurveyAnswerMap })),
    responseCount: rows.length,
  };
}
