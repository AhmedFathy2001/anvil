import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { setSetting, deleteSetting } from '@/lib/settings';
import { verifyAdmin } from '@/lib/auth';
import { DEFAULT_TIER_BANDS, normalizeTierBands } from '@/lib/tileFilter';
import { TIER_BANDS_SETTING_KEY, getTierBands } from '@/lib/pluginConfig';

// Admin-managed difficulty-tier bands (points → tier). Stored as a JSON array under the
// `tier_bands` settings key. GET returns the current bands (defaults when unset); PUT replaces
// them after validation. Served to the plugin via /api/plugin/config + /api/plugin/board.

export async function GET() {
  const clan = await requireClan();
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ bands: await getTierBands(clan.id) });
}

export async function PUT(request: Request) {
  const clan = await requireClan();
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { bands?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bands = normalizeTierBands(body.bands);
  if (bands.length === 0) {
    return NextResponse.json(
      { error: 'Provide at least one tier with a label and a non-negative min points.' },
      { status: 400 },
    );
  }
  // The lowest band must start at 0 so every tile (including 0-point ones) lands in a tier.
  if (bands[0].min !== 0) {
    return NextResponse.json(
      { error: 'The lowest tier must start at 0 points so no tile falls outside the bands.' },
      { status: 400 },
    );
  }

  const value = JSON.stringify(bands);
  await setSetting(clan.id, TIER_BANDS_SETTING_KEY, value);

  return NextResponse.json({ success: true, bands });
}

// Restore the curated defaults (used by the admin "Reset" action).
export async function DELETE() {
  const clan = await requireClan();
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await deleteSetting(clan.id, TIER_BANDS_SETTING_KEY);
  return NextResponse.json({ success: true, bands: DEFAULT_TIER_BANDS });
}
