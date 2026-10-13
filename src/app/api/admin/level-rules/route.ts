import { NextResponse } from 'next/server';

import { requireClan } from '@/lib/clanContext';
import { verifyAdmin } from '@/lib/auth';
import { DEFAULT_MILESTONE_RULES } from '@/lib/levelRules';
import { getClanMilestoneRules, setClanMilestoneRules } from '@/lib/levelRulesStore';

// The clan's level / XP milestone rules (lib/levelRules) — Admin → Advanced settings → Notifications.
// Stored as JSON under the `level_rules` settings key; served to the plugin as part of `levelRules`
// on /api/plugin/config and re-checked by /api/plugin/notify. Staff-gated like every clan setting.

export const dynamic = 'force-dynamic';

export async function GET() {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ rules: await getClanMilestoneRules(clan.id), defaults: DEFAULT_MILESTONE_RULES });
}

export async function PUT(request: Request) {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || typeof (body as { rules?: unknown }).rules !== 'object') {
    return NextResponse.json({ error: 'Send { rules: {...} }' }, { status: 400 });
  }
  // Normalised, not rejected: every field is clamped into range and anything missing keeps its default.
  const rules = await setClanMilestoneRules(clan.id, (body as { rules: unknown }).rules);
  return NextResponse.json({ ok: true, rules });
}
