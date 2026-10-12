import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { memberClogItems, users } from '@/db/schema';
import { apexCharacter } from '@/lib/apexProfiles';
import { verifyPluginTokenUser } from '@/lib/auth';
import { clogPageItems, clogPageNames } from '@/lib/clogDataset';
import { jsonWithEtag } from '@/lib/httpEtag';

/**
 * One collection log page for the plugin's player card: GET /api/players/<rsn>/clog-page?name=Zulrah.
 *
 * Every slot on the page in the game's order, each marked owned or not (with how many), so the panel
 * can draw the page the way the game does — lit and dim. Same visibility as the card and /p/<rsn>
 * (apexCharacter): shared characters are public, an unshared one is its owner's. Part of the
 * `player-card` capability.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ rsn: string }> }) {
  const rsn = decodeURIComponent((await params).rsn).trim();
  const wanted = (new URL(request.url).searchParams.get('name') ?? '').trim().toLowerCase();
  const page = clogPageNames().find((p) => p.toLowerCase() === wanted);
  if (!rsn || rsn.length > 12 || !page) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let viewerPlayerId: number | null = null;
  const viewer = await verifyPluginTokenUser(request);
  if (viewer) {
    const row = await db.query.users.findFirst({ where: eq(users.id, viewer.userId), columns: { playerId: true } });
    viewerPlayerId = row?.playerId ?? null;
  }
  const character = await apexCharacter(rsn, viewerPlayerId);
  if (!character) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Owned is by ITEM, not by the page it was stored under: an item shows on every page it belongs to,
  // and is stored once, under its owning page.
  // clan-scope: global -- an OSRS account is one account however many clans roster it.
  const owned = await db
    .select({ itemId: memberClogItems.itemId, quantity: memberClogItems.quantity })
    .from(memberClogItems)
    .where(eq(memberClogItems.accountId, character.accountId));
  const qty = new Map(owned.map((o) => [o.itemId, o.quantity]));

  const items = clogPageItems(page).map((i) => ({
    id: i.id,
    name: i.name,
    owned: qty.has(i.id),
    quantity: qty.get(i.id) ?? 0,
  }));
  return jsonWithEtag(request, {
    page,
    obtained: items.filter((i) => i.owned).length,
    total: items.length,
    synced: owned.length > 0,
    items,
  });
}
