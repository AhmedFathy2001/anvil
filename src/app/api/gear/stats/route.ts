import { NextResponse } from 'next/server';

import { fetchHiscoresOnce } from '@/lib/hiscores';
import { rateLimit } from '@/lib/rate-limit';

// Combat levels by RSN, for "load my stats" in the gear calculator. Public, so rate limited by IP:
// it is a direct official-hiscores read and must not become a free lookup proxy.
export async function GET(request: Request) {
  const rl = await rateLimit(request, 'gear-stats', { limit: 20, windowMs: 600_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many lookups — try again in a few minutes.' }, { status: 429 });
  const rsn = (new URL(request.url).searchParams.get('rsn') ?? '').trim();
  if (!rsn || rsn.length > 12) return NextResponse.json({ error: 'Enter a valid RSN.' }, { status: 400 });
  try {
    const snap = await fetchHiscoresOnce(rsn);
    const lvl = (k: string) => snap.skills?.[k]?.level ?? 1;
    return NextResponse.json({
      stats: { attack: lvl('attack'), strength: lvl('strength'), ranged: lvl('ranged'), magic: lvl('magic'), defence: lvl('defence'), prayer: lvl('prayer'), hitpoints: lvl('hitpoints') },
    });
  } catch {
    return NextResponse.json({ error: 'Not on the hiscores (or the hiscores are down).' }, { status: 404 });
  }
}
