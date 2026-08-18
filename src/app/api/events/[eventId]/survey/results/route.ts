import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { surveyQuestions, surveyResponses, users } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { aggregateSurvey, toQuestionView, type SurveyAnswerMap } from '@/lib/survey';

// Staff-only survey results: per-question aggregation plus attributed free-text answers. Attribution
// (respondent name) never leaves this admin-gated endpoint.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);

  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const [qRows, rRows] = await Promise.all([
    db.select().from(surveyQuestions).where(eq(surveyQuestions.eventId, eId)),
    db.select().from(surveyResponses).where(eq(surveyResponses.eventId, eId)),
  ]);

  const questions = qRows.sort((a, b) => a.position - b.position).map(toQuestionView);

  const userIds = [...new Set(rRows.map((r) => r.userId).filter((v): v is number => v != null))];
  const nameRows = userIds.length
    ? await db.select({ id: users.id, displayName: users.displayName }).from(users).where(inArray(users.id, userIds))
    : [];
  const nameById = new Map(nameRows.map((u) => [u.id, u.displayName]));

  // Full attributed submissions, newest first — the "By person" view renders these directly.
  const respondents = rRows
    .map((r) => {
      let answers: SurveyAnswerMap = {};
      try {
        answers = JSON.parse(r.answers) as SurveyAnswerMap;
      } catch { /* skip a malformed blob */ }
      return {
        userId: r.userId,
        name: r.userId != null ? nameById.get(r.userId) ?? null : null,
        submittedAt: r.submittedAt,
        answers,
      };
    })
    .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));

  const results = aggregateSurvey(
    questions,
    respondents,
    (userId) => (userId != null ? nameById.get(userId) ?? null : null),
  );

  return NextResponse.json({
    responseCount: rRows.length,
    questionCount: questions.length,
    results,
    respondents,
  });
}
