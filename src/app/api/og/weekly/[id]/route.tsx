import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { weeklyCompetitions } from '@/db/schema';
import { resolveClanById } from '@/lib/clanContext';
import { clanVisibilityOf } from '@/lib/clanVisibility';
import { weeklyMetricLabel } from '@/lib/constants';
import { momentsForCompetition } from '@/lib/momentsStore';
import { siteCard, weeklyCard } from '@/lib/ogCard';
import { cachedCard, remoteSprite } from '@/lib/ogKit';
import { WEEKLY_KIND_LABEL as KIND_LABEL, WEEKLY_VERB as VERB, timeLeft, weeklyGain, weeklyKind, weeklyTotal } from '@/lib/linkText';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { idOrNull } from '@/lib/routeIds';
import { competitionImageUrl, itemIconUrl } from '@/lib/tileIcons';
import { computeLeaderboard, getEffectiveParticipants } from '@/lib/weekly';

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

  const kind = weeklyKind(comp.type);
  const label = weeklyMetricLabel(kind, comp.metric) || comp.title;
  const stage = (['upcoming', 'active', 'completed'].includes(comp.status) ? comp.status : 'active') as
    | 'upcoming'
    | 'active'
    | 'completed';

  const [participants, clanName] = await Promise.all([getEffectiveParticipants(comp.id), getClanDisplayName(clan.id, clan.name)]);
  const board = computeLeaderboard(participants).filter((e) => e.gained > 0);
  const name = clanName || clan.name;

  const art = await remoteSprite(competitionImageUrl(kind, comp.metric), kind === 'boss' ? 560 : 300);

  // The clan's own title only when it says something the metric doesn't ("Double XP week").
  const subtitle = comp.title && !comp.title.toLowerCase().includes(label.toLowerCase()) ? comp.title : null;

  const count = participants.length;
  const left = timeLeft(comp.endDate);
  const line =
    stage === 'upcoming'
      ? [`${count} member${count === 1 ? '' : 's'} signed up`, timeLeft(comp.startDate) ? `starts in ${timeLeft(comp.startDate)}` : null]
          .filter(Boolean)
          .join(' · ')
      : stage === 'completed'
        ? board.length
          ? `${weeklyTotal(kind, board.reduce((s, e) => s + e.gained, 0))} across ${board.length} member${board.length === 1 ? '' : 's'}.`
          : 'Finished.'
        : [`${board.length || count} member${(board.length || count) === 1 ? '' : 's'} ${VERB[kind]}`, left ? `${left} left` : null]
            .filter(Boolean)
            .join(' · ');

  let winner = null;
  if (stage === 'completed' && board[0]) {
    const top = board[0];
    const moments = await momentsForCompetition(comp.id, 30).catch(() => []);
    const mine = moments.filter((m) => m.rsn.toLowerCase() === top.rsn.toLowerCase());
    const best = mine.find((m) => m.kind === 'pet') ?? mine.find((m) => m.itemId != null && m.kind !== 'death');
    winner = {
      rsn: top.rsn,
      gain: weeklyGain(kind, top.gained),
      highlight: best?.itemName
        ? `and got ${best.itemName}${best.kc ? ` on kill ${best.kc.toLocaleString('en-US')}` : ''}`
        : null,
      sprite: best?.itemId != null ? await remoteSprite(itemIconUrl(best.itemId), 72) : null,
    };
  }

  return weeklyCard({
    kind,
    eyebrow: `${KIND_LABEL[kind]} · ${stage === 'completed' ? 'Finished' : name}`,
    stage,
    title: label,
    subtitle,
    line,
    art,
    top: board.slice(0, 3).map((e) => ({ rsn: e.rsn, gain: weeklyGain(kind, e.gained) })),
    winner,
  });
}

export function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  // Keyed by path alone: the card never depends on who is asking.
  return cachedCard(new URL(request.url).pathname, () => load(request, ctx));
}
