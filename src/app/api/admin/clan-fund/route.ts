import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { requireClanFromRequest } from '@/lib/clanContext';
import { clanGrant } from '@/lib/clanGrants';
import { setFundPlan } from '@/lib/clanFund';
import { isFundPlan } from '@/lib/clanFundRules';

/**
 * POST { plan: 'bronze' | 'silver' | 'gold' | null } — the OWNER starts the clan fund for a plan,
 * changes it while it is still collecting, or turns it off when no chip-in counts (lib/clanFund).
 */
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClanFromRequest(request);
  const grant = await clanGrant(clan.id, session.userId);
  if (!grant?.isOwner) return NextResponse.json({ error: 'Only the owner runs the clan fund.' }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { plan?: unknown } | null;
  const plan = body?.plan === null ? null : isFundPlan(body?.plan) ? body.plan : undefined;
  if (plan === undefined) return NextResponse.json({ error: 'plan must be bronze, silver, gold or null' }, { status: 400 });
  const res = await setFundPlan(clan.id, session.userId, plan);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true });
}
