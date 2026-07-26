import { NextResponse } from 'next/server';
import { db } from '@/db';
import { surveyQuestions, events } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { SURVEY_QUESTION_TYPES, isChoiceType, toQuestionView, type SurveyQuestionType } from '@/lib/survey';

// Admin survey builder. GET returns the ordered question set; PUT saves the whole set at once,
// upserting by id (so questions that persist keep their id — and therefore stay linked to any answers
// already submitted against them) and deleting any that were removed in the editor.

async function loadOrdered(eventId: number) {
  const rows = await db
    .select()
    .from(surveyQuestions)
    .where(eq(surveyQuestions.eventId, eventId));
  return rows.sort((a, b) => a.position - b.position).map(toQuestionView);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  return NextResponse.json({ questions: await loadOrdered(eId) });
}

interface IncomingQuestion {
  id?: number;
  type: string;
  prompt: string;
  options?: string[];
  required?: boolean;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);

  const event = await db.query.events.findFirst({ where: eq(events.id, eId) });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const body = await request.json();
  const incoming: IncomingQuestion[] = Array.isArray(body?.questions) ? body.questions : [];

  let saved;
  try {
    // Validate + normalize every question before touching the DB (a bad shape → 400, not a 500).
    const normalized = incoming.map((q, i) => {
      const type = (SURVEY_QUESTION_TYPES as readonly string[]).includes(q.type)
        ? (q.type as SurveyQuestionType)
        : null;
      if (!type) throw new Error(`Question ${i + 1}: invalid type`);
      const prompt = typeof q.prompt === 'string' ? q.prompt.trim() : '';
      if (!prompt) throw new Error(`Question ${i + 1}: prompt is required`);
      let options: string[] | null = null;
      if (isChoiceType(type)) {
        options = (Array.isArray(q.options) ? q.options : [])
          .map((o) => (typeof o === 'string' ? o.trim() : ''))
          .filter(Boolean);
        if (options.length < 2) throw new Error(`Question ${i + 1}: choice questions need at least 2 options`);
      }
      return {
        id: typeof q.id === 'number' ? q.id : undefined,
        position: i,
        type,
        prompt: prompt.slice(0, 500),
        options: options ? JSON.stringify(options.slice(0, 20)) : null,
        required: !!q.required,
      };
    });

    // Existing question ids for this event — anything not resubmitted gets deleted.
    const existing = await db
      .select({ id: surveyQuestions.id })
      .from(surveyQuestions)
      .where(eq(surveyQuestions.eventId, eId));
    const existingIds = new Set(existing.map((r) => r.id));
    const keptIds = new Set(normalized.filter((q) => q.id && existingIds.has(q.id)).map((q) => q.id!));

    const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
    if (toDelete.length > 0) {
      await db.delete(surveyQuestions).where(
        and(eq(surveyQuestions.eventId, eId), inArray(surveyQuestions.id, toDelete)),
      );
    }

    for (const q of normalized) {
      if (q.id && existingIds.has(q.id)) {
        await db
          .update(surveyQuestions)
          .set({ position: q.position, type: q.type, prompt: q.prompt, options: q.options, required: q.required })
          .where(and(eq(surveyQuestions.id, q.id), eq(surveyQuestions.eventId, eId)));
      } else {
        await db.insert(surveyQuestions).values({
          eventId: eId,
          position: q.position,
          type: q.type,
          prompt: q.prompt,
          options: q.options,
          required: q.required,
        });
      }
    }
    saved = await loadOrdered(eId);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Save failed' }, { status: 400 });
  }

  return NextResponse.json({ questions: saved });
}
