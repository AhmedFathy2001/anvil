import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { requireClan } from '@/lib/clanContext';
import { db } from '@/db';
import { getSetting } from '@/lib/settings';
import { eventParticipants, eventSignups, events, teams, tiles } from '@/db/schema';
import { and, count, eq, isNotNull } from 'drizzle-orm';
import { verifyTileEditorForEvent } from '@/lib/auth';
import { analyzeEffort } from '@/lib/balanceEffort';
import { computePlayerProfiles } from '@/lib/playerProfile';
import { isPointsMode } from '@/lib/utils';
import { BALANCE_RATES_SETTING_KEY } from '@/lib/balanceRates';
import { RAID_LUCK_SETTING_KEY } from '@/lib/raidLuck';
import { tileBalanceRevision } from '@/lib/tileBalanceRevision';
import { unobtainableItems } from '@/lib/dropSourceCheck';
import { dropVariants } from '@/lib/dropVariants';
import { parseJsonArray } from '@/lib/tileKinds';

// Effort-model side of the board-balance auditor. Runs server-side because the wiki
// drop-rate dataset (~700KB) shouldn't ship to the client; the Tiles tab fetches this
// and merges the result with its live structural checks. Admin rate overrides (the
// balance_rates setting) merge over the curated defaults.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const clan = await requireClan();
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const editor = await verifyTileEditorForEvent(eId);
  if (!editor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, eId) });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  const eventTiles = await db.query.tiles.findMany({ where: eq(tiles.eventId, eId) });

  let ratesOverride: unknown = null;
  let raidRatesOverride: unknown = null;
  const [stored, storedRaidRates] = await Promise.all([
    getSetting(clan.id, BALANCE_RATES_SETTING_KEY),
    getSetting(clan.id, RAID_LUCK_SETTING_KEY),
  ]);
  if (stored) {
    try {
      ratesOverride = JSON.parse(stored);
    } catch {
      /* malformed overrides are ignored — defaults still apply */
    }
  }
  if (storedRaidRates) {
    try {
      raidRatesOverride = JSON.parse(storedRaidRates);
    } catch {
      /* malformed overrides are ignored — defaults still apply */
    }
  }

  // Event window for the realizability (lottery) classification — falls back to the model's
  // default when dates aren't set yet at authoring time.
  const eventDays =
    event.startDate && event.endDate
      ? Math.max(1, Math.round((Date.parse(event.endDate) - Date.parse(event.startDate)) / 86_400_000))
      : null;

  // Players per team: a team-tracked XP/KC goal is fed by every member at once. Before the draft
  // there are no placed players, so approved sign-ups over the planned teams stand in.
  const [teamCount, placed, approved] = await Promise.all([
    db.select({ n: count() }).from(teams).where(eq(teams.eventId, eId)),
    db.select({ n: count() }).from(eventParticipants).where(and(eq(eventParticipants.eventId, eId), isNotNull(eventParticipants.teamId))),
    db.select({ n: count() }).from(eventSignups).where(and(eq(eventSignups.eventId, eId), eq(eventSignups.status, 'approved'))),
  ]);
  const nTeams = teamCount[0]?.n ?? 0;
  const players = (placed[0]?.n ?? 0) || (approved[0]?.n ?? 0);
  const teamSize = nTeams > 0 && players > 0 ? players / nTeams : null;

  const report = analyzeEffort(eventTiles, {
    pointsMode: isPointsMode(event.scoringMode),
    ratesOverride,
    raidRatesOverride,
    eventDays,
    teamSize,
  });

  // Drop tiles restricted to a monster that doesn't drop the item can never complete — and neither
  // can one asking for the wrong variant of a drop (a charged Tumeken's shadow, when the chest gives
  // it uncharged), source or no source.
  const deadDrops: { id: number; label: string; sources: string[] }[] = [];
  const dropTiles: { id: number; label: string; ids: number[] }[] = [];
  for (const t of eventTiles) {
    if (t.tileType !== 'drop' && t.tileType !== 'collection') continue;
    const reqs = parseJsonArray<{ itemId?: number }>(t.itemRequirements);
    const ids = reqs.length > 0 ? reqs.map((r) => r.itemId).filter((n): n is number => typeof n === 'number') : parseJsonArray<number>(t.trackedItemIds);
    dropTiles.push({ id: t.id, label: t.label, ids });
    const sources = parseJsonArray<string>(t.sourceNpcs);
    if (sources.length === 0) continue;
    if (unobtainableItems(ids, sources).length > 0) deadDrops.push({ id: t.id, label: t.label, sources });
  }
  const variants = await dropVariants([...new Set(dropTiles.flatMap((t) => t.ids))]);
  const wrongVariant = dropTiles.flatMap((t) => {
    const swaps = t.ids.filter((id) => variants[id] && !t.ids.includes(variants[id].id)).map((id) => variants[id].name);
    return swaps.length > 0 ? [{ id: t.id, label: t.label, swaps }] : [];
  });
  if (wrongVariant.length > 0) {
    report.checks.push({
      id: 'drop-variant',
      level: 'warn',
      title: `${wrongVariant.length} drop tile${wrongVariant.length === 1 ? '' : 's'} ask for a variant that never drops`,
      detail:
        wrongVariant.map((w) => `${w.label} (drops as ${w.swaps.join(', ')})`).join('; ') +
        ` — the plugin credits the exact item, so these can never complete. Open the tile and use the suggested item.`,
      tileIds: wrongVariant.map((w) => w.id),
    });
  }
  if (deadDrops.length > 0) {
    report.checks.push({
      id: 'drop-source',
      level: 'warn',
      title: `${deadDrops.length} drop tile${deadDrops.length === 1 ? '' : 's'} ask for an item the source doesn't drop`,
      detail:
        deadDrops.map((d) => `${d.label} (only from ${d.sources.join(', ')})`).join('; ') +
        ` — by the wiki's drop tables these can never complete. Check the item (a charged or noted variant?) or the source.`,
      tileIds: deadDrops.map((d) => d.id),
    });
  }

  // Pool-aware pass (plan A3): the assignee-band pricing above assumes SOMEONE capable exists —
  // check that against the actual sign-up pool (or, before anyone signs up, the whole clan as the
  // prior). An elite-gated board over a pool with no endgame markers is a dead board, and the
  // best moment to hear that is while points are still editable. Best-effort: a profile hiccup
  // never blocks the audit itself.
  try {
    const enrolled = await computePlayerProfiles(clan.id, { eventId: eId });
    const pool = enrolled.length > 0 ? enrolled : await computePlayerProfiles(clan.id, {});
    const poolLabel = enrolled.length > 0 ? 'sign-up pool' : 'clan (nobody signed up yet)';
    const gatedTiles = report.perTile.filter((t) => t.floor === 'elite' || t.floor === 'high');
    if (pool.length > 0 && gatedTiles.length > 0) {
      const capable = pool.filter((p) =>
        p.capabilityMarkers.some((m) => (m.domain === 'endgame-pvm' || m.domain === 'raids') && m.kc >= 1),
      );
      const gatedWeight = gatedTiles.reduce((s, t) => s + t.weight, 0);
      const totalWeight = report.perTile.reduce((s, t) => s + t.weight, 0) || 1;
      if (capable.length === 0) {
        report.checks.push({
          id: 'pool-capability',
          level: 'warn',
          title: `Nobody in the ${poolLabel} has endgame-PvM/raid experience`,
          detail:
            `${gatedTiles.length} high/elite tile${gatedTiles.length === 1 ? '' : 's'} ` +
            `(${Math.round((gatedWeight / totalWeight) * 100)}% of the board's weight) assume a capable assignee — ` +
            `for this pool they're effectively dead tiles. Reprice or swap before the draft.`,
          tileIds: gatedTiles.map((t) => t.tileId),
        });
      } else if (capable.length <= 2) {
        report.checks.push({
          id: 'pool-capability',
          level: 'info',
          title: `Only ${capable.length} in the ${poolLabel} carry the gated tiles`,
          detail:
            `${capable.map((p) => p.rsn).join(', ')} hold the endgame/raid markers behind ` +
            `${Math.round((gatedWeight / totalWeight) * 100)}% of the board's weight — make sure the draft ` +
            `spreads them across teams, or the balance math won't save it.`,
          tileIds: gatedTiles.map((t) => t.tileId),
        });
      }
    }
  } catch {
    /* pool read is advisory */
  }

  // Infinity doesn't survive JSON — encode as null and let the client re-read hours[1] == null
  // alongside `blocked` to mean "average band can't do it".
  const perTile = report.perTile.map((t) => ({
    ...t,
    hours: t.hours ? t.hours.map((h) => (Number.isFinite(h) ? Math.round(h * 100) / 100 : null)) : null,
  }));
  return NextResponse.json({
    ...report,
    perTile,
    // The bulk review sends this back when applying. It prevents an old preview from overwriting
    // changes made by another editor while the dialog was open.
    revision: tileBalanceRevision(eventTiles),
  });
}
