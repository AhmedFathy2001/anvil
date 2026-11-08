import { branchingRaceWin, afterRaceCompletion } from '@/lib/raceRoutesDb';
import { db } from '@/db';
import { emitCompletionRow } from '@/lib/panelRows';
import { queueTileHighlight } from '@/lib/highlights/store';
import { completions, eventParticipants, events, submissions, teams, tiles } from '@/db/schema';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { isComboTile, parseComboRule } from '@/lib/combo';
import { comboView, type PartInputs } from '@/lib/comboProgress';
import { getStatStandings } from '@/lib/statStandings';
import { evaluateCompletionGate } from '@/lib/completionGate';
import { notifyTileCompletion, notifyTeamWin } from '@/lib/discord';
import { handleBountyClaim, reopenBountyTileIfUnclaimed } from '@/lib/revealEngine';
import { log } from '@/lib/logger';
import { notifyTeamTiles } from '@/lib/pushNotify';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Combo completion (lib/combo): the PARENT's `completions` row follows its parts'.
//
// Every completion writer — the submission sync (lib/submissions), the hiscores sweep (lib/statsSweep),
// the live stat push / admin recompute (lib/statTileCredit) and the manual completions route — writes
// a PART's completion exactly as it would any tile's (that row is the part's progress) and then calls
// `afterPartCompletion`. That recomputes the parent for the team: insert when the rule is met (through
// the parent's own race / event-rules gate, which is what freezes its award and claims a bounty), and
// — only when a part's completion was REMOVED — revert it when the rule no longer holds. Additions
// never revert, so a manual completion of the combo itself stands until a part is actually undone.
//
// The parent never completes on its own engine: it has none. An admin can still complete it by hand
// (completions route), and `autoTrackDisabled` on the parent stops this sync touching it at all.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

type TileRow = typeof tiles.$inferSelect;

export interface ComboSyncResult {
  complete: boolean;
  /** Parts done (any/all/nOf) or the share in % (mix). */
  done: number;
  /** Parts needed, or 100 (mix). */
  needed: number;
  finisherPlayerId: number | null;
  /** True when the parent's completion row exists after this sync. */
  parentComplete: boolean;
  /** True when THIS call inserted it (the caller may want to say so). */
  inserted: boolean;
}

/**
 * A part's completion changed for a team — recompute its combo. No-op for a tile that isn't a part.
 * Fire-safe: errors are logged and swallowed, a combo hiccup must never fail the part's own credit.
 */
export async function afterPartCompletion(
  part: Pick<TileRow, 'id' | 'parentTileId' | 'label'>,
  teamId: number,
  opts: {
    /** 'removed' = a part's completion was deleted: the only change that may revert the combo. */
    change: 'added' | 'removed';
    /** Suppress every post (bulk maintenance recomputes). */
    silent?: boolean;
    /** Whose webhooks announce it — the pushing member's clan on a live push; the host otherwise. */
    notifyClanId?: number;
    /** The part's finisher, for the "part done" progress post. */
    finisher?: string | null;
    /** False when the caller already posted the part finishing (the submission post folds it in). */
    progressPost?: boolean;
  },
): Promise<ComboSyncResult | null> {
  if (part.parentTileId == null) return null;
  try {
    const res = await syncComboParent(part.parentTileId, teamId, {
      allowRevert: opts.change === 'removed',
      silent: opts.silent,
      notifyClanId: opts.notifyClanId,
    });
    // A part landing without finishing its combo posts as progress ("🧩 Combo — 1 of 2").
    if (res && opts.change === 'added' && !opts.silent && opts.progressPost !== false && !res.inserted && !res.parentComplete) {
      await postPartProgress(part, teamId, res, opts).catch(() => {});
    }
    return res;
  } catch (error) {
    log.warn('combo.sync-fail', { partId: part.id, parentId: part.parentTileId, teamId }, error);
    return null;
  }
}

/**
 * One team's view of a combo (lib/comboProgress): its parts' completions — and, for a 'mix' combo, how
 * far along each part is (its submissions and stat gains), per member too on a Solo combo.
 */
