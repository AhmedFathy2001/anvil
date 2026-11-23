import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { requireClan } from '@/lib/clanContext';
import { db } from '@/db';
import { getSetting } from '@/lib/settings';
import { eventParticipants, eventSignups, events, teams, tiles } from '@/db/schema';
import { eventBoardTiles } from '@/lib/comboSql';
import { and, count, eq, isNotNull } from 'drizzle-orm';
import { verifyTileEditorForEvent } from '@/lib/auth';
import { analyzeEffort } from '@/lib/balanceEffort';
import { capabilityShares, type CapabilityShares } from '@/lib/capabilityPool';
import { boardActivityKeys } from '@/lib/draftCoverage';
import { BOSSES } from '@/lib/constants';
import { isPointsMode } from '@/lib/utils';
import { BALANCE_RATES_SETTING_KEY } from '@/lib/balanceRates';
import { RAID_LUCK_SETTING_KEY } from '@/lib/raidLuck';
import { tileBalanceRevision } from '@/lib/tileBalanceRevision';
import { unobtainableItems } from '@/lib/dropSourceCheck';
import { dropVariants } from '@/lib/dropVariants';
import { parseJsonArray } from '@/lib/tileKinds';
import { refusePractice } from '@/lib/practiceGuard';

// Effort-model side of the board-balance auditor. Runs server-side because the wiki
// drop-rate dataset (~700KB) shouldn't ship to the client; the Tiles tab fetches this
// and merges the result with its live structural checks. Admin rate overrides (the
// balance_rates setting) merge over the curated defaults.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  // A practice board (lib/practice) has none of this (lib/practiceGuard).
  const practiceRefused = await refusePractice(params);
  if (practiceRefused) return practiceRefused;
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
  // Board cells only — combo parts (lib/combo) carry no points of their own.
  const eventTiles = await db.query.tiles.findMany({ where: eventBoardTiles(eId) });

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

  // Who it's priced for: the sign-up pool, else the clan, else the curated floors (lib/capabilityPool).
  // Best-effort: a read hiccup prices on the floors rather than failing the audit.
  let capability: CapabilityShares = { pricedFor: 'baseline', population: 0, shares: new Map() };
  try {
    capability = await capabilityShares(clan.id, eId, boardActivityKeys(eventTiles));
  } catch {
    /* advisory */
  }

  const report = analyzeEffort(eventTiles, {
    pointsMode: isPointsMode(event.scoringMode),
    ratesOverride,
    raidRatesOverride,
    eventDays,
    teamSize,
    capabilityShares: new Map([...capability.shares].map(([k, v]) => [k, v.share])),
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

  // Pool-aware pass: hard content nobody (or almost nobody) here can do. Counts only, never names —
  // pricing is a board question, and who can't do the Inferno is nobody else's business.
  if (capability.pricedFor !== 'baseline') {
    const poolLabel = capability.pricedFor === 'pool' ? 'sign-up pool' : 'clan (nobody signed up yet)';
    const label = new Map(BOSSES.map((b) => [b.key, b.label]));
    const totalWeight = report.perTile.reduce((s, t) => s + t.weight, 0) || 1;
    const tilesFor = (key: string) =>
      eventTiles.filter((t) => boardActivityKeys([t]).has(key)).map((t) => t.id);
    const nobody = [...capability.shares].filter(([, v]) => v.able === 0);
    const few = [...capability.shares].filter(([, v]) => v.able > 0 && v.able <= 2);
    if (nobody.length) {
      const ids = nobody.flatMap(([k]) => tilesFor(k));
      const weight = report.perTile.filter((t) => ids.includes(t.tileId)).reduce((s, t) => s + t.weight, 0);
      report.checks.push({
        id: 'pool-capability',
        level: 'warn',
        title: `Nobody in the ${poolLabel} can realistically do ${nobody.length === 1 ? label.get(nobody[0][0]) : `${nobody.length} of the board's activities`}`,
        detail:
          `${nobody.map(([k]) => label.get(k) ?? k).join(', ')} — by stats and experience nobody here is set up for ` +
          `${nobody.length === 1 ? 'it' : 'these'}, so ${Math.round((weight / totalWeight) * 100)}% of the board's points ` +
          `are effectively dead. Reprice or swap them before the draft.`,
        tileIds: ids,
      });
    }
    if (few.length) {
      report.checks.push({
        id: 'pool-capability-thin',
        level: 'info',
        title: `Only one or two people here can do ${few.length === 1 ? label.get(few[0][0]) : `${few.length} activities`}`,
        detail:
          few.map(([k, v]) => `${label.get(k) ?? k} (${v.able})`).join(', ') +
          ` — spread them across teams in the draft, or those tiles go to whoever lands them.`,
        tileIds: few.flatMap(([k]) => tilesFor(k)),
      });
    }
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
    // What the skill premium was read from: 'pool' | 'clan' | 'baseline' (and how many accounts).
    pricedFor: { source: capability.pricedFor, population: capability.population },
  });
}
