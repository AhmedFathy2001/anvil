import { rushTargetsLine } from '@/lib/bossRushRules';
import { huntIconFor, huntKindWord, isRush, parseHunt } from '@/lib/itemHunt';
import { competitionBoard } from '@/lib/itemHuntDb';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { weeklyCompetitions } from '@/db/schema';
import { resolveClanById } from '@/lib/clanContext';
import { clanVisibilityOf } from '@/lib/clanVisibility';
import { ANONYMOUS_VIEWER, competitionReadableBy } from '@/lib/competitionTeamsDb';
import { weeklyMetricLabel } from '@/lib/constants';
import { momentsForCompetition } from '@/lib/momentsStore';
import { siteCard, weeklyCard } from '@/lib/ogCard';
import { cachedCard, remoteSprite } from '@/lib/ogKit';
import { WEEKLY_KIND_LABEL as KIND_LABEL, WEEKLY_VERB as VERB, timeLeft, weeklyGain, weeklyKind, weeklyTotal } from '@/lib/linkText';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { idOrNull } from '@/lib/routeIds';
import { competitionImageUrl, itemIconUrl } from '@/lib/tileIcons';
import { getEffectiveParticipants } from '@/lib/weekly';
import { weeklyStatus } from '@/lib/weeklyStage';

export const dynamic = 'force-dynamic';


/**
 * A Skill or Boss of the Week's card: the skill's icon or the boss itself, and the race so far.
 *
 * Gated like the clan card — a clan that keeps to itself gets the plain Anvil card, never a 404 that
 * would confirm the competition exists. The names on it are the ones the competition page already
 * shows any visitor to a public clan.
 *
 * Once it's over the card stops being a race and becomes the result: who won, by how much, and the
 * best thing that happened to them along the way (a pet or a unique off Moments), because "won it
 * and got a Vorki on the way" is the line somebody pastes the link to brag about.
 */
async function load(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const compId = idOrNull((await params).id);
  if (compId == null) return siteCard();

  // clan-scope: global -- the competition named in the URL, by id; its clan is resolved and
  // visibility-checked on the next lines before anything about it is drawn.
  const comp = await db.query.weeklyCompetitions.findFirst({ where: eq(weeklyCompetitions.id, compId) });
  if (!comp) return siteCard();
  const clan = await resolveClanById(comp.clanId);
  if (!clan || clanVisibilityOf(clan.visibility) !== 'public') return siteCard();
  // Clan vs clan: the card names players from every racing clan, so every one of them has to be
  // readable by a stranger — a private partner's members stay off it.
  if (!(await competitionReadableBy(comp, ANONYMOUS_VIEWER))) return siteCard();

  const kind = weeklyKind(comp.type);
  const label = weeklyMetricLabel(kind, comp.metric) || comp.title;
  const stage = weeklyStatus(comp);

  const [participants, clanName] = await Promise.all([getEffectiveParticipants(comp.id), getClanDisplayName(clan.id, clan.name)]);
  const board = (await competitionBoard(comp, participants)).filter((e) => e.gained > 0);
  const name = clanName || clan.name;

  // An item hunt draws the item or pet it hunts.
  const art = await remoteSprite(kind === 'hunt' ? huntIconFor(comp.hunt) : competitionImageUrl(kind, comp.metric), kind === 'boss' ? 560 : 300);

  // A Boss Rush or a points hunt is scored in points: its board number is never "drops".
  const hunt = kind === 'hunt' ? parseHunt(comp.hunt) : null;
  const points = hunt?.rule === 'rush' || hunt?.rule === 'points';
  const gain = (n: number) => weeklyGain(kind, n, points);

  // The clan's own title only when it says something the metric doesn't ("Double XP week").
  let title = label;
  let subtitle = comp.title && !comp.title.toLowerCase().includes(label.toLowerCase()) ? comp.title : null;
  if (kind === 'hunt' && comp.title) {
    // A hunt's own name leads ("Any DT2 Pet"; the eyebrow already says it is a hunt), and what it
    // hunts goes under it as a list. A hunt for four pets was the title before: "Baron + Butcher +
    // Nid + 1 more" was cut off on its one line, and the display font drew its "+" broken.
    title = asList(comp.title.replace(/^(pet|item) hunt:\s*/i, '') || comp.title);
    subtitle = asList(label);
  }
  if (isRush(hunt)) {
    // "Boss Rush: Raids" on the title's one line drew "Boss Rush:" and lost the rest; the eyebrow says
    // Boss Rush already. Its targets go under it short and once each ("CoX, CoX: CM, ToB and 4 more"):
    // the stored metric is the full raid names, and clipped to one line it read "Chambers of Xeric,
    // Chambers of Xeric…".
    title = comp.title.replace(/^boss rush:\s*/i, '').trim() || comp.title;
    subtitle = rushTargetsLine(hunt.rush.targets) || subtitle;
  }

  const count = participants.length;
  const left = timeLeft(comp.endDate);
  const line =
    stage === 'upcoming'
      ? [`${count} member${count === 1 ? '' : 's'} signed up`, timeLeft(comp.startDate) ? `starts in ${timeLeft(comp.startDate)}` : null]
          .filter(Boolean)
          .join(', ')
      : stage === 'completed'
        ? board.length
          ? `${weeklyTotal(kind, board.reduce((s, e) => s + e.gained, 0), points)} across ${board.length} member${board.length === 1 ? '' : 's'}.`
          : 'Finished.'
        : [`${board.length || count} member${(board.length || count) === 1 ? '' : 's'} ${VERB[kind]}`, left ? `${left} left` : null]
            .filter(Boolean)
            .join(', ');

  let winner = null;
  if (stage === 'completed' && board[0]) {
    const top = board[0];
    const moments = await momentsForCompetition(comp.id, 30).catch(() => []);
    const mine = moments.filter((m) => m.rsn.toLowerCase() === top.rsn.toLowerCase());
    const best = mine.find((m) => m.kind === 'pet') ?? mine.find((m) => m.itemId != null && m.kind !== 'death');
    winner = {
      rsn: top.rsn,
      gain: gain(top.gained),
      highlight: best?.itemName
        ? `and got ${best.itemName}${best.kc ? ` on kill ${best.kc.toLocaleString('en-US')}` : ''}`
        : null,
      sprite: best?.itemId != null ? await remoteSprite(itemIconUrl(best.itemId), 72) : null,
    };
  }

  return weeklyCard({
    kind,
    eyebrow: `${hunt ? huntKindWord(hunt) : KIND_LABEL[kind]}, ${stage === 'completed' ? 'Finished' : name}`,
    stage,
    title,
    subtitle,
    line,
    art,
    top: board.slice(0, 3).map((e) => ({ rsn: e.rsn, gain: gain(e.gained) })),
    winner,
  });
}

export function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  // Keyed by path alone: the card never depends on who is asking.
  return cachedCard(new URL(request.url).pathname, () => load(request, ctx));
}

/** "Baron + Butcher + 2 more" → "Baron, Butcher and 2 more": the card's display font draws "+" broken. */
function asList(s: string): string {
  return s.replace(/ \+ (\d+ )?more$/, (_, n) => ` and ${n ?? ''}more`).replace(/ \+ /g, ', ');
}
