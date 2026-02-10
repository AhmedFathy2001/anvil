import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';

interface OsrsItem {
  id: number;
  name: string;
  type: string;
  duplicate: boolean;
}

// In-memory cache — fetched once per server lifecycle
let cachedItems: OsrsItem[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

async function getItems(): Promise<OsrsItem[]> {
  if (cachedItems && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedItems;
  }

  const res = await fetch('https://www.osrsbox.com/osrsbox-db/items-search.json');
  if (!res.ok) throw new Error('Failed to fetch OSRS items');

  const data: Record<string, OsrsItem> = await res.json();

  // Filter to only normal, non-duplicate items (skip noted variants)
  cachedItems = Object.values(data).filter(
    item => item.type === 'normal' && !item.duplicate
  );
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

    const results = items
      .filter(item => item.name.toLowerCase().includes(query))
      .slice(0, 20) // Limit results
      .map(item => ({ id: item.id, name: item.name }));

    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  }
}
