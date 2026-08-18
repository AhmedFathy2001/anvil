import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanAuditLog, clanMemberships, clanRoster, users } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { verifyAdminOrModerator } from '@/lib/auth';
import { applyPendingRole } from '@/lib/pending-role';

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

  const members = await db.select().from(clanRoster).where(inArray(clanRoster.id, ids));
  if (!members.length) return NextResponse.json({ error: 'No matching members' }, { status: 404 });

  // Linked users, for the ban guards.
  const userIds = [...new Set(members.map((m) => m.playerId).filter((v): v is number => v != null))];
  const userRows = userIds.length
    ? await db
        .select({ id: users.id, isOwner: users.isOwner, role: users.role })
        .from(users)
        .where(inArray(users.id, userIds))
    : [];
  const userById = new Map(userRows.map((u) => [u.id, u]));

  const nowIso = new Date().toISOString();
  const skipped: { id: number; rsn: string; reason: string }[] = [];
  let applied = 0;
  // Roles applied straight away (already-verified members) vs queued until they claim their RSN —
  // the client turns this into "3 promoted now, 2 queued".
  let appliedNow = 0;

  for (const m of members) {
    const linked = m.playerId != null ? userById.get(m.playerId) ?? null : null;

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
        if (role && m.playerId && !m.provisional) {
          if (await applyPendingRole(m.id, m.playerId, 'manual_approval')) appliedNow++;
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
        await db.update(clanMemberships).set({ leftAt: null }).where(eq(clanMemberships.id, m.id));
        applied++;
        break;
      }
      case 'ban':
      case 'unban': {
        const banning = action === 'ban';
        if (!linked) {
          skipped.push({ id: m.id, rsn: m.rsn, reason: 'no site account' });
          break;
        }
        if (linked.id === actor.userId) {
          skipped.push({ id: m.id, rsn: m.rsn, reason: 'that’s you' });
          break;
        }
        if (linked.isOwner) {
          skipped.push({ id: m.id, rsn: m.rsn, reason: 'clan owner' });
          break;
        }
        await db
          .update(users)
          .set({
            banned: banning,
            bannedAt: banning ? nowIso : null,
            bannedReason: banning ? reason : null,
            bannedByUserId: banning ? actor.userId : null,
          })
          .where(eq(users.id, linked.id));
        db.insert(clanAuditLog)
          .values({
            clanMemberId: m.id,
            eventType: banning ? 'banned' : 'unbanned',
            newValue: JSON.stringify({ userId: linked.id, reason }),
            actorUserId: actor.userId,
          })
          .catch(() => {});
        applied++;
        break;
      }
    }
  }

  return NextResponse.json({ ok: true, applied, appliedNow, skipped });
}
