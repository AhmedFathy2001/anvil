import { NextResponse } from 'next/server';
import { findOrCreateAccount, findOrCreateSeat, updateAccountOfSeat } from '@/lib/roster';
import { isBannedFromClan } from '@/lib/clanBans';
import { claimMemberSeat } from '@/lib/guestAdmission';
import { db } from '@/db';
import { getSetting, setSetting } from '@/lib/settings';
import { requireClanFromRequest } from '@/lib/clanContext';
import { clanAuditLog, clanMemberships, clanRoster } from '@/db/schema';
import { and, desc, eq, inArray, isNull, ne, notInArray } from 'drizzle-orm';
import { isPlausibleRsn, normalizeRsn, sanitizeRsn, verifyAdminPluginToken } from '@/lib/auth';
import { sendDiscordWebhook } from '@/lib/discord';
import { EMBED_COLOR } from '@/lib/discordEmbeds';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { applyRenameToActiveWeeklyParticipants } from '@/lib/weekly';
import { syncRolesForClanMemberFireAndForget } from '@/lib/discord-roles';
import { capMessage, newMemberAllowance, syncCapGrace } from '@/lib/member-cap';
import { getInGameClanName } from '@/lib/pluginConfig';
import { log } from '@/lib/logger';

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

// POST — admin plugin pushes the current in-game clan roster.
//
// Reconciliation strategy:
//   1) Pre-fetch every clan_members row once (one SELECT)
//   2) Build maps by accountHash + rsnNormalized for O(1) lookup
//   3) Categorize each incoming row in memory (no per-member queries)
//   4) Bulk-insert new members in one statement
//   5) Apply per-row updates sequentially (drizzle has no batch UPDATE-with-different-values)
//   6) Bulk-insert audit entries in one statement
//   7) Soft-delete missing-from-roster rows in one UPDATE
//
// On a 100+ member roster, the previous per-member SELECT-then-INSERT-or-UPDATE pattern
// produced 300-500 sequential round-trips and reliably exceeded plugin read timeouts.
// This pass keeps it bounded to a small constant of round-trips regardless of clan size.
export async function POST(request: Request) {
  const rl = await rateLimit(request, 'plugin-clan-sync', { limit: 12, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });

  const auth = await verifyAdminPluginToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // The roster being synced belongs to the clan whose address the plugin called.
  const clan = await requireClanFromRequest(request);

  let body: { clanName?: string; members?: IncomingMember[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const clanName = (body.clanName || '').trim();
  const members = Array.isArray(body.members) ? body.members : null;
  if (!members) return NextResponse.json({ error: 'members[] required' }, { status: 400 });

  // Gate on the IN-GAME clan name (settings.clan_ingame_name), never the display name — those two
  // are allowed to differ, and a site rename must not start rejecting the roster sync.
  const expectedClanName = await getInGameClanName(clan.id);
  if (expectedClanName && clanName.toLowerCase() !== expectedClanName.toLowerCase()) {
    return NextResponse.json(
      { error: 'clanMismatch', serverClanName: expectedClanName, reportedClanName: clanName },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const changes: ChangeRecord[] = [];

  // ── 1) Pre-fetch this clan's existing rows ────────────────────────────────
  // Scoped to the clan: unscoped, the diff below would treat every OTHER clan's members as missing
  // from this roster and soft-delete them.
  const existingRows = await db.select().from(clanRoster).where(eq(clanRoster.clanId, clan.id));
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
    // Carried so the exclusivity rule can be applied before the update — the seat id alone does not
    // say which ACCOUNT is being promoted, and that is what may be a member elsewhere.
    accountId: number;
    setRsnNormalized: string;
    setRank: string | null;
    setAccountHash: string | null;
    setSource: 'roster' | 'admin' | 'application';
    setLeftAt: string | null;
    setKind: 'member' | 'guest';
    setPreviousRsns: string | null;
    renamed: boolean;
    oldRsn?: string;
    returning: boolean;
    rankChanged: boolean;
    oldRank: string | null;
    newRank: string | null;
    // A guest (event-only, isGuest=1) that now appears in the ranked roster, i.e. they
    // actually joined the clan. Forces a Discord role re-sync even when no rank was
    // reported, so they stop being treated as a guest on the Discord side.
    becameMember: boolean;
  };
  const toInsert: { rsn: string; rsnNormalized: string; rank: string | null; accountHash: string | null }[] = [];
  const toUpdate: ToUpdate[] = [];
  const incomingNormalized = new Set<string>();
  const seenIncoming = new Set<string>();
  let skippedNames = 0;

  for (const m of members) {
    if (!m || typeof m.rsn !== 'string') continue;
    // sanitizeRsn (NBSP → ASCII space) so the stored display RSN is what the OSRS
    // Hiscores library accepts. Raw plugin payloads ship in-game names with U+00A0.
    const rsn = sanitizeRsn(m.rsn);
    if (!rsn) continue;
    // RuneLite reports unresolvable clan members as placeholders like "#Player1404". They can never
    // be found on the hiscores, so admitting them just fills the roster with rows that will never
    // have a stat — skip them and count them, rather than storing a member who doesn't exist.
    if (!isPlausibleRsn(rsn)) {
      skippedNames++;
      continue;
    }
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
    const preserveLeftAt = Boolean(existing.leftAt && existing.source === 'admin');
    // A null existing.rank (a guest or never-ranked row) counts as a change to their
    // first rank — so a guest the roster now reports with a rank ("imp") produces a
    // rank_changed audit + Discord role sync instead of silently flipping isGuest.
    const rankChanged = rank != null && rank !== existing.rank;
    // Guest → real member: the ranked roster includes them, so they're no longer a
    // guest. preserveLeftAt guards the manual-left case (don't resurrect those).
    const becameMember = existing.kind === 'guest' && !preserveLeftAt;

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
      accountId: existing.accountId,
      setRsn: rsn,
      setRsnNormalized: renamed ? rsnNormalized : existing.rsnNormalized,
      setRank: rank ?? existing.rank,
      setAccountHash: incomingHash ?? existing.accountHash,
      // An admin's decision outranks the roster; anything else the roster now confirms.
      setSource: existing.source === 'admin' ? ('admin' as const) : ('roster' as const),
      setLeftAt: preserveLeftAt ? existing.leftAt : null,
      setKind: preserveLeftAt ? (existing.kind as 'member' | 'guest') : ('member' as const),
      setPreviousRsns: renamed ? JSON.stringify(previousRsns) : existing.previousRsns,
      renamed,
      oldRsn: renamed ? existing.rsn : undefined,
      returning: returning && !preserveLeftAt,
      rankChanged,
      oldRank: rankChanged ? existing.rank : null,
      newRank: rankChanged ? rank : null,
      becameMember,
    });
  }

  // ── 3) Bulk insert new members ───────────────────────────────────────────
  const auditPayload: { clanMemberId: number; eventType: string; oldValue?: string | null; newValue?: string | null; notes?: string | null }[] = [];

  // Plan limit. This insert is the ONLY place billable members are created (guests are free and
  // made elsewhere), so the cap is enforced here or nowhere. syncCapGrace also maintains the grace
  // clock — this sweep is what observes the roster changing size.
  //
  // Growth is all that ever stops. Existing members keep syncing — renames, rank changes, leaves,
  // returns — because a clan discovering it outgrew its plan shouldn't find its board half-broken.
  const roster = await syncCapGrace(clan.id);
  const refusedNewMembers: string[] = [];
  if (newMemberAllowance(roster) === 0 && toInsert.length > 0) {
    refusedNewMembers.push(...toInsert.map((row) => row.rsn));
    toInsert.length = 0;
    log.warn('member-cap.blocked-new-members', {
      active: roster.active,
      cap: roster.cap,
      refused: refusedNewMembers.length,
    });
  }

  const refusedBanned: string[] = [];

  if (toInsert.length > 0) {
    // THE grant. Membership is never assumed anywhere else in the codebase — this sweep is the
    // in-game roster itself, so it is the one writer allowed to seat someone as a member.
    const insertedRows: { id: number; rsn: string }[] = [];
    for (const row of toInsert) {
      const account = await findOrCreateAccount({
        rsn: row.rsn,
        rsnNormalized: row.rsnNormalized,
        accountHash: row.accountHash,
      });

      // A clan ban outranks the in-game roster HERE, and only here. If the two disagree — they are
      // still in the in-game clan but this clan's staff barred them from the site — the staff
      // decision is the one about the site, and the roster must not quietly undo it every sync.
      // Reported back so it looks like a decision rather than a member who mysteriously never
      // appears.
      if (await isBannedFromClan(clan.id, account.playerId)) {
        refusedBanned.push(row.rsn);
        continue;
      }

      // An account is a member of ONE clan. If this roster claims someone who is a member
      // elsewhere, that seat demotes to guest — the in-game roster is the evidence, they cannot be
      // in both, so the later sync is simply the more current truth. Without this the unique index
      // rejects the sync outright and a clan finds its roster refusing to import a player who
      // transferred in, which is the common case rather than an edge one.
      await claimMemberSeat(clan.id, account.id);

      const seatId = await findOrCreateSeat(clan.id, account.id, { kind: 'member', source: 'roster' });
      await db
        .update(clanMemberships)
        .set({ kind: 'member', source: 'roster', rank: row.rank, lastSeenInClan: now, leftAt: null })
        .where(eq(clanMemberships.id, seatId));
      insertedRows.push({ id: seatId, rsn: row.rsn });
    }

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
      // Brand-new join → assign default + rank roles in Discord. Best-effort; the
      // user might not exist on the guild side yet (in which case the sync is a
      // no-op until a future trigger).
      syncRolesForClanMemberFireAndForget(ins.id);
    }
  }

  // ── 4) Apply per-member updates ──────────────────────────────────────────
  // Sequential because each row has different values; drizzle doesn't have a portable
  // batch UPDATE form. Each statement is a single round-trip keyed on PK.
  for (const u of toUpdate) {
    // The name and the hash describe the account, so a rename spotted by one clan's sync is a
    // rename everywhere. Rank, presence and membership describe this seat and stop here.
    await updateAccountOfSeat(u.id, {
      rsn: u.setRsn,
      rsnNormalized: u.setRsnNormalized,
      previousRsns: u.setPreviousRsns,
      accountHash: u.setAccountHash,
    });
    // The other half of the exclusivity rule. This path promotes an EXISTING seat — usually a guest
    // who has now joined in game — and the insert path above is not the only way to become a member.
    // Missing it here would let the index reject the update instead.
    if (u.setKind === 'member' && !u.setLeftAt) {
      await claimMemberSeat(clan.id, u.accountId);
    }

    await db
      .update(clanMemberships)
      .set({
        rank: u.setRank,
        lastSeenInClan: now,
        leftAt: u.setLeftAt,
        kind: u.setKind,
        source: u.setSource,
      })
      .where(eq(clanMemberships.id, u.id));

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
    // Trigger a role re-sync on any signal that could change the target role set:
    // rename, return-from-left, rank change, or a guest being promoted to a real
    // member. Each is a fire-and-forget HTTP call; the sync function diff-applies so
    // back-to-back triggers for the same member are cheap (just a GET of current
    // roles, then no-op writes).
    if (u.renamed || u.returning || u.rankChanged || u.becameMember) {
      syncRolesForClanMemberFireAndForget(u.id);
    }
  }

  // ── 5) Soft-delete missing ───────────────────────────────────────────────
  const incomingList = Array.from(incomingNormalized);
  // Chosen through the view and applied to the seats: the RSN this filters on belongs to the
  // account now, so filter and target no longer live on one table.
  //
  // `source != 'admin'` is the guard that matters. An admin put those seats here by hand, and the
  // in-game roster not listing them is not evidence they left — it is usually evidence they were
  // never in the clan in game, which is what a guest IS.
  const departing = await db
    .select({ id: clanRoster.id, rsn: clanRoster.rsn })
    .from(clanRoster)
    .where(
      and(
        eq(clanRoster.clanId, clan.id),
        isNull(clanRoster.leftAt),
        ne(clanRoster.source, 'admin'),
        eq(clanRoster.kind, 'member'),
        incomingList.length > 0
          ? notInArray(clanRoster.rsnNormalized, incomingList)
          : eq(clanRoster.source, 'roster'),
      ),
    );
  const leftResult = departing.length
    ? await db
        .update(clanMemberships)
        .set({ leftAt: now })
        .where(inArray(clanMemberships.id, departing.map((d) => d.id)))
        .returning({ id: clanMemberships.id })
        .then((rows) => {
          const byId = new Map(departing.map((d) => [d.id, d.rsn]));
          return rows.map((r) => ({ id: r.id, rsn: byId.get(r.id)! }));
        })
    : [];

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
  await setSetting(clan.id, 'last_clan_sync', lastSyncSettingValue);

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

    sendDiscordWebhook(clan.id, {
      embeds: [
        {
          author: { name: clanName || 'Clan roster' },
          title: '🔄 Roster synced',
          description: `${members.length} members in the clan.`,
          color: EMBED_COLOR.blue,
          fields,
          timestamp: now,
        },
      ],
    }).catch(() => {});
  }

  // The sync itself is never rejected — breaking a paying clan's plugin mid-event would be worse
  // than an overage. Only new-member growth stops, and only after the grace window (see above).
  if (roster.overLimit) {
    log.warn('member-cap.over-limit', {
      active: roster.active,
      cap: roster.cap,
      state: roster.state,
      graceDaysLeft: roster.graceDaysLeft,
    });
  }

  // Detailed change list for the plugin to render as in-game chat lines (one per
  // event), in addition to the count summary it has always returned.
  return NextResponse.json({
    added: toInsert.length,
    updated: toUpdate.length,
    markedLeft: leftResult.length,
    renamed: changes.filter((c) => c.type === 'renamed').length,
    returned: changes.filter((c) => c.type === 'returned').length,
    // Names RuneLite couldn't resolve ("#Player1404") and we therefore didn't store. Reported so a
    // roster that syncs 48 of 52 members isn't silently short.
    skippedNames,
    syncedAt: now,
    // { cap, active, overLimit, remaining, state, overSince, graceEndsAt, graceDaysLeft }.
    // cap=null means unlimited. `capNotice` is a ready-to-show line for the plugin/admin UI, and
    // `refusedNewMembers` names anyone the plan limit kept off the roster this sweep.
    roster,
    capNotice: capMessage(roster),
    refusedNewMembers,
    // Anyone the in-game roster listed whom this clan has banned from the SITE. Named rather than
    // dropped, so a roster that syncs 51 of 52 says which one and why.
    refusedBanned,
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
  const clan = await requireClanFromRequest(request);
  const auth = await verifyAdminPluginToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const stored = await getSetting(clan.id, 'last_clan_sync');
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as {
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
