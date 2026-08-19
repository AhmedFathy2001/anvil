import { NextResponse } from 'next/server';
import { loginOf } from '@/lib/roster';
import { requireClanFromRequest } from '@/lib/clanContext';
import { db } from '@/db';
import { clanAuditLog, clanMemberships, clanRoster, clanStaff, users } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { verifyAdminOrModerator } from '@/lib/auth';
import { applyPendingRole } from '@/lib/pending-role';
import { banFromClan, isBannedFromClan, liftClanBan } from '@/lib/clanBans';

// POST /api/admin/clan/bulk — apply one roster action to many members in a single round-trip.
//
// Semantics mirror the per-member routes exactly (see [id]/route.ts, [id]/pending-role/route.ts and
// admin/users/[id]/ban/route.ts): same admin gate, same guards (owner never banned, never ban
// yourself, roles only ever applied upward via applyPendingRole), same audit rows. Anything a guard
// refuses is reported in `skipped` rather than failing the whole batch — a 40-row selection that
// contains one unlinked account should still apply to the other 39.
type BulkAction =
  | 'set-role'
  | 'promote'
  | 'demote'
  | 'remove'
  | 'rejoin'
  | 'ban'
  | 'unban';

const PENDING_ROLES = new Set(['admin', 'moderator', 'editor', 'treasurer']);
const ACTIONS = new Set<BulkAction>([
  'set-role',
  'promote',
  'demote',
  'remove',
  'rejoin',
  'ban',
  'unban',
]);

// A selection is a hand-made list from one screen; this only exists to keep a malformed/hostile body
// from turning into an unbounded write loop.
const MAX_IDS = 500;

// Actions a MODERATOR may run. Everything here is roster work — who is in the clan, who's banned
// from it. What's deliberately absent is 'set-role', 'promote' and 'demote': those change what
// someone can DO on the site, and a moderator handing out roles (including their own) is how a
// moderation account becomes an admin account.
const MODERATOR_ACTIONS = new Set<BulkAction>(['remove', 'rejoin', 'ban', 'unban']);

