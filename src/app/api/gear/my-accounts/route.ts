import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, accountStatSnapshots } from '@/db/schema';
import { verifyUser } from '@/lib/auth';

// The signed-in person's own characters, with the combat levels Anvil already tracks for them — so
// the gear calculator can offer "use my main's levels" without a hiscores round-trip. Signed out:
// an empty list, and the calculator falls back to typing an RSN.
export async function GET() {
  const user = await verifyUser();
  if (!user?.playerId) return NextResponse.json({ accounts: [] });
  // clan-scope: global -- a person's characters are theirs, not a clan's.
  const rows = await db
    .select({ rsn: accounts.rsn, snapshot: accountStatSnapshots.snapshot })
    .from(accounts)
    .leftJoin(accountStatSnapshots, eq(accountStatSnapshots.accountId, accounts.id))
    .where(eq(accounts.playerId, user.playerId))
    .orderBy(asc(accounts.id));
  return NextResponse.json(
    {
      accounts: rows.map((r) => {
        let stats: Record<string, number> | null = null;
        try {
          const skills = r.snapshot ? (JSON.parse(r.snapshot) as { skills?: Record<string, { level?: number }> }).skills : null;
          if (skills?.attack?.level) {
            const lvl = (k: string) => Math.max(1, Math.min(99, skills[k]?.level ?? 1));
            stats = { attack: lvl('attack'), strength: lvl('strength'), ranged: lvl('ranged'), magic: lvl('magic') };
          }
        } catch {
          /* a malformed snapshot just means "look it up" */
        }
        return { rsn: r.rsn, stats };
      }),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
