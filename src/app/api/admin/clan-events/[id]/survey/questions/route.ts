import { NextResponse } from 'next/server';

import { verifyAdminOrModerator } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { loadQuestions, saveQuestions } from '@/lib/clanEventQuestions';
import { liveClanEvent } from '@/lib/clanEventSignups';
import { toSurveyStage } from '@/lib/survey';

// A clan event's questions — the sign-up form's ('signup') or the survey's ('post'). The builder
// (SurveyClient) saves a stage's whole set at once.

async function scope(params: Promise<{ id: string }>) {
  if (!(await verifyAdminOrModerator())) return null;
  const clan = await requireClan();
  const e = await liveClanEvent(clan.id, Number((await params).id));
  return e ? { clanId: clan.id, eventId: e.id } : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await scope(params);
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const stage = toSurveyStage(new URL(request.url).searchParams.get('stage'));
  return NextResponse.json({ stage, questions: await loadQuestions(s.clanId, s.eventId, stage) });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await scope(params);
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { stage?: unknown; questions?: unknown };
  const r = await saveQuestions(s.clanId, s.eventId, toSurveyStage(body.stage), body.questions);
  return r.ok ? NextResponse.json({ questions: r.questions }) : NextResponse.json({ error: r.error }, { status: 400 });
}
