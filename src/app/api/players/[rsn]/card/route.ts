import { NextResponse } from 'next/server';

import { jsonWithEtag } from '@/lib/httpEtag';
import { lookupPlayerCard } from '@/lib/pluginUi/load';

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
 * A name the viewer can't see — not on Anvil, or private — falls back to the OSRS hiscores
 * (lib/publicHiscoresCard, advertised as `player-card-hiscores`): a card with `source: 'hiscores'`
 * built only from what Jagex publishes, the same for both, so the two stay indistinguishable. That
 * fallback is the only path here that can reach Jagex, so it alone carries the per-IP limit.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ rsn: string }> }) {
  const rsn = decodeURIComponent((await params).rsn).trim();
  const found = await lookupPlayerCard(request, rsn);
  switch (found.kind) {
    case 'card':
      return jsonWithEtag(request, found.card);
    case 'limited':
      return NextResponse.json({ error: 'Too many lookups' }, { status: 429, headers: { 'Retry-After': String(found.retryAfterSec) } });
    case 'busy':
      return NextResponse.json(
        { error: 'Hiscores busy, try again shortly' },
        { status: 503, headers: { 'Retry-After': String(found.retryAfterSec) } },
      );
    default:
      // Not on Anvil (or not visible) and not on the hiscores.
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
