import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { eligibleCharacter } from '@/lib/h2h';
import { isMonsterDrop } from '@/lib/itemObtain';
import { getItemMapping } from '@/lib/osrsItems';
import { rateLimitByKey } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// The challenge form's two lookups:
//   ?item=<text>  monster drops by name (only what a monster, raid chest or pet roll hands over: the
//                 plugin can see those land)
//   ?rsn=<name>   can this character be challenged? Yes/no and its display name only: a signed-in
//                 person asking, rate limited, so it can't be walked as a directory.

export async function GET(request: Request) {
  const session = await verifyUser();
  if (!session?.playerId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const url = new URL(request.url);

  const rsn = url.searchParams.get('rsn');
  if (rsn != null) {
    const rl = await rateLimitByKey('h2h-lookup', String(session.playerId), { limit: 30, windowMs: 60_000 });
    if (!rl.ok) return NextResponse.json({ error: 'Slow down a little.' }, { status: 429 });
    const who = await eligibleCharacter(rsn.slice(0, 20));
    if (!who) return NextResponse.json({ ok: false, error: 'Not on Anvil with a verified character yet.' });
    if (who.playerId === session.playerId) return NextResponse.json({ ok: false, error: 'That’s one of your own characters.' });
    return NextResponse.json({ ok: true, rsn: who.rsn });
  }

  const q = (url.searchParams.get('item') ?? '').trim().toLowerCase().slice(0, 40);
  if (q.length < 2) return NextResponse.json({ items: [] });
  const all = await getItemMapping().catch(() => []);
  const items = all
    .filter((i) => i.name.toLowerCase().includes(q) && isMonsterDrop(i.id))
    .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)) || a.name.length - b.name.length)
    .slice(0, 20);
  return NextResponse.json({ items: items.map((i) => ({ id: i.id, name: i.name })) });
}