export async function teamComboView(parent: TileRow, teamId: number) {
  const parts = (await db.select().from(tiles).where(eq(tiles.parentTileId, parent.id))).sort((a, b) => a.id - b.id);
  const partIds = parts.map((p) => p.id);
  const done = partIds.length
    ? await db
        .select({ tileId: completions.tileId, creditPlayerId: completions.creditPlayerId })
        .from(completions)
        .where(and(eq(completions.teamId, teamId), inArray(completions.tileId, partIds)))
    : [];
  const doneBy = new Map(done.map((d) => [d.tileId, d.creditPlayerId]));
  const mix = parseComboRule(parent.comboRule).mode === 'mix';
  let subsByPart = new Map<number, { playerId: number | null; creditPlayerId: number | null; amount: number; itemId: number | null; goal: string | null }[]>();
  let statByPart = new Map<number, { playerId: number; gained: number }[]>();
  let memberIds: number[] = [];
  if (mix && partIds.length) {
    const [rows, members] = await Promise.all([
      db
        .select({ tileId: submissions.tileId, playerId: submissions.playerId, creditPlayerId: submissions.creditPlayerId, amount: submissions.amount, itemId: submissions.itemId, goal: submissions.goal })
        .from(submissions)
        .where(and(eq(submissions.teamId, teamId), inArray(submissions.tileId, partIds))),
      db.select({ id: eventParticipants.id }).from(eventParticipants).where(eq(eventParticipants.teamId, teamId)),
    ]);
    memberIds = members.map((m) => m.id);
    subsByPart = new Map();
    for (const r of rows) subsByPart.set(r.tileId, [...(subsByPart.get(r.tileId) ?? []), r]);
    const statIds = parts.filter((p) => p.trackedStat && p.statGoal).map((p) => p.id);
    if (statIds.length) {
      statByPart = new Map(
        (await getStatStandings(parent.eventId, statIds)).map((st) => [
          st.tileId,
          st.players.filter((pl) => pl.teamId === teamId).map((pl) => ({ playerId: pl.playerId, gained: pl.gained })),
        ]),
      );
    }
  }
  const inputsOf = (id: number): PartInputs => ({
    done: doneBy.has(id),
    doneBy: doneBy.get(id) ?? null,
    subs: subsByPart.get(id),
    stat: statByPart.get(id),
  });
  return { parts, view: comboView(parent, parts, inputsOf, memberIds) };
}

/**
 * A part's PROGRESS moved without it finishing (a submission, a stat gain). Only a 'mix' combo cares —
 * its share grows with every part's — so this recomputes the combo when it is one. Fire-safe.
 */
export async function afterPartProgress(
  part: Pick<TileRow, 'id' | 'parentTileId'>,
  teamId: number,
  opts: { silent?: boolean; notifyClanId?: number } = {},
): Promise<void> {
  if (part.parentTileId == null) return;
  try {
    const parent = await db.query.tiles.findFirst({ where: eq(tiles.id, part.parentTileId), columns: { comboRule: true } });
    if (!parent || parseComboRule(parent.comboRule).mode !== 'mix') return;
    await syncComboParent(part.parentTileId, teamId, { allowRevert: false, ...opts });
  } catch (error) {
    log.warn('combo.progress-sync-fail', { partId: part.id, teamId }, error);
  }
}

/**
 * Recompute one team's completion of a combo from its parts' completions. Inserts the parent's row when
 * the rule is met and the parent's gates allow it; deletes it when the rule fails and `allowRevert`.
 */
