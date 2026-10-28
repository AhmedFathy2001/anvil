import { NextResponse } from 'next/server';

import { verifyAdminOrModerator } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { addSurveyTemplate } from '@/lib/clanEventQuestions';
import { liveClanEvent } from '@/lib/clanEventSignups';

// Start a clan event's survey from a curated template (lib/surveyTemplates); its questions are added after any already there.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAdminOrModerator())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  const e = await liveClanEvent(clan.id, Number((await params).id));
  if (!e) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { templateId } = (await request.json().catch(() => ({}))) as { templateId?: unknown };
  const questions = await addSurveyTemplate(clan.id, e.id, String(templateId ?? ''));
  return questions ? NextResponse.json({ questions }) : NextResponse.json({ error: 'Unknown template' }, { status: 400 });
}
