import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { requireClan } from '@/lib/clanContext';
import { db } from '@/db';
import { events, eventParticipants, teams } from '@/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { assertEventEditable } from '@/lib/eventLock';
import { buildDraftControl, rotateOrderSoNextIs } from '@/lib/draftControl';
import { draftShortlists, teams as teamsTable } from '@/db/schema';
import { buildDraftBalance } from '@/lib/draftBalance';
import { notifyDraftComplete } from '@/lib/discord';
import { syncTeamDiscordOnDraftCompleteFireAndForget } from '@/lib/discord-teams';
import { parseEventRules, validateEventRules } from '@/lib/eventRules';

/**
 * Admin steering for a draft that's already running.
 *
 * The pre-draft panel could only act while `draftStatus === 'none'`, which is the one moment
 * nothing has gone wrong yet. These are the mid-draft levers: move a person between rosters, apply
 * the swap the balance engine already knows about, arm or disarm the per-captain tier filter, and
 * resume from a chosen team after a pause.
 *
 * Deliberately NOT here: un-picking (that's the draft route's `undo-pick`, which rewinds the clock)
 * and moving someone back to the pool. Both change whose turn it is, and an admin fixing a lopsided
 * roster shouldn't have to think about the clock.
 */

async function loadEvent(eventId: number) {
  // clan-scope: global -- a helper called only from handlers that have already run the event guard.
  return db.query.events.findFirst({ where: eq(events.id, eventId) });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!Number.isFinite(eId)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });

  const control = await buildDraftControl(clan.id, eId);
  if (!control) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  return NextResponse.json(control);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!Number.isFinite(eId)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });

  // Finished events are read-only unless explicitly unlocked (lib/eventLock).
  const locked = await assertEventEditable(eId);
  if (locked) return locked;

  let body: { action?: string; playerIds?: unknown; teamId?: unknown; give?: unknown; take?: unknown; mode?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = await loadEvent(eId);
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  switch (body.action) {
    // ── Move one person to another team, mid-draft ────────────────────────────────────────────
    // Their pick stays theirs: pickNumber and pickedAt are untouched, so the order isn't rewritten
    // and the clock doesn't move. Every account of that person travels together, exactly as a pick
    // would take them.
    case 'move': {
      const playerIds = Array.isArray(body.playerIds)
        ? body.playerIds.map((x) => Number(x)).filter((n) => Number.isFinite(n))
        : [];
      const teamId = Number(body.teamId);
      if (playerIds.length === 0 || !Number.isFinite(teamId)) {
        return NextResponse.json({ error: 'playerIds and teamId are required' }, { status: 400 });
      }
      const target = await db.query.teams.findFirst({
        where: and(eq(teams.id, teamId), eq(teams.eventId, eId)),
      });
      if (!target) return NextResponse.json({ error: 'Team not found in this event' }, { status: 404 });

      const rows = await db
        .select()
        .from(eventParticipants)
        .where(and(eq(eventParticipants.eventId, eId), inArray(eventParticipants.id, playerIds)));
      if (rows.length === 0) return NextResponse.json({ error: 'Nobody to move' }, { status: 404 });
      // Moving someone who was never picked would hand them a roster spot without a turn — that's
      // what the pool assignment on the Teams tab is for, before the draft runs.
      if (rows.some((r) => r.teamId == null)) {
        return NextResponse.json({ error: 'That player has not been drafted yet' }, { status: 400 });
      }

      await db
        .update(eventParticipants)
        .set({ teamId })
        .where(and(eq(eventParticipants.eventId, eId), inArray(eventParticipants.id, rows.map((r) => r.id))));

      return NextResponse.json({ ok: true, moved: rows.length, teamId });
    }

    // ── Apply a two-person swap (the balance engine's suggestion, or a manual pair) ────────────
    case 'swap': {
      const give = Array.isArray(body.give) ? body.give.map(Number).filter(Number.isFinite) : [];
      const take = Array.isArray(body.take) ? body.take.map(Number).filter(Number.isFinite) : [];
      if (give.length === 0 || take.length === 0) {
        return NextResponse.json({ error: 'give and take player ids are required' }, { status: 400 });
      }
      const rows = await db
        .select()
        .from(eventParticipants)
        .where(and(eq(eventParticipants.eventId, eId), inArray(eventParticipants.id, [...give, ...take])));
      const giveRows = rows.filter((r) => give.includes(r.id));
      const takeRows = rows.filter((r) => take.includes(r.id));
      const giveTeam = giveRows[0]?.teamId ?? null;
      const takeTeam = takeRows[0]?.teamId ?? null;
      if (giveTeam == null || takeTeam == null) {
        return NextResponse.json({ error: 'Both sides of a swap must already be on a team' }, { status: 400 });
      }
      if (giveTeam === takeTeam) {
        return NextResponse.json({ error: 'Both sides are already on the same team' }, { status: 400 });
      }

      await db
        .update(eventParticipants)
        .set({ teamId: takeTeam })
        .where(and(eq(eventParticipants.eventId, eId), inArray(eventParticipants.id, giveRows.map((r) => r.id))));
      await db
        .update(eventParticipants)
        .set({ teamId: giveTeam })
        .where(and(eq(eventParticipants.eventId, eId), inArray(eventParticipants.id, takeRows.map((r) => r.id))));

      return NextResponse.json({ ok: true, swapped: giveRows.length + takeRows.length });
    }

    // ── Arm / disarm the per-captain filter ───────────────────────────────────────────────────
    // Only the modes that exist are accepted; anything else would be silently ignored by the pick
    // route, which is worse than a 400 here.
    case 'balance-mode': {
      const mode = String(body.mode ?? '');
      const allowed = ['off', 'advisory', 'tiered-snake', 'dynamic-order', 'spread-cap'];
      if (!allowed.includes(mode)) {
        return NextResponse.json({ error: `mode must be one of ${allowed.join(', ')}` }, { status: 400 });
      }
      // Same validator the events PATCH runs, so a mode set from here can't produce rules JSON the
      // rest of the app would reject.
      const merged = { ...parseEventRules(event.rules), balanceMode: mode };
      const validated = validateEventRules(merged);
      if ('error' in validated) return NextResponse.json({ error: validated.error }, { status: 400 });
      await db.update(events).set({ rules: validated.rules }).where(eq(events.id, eId));
      return NextResponse.json({ ok: true, balanceMode: mode });
    }

    // ── Resume, optionally from a chosen team ─────────────────────────────────────────────────
    // Resuming in order after fixing a mis-pick would just repeat it, so the admin can name who
    // picks next; the order rotates so that's true, and everyone still picks once per round.
    case 'resume': {
      if (event.draftStatus !== 'paused') {
        return NextResponse.json({ error: 'The draft is not paused' }, { status: 400 });
      }
      const fromTeamId = body.teamId != null ? Number(body.teamId) : null;
      if (fromTeamId != null) {
        const control = await buildDraftControl(clan.id, eId);
        if (!control) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        if (!control.teamOrder.includes(fromTeamId)) {
          return NextResponse.json({ error: 'That team is not in the draft order' }, { status: 400 });
        }
        const rotated = rotateOrderSoNextIs(control.teamOrder, control.currentPickNumber, fromTeamId);
        await db.update(events).set({ draftOrder: JSON.stringify(rotated) }).where(eq(events.id, eId));
      }
      await db.update(events).set({ draftStatus: 'active' }).where(eq(events.id, eId));
      return NextResponse.json({ ok: true, resumedFrom: fromTeamId });
    }

    // ── Take the pick for a captain who has gone quiet ────────────────────────────────────────
    // Only once the clock has actually run out, and it takes THEIR pick, not the host's opinion:
    // the top of that captain's own shortlist if they left one, else the best rated player left.
    //
    // Written here rather than through the pick route (which authenticates a captain, not a host
    // acting for one), so the two things that route does at the end are mirrored below: every
    // account of the person travels together — profiles are already per-person — and emptying the
    // pool completes the draft and posts the roster, exactly once.
    case 'pick-for': {
      const control = await buildDraftControl(clan.id, eId);
      if (!control) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      if (control.draftStatus !== 'active') {
        return NextResponse.json({ error: 'The draft is not running' }, { status: 400 });
      }
      if (control.currentTeamId == null) {
        return NextResponse.json({ error: 'Nobody is on the clock' }, { status: 400 });
      }
      if (!control.pickOverdue) {
        return NextResponse.json(
          { error: 'That pick is not overdue yet — let them have their time.' },
          { status: 409 },
        );
      }

      const balance = await buildDraftBalance(clan.id, eId);
      const pool = balance.profiles.filter((p) => p.teamId == null && p.playerIds.length > 0);
      if (pool.length === 0) return NextResponse.json({ error: 'Nobody left to pick' }, { status: 400 });

      const team = await db.query.teams.findFirst({
        where: and(eq(teamsTable.id, control.currentTeamId), eq(teamsTable.eventId, eId)),
      });
      let chosen = pool[0]; // pool is rating-desc from the profile engine
      let source = 'best available';
      if (team?.captainUserId != null) {
        const list = await db
          .select({ personKey: draftShortlists.personKey })
          .from(draftShortlists)
          .where(and(eq(draftShortlists.eventId, eId), eq(draftShortlists.userId, team.captainUserId)))
          .orderBy(draftShortlists.position);
        const wanted = list
          .map((row) => pool.find((p) => p.personKey === row.personKey))
          .find((p): p is (typeof pool)[number] => !!p);
        if (wanted) {
          chosen = wanted;
          source = 'their shortlist';
        }
      }

      const now = new Date().toISOString();
      await db
        .update(eventParticipants)
        .set({ teamId: control.currentTeamId, pickNumber: control.currentPickNumber, pickedAt: now })
        .where(and(eq(eventParticipants.eventId, eId), inArray(eventParticipants.id, chosen.playerIds)));

      // Was that the last one? Then the draft is over, and the roster post has to fire here too —
      // otherwise a draft finished by a host-made pick ends silently.
      const stillInPool = await db
        .select({ id: eventParticipants.id })
        .from(eventParticipants)
        .where(and(eq(eventParticipants.eventId, eId), isNull(eventParticipants.teamId)));
      if (stillInPool.length === 0) {
        await db.update(events).set({ draftStatus: 'completed' }).where(eq(events.id, eId));
        // Atomic 0→1 flip, the same exactly-once guard the pick route and "End draft" both use.
        const flipped = await db
          .update(events)
          .set({ draftNotified: 1 })
          .where(and(eq(events.id, eId), eq(events.draftNotified, 0)))
          .returning({ id: events.id });
        if (flipped.length > 0) {
          const eventTeams = await db.select().from(teamsTable).where(eq(teamsTable.eventId, eId));
          const allPlayers = await db.select().from(eventParticipants).where(eq(eventParticipants.eventId, eId));
          notifyDraftComplete({
            clanId: clan.id,
            eventName: event.name,
            teams: eventTeams.map((t) => ({
              name: t.name,
              color: t.color,
              players: allPlayers.filter((p) => p.teamId === t.id).map((p) => p.name),
            })),
            eventId: eId,
          }).catch(() => {});
          syncTeamDiscordOnDraftCompleteFireAndForget(eId);
        }
      }

      return NextResponse.json({ ok: true, picked: chosen.rsn, source, teamId: control.currentTeamId });
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
