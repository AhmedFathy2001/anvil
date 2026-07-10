import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers } from '@/db/schema';
import { and, eq, isNull, isNotNull, or } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { loadRoleSyncConfig, syncRolesForClanMember } from '@/lib/discord-roles';

// Bounded by realistic guild size + the per-call delay. Each member is ~3-5 Discord
// REST calls (search + get-member + a small number of PUT/DELETE), at ~150 ms each,
// so 200 members ≈ 60 s of round-trips. Well inside this route's budget.
export const maxDuration = 300;

// POST — body { memberId?: number } syncs one member; without memberId sweeps every
// active non-guest member. Mods can use this to bulk-apply after a rank-role-map
// change or to retrofit roles after first turning the feature on.
export async function POST(request: Request) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cfg = await loadRoleSyncConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: 'Discord role sync is disabled or missing credentials (DISCORD_BOT_TOKEN / discord_guild_id / discord_role_sync_enabled)' },
      { status: 400 },
    );
  }

  let body: { memberId?: number } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine — means "sync all"
  }

  if (typeof body.memberId === 'number') {
    const report = await syncRolesForClanMember(body.memberId);
    return NextResponse.json({ mode: 'single', report });
  }

  // Sweep everyone who's still in the clan and can hold a role: full members plus verified
  // guests (an in-game member who linked but isn't confirmed on the roster yet). We do NOT
  // gate on hiscores `status` — a role reflects membership, not whether their XP is trackable,
  // so an 'unranked' member (RSN 404s on the hiscores) must still be synced.
  const eligible = await db
    .select({ id: clanMembers.id, rsn: clanMembers.rsn })
    .from(clanMembers)
    .where(
      and(
        isNull(clanMembers.leftAt),
        or(eq(clanMembers.isGuest, 0), isNotNull(clanMembers.verifiedAt)),
      ),
    );

  const reports: Array<{
    memberId: number;
    rsn: string;
    ok: boolean;
    reason?: string;
    resolved: boolean; // did we find a Discord id at all?
    added: number;
    removed: number;
    nickSet?: string;
  }> = [];
  let synced = 0;
  let skipped = 0;
  for (const m of eligible) {
    const r = await syncRolesForClanMember(m.id);
    if (r.ok) synced++;
    else skipped++;
    // Gentle pacing between members so a large roster doesn't burst past Discord's global rate
    // limit — the per-call retry then rarely has to kick in, and get-member stops false-negativing.
    await new Promise((res) => setTimeout(res, 150));
    reports.push({
      memberId: m.id,
      rsn: m.rsn,
      ok: r.ok,
      reason: r.reason,
      resolved: !!r.discordUserId,
      added: r.added.length,
      removed: r.removed.length,
      nickSet: r.nickSet,
    });
  }

  return NextResponse.json({
    mode: 'sweep',
    total: eligible.length,
    synced,
    skipped,
    // Resolved but nothing to give = a role-config gap (rank map / default / guest role ids)
    // or already in sync — surfaced so "it ran but nobody got a role" is diagnosable.
    noChange: reports.filter((r) => r.ok && r.added === 0 && r.removed === 0 && !r.nickSet).length,
    reports,
  });
}
