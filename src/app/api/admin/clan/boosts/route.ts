import { NextResponse } from 'next/server';

import { verifyAdmin, verifyUser } from '@/lib/auth';
import { clanBoostSummary, sendRecruitPost, setClanBoostNameStyle, setRecruitingLine } from '@/lib/clanBoosts';
import { requireClan } from '@/lib/clanContext';

export const dynamic = 'force-dynamic';

// Clan settings → Boosts (lib/clanBoosts): the clan's level and grace, its recruiting line (Level 2)
// and its monthly recruitment post into Anvil's own Discord (Level 3). ADMIN (and owner) only, like
// the rest of the clan profile. The level, the monthly limit and the text rules are all enforced in
// lib/clanBoosts.
//
//   GET                         → ClanBoostSummary
//   PUT  { recruitingLine }     → save or clear (null / '') the line
//   POST { post }               → send this month's recruitment post

export async function GET() {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await clanBoostSummary(clan.id));
}

export async function PUT(request: Request) {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { recruitingLine?: unknown; nameStyle?: unknown } | null;
  if (!body || (!('recruitingLine' in body) && !('nameStyle' in body))) return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  const actor = await verifyUser();
  const res = 'nameStyle' in body
    ? await setClanBoostNameStyle(clan.id, body.nameStyle, actor?.userId ?? null)
    : await setRecruitingLine(clan.id, body.recruitingLine ?? '', actor?.userId ?? null);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, summary: await clanBoostSummary(clan.id) });
}

export async function POST(request: Request) {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const actor = await verifyUser();
  if (!actor?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { post?: unknown } | null;
  const res = await sendRecruitPost(clan.id, body?.post, actor.userId);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, note: res.note ?? null, summary: await clanBoostSummary(clan.id) });
}
