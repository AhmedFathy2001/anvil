import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanAuditLog, clanMembers, settings } from '@/db/schema';
import { and, desc, eq, inArray, isNull, ne, notInArray } from 'drizzle-orm';
import { normalizeRsn, verifyAdminPluginToken } from '@/lib/auth';
import { sendDiscordWebhook } from '@/lib/discord';
import { applyRenameToActiveWeeklyParticipants } from '@/lib/weekly';

interface IncomingMember {
  rsn: string;
  rank?: string | null;
  joinedDays?: number | null;
  // Only present for the locally-logged-in player. Used for stable identity / rename detection.
  accountHash?: string | null;
}

interface ChangeRecord {
  type: 'joined' | 'left' | 'returned' | 'renamed' | 'rank_changed';
  rsn: string;
  oldRsn?: string;
  oldRank?: string | null;
  newRank?: string | null;
  memberId: number;
}

async function getConfiguredClanName(): Promise<string | null> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, 'clan_name') });
  const fromDb = row?.value?.trim();
  if (fromDb) return fromDb;
  const fromEnv = process.env.CLAN_NAME?.trim();
  return fromEnv || null;
}

// POST — admin plugin pushes the current in-game clan roster.
//
// Reconciliation strategy:
//   1) Pre-fetch every clan_members row once (one SELECT)
//   2) Build maps by accountHash + rsnNormalized for O(1) lookup
//   3) Categorize each incoming row in memory (no per-member queries)
//   4) Bulk-insert new members in one statement
//   5) Apply per-row updates sequentially (drizzle SQLite has no batch UPDATE-with-different-values)
//   6) Bulk-insert audit entries in one statement
//   7) Soft-delete missing-from-roster rows in one UPDATE
//
// On a 100+ member roster, the previous per-member SELECT-then-INSERT-or-UPDATE pattern
// produced 300-500 sequential round-trips and reliably exceeded plugin read timeouts.
// This pass keeps it bounded to a small constant of round-trips regardless of clan size.
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
  const changes: ChangeRecord[] = [];

  // ── 1) Pre-fetch all existing rows ────────────────────────────────────────
  const existingRows = await db.select().from(clanMembers);
  const byHash = new Map<string, typeof existingRows[number]>();
  const byRsn = new Map<string, typeof existingRows[number]>();
  for (const r of existingRows) {
    if (r.accountHash) byHash.set(r.accountHash, r);
    byRsn.set(r.rsnNormalized, r);
  }

  // ── 2) Categorize incoming rows ──────────────────────────────────────────
  type ToUpdate = {
    id: number;
    setRsn: string;
    setRsnNormalized: string;
    setRank: string | null;
    setAccountHash: string | null;
    setSource: 'manual' | 'plugin-self' | 'plugin-roster';
    setLeftAt: string | null;
    setIsGuest: number;
    setPreviousRsns: string | null;
    renamed: boolean;
    oldRsn?: string;
    returning: boolean;
    rankChanged: boolean;
    oldRank: string | null;
    newRank: string | null;
  };
  const toInsert: { rsn: string; rsnNormalized: string; rank: string | null; accountHash: string | null }[] = [];
  const toUpdate: ToUpdate[] = [];
  const incomingNormalized = new Set<string>();
  const seenIncoming = new Set<string>();

  for (const m of members) {
    if (!m || typeof m.rsn !== 'string') continue;
    const rsn = m.rsn.trim();
    if (!rsn) continue;
    const rsnNormalized = normalizeRsn(rsn);
    if (seenIncoming.has(rsnNormalized)) continue; // de-dupe duplicate names in payload
    seenIncoming.add(rsnNormalized);
    incomingNormalized.add(rsnNormalized);

    const rank = typeof m.rank === 'string' ? m.rank.trim().toLowerCase() : null;
    const incomingHash = typeof m.accountHash === 'string' && m.accountHash.length > 0 ? m.accountHash : null;

    const existing = (incomingHash && byHash.get(incomingHash)) || byRsn.get(rsnNormalized) || null;

    if (!existing) {
      toInsert.push({ rsn, rsnNormalized, rank, accountHash: incomingHash });
      continue;
    }

    const renamed =
      incomingHash != null &&
      existing.accountHash === incomingHash &&
      existing.rsnNormalized !== rsnNormalized;
    const returning = existing.leftAt != null && existing.source !== 'manual';
    const preserveLeftAt = Boolean(existing.leftAt && existing.source === 'manual');
    const rankChanged =
      rank != null && existing.rank != null && rank !== existing.rank;

    let previousRsns: string[] = [];
    if (existing.previousRsns) {
      try {
        const parsed = JSON.parse(existing.previousRsns);
        if (Array.isArray(parsed)) previousRsns = parsed;
      } catch { /* keep empty */ }
    }
    if (renamed && existing.rsn) previousRsns.push(existing.rsn);

    toUpdate.push({
      id: existing.id,
      setRsn: rsn,
      setRsnNormalized: renamed ? rsnNormalized : existing.rsnNormalized,
      setRank: rank ?? existing.rank,
      setAccountHash: incomingHash ?? existing.accountHash,
      setSource:
        existing.source === 'manual'
          ? 'manual'
          : existing.source === 'plugin-self'
            ? 'plugin-self'
            : 'plugin-roster',
      setLeftAt: preserveLeftAt ? existing.leftAt : null,
      setIsGuest: preserveLeftAt ? existing.isGuest : 0,
      setPreviousRsns: renamed ? JSON.stringify(previousRsns) : existing.previousRsns,
      renamed,
      oldRsn: renamed ? existing.rsn : undefined,
      returning: returning && !preserveLeftAt,
      rankChanged,
      oldRank: rankChanged ? existing.rank : null,
      newRank: rankChanged ? rank : null,
    });
  }

  // ── 3) Bulk insert new members ───────────────────────────────────────────
  const auditPayload: { clanMemberId: number; eventType: string; oldValue?: string | null; newValue?: string | null; notes?: string | null }[] = [];

  if (toInsert.length > 0) {
    const insertedRows = await db
      .insert(clanMembers)
      .values(
        toInsert.map((row) => ({
          rsn: row.rsn,
          rsnNormalized: row.rsnNormalized,
          rank: row.rank,
          source: 'plugin-roster' as const,
          isGuest: 0,
          lastSeenInClan: now,
          accountHash: row.accountHash,
        })),
      )
      .returning({ id: clanMembers.id, rsn: clanMembers.rsn });

    for (let i = 0; i < insertedRows.length; i++) {
      const ins = insertedRows[i];
      const src = toInsert[i];
      changes.push({ type: 'joined', rsn: ins.rsn, memberId: ins.id });
      auditPayload.push({
        clanMemberId: ins.id,
        eventType: 'joined',
        newValue: JSON.stringify({ rsn: ins.rsn, rank: src.rank }),
        notes: 'Detected via clan-sync',
      });
    }
  }

  // ── 4) Apply per-member updates ──────────────────────────────────────────
  // Sequential because each row has different values; libsql doesn't have a portable
  // batch UPDATE form. Each statement is a single round-trip keyed on PK.
  for (const u of toUpdate) {
    await db
      .update(clanMembers)
      .set({
        rsn: u.setRsn,
        rsnNormalized: u.setRsnNormalized,
        previousRsns: u.setPreviousRsns,
        rank: u.setRank,
        lastSeenInClan: now,
        leftAt: u.setLeftAt,
        isGuest: u.setIsGuest,
        accountHash: u.setAccountHash,
        source: u.setSource,
      })
      .where(eq(clanMembers.id, u.id));

    if (u.renamed) {
      changes.push({ type: 'renamed', rsn: u.setRsn, oldRsn: u.oldRsn, memberId: u.id });
      auditPayload.push({
        clanMemberId: u.id,
        eventType: 'renamed',
        oldValue: JSON.stringify({ rsn: u.oldRsn ?? null }),
        newValue: JSON.stringify({ rsn: u.setRsn }),
        notes: 'Detected via clan-sync (accountHash matched)',
      });
      if (u.oldRsn) {
        await applyRenameToActiveWeeklyParticipants(u.id, u.oldRsn, u.setRsn).catch(() => {});
      }
    }
    if (u.returning) {
      changes.push({ type: 'returned', rsn: u.setRsn, memberId: u.id });
      auditPayload.push({
        clanMemberId: u.id,
        eventType: 'returned',
        newValue: JSON.stringify({ rsn: u.setRsn }),
        notes: 'Detected via clan-sync',
      });
    }
    if (u.rankChanged) {
      changes.push({
        type: 'rank_changed',
        rsn: u.setRsn,
        oldRank: u.oldRank,
        newRank: u.newRank,
        memberId: u.id,
      });
      auditPayload.push({
        clanMemberId: u.id,
        eventType: 'rank_changed',
        oldValue: JSON.stringify({ rank: u.oldRank }),
        newValue: JSON.stringify({ rank: u.newRank }),
        notes: 'Detected via clan-sync',
      });
    }
  }

  // ── 5) Soft-delete missing ───────────────────────────────────────────────
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
    auditPayload.push({
      clanMemberId: left.id,
      eventType: 'left',
      oldValue: JSON.stringify({ rsn: left.rsn }),
      notes: 'Detected via clan-sync (missing from roster)',
    });
  }

  // ── 6) Bulk insert audit entries ─────────────────────────────────────────
  if (auditPayload.length > 0) {
    // Fire-and-forget — audit failures shouldn't sink an otherwise-successful sync.
    db.insert(clanAuditLog).values(auditPayload).catch(() => {});
  }

  // Always stamp the last-sync timestamp in settings so the plugin can show
  // "Last sync: X ago" even when a sync produced zero changes (the audit log only
  // records actual diffs, so a clean sync would otherwise leave no trace).
  const lastSyncSettingValue = JSON.stringify({
    at: now,
    summary: {
      added: toInsert.length,
      markedLeft: leftResult.length,
      returned: changes.filter((c) => c.type === 'returned').length,
      renamed: changes.filter((c) => c.type === 'renamed').length,
    },
  });
  await db
    .insert(settings)
    .values({ key: 'last_clan_sync', value: lastSyncSettingValue })
    .onConflictDoUpdate({ target: settings.key, set: { value: lastSyncSettingValue } });

  // ── 7) Discord summary (async, never blocks the response) ────────────────
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
    const rankChanged = changes.filter((c) => c.type === 'rank_changed');
    if (rankChanged.length) fields.push({
      name: `Rank changed (${rankChanged.length})`,
      value: rankChanged.map((c) => `${c.rsn}: ${c.oldRank ?? '—'} → ${c.newRank ?? '—'}`).join('\n').slice(0, 1024),
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

  // Detailed change list for the plugin to render as in-game chat lines (one per
  // event), in addition to the count summary it has always returned.
  return NextResponse.json({
    added: toInsert.length,
    updated: toUpdate.length,
    markedLeft: leftResult.length,
    renamed: changes.filter((c) => c.type === 'renamed').length,
    returned: changes.filter((c) => c.type === 'returned').length,
    syncedAt: now,
    changes: changes.map((c) => ({
      type: c.type,
      rsn: c.rsn,
      oldRsn: c.oldRsn ?? null,
      oldRank: c.oldRank ?? null,
      newRank: c.newRank ?? null,
    })),
  });
}

// GET — what's the latest sync state for this clan? The plugin calls this on startup
// so its panel can show "Last sync: X minutes ago" without performing a fresh roster
// post. Reads from settings (always stamped) rather than clan_audit_log (only stamped
// when there were actual diffs), so a clean sync still surfaces.
export async function GET(request: Request) {
  const auth = await verifyAdminPluginToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const row = await db.query.settings.findFirst({ where: eq(settings.key, 'last_clan_sync') });
  if (row?.value) {
    try {
      const parsed = JSON.parse(row.value) as {
        at?: string;
        summary?: { added?: number; markedLeft?: number; returned?: number; renamed?: number };
      };
      if (parsed.at) {
        return NextResponse.json({
          lastSyncAt: parsed.at,
          summary: parsed.summary
            ? {
                added: parsed.summary.added ?? 0,
                markedLeft: parsed.summary.markedLeft ?? 0,
                returned: parsed.summary.returned ?? 0,
                renamed: parsed.summary.renamed ?? 0,
              }
            : null,
        });
      }
    } catch {
      /* fall through to audit-log fallback */
    }
  }

  // Fallback: no setting yet (first deploy, or never synced since the setting was added).
  // Reconstruct from clan_audit_log so users with prior sync history still see "Last sync"
  // in the panel without having to perform a fresh sync to seed the setting.
  const SYNC_EVENT_TYPES = ['joined', 'left', 'returned', 'renamed'];
  const recent = await db
    .select({
      eventType: clanAuditLog.eventType,
      occurredAt: clanAuditLog.occurredAt,
    })
    .from(clanAuditLog)
    .where(inArray(clanAuditLog.eventType, SYNC_EVENT_TYPES))
    .orderBy(desc(clanAuditLog.occurredAt))
    .limit(200);

  if (recent.length === 0) {
    return NextResponse.json({ lastSyncAt: null, summary: null });
  }
  const lastSyncAt = recent[0].occurredAt;
  const lastTs = new Date(lastSyncAt).getTime();
  const sameSync = recent.filter((r) => Math.abs(new Date(r.occurredAt).getTime() - lastTs) <= 2000);
  const tally = sameSync.reduce<Record<string, number>>((acc, r) => {
    acc[r.eventType] = (acc[r.eventType] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    lastSyncAt,
    summary: {
      added: tally.joined ?? 0,
      markedLeft: tally.left ?? 0,
      returned: tally.returned ?? 0,
      renamed: tally.renamed ?? 0,
    },
  });
}
