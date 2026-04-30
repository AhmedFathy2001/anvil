import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanAuditLog, clanMembers, settings } from '@/db/schema';
import { and, eq, inArray, isNull, ne, notInArray } from 'drizzle-orm';
import { normalizeRsn, verifyAdminPluginToken } from '@/lib/auth';
import { sendDiscordWebhook } from '@/lib/discord';

interface IncomingMember {
  rsn: string;
  rank?: string | null;
  joinedDays?: number | null;
  // Only present for the locally-logged-in player. Used for stable identity / rename detection.
  accountHash?: string | null;
}

async function getConfiguredClanName(): Promise<string | null> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, 'clan_name') });
  const fromDb = row?.value?.trim();
  if (fromDb) return fromDb;
  const fromEnv = process.env.CLAN_NAME?.trim();
  return fromEnv || null;
}

interface ChangeRecord {
  type: 'joined' | 'left' | 'returned' | 'renamed';
  rsn: string;
  oldRsn?: string;
  memberId: number;
}

// POST — admin plugin pushes the current in-game clan roster.
// Reconciles into clan_members:
//   • Unknown RSN → create row (joined)
//   • Existing soft-deleted (leftAt set, source != manual) → un-leave (returned)
//   • Existing accountHash matches but RSN differs → rename
//   • Plugin-sourced row not in this sync → mark left
// Each transition emits a clan_audit_log entry; a single summary embed gets posted to
// the Discord webhook so the clan can see "+2 joined, -1 left" without inbox spam.
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
  const changes: ChangeRecord[] = [];
  let added = 0;
  let updated = 0;

  for (const m of members) {
    if (!m || typeof m.rsn !== 'string') continue;
    const rsn = m.rsn.trim();
    if (!rsn) continue;
    const rsnNormalized = normalizeRsn(rsn);
    incomingNormalized.add(rsnNormalized);

    const rank = typeof m.rank === 'string' ? m.rank.trim().toLowerCase() : null;
    const incomingHash = typeof m.accountHash === 'string' && m.accountHash.length > 0 ? m.accountHash : null;

    // Match by accountHash first (lets us detect renames). Fall back to RSN.
    let existing = incomingHash
      ? await db.query.clanMembers.findFirst({ where: eq(clanMembers.accountHash, incomingHash) })
      : null;
    if (!existing) {
      existing = (await db.query.clanMembers.findFirst({
        where: eq(clanMembers.rsnNormalized, rsnNormalized),
      })) ?? null;
    }

    if (!existing) {
      const inserted = await db
        .insert(clanMembers)
        .values({
          rsn,
          rsnNormalized,
          rank,
          source: 'plugin-roster',
          isGuest: 0,
          lastSeenInClan: now,
          accountHash: incomingHash,
        })
        .returning({ id: clanMembers.id });
      const newId = inserted[0].id;
      added++;
      changes.push({ type: 'joined', rsn, memberId: newId });
      db.insert(clanAuditLog)
        .values({
          clanMemberId: newId,
          eventType: 'joined',
          newValue: JSON.stringify({ rsn, rank }),
          notes: 'Detected via clan-sync',
        })
        .catch(() => {});
      continue;
    }

    const renamed =
      incomingHash != null &&
      existing.accountHash === incomingHash &&
      existing.rsnNormalized !== rsnNormalized;
    const returning = existing.leftAt != null && existing.source !== 'manual';

    const previousRsns: string[] = (() => {
      if (!existing!.previousRsns) return [];
      try {
        const parsed = JSON.parse(existing!.previousRsns);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();
    if (renamed && existing.rsn) previousRsns.push(existing.rsn);

    // Manual removals are sticky — admin made a deliberate call. Skip un-leave but still
    // refresh metadata so the row stays current.
    const preserveLeftAt = Boolean(existing.leftAt && existing.source === 'manual');

    await db
      .update(clanMembers)
      .set({
        rsn: renamed ? rsn : rsn, // refresh display casing either way
        rsnNormalized: renamed ? rsnNormalized : existing.rsnNormalized,
        previousRsns: renamed ? JSON.stringify(previousRsns) : existing.previousRsns,
        rank: rank ?? existing.rank,
        lastSeenInClan: now,
        leftAt: preserveLeftAt ? existing.leftAt : null,
        isGuest: preserveLeftAt ? existing.isGuest : 0,
        accountHash: incomingHash ?? existing.accountHash,
        source:
          existing.source === 'manual'
            ? 'manual'
            : existing.source === 'plugin-self'
              ? 'plugin-self'
              : 'plugin-roster',
      })
      .where(eq(clanMembers.id, existing.id));
    updated++;

    if (renamed) {
      changes.push({ type: 'renamed', rsn, oldRsn: existing.rsn, memberId: existing.id });
      db.insert(clanAuditLog)
        .values({
          clanMemberId: existing.id,
          eventType: 'renamed',
          oldValue: JSON.stringify({ rsn: existing.rsn }),
          newValue: JSON.stringify({ rsn }),
          notes: 'Detected via clan-sync (accountHash matched)',
        })
        .catch(() => {});
    }
    if (returning && !preserveLeftAt) {
      changes.push({ type: 'returned', rsn, memberId: existing.id });
      db.insert(clanAuditLog)
        .values({
          clanMemberId: existing.id,
          eventType: 'returned',
          newValue: JSON.stringify({ rsn }),
          notes: 'Detected via clan-sync',
        })
        .catch(() => {});
    }
  }

  // Soft-delete plugin-sourced rows missing from this sync.
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
          : inArray(clanMembers.source, ['plugin-self', 'plugin-roster']),
      ),
    )
    .returning({ id: clanMembers.id, rsn: clanMembers.rsn });

  for (const left of leftResult) {
    changes.push({ type: 'left', rsn: left.rsn, memberId: left.id });
    db.insert(clanAuditLog)
      .values({
        clanMemberId: left.id,
        eventType: 'left',
        oldValue: JSON.stringify({ rsn: left.rsn }),
        notes: 'Detected via clan-sync (missing from roster)',
      })
      .catch(() => {});
  }

  // Fire-and-forget Discord summary if anything changed. Empty syncs are silent.
  if (changes.length > 0) {
    const joined = changes.filter((c) => c.type === 'joined');
    const left = changes.filter((c) => c.type === 'left');
    const renamed = changes.filter((c) => c.type === 'renamed');
    const returned = changes.filter((c) => c.type === 'returned');

    const fields: { name: string; value: string }[] = [];
    if (joined.length) fields.push({ name: `Joined (${joined.length})`, value: joined.map((c) => c.rsn).join(', ').slice(0, 1024) });
    if (left.length) fields.push({ name: `Left (${left.length})`, value: left.map((c) => c.rsn).join(', ').slice(0, 1024) });
    if (returned.length) fields.push({ name: `Returned (${returned.length})`, value: returned.map((c) => c.rsn).join(', ').slice(0, 1024) });
    if (renamed.length) fields.push({
      name: `Renamed (${renamed.length})`,
      value: renamed.map((c) => `${c.oldRsn ?? '?'} → ${c.rsn}`).join('\n').slice(0, 1024),
    });

    sendDiscordWebhook({
      embeds: [
        {
          title: 'Clan roster sync',
          description: clanName ? `Synced **${clanName}** (${members.length} members)` : `Synced ${members.length} members`,
          color: 0xd4a017,
          fields,
          timestamp: now,
        },
      ],
    }).catch(() => {});
  }

  return NextResponse.json({
    added,
    updated,
    markedLeft: leftResult.length,
    renamed: changes.filter((c) => c.type === 'renamed').length,
    returned: changes.filter((c) => c.type === 'returned').length,
    syncedAt: now,
  });
}
