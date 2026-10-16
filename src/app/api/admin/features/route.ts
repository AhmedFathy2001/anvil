import { NextResponse } from 'next/server';

import { verifyAdmin, verifyUser } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { getClanFeatures, setClanFeature } from '@/lib/clanFeatures';
import { FEATURES, isFeatureKey } from '@/lib/features';

/**
 * Admin → Features: which optional modules this clan uses.
 *
 * ADMIN only. Switching a feature off hides it for every member of the clan, which is the same
 * class of decision as the clan's access policy.
 */

export async function GET() {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const flags = await getClanFeatures(clan.id);
  return NextResponse.json({ features: FEATURES.map((f) => ({ key: f.key, on: flags.on(f.key) })) });
}

export async function PUT(request: Request) {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const actor = await verifyUser();

  const body = await request.json().catch(() => null);
  if (!body || !isFeatureKey(body.key) || typeof body.on !== 'boolean') {
    return NextResponse.json({ error: 'Expected { key, on }' }, { status: 400 });
  }
  const flags = await setClanFeature(clan.id, body.key, body.on, actor && actor.userId > 0 ? actor.userId : null);
  return NextResponse.json({ features: FEATURES.map((f) => ({ key: f.key, on: flags.on(f.key) })) });
}
