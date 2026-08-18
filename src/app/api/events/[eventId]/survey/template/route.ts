import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { surveyQuestions, events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { isChoiceType, toQuestionView } from '@/lib/survey';
import { surveyTemplateById } from '@/lib/surveyTemplates';

// Load a curated template into the event's survey — appends its questions after any that already
// exist (positions continue from the current max), so it composes with a hand-built survey.
export async function POST(
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
  const event = await db.query.events.findFirst({ where: eq(events.id, eId) });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const { templateId } = await request.json();
  const template = surveyTemplateById(String(templateId));
  if (!template) return NextResponse.json({ error: 'Unknown template' }, { status: 400 });

  const existing = await db
    .select({ position: surveyQuestions.position })
    .from(surveyQuestions)
    .where(eq(surveyQuestions.eventId, eId));
  const base = existing.reduce((max, r) => Math.max(max, r.position + 1), 0);

  await db.insert(surveyQuestions).values(
    template.questions.map((q, i) => ({
      eventId: eId,
      position: base + i,
      type: q.type,
      prompt: q.prompt,
      options: isChoiceType(q.type) && q.options ? JSON.stringify(q.options) : null,
      required: !!q.required,
    })),
  );

  const rows = await db.select().from(surveyQuestions).where(eq(surveyQuestions.eventId, eId));
  return NextResponse.json({
    questions: rows.sort((a, b) => a.position - b.position).map(toQuestionView),
  });
}
