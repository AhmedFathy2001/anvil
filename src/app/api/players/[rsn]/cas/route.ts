import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { apexCharacter } from '@/lib/apexProfiles';
import { verifyPluginTokenUser } from '@/lib/auth';
import { caLookup, combatTasks } from '@/lib/combatTasks';
import { jsonWithEtag } from '@/lib/httpEtag';
import { getMemberItems } from '@/lib/memberProgressRead';

/**
 * A character's combat achievements for the plugin's Lookup "CAs" tab: GET /api/players/<rsn>/cas.
 *
 * Same visibility as the player card (apexCharacter): shared characters are anyone's to look at, an
 * unshared one only its owner's. Fetched only when the tab is opened, so a lookup stays light. The
 * hiscores don't publish CAs, so a name without an Anvil profile — or one that never synced its
 * tasks — is a 404 and the tab says so. Advertised as `player-cas`.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ rsn: string }> }) {
  const rsn = decodeURIComponent((await params).rsn).trim();
  if (!rsn || rsn.length > 12) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let viewerPlayerId: number | null = null;
  const viewer = await verifyPluginTokenUser(request);
  if (viewer) {
    const row = await db.query.users.findFirst({ where: eq(users.id, viewer.userId), columns: { playerId: true } });
    viewerPlayerId = row?.playerId ?? null;
  }

  const character = await apexCharacter(rsn, viewerPlayerId);
  const items = character ? await getMemberItems(character.accountId, 'ca') : null;
  if (!items) return NextResponse.json({ error: 'No combat achievements synced' }, { status: 404 });
  return jsonWithEtag(request, caLookup(combatTasks(items.items)));
}