export async function POST(request: Request) {
  const actor = await verifyAdminOrModerator();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const clan = await requireClanFromRequest(request);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: { ids?: unknown; action?: unknown; role?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.filter((v): v is number => Number.isInteger(v) && (v as number) > 0))]
    : [];
  if (!ids.length) return NextResponse.json({ error: 'ids[] required' }, { status: 400 });
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `Too many members (max ${MAX_IDS} at a time)` }, { status: 400 });
  }

  const action = body.action as BulkAction;
  if (!ACTIONS.has(action)) return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  if (actor.role !== 'admin' && !MODERATOR_ACTIONS.has(action)) {
    return NextResponse.json(
      { error: 'Only an admin can change site roles.' },
      { status: 403 },
    );
  }

  const role = typeof body.role === 'string' ? body.role : null;
  if (action === 'set-role' && role !== null && !PENDING_ROLES.has(role)) {
    return NextResponse.json(
      { error: "role must be 'admin', 'moderator', 'editor', 'treasurer', or null" },
      { status: 400 },
    );
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) || null : null;

  // Scoped to the clan whose host asked: the ids came from the request body, and a bulk promote,
  // demote or remove must not be able to reach across into another clan's roster.
  const members = await db
    .select()
    .from(clanRoster)
    .where(and(eq(clanRoster.clanId, clan.id), inArray(clanRoster.id, ids)));
  if (!members.length) return NextResponse.json({ error: 'No matching members' }, { status: 404 });

  // Their LOGINS, for the ban guards.
  //
  // Keyed by player_id, not by users.id. A seat names a PERSON; users and players are separate
  // sequences, so looking a login up by a person's number matches whoever happens to share it. On
  // this database that is 59 of 60 users — the guards below were reading a near-arbitrary
  // stranger's row, and the ban then wrote to it.
  const personIds = [...new Set(members.map((m) => m.playerId).filter((v): v is number => v != null))];
  const userRows = personIds.length
    ? await db
        .select({ id: users.id, playerId: users.playerId, role: users.role })
        .from(users)
        .where(inArray(users.playerId, personIds))
    : [];
  const userByPerson = new Map(userRows.map((u) => [u.playerId, u]));

  // Who owns THIS clan, as a person. Read from the grant rather than a flag on the user: being the
  // owner of another clan confers nothing here, and must not.
  const ownerGrant = await db
    .select({ playerId: users.playerId })
    .from(clanStaff)
    .innerJoin(users, eq(users.id, clanStaff.userId))
    .where(and(eq(clanStaff.clanId, clan.id), eq(clanStaff.role, 'owner')))
    .limit(1)
    .then((r) => r[0] ?? null);
  const ownerPersonId = ownerGrant?.playerId ?? null;

  const nowIso = new Date().toISOString();
  const skipped: { id: number; rsn: string; reason: string }[] = [];
  let applied = 0;
  // Roles applied straight away (already-verified members) vs queued until they claim their RSN —
  // the client turns this into "3 promoted now, 2 queued".
  let appliedNow = 0;

  for (const m of members) {
    const linked = m.playerId != null ? userByPerson.get(m.playerId) ?? null : null;

    switch (action) {
      case 'set-role': {
        await db.update(clanMemberships).set({ pendingRole: role }).where(eq(clanMemberships.id, m.id));
        db.insert(clanAuditLog)
          .values({
            clanMemberId: m.id,
            eventType: 'role_pre_assigned',
            oldValue: JSON.stringify({ pendingRole: m.pendingRole }),
            newValue: JSON.stringify({ pendingRole: role }),
            actorUserId: actor.userId > 0 ? actor.userId : null,
          })
          .catch(() => {});
        // Already-verified, non-provisional members get it immediately — same rule as the single-row
        // route. applyPendingRole never downgrades, so an existing admin is left alone.
        // applyPendingRole promotes a LOGIN; a seat names a person. Resolve one to the other
        // rather than passing a number from the wrong sequence.
        const owner = m.claimedAt ? await loginOf(m.playerId) : null;
        if (role && owner != null && !m.provisional) {
          if (await applyPendingRole(m.id, owner, 'manual_approval')) appliedNow++;
        }
        applied++;
        break;
      }
      case 'promote':
      case 'demote': {
        const kind = action === 'demote' ? ('guest' as const) : ('member' as const);
        if (m.kind === kind) {
          skipped.push({ id: m.id, rsn: m.rsn, reason: kind === 'guest' ? 'already a guest' : 'already a member' });
          break;
        }
        await db.update(clanMemberships).set({ kind }).where(eq(clanMemberships.id, m.id));
        applied++;
        break;
      }
      case 'remove': {
        if (m.leftAt) {
          skipped.push({ id: m.id, rsn: m.rsn, reason: 'already left' });
          break;
        }
        await db.update(clanMemberships).set({ leftAt: nowIso }).where(eq(clanMemberships.id, m.id));
        applied++;
        break;
      }
      case 'rejoin': {
        if (!m.leftAt) {
          skipped.push({ id: m.id, rsn: m.rsn, reason: 'already on the roster' });
          break;
        }
        // Says why rather than quietly succeeding-then-not: rejoining someone this clan has banned
        // is a contradiction, and the fix is to lift the ban, which is a decision not a side effect.
        if (m.playerId != null && (await isBannedFromClan(clan.id, m.playerId))) {
          skipped.push({ id: m.id, rsn: m.rsn, reason: 'banned from this clan — lift the ban first' });
          break;
        }
        await db.update(clanMemberships).set({ leftAt: null }).where(eq(clanMemberships.id, m.id));
        applied++;
        break;
      }
      case 'ban':
      case 'unban': {
        // Barring someone from THIS CLAN, and nothing more. This used to write `users.banned`,
        // which verifyUser refuses a session on — so a moderator here signed the person out of
        // every clan on the deployment and off the platform. That level is /staff's.
        const banning = action === 'ban';
        if (m.playerId == null) {
          skipped.push({ id: m.id, rsn: m.rsn, reason: 'unclaimed account' });
          break;
        }
        if (linked?.id === actor.userId) {
          skipped.push({ id: m.id, rsn: m.rsn, reason: 'that’s you' });
          break;
        }
        // Owner OF THIS CLAN, read from the grant. Owning some other clan is no protection here.
        if (ownerPersonId != null && m.playerId === ownerPersonId) {
          skipped.push({ id: m.id, rsn: m.rsn, reason: 'clan owner' });
          break;
        }

        if (banning) {
          const r = await banFromClan({
            clanId: clan.id,
            playerId: m.playerId,
            accountId: m.accountId,
            reason,
            byUserId: actor.userId,
          });
          if (!r.ok) {
            skipped.push({ id: m.id, rsn: m.rsn, reason: r.error.toLowerCase() });
            break;
          }
        } else if (!(await liftClanBan(clan.id, m.playerId, actor.userId))) {
          skipped.push({ id: m.id, rsn: m.rsn, reason: 'not banned here' });
          break;
        }
        applied++;
        break;
      }
    }
  }

  return NextResponse.json({ ok: true, applied, appliedNow, skipped });
}
