import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';

interface MappingItem {
  id: number;
  name: string;
}

// In-memory cache — fetched once per server lifecycle.
let cachedItems: MappingItem[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

// Source: the OSRS Wiki real-time-prices item mapping. It's actively maintained (the old
// osrsbox-db this used to hit was abandoned and now 301s to a dead host, which was the 500).
// The Wiki requires a descriptive User-Agent or it rejects the request. Note this list is
// GE-tradeable items only — untradeables (most pets, a few uniques) won't appear; those tiles
// are configured without an item icon.
const MAPPING_URL = 'https://prices.runescape.wiki/api/v1/osrs/mapping';
const USER_AGENT = 'osrs-bingo-anvil (admin item-icon picker)';

async function getItems(): Promise<MappingItem[]> {
  if (cachedItems && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedItems;
  }

  const res = await fetch(MAPPING_URL, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Failed to fetch OSRS item mapping: HTTP ${res.status}`);

  const data = (await res.json()) as { id: number; name: string }[];
  cachedItems = data
    .filter((item) => typeof item.id === 'number' && typeof item.name === 'string')
    .map((item) => ({ id: item.id, name: item.name }));
  cacheTimestamp = Date.now();

  return cachedItems;
}

export async function GET(request: Request) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.toLowerCase().trim();

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const items = await getItems();

    // Prefix matches first (more relevant), then any substring match; cap at 20.
    const matches = items.filter((item) => item.name.toLowerCase().includes(query));
    matches.sort((a, b) => {
      const ap = a.name.toLowerCase().startsWith(query) ? 0 : 1;
      const bp = b.name.toLowerCase().startsWith(query) ? 0 : 1;
      return ap !== bp ? ap - bp : a.name.localeCompare(b.name);
    });

    return NextResponse.json(matches.slice(0, 20).map((item) => ({ id: item.id, name: item.name })));
  } catch (err) {
    console.error('items-search failed:', err);
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  }
}
