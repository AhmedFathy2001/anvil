import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { apexCharacter } from '@/lib/apexProfiles';
import { verifyPluginTokenUser } from '@/lib/auth';
import { jsonWithEtag } from '@/lib/httpEtag';
import { loadPlayerCard } from '@/lib/playerCard';
import { publicHiscoresCard } from '@/lib/publicHiscoresCard';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

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
 *
 * A name NO Anvil account holds falls back to the OSRS hiscores (lib/publicHiscoresCard, advertised
 * as `player-card-hiscores`): a card with `source: 'hiscores'` instead of a 404. Only when no account
 * holds it — a private account still 404s exactly like a missing one. That fallback is the only path
 * here that can reach Jagex, so it alone carries the per-IP limit.
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
  if (character) return jsonWithEtag(request, await loadPlayerCard(character));

  const limit = await rateLimit(request, 'player-card-lookup', { limit: 30, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many lookups' },
      {
        status: 429,
        headers: { ...rateLimitHeaders(limit), 'Retry-After': String(Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000))) },
      },
    );
  }

  const result = await publicHiscoresCard(rsn);
  switch (result.kind) {
    case 'card':
      return jsonWithEtag(request, result.card);
    case 'busy':
      return NextResponse.json(
        { error: 'Hiscores busy, try again shortly' },
        { status: 503, headers: { 'Retry-After': String(result.retryAfterSec) } },
      );
    default:
      // 'hidden' (a private account) and 'unranked' MUST look identical — same status, same body.
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