export async function syncComboParent(
  parentId: number,
  teamId: number,
  opts: { allowRevert?: boolean; silent?: boolean; notifyClanId?: number } = {},
): Promise<ComboSyncResult | null> {
  const parent = await db.query.tiles.findFirst({ where: eq(tiles.id, parentId) });
  if (!parent || !isComboTile(parent) || parent.parentTileId != null) return null;
  // A part moved, so the combo's pinned tracker view moved too (push/hub) — whatever happens below.
  notifyTeamTiles(parent.eventId, teamId, [parent.id]);
  // Admin kill-switch: a manual combo is completed by hand only.
  if (parent.autoTrackDisabled) return null;

  const { view } = await teamComboView(parent, teamId);
  const evaluation = { complete: view.complete, done: view.done, needed: view.needed, finisherPlayerId: view.finisherPlayerId };
  const [existing] = await db
    .select({ id: completions.id })
    .from(completions)
    .where(and(eq(completions.teamId, teamId), eq(completions.tileId, parentId)))
    .limit(1);

  if (!evaluation.complete) {
    if (existing && opts.allowRevert) {
      const removed = await db
        .delete(completions)
        .where(and(eq(completions.teamId, teamId), eq(completions.tileId, parentId)))
        .returning({ id: completions.id });
      if (removed.length > 0) reopenBountyTileIfUnclaimed(parent.eventId, parentId).catch(() => {});
      return { ...evaluation, parentComplete: false, inserted: false };
    }
    return { ...evaluation, parentComplete: !!existing, inserted: false };
  }
  if (existing) return { ...evaluation, parentComplete: true, inserted: false };

  // clan-scope: global -- the parent tile row came from an id the caller already scoped.
  const event = await db.query.events.findFirst({ where: eq(events.id, parent.eventId) });
  if (!event) return { ...evaluation, parentComplete: false, inserted: false };

  // Tile race: the gate below holds a combo that isn't open on the team's route (lib/completionGate).
  // Event rules (reveal / lockout / first bonus / decay / bounty) — the combo's own, as any board tile.
  const gate = await evaluateCompletionGate({ event, tile: parent, teamId });
  if (!gate.allowed) return { ...evaluation, parentComplete: false, inserted: false };

  const [inserted] = await db
    .insert(completions)
    .values({ teamId, tileId: parentId, creditPlayerId: evaluation.finisherPlayerId, awardedPoints: gate.awardedPoints })
    .onConflictDoNothing()
    .returning({ id: completions.id });
  if (!inserted) return { ...evaluation, parentComplete: true, inserted: false };
  emitCompletionRow(parentId, teamId);
  afterRaceCompletion(event, teamId);
  if (!opts.silent) queueTileHighlight(parentId, teamId);

  if (gate.bounty) handleBountyClaim(parent.eventId, parentId).catch(() => {});
  if (!opts.silent) await announceCombo(parent, teamId, event, opts.notifyClanId, evaluation.finisherPlayerId).catch(() => {});
  return { ...evaluation, parentComplete: true, inserted: true };
}

async function announceCombo(
  parent: TileRow,
  teamId: number,
  event: typeof events.$inferSelect,
  notifyClanId: number | undefined,
  finisherPlayerId: number | null,
): Promise<void> {
  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!team) return;
  let finisher: string | null = null;
  if (finisherPlayerId != null) {
    const p = await db.query.eventParticipants.findFirst({ where: (ep, { eq: e }) => e(ep.id, finisherPlayerId) });
    finisher = p?.name ?? null;
  }
  await notifyTileCompletion({
    clanId: notifyClanId ?? event.clanId,
    eventName: event.name,
    tileLabel: parent.label,
    teamName: team.name,
    teamId: team.id,
    teamColor: team.color,
    tileType: parent.tileType,
    eventId: event.id,
    tile: parent,
    finisher,
  });

  // Blackout: every board tile done (parts never count — the combo did).
  const board = await db.select({ id: tiles.id }).from(tiles).where(and(eq(tiles.eventId, event.id), isNull(tiles.parentTileId)));
  if (board.length === 0) return;
  const doneRows = await db
    .select({ tileId: completions.tileId })
    .from(completions)
    .where(and(eq(completions.teamId, teamId), inArray(completions.tileId, board.map((t) => t.id))));
  // A branching race is won by the first team to finish an end tile instead (lib/raceRoutesDb).
  const race = await branchingRaceWin(event, teamId);
  if (race ? race.won : new Set(doneRows.map((r) => r.tileId)).size === board.length) {
    await notifyTeamWin({
      clanId: event.clanId,
      eventName: event.name,
      teamName: team.name,
      teamId: team.id,
      teamColor: team.color,
      totalTiles: race ? race.steps : board.length,
      eventId: event.id,
    });
  }
}

async function postPartProgress(
  part: Pick<TileRow, 'id' | 'parentTileId' | 'label'>,
  teamId: number,
  res: ComboSyncResult,
  opts: { notifyClanId?: number; finisher?: string | null },
): Promise<void> {
  const parent = await db.query.tiles.findFirst({ where: eq(tiles.id, part.parentTileId!) });
  if (!parent) return;
  // clan-scope: global -- the parent tile row came from an id the caller already scoped.
  const event = await db.query.events.findFirst({ where: eq(events.id, parent.eventId) });
  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!event || !team) return;
  await notifyTileCompletion({
    clanId: opts.notifyClanId ?? event.clanId,
    eventName: event.name,
    tileLabel: part.label,
    teamName: team.name,
    teamId: team.id,
    teamColor: team.color,
    tileType: parent.tileType,
    eventId: event.id,
    tile: parent,
    finisher: opts.finisher ?? null,
    partOf: { label: parent.label, done: res.done, needed: res.needed },
  });
}
