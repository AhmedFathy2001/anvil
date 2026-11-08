import { NextResponse } from 'next/server';

import { verifyAdmin } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { normalizeClanKinds } from '@/lib/notifyKinds';
import { getClanKindDefaults, NOTIFY_KIND_DEFAULTS_SETTING_KEY } from '@/lib/pluginConfig';
import { setSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/** GET: the clan's defaults for the newer announcement kinds (lib/notifyKinds). */
export async function GET() {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const clan = await requireClan();
  return NextResponse.json(await getClanKindDefaults(clan.id));
}

/**
 * PUT: the whole set, normalized. Private kinds (GE, trades, group storage, other plugins) and invalid
 * patterns are dropped here: a clan can never turn those on for anyone.
 */
export async function PUT(request: Request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const clan = await requireClan();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  const next = normalizeClanKinds(body);
  const empty = !Object.keys(next.kinds).length && !Object.keys(next.shots).length && !next.patterns.length && !Object.keys(next.templates ?? {}).length;
  await setSetting(clan.id, NOTIFY_KIND_DEFAULTS_SETTING_KEY, empty ? null : JSON.stringify(next));
  return NextResponse.json(next);
}
