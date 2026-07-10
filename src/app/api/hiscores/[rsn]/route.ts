import { NextResponse } from 'next/server';
import { getHiscoresStats } from '@/lib/hiscores';
import { verifyUser } from '@/lib/auth';

// Small in-process cache so repeated lookups of the same RSN (and accidental double-fires) don't each
// hit Jagex. Best-effort — not shared across serverless instances, but it covers the common case.
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; data: unknown }>();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ rsn: string }> },
) {
  // Previously fully public — anyone could loop this endpoint to proxy-hammer the OSRS hiscores
  // through the server. Require a logged-in clan member (this backs the admin "View hiscores" links).
  const user = await verifyUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { rsn } = await params;
  const decodedRsn = decodeURIComponent(rsn);
  const key = decodedRsn.toLowerCase();

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.data);
  }

  try {
    const stats = await getHiscoresStats(decodedRsn);
    const data = { rsn: decodedRsn, stats };
    cache.set(key, { at: Date.now(), data });
    // Opportunistic prune so the map can't grow unbounded across a warm instance's lifetime.
    if (cache.size > 500) {
      const cutoff = Date.now() - CACHE_TTL_MS;
      for (const [k, v] of cache) {
        if (v.at < cutoff) cache.delete(k);
      }
    }
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch hiscores';
    return NextResponse.json({ error: message, rsn: decodedRsn }, { status: 404 });
  }
}
