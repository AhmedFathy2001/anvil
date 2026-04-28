import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, settings } from '@/db/schema';
import { and, eq, inArray, isNull, ne, notInArray } from 'drizzle-orm';
import { normalizeRsn, verifyAdminPluginToken } from '@/lib/auth';

interface IncomingMember {
  rsn: string;
  rank?: string | null;
  joinedDays?: number | null;
}

async function getConfiguredClanName(): Promise<string | null> {
  // DB setting takes precedence over env var so admins can adjust without a redeploy
  const row = await db.query.settings.findFirst({ where: eq(settings.key, 'clan_name') });
  const fromDb = row?.value?.trim();
  if (fromDb) return fromDb;
  const fromEnv = process.env.CLAN_NAME?.trim();
  return fromEnv || null;
}

// POST — admin plugin pushes the current in-game clan roster.
// Upserts into clan_members. Rows previously reported from plugin but missing
// from this sync get marked as left (soft delete).
export async function POST(request: Request) {
  const auth = await verifyAdminPluginToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { clanName?: string; members?: IncomingMember[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const clanName = (body.clanName || '').trim();
  const members = Array.isArray(body.members) ? body.members : null;
  if (!members) return NextResponse.json({ error: 'members[] required' }, { status: 400 });

  const expectedClanName = await getConfiguredClanName();
  if (expectedClanName && clanName.toLowerCase() !== expectedClanName.toLowerCase()) {
    return NextResponse.json(
      { error: 'clanMismatch', serverClanName: expectedClanName, reportedClanName: clanName },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const incomingNormalized = new Set<string>();
  let added = 0;
  let updated = 0;

  for (const m of members) {
    if (!m || typeof m.rsn !== 'string') continue;
    const rsn = m.rsn.trim();
    if (!rsn) continue;
    const rsnNormalized = normalizeRsn(rsn);
    incomingNormalized.add(rsnNormalized);

    const rank = typeof m.rank === 'string' ? m.rank.trim().toLowerCase() : null;

    const existing = await db.query.clanMembers.findFirst({
      where: eq(clanMembers.rsnNormalized, rsnNormalized),
    });

    if (!existing) {
      await db.insert(clanMembers).values({
        rsn,
        rsnNormalized,
        rank,
        source: 'plugin-roster',
        isGuest: 0,
        lastSeenInClan: now,
      });
      added++;
    } else {
      // For manually-removed members (leftAt != null && source='manual') we refresh metadata
      // but DO NOT clear leftAt — the admin made a deliberate call to remove them.
      // They can be re-added via /admin/clan.
      const preserveLeftAt = existing.leftAt && existing.source === 'manual';
      await db
        .update(clanMembers)
        .set({
          rsn, // refresh display casing to latest in-game
          rank: rank ?? existing.rank,
          lastSeenInClan: now,
          leftAt: preserveLeftAt ? existing.leftAt : null,
          // Anyone showing up in a clan roster sync is no longer a guest (unless still hidden)
          isGuest: preserveLeftAt ? existing.isGuest : 0,
          // Preserve stronger provenance: manual > plugin-self > plugin-roster
          source:
            existing.source === 'manual'
              ? 'manual'
              : existing.source === 'plugin-self'
                ? 'plugin-self'
                : 'plugin-roster',
        })
        .where(eq(clanMembers.id, existing.id));
      updated++;
    }
  }

  // Soft-delete plugin-sourced rows missing from this sync
  const incomingList = Array.from(incomingNormalized);
  const leftResult = await db
    .update(clanMembers)
    .set({ leftAt: now })
    .where(
      and(
        isNull(clanMembers.leftAt),
        ne(clanMembers.source, 'manual'),
        eq(clanMembers.isGuest, 0),
        incomingList.length > 0
          ? notInArray(clanMembers.rsnNormalized, incomingList)
          : // If roster is empty (shouldn't happen but defensive), mark all plugin-sourced members left
            inArray(clanMembers.source, ['plugin-self', 'plugin-roster']),
      ),
    )
    .returning({ id: clanMembers.id });

  return NextResponse.json({
    added,
    updated,
    markedLeft: leftResult.length,
    syncedAt: now,
  });
}
