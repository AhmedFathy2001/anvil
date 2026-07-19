import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, eventSignups, surveyQuestions, surveyResponses } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { isEventEnded, toQuestionView, validateAnswers } from '@/lib/survey';

// A participant submits (or updates) their survey response. Gated: must be logged in, hold an approved
// sign-up for this event, and the event must have ended. One response per user (upserted).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const { eventId } = await params;
  const eId = parseInt(eventId, 10);

  const event = await db.query.events.findFirst({ where: eq(events.id, eId) });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (!isEventEnded(event)) {
    return NextResponse.json({ error: 'The survey opens once the event has ended.' }, { status: 403 });
  }

  // Eligibility: anyone with an approved sign-up for this event.
  const signup = await db.query.eventSignups.findFirst({
    where: and(eq(eventSignups.eventId, eId), eq(eventSignups.userId, session.userId)),
  });
  if (!signup || signup.status !== 'approved') {
    return NextResponse.json({ error: 'Only approved participants can fill out this survey.' }, { status: 403 });
  }

  const qRows = await db.select().from(surveyQuestions).where(eq(surveyQuestions.eventId, eId));
  if (qRows.length === 0) {
    return NextResponse.json({ error: 'This event has no survey.' }, { status: 400 });
  }
  const questions = qRows.sort((a, b) => a.position - b.position).map(toQuestionView);

  const body = await request.json();
  const validated = validateAnswers(questions, body?.answers);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  await db
    .insert(surveyResponses)
    .values({
      eventId: eId,
      userId: session.userId,
      answers: JSON.stringify(validated.clean),
      submittedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: [surveyResponses.eventId, surveyResponses.userId],
      set: { answers: JSON.stringify(validated.clean), submittedAt: new Date().toISOString() },
    });

  return NextResponse.json({ ok: true });
}
