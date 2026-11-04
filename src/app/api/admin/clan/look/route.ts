import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clans } from '@/db/schema';
import { verifyAdmin, verifyUser } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { isCreatorSpace } from '@/lib/creatorSpaces';
import { normalizeHex, paletteSource, readStoredPalette } from '@/lib/artPalette';
import { paletteFromArt } from '@/lib/artPaletteImage';

export const dynamic = 'force-dynamic';

/**
 * "Colours" in a clan's or a creator space's settings (lib/artPalette): the accent an admin picked
 * and the swatches pulled from its own logo and banner. ADMIN only, like the rest of the profile.
 *
 *   GET    → { accent, palette, logoUrl, bannerUrl, space }
 *            The palette is (re)computed here when the art changed since it was last pulled, so a new
 *            upload is reflected the next time the card opens, with nothing to hook in the uploads.
 *   PATCH  { accent: "#rrggbb" | null } → the same shape. null goes back to Anvil gold.
 */

async function load(clanId: number, recompute: boolean) {
  // clan-scope: this clan's own row (requireClan).
  const row = await db.query.clans.findFirst({
    where: eq(clans.id, clanId),
    columns: { accentColor: true, artPalette: true, logoUrl: true, bannerUrl: true },
  });
  if (!row) return null;
  const from = paletteSource(row.logoUrl, row.bannerUrl);
  let stored = readStoredPalette(row.artPalette);
  if (recompute && (!stored || stored.from !== from)) {
    const colors = row.logoUrl || row.bannerUrl ? await paletteFromArt(row.logoUrl, row.bannerUrl) : [];
    stored = { from, colors };
    // clan-scope: this clan's own row.
    await db.update(clans).set({ artPalette: stored }).where(eq(clans.id, clanId));
  }
  return {
    accent: normalizeHex(row.accentColor),
    palette: stored?.colors ?? [],
    logoUrl: row.logoUrl ?? null,
    bannerUrl: row.bannerUrl ?? null,
  };
}

export async function GET() {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const look = await load(clan.id, true);
  if (!look) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ...look, space: isCreatorSpace(clan) });
}

export async function PATCH(request: Request) {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || !('accent' in body)) {
    return NextResponse.json({ error: 'Send { accent: "#rrggbb" } or { accent: null }' }, { status: 400 });
  }
  const raw = (body as { accent: unknown }).accent;
  const accent = raw === null ? null : normalizeHex(raw);
  if (raw !== null && !accent) return NextResponse.json({ error: 'That is not a colour like #a78bfa.' }, { status: 400 });

  // clan-scope: this clan's own row.
  await db.update(clans).set({ accentColor: accent }).where(eq(clans.id, clan.id));
  const actor = await verifyUser();
  // clan-scope: this clan.
  await db
    .insert(clanAuditLog)
    .values({ clanId: clan.id, eventType: 'accent_color_set', actorUserId: actor?.userId ?? null, newValue: JSON.stringify({ accent }) })
    .catch(() => {});
  const look = await load(clan.id, false);
  return NextResponse.json({ ...look, space: isCreatorSpace(clan) });
}
