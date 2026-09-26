import { NextResponse } from 'next/server';

import { getItemPrices } from '@/lib/itemPrices';

// GE prices for the calculator's upgrade route: ?ids=1,2,3 → { prices: { id: gp } }. An id with no
// price is untradeable (quest, minigame, raid reward) and is simply absent.
export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get('ids') ?? '')
    .split(',')
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 400);
  const all = await getItemPrices();
  const prices: Record<number, number> = {};
  for (const id of ids) {
    const p = all.get(id);
    if (p != null) prices[id] = p;
  }
  return NextResponse.json({ prices }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
