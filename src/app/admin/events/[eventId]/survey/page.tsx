import { db } from '@/db';
import { events, surveyQuestions, surveyResponses } from '@/db/schema';
import { eq, count } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import SurveyClient from './SurveyClient';
import { isEventEnded, toQuestionView } from '@/lib/survey';
import { SURVEY_TEMPLATES } from '@/lib/surveyTemplates';

export const dynamic = 'force-dynamic';

export default async function EventSurveyPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) notFound();

  const [qRows, [{ c: responseCount }]] = await Promise.all([
    db.select().from(surveyQuestions).where(eq(surveyQuestions.eventId, id)),
    db.select({ c: count() }).from(surveyResponses).where(eq(surveyResponses.eventId, id)),
  ]);

  const questions = qRows.sort((a, b) => a.position - b.position).map(toQuestionView);
  const templates = SURVEY_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    questionCount: t.questions.length,
  }));

  return (
    <SurveyClient
      eventId={id}
      ended={isEventEnded(event)}
      initialQuestions={questions}
      responseCount={responseCount}
      templates={templates}
    />
  );
}
