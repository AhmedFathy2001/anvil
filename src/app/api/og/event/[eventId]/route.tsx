import { asc, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { completions, events as eventsTable, tiles as tilesTable } from '@/db/schema';
import { resolveClanById } from '@/lib/clanContext';
import { clanVisibilityOf } from '@/lib/clanVisibility';
import { eventStage } from '@/lib/eventStage';
import { visibilityOf } from '@/lib/eventVisibility';
import { eventCard, siteCard, type BoardCell } from '@/lib/ogCard';
import { remoteSprite } from '@/lib/ogKit';
import { compact, timeLeft } from '@/lib/linkText';
import { ourImageAsDataUrl } from '@/lib/crestImage';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { parseEventRules, visibleTiles, boardTiles } from '@/lib/eventRules';
import { getTeamStandings } from '@/lib/statStandings';
import { deriveTileIcon } from '@/lib/tileIcons';
import { eventActivityIsValid } from '@/lib/completionGate';

export const dynamic = 'force-dynamic';

const FORMAT_LABEL: Record<string, string> = {
  bingo: 'Bingo',
  tilerace: 'Tile race',
  ladder: 'Ladder',
  sotw: 'Skill of the Week',
  botw: 'Boss of the Week',
};

/** Team colours are free text in principle; anything that isn't a hex colour gets a house one. */
const FALLBACK_TEAM = ['#d9534f', '#5b8def', '#3fbf7f', '#b06fe0', '#e0aa1e', '#3fc1c9'];
function teamColor(raw: string | null | undefined, i: number): string {
  return raw && /^#[0-9a-f]{6}$/i.test(raw.trim()) ? raw.trim() : FALLBACK_TEAM[i % FALLBACK_TEAM.length];
}

/** The most cells the mini board draws: a 10×10 at most, or the first 25 of a list board. */
const MAX_SQUARE = 10;
const LIST_CELLS = 25;

/**
 * An event's social card — the link people actually paste, since a board is the thing a clan wants
 * looked at.
 *
 * The gate is the READ gate, not the play gate: an `invited` event is not for strangers, and neither
 * is any event belonging to a clan that keeps to itself. Both fall back to the plain Anvil card for
 * the same reason the clan route does — a 404 here would answer questions about which private events
 * exist. A `clan`-visibility event on a public clan IS shown, because that is precisely what a
 * stranger following the link from Discord already sees on the page.
 *
 * WHAT THE BOARD SHOWS IS WHAT THE PAGE SHOWS. Nothing while `tilesRevealed` is off (the count and
 * the icons are exactly what it is holding back); on a staged-reveal board only the tiles drawn so
 * far, through the same `visibleTiles` the page uses; and never a mission.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const id = Number((await params).eventId);
  if (!Number.isInteger(id) || id <= 0) return siteCard();

  // clan-scope: global -- reads the very event named in the URL, by its own id; its clanId is
  // then resolved and access-checked on the next two lines, exactly as lib/eventAccess does.
  const event = await db.query.events.findFirst({ where: eq(eventsTable.id, id) });
  if (!event || visibilityOf(event.visibility) === 'invited') return siteCard();

  const clan = await resolveClanById(event.clanId);
  if (!clan || clanVisibilityOf(clan.visibility) !== 'public') return siteCard();

  const revealed = !!event.tilesRevealed;
  const [standings, allTiles, clanName] = await Promise.all([
    getTeamStandings(event.id, event.scoringMode),
    revealed ? db.select().from(tilesTable).where(eq(tilesTable.eventId, event.id)) : Promise.resolve([]),
    getClanDisplayName(clan.id, clan.name),
  ]);
  const name = clanName || clan.name;

  const rules = parseEventRules(event.rules);
  const shown = revealed ? visibleTiles(rules, boardTiles(allTiles)).sort((a, b) => a.position - b.position) : [];
  const colorByTeam = new Map(standings.map((s, i) => [s.teamId, teamColor(s.color, i)]));

  // Who claimed each shown tile first. Earliest completion wins the colour, the way it does on the
  // page when two teams have both finished a tile.
  const firstClaim = new Map<number, number>();
  if (shown.length) {
    const rows = await db
      .select({ tileId: completions.tileId, teamId: completions.teamId, completedAt: completions.completedAt })
      .from(completions)
      .where(inArray(completions.tileId, shown.map((t) => t.id)))
      .orderBy(asc(completions.completedAt));
    for (const r of rows) {
      if (!firstClaim.has(r.tileId) && eventActivityIsValid(event, r.completedAt)) firstClaim.set(r.tileId, r.teamId);
    }
  }

  const square = event.format === 'bingo' && event.scoringMode !== 'points' && event.boardSize > 0;
  const cols = square ? Math.min(MAX_SQUARE, event.boardSize) : 5;
  const cellTiles = shown.slice(0, square ? cols * cols : LIST_CELLS);
  const iconBox = cols > 7 ? 40 : 56;

  const stage = eventStage(event);
  const [banner, icon, clanLogo, icons] = await Promise.all([
    ourImageAsDataUrl(event.bannerUrl, { width: 1200, height: 630 }, 'jpeg'),
    ourImageAsDataUrl(event.iconUrl, { width: 300, height: 300 }, 'png'),
    ourImageAsDataUrl(clan.logoUrl, { width: 300, height: 300 }, 'png'),
    Promise.all(cellTiles.map((t) => remoteSprite(deriveTileIcon(t), iconBox))),
  ]);

  const cells: BoardCell[] = cellTiles.map((t, i) => {
    const team = firstClaim.get(t.id);
    return { icon: icons[i], claimedBy: team != null ? colorByTeam.get(team) ?? null : null };
  });

  const leader = standings[0];
  const anyScore = standings.some((s) => s.score > 0);
  const clock =
    stage === 'run'
      ? (() => {
          const left = timeLeft(event.endDate);
          return left ? `${left} left` : null;
        })()
      : stage === 'build'
        ? (() => {
            const until = timeLeft(event.startDate);
            return until ? `Starts in ${until}` : null;
          })()
        : leader && anyScore
          ? `${leader.name} won`
          : null;

  const facts = [
    standings.length ? `${standings.length} team${standings.length === 1 ? '' : 's'}` : null,
    revealed && shown.length ? `${shown.length} tile${shown.length === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const stageWord = stage === 'run' ? 'Live now' : stage === 'wrap' ? 'Finished' : 'Upcoming';
  return eventCard({
    eyebrow: `${stageWord} · ${FORMAT_LABEL[event.format] ?? 'Event'}`,
    stage,
    title: event.name,
    clanName: name,
    clanLogo,
    icon,
    banner,
    board: cells.length ? { cols: Math.min(cols, Math.max(1, cells.length)), cells } : null,
    // Standings only once somebody has scored — a column of zeroes reads as a dead board.
    standings: anyScore
      ? standings.slice(0, 3).map((s, i) => ({
          name: s.name,
          value: s.score,
          score: s.unit === 'pts' ? compact(s.score) : `${s.score}`,
          color: teamColor(s.color, i),
        }))
      : [],
    clock,
    facts: facts || null,
  });
}
