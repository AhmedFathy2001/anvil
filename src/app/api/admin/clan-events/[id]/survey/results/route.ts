import { NextResponse } from 'next/server';

import { verifyAdminOrModerator } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { liveClanEvent } from '@/lib/clanEventSignups';
import { surveyResults } from '@/lib/clanEventSurvey';

// Staff-only: a clan event's survey answers under one key (?key= a week's ISO start, or 'series').

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAdminOrModerator())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  const e = await liveClanEvent(clan.id, Number((await params).id));
  const key = new URL(request.url).searchParams.get('key');
  if (!e || !key) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(await surveyResults(clan.id, e.id, key));
}
