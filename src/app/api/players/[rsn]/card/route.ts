import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { apexCharacter } from '@/lib/apexProfiles';
import { verifyPluginTokenUser } from '@/lib/auth';
import { jsonWithEtag } from '@/lib/httpEtag';
import { loadPlayerCard } from '@/lib/playerCard';

/**
 * The plugin's player card: GET /api/players/<rsn>/card.
 *
 * Public, with the same visibility rule as /p/<rsn> (apexCharacter): a shared character is anyone's to
 * look at, an unshared one only its owner's, and everybody else gets the same 404 a name that isn't on
 * Anvil gets. The Account Token is optional and only ever WIDENS what you can see to your own
 * characters — it is how the plugin's "You" tab shows a private account to the person who owns it.
 *
 * Read-only and additive: advertised as the `player-card` capability, so a plugin against a site
 * without this route never calls it.
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
  if (!character) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return jsonWithEtag(request, await loadPlayerCard(character));
}
