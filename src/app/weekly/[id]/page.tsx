import { accentStyle } from '@/lib/accentStyle';
import { sceneForMetric } from '@/lib/scenes';
import type { Metadata } from 'next';

import { weeklyStatus } from '@/lib/weeklyStage';
import { db } from '@/db';
import { weeklyCompetitions } from '@/db/schema';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { clanSectionMetadata } from '@/lib/seoPages';
import { and, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import LiveRefresher from '@/components/LiveRefresher';
import { requireClan } from '@/lib/clanContext';
import { creatorPublicAway } from '@/lib/creatorGuard';
import { verifyUser } from '@/lib/auth';
import { buildCompetitionView, viewerMemberIds } from '@/lib/competitionView';
import { competitionIconUrl } from '@/lib/tileIcons';
import CompetitionHero from '@/components/weekly/CompetitionHero';
import { DailyUnavailable, RaceChart, DayStrip, TrainingHeatmap } from '@/components/weekly/CompetitionWeek';
import { Board, Podium, SidePanels, YouStrip } from '@/components/weekly/CompetitionBoard';
import CompetitionAwards from '@/components/weekly/CompetitionAwards';
import ClanLink from '@/components/ClanLink';
import { idOrNull, idParam } from '@/lib/routeIds';
import { weeklyLinkDescription } from '@/lib/linkText';
import { clanVisibilityOf } from '@/lib/clanVisibility';
import { getEffectiveParticipants } from '@/lib/weekly';
import { competitionBoard, myHuntSeats, rushFeedFacts } from '@/lib/itemHuntDb';
import { competitionMode } from '@/lib/competitionTeams';
import { ANONYMOUS_VIEWER, buildGroupStandings, competitionForClan, competitionReadableBy, entryStatus, racingClans } from '@/lib/competitionTeamsDb';
import OptOutToggle from '@/components/weekly/OptOutToggle';
import GroupStandings from '@/components/weekly/GroupStandings';
import BestDrops from '@/components/weekly/BestDrops';
import CompetitionPrizes from '@/components/weekly/CompetitionPrizes';
import { MixedGameNote } from '@/components/weekly/GameTags';
import { MAIN_AND_HARDCORE, parseCountsOn } from '@/lib/competitionGame';
import SelfEntry from '@/components/weekly/SelfEntry';
import { myEntry, signupOpen, weeklyFeePotGp } from '@/lib/weeklySignups';
import { HuntClaim, HuntHero, HuntStandingsTable } from '@/components/weekly/HuntBoard';
import { loadHuntView } from '@/lib/itemHuntView';
import { huntScoresPoints } from '@/lib/itemHunt';
import { buildCompetitionFeed, buildHuntFeed, rushFeedExtra, watchedPlaces, type FeedFilter } from '@/lib/competitionFeed';
import CompetitionFeed, { CompetitionLatest, CompetitionTabs, WhatCounts } from '@/components/weekly/CompetitionFeed';
import { momentsForCompetition } from '@/lib/momentsStore';
import { parseWeeklyPrizes } from '@/lib/weeklyPrizes';
import { withUnit } from '@/components/weekly/format';
import { ordinal } from '@/lib/yourTeam';
import { buildCompetitionRecap, huntLuck } from '@/lib/competitionRecap';
import { LuckFacts, RecapDeaths, RecapLuck, RecapNumbers, RecapYourWeek } from '@/components/weekly/CompetitionRecap';

export const dynamic = 'force-dynamic';

/**
 * A competition week.
 *
 * This used to be a three-column table: rank, name, total. That's the one thing the Discord post
 * already tells everyone, so there was no reason to open the page twice. The week's shape — who
 * moved on which day, who is on a streak, whether the clan is beating its last run at this metric —
 * comes from `member_daily_stats`, which the sweep already writes, so all of it is a read.
 */
/**
 * A Skill or Boss of the Week, named for itself.
 *
 * These had no metadata at all, so every SotW a clan has ever run shared one title and one
 * description with the clan's home page — and a clan that runs one a week accumulates them faster
 * than anything else on the site. Scoped to the clan the same way the page is: a global id with no
 * clan check would title one clan's page with another clan's competition.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const compId = idOrNull((await params).id);
  if (compId == null) return {};
  const clan = await requireClan();
  const clanName = (await getClanDisplayName(clan.id, clan.name)) || clan.name;
  // A private clan's page shows strangers the "this clan is private" card, and its link preview
  // must say no more than that card does — not the competition's name, and not (by answering
  // differently for a real id than a made-up one) whether it exists. So this is decided before the
  // competition is even looked up.
  if (clanVisibilityOf(clan.visibility) !== 'public') {
    return clanSectionMetadata({ title: `Competition — ${clanName}`, description: `A competition in ${clanName}.` });
  }
  const [competition] = await db
    .select({
      id: weeklyCompetitions.id,
      clanId: weeklyCompetitions.clanId,
      mode: weeklyCompetitions.mode,
      title: weeklyCompetitions.title,
      type: weeklyCompetitions.type,
      status: weeklyCompetitions.status,
      startDate: weeklyCompetitions.startDate,
      endDate: weeklyCompetitions.endDate,
      metric: weeklyCompetitions.metric,
      hunt: weeklyCompetitions.hunt,
    })
    .from(weeklyCompetitions)
    .where(and(eq(weeklyCompetitions.clanId, clan.id), eq(weeklyCompetitions.id, compId)));
  if (!competition) return {};
  // A clan vs clan board lists every racing clan's players. A preview goes to whoever the link is
  // pasted to, so it names them only when a stranger could read every one of those clans.
  if (!(await competitionReadableBy(competition, ANONYMOUS_VIEWER))) {
    return clanSectionMetadata({ title: `${competition.title} — ${clanName}`, description: `A competition in ${clanName}.` });
  }

  const participants = await getEffectiveParticipants(compId);
  const board = (await competitionBoard(competition, participants)).filter((e) => e.gained > 0);
  return clanSectionMetadata({
    title: `${competition.title} — ${clanName}`,
    // Who's winning, said the way the card shows it, so the line and the picture agree.
    description: weeklyLinkDescription({ ...competition, status: weeklyStatus(competition), points: huntScoresPoints(competition.hunt) }, participants.length, board),
    image: `/api/og/weekly/${compId}`,
  });
}

export default async function WeeklyLeaderboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  // Two tabs on one address: Standings, and the competition's own feed (?view=feed).
  const viewParam = (await searchParams).view;
  const feedTab = viewParam === 'feed';
  // `/weekly/null` reached the query as NaN and took the render down with a 500 — a bad link is a
  // 404, not a server error. generateMetadata has always guarded this; the page never did.
  const compId = idParam(id);

  // Scoped to the clan whose host this is: ids are global, so without the clan check one clan's
  // page would happily render another clan's competition under its own banner.
  const clan = await requireClan();
  await creatorPublicAway('/weekly', clan);
  // Its own competition — or a clan-vs-clan one this clan accepted an invite into (read-only here).
  const scoped = await competitionForClan(clan.id, compId);
  if (!scoped) notFound();
  const competition = scoped.comp;

  const session = await verifyUser();
  const mode = competitionMode(competition.mode);
  // A clan-vs-clan board lists every racing clan's players, so it shows only when EVERY racing clan's
  // privacy lets this viewer in — the host's included when a partner's page is the one asking.
  if (!(await competitionReadableBy(competition, { playerId: session?.playerId ?? null, userId: session?.userId ?? null }))) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-card-border bg-card-bg p-6 text-center">
        <h1 className="mb-2 text-lg font-bold text-gold">{competition.title}</h1>
        <p className="text-sm text-text-muted">
          This is a clan vs clan competition, and at least one of the clans racing keeps its members private. Its
          standings show only to people who can see every clan racing.
        </p>
      </div>
    );
  }
  // Clan vs clan: the viewer may be seated in any racing clan, so "you" looks across all of them.
  const myMemberIds =
    mode === 'clans'
      ? (await Promise.all((await racingClans(competition)).map((c) => viewerMemberIds(c.id, session)))).flat()
      : await viewerMemberIds(clan.id, session);
  // Entry fees added to the prizes: what is in so far (lib/weeklySignups weeklyFeePotGp).
  const feePot = competition.feesToPrizes ? { gp: await weeklyFeePotGp(compId), each: competition.entryFee } : null;
  // A competition that takes sign-ups (lib/weeklySignups): the Enter card, on the host clan's own page.
  const takesSignups = signupOpen(competition) && competition.clanId === clan.id;
  const mine = takesSignups ? await myEntry(competition, session?.playerId ?? null) : null;
  const selfEntry = mine ? (
    <SelfEntry
      competitionId={compId}
      entryFee={competition.entryFee}
      started={weeklyStatus(competition) !== 'upcoming'}
      seats={mine.seats}
      entries={mine.entries}
      signedIn={!!session?.playerId}
    />
  ) : null;
  // An item hunt has its own page: a list of drops, not a week of gains (lib/itemHuntView).
  if (competition.type === 'hunt') {
    const hunt = await loadHuntView(competition, myMemberIds);
    if (!hunt) notFound();
    const running = hunt.status === 'active';
    const [huntEntry, seats] = await Promise.all([
      session?.playerId && hunt.status !== 'completed' ? entryStatus(compId, { playerId: session.playerId }) : null,
      session?.playerId && running ? myHuntSeats(compId, session.playerId) : [],
    ]);
    // A hunt's feed is its drops, day by day (lib/competitionFeed buildHuntFeed).
    // A rush also reads its deaths and the kills clanmates finished together.
    const rushExtra = hunt.rule === 'rush' ? rushFeedExtra(await rushFeedFacts(compId), new Set(hunt.rows.filter((r) => r.isMe).map((r) => r.rsn))) : [];
    const huntFeed = buildHuntFeed(hunt.rows, competition.startDate, rushExtra);
    if (feedTab) {
      return (
        <div>
          <LiveRefresher url={`/api/weekly/${compId}/pulse`} />
          <ClanLink href="/events" className="mb-3 inline-block text-sm text-text-muted transition-colors hover:text-gold max-sm:inline-flex max-sm:min-h-11 max-sm:items-center">
            ← All competitions
          </ClanLink>
          <div className="contents" style={accentStyle(clan.accentColor)}>
            <HuntHero title={competition.title} view={hunt} startDate={competition.startDate} endDate={competition.endDate} countsOn={competition.countsOn} />
          </div>
          <CompetitionTabs competitionId={compId} active="feed" />
          <CompetitionFeed
            days={huntFeed}
            title={hunt.rule === 'rush' ? 'Drops, deaths and kills together' : 'Drops in this hunt'}
            filters={[{ key: 'all', label: 'Everything' }]}
            canFilterMine={!!hunt.me}
            emptyNote="Nobody has a drop yet. Each one shows here as it lands."
          />
        </div>
      );
    }
    return (
      <div>
        <LiveRefresher url={`/api/weekly/${compId}/pulse`} />
        <ClanLink href="/events" className="mb-3 inline-block text-sm text-text-muted transition-colors hover:text-gold max-sm:inline-flex max-sm:min-h-11 max-sm:items-center">
          ← All competitions
        </ClanLink>
        <div className="contents" style={accentStyle(clan.accentColor)}>
          <HuntHero title={competition.title} view={hunt} startDate={competition.startDate} endDate={competition.endDate} countsOn={competition.countsOn} />
        </div>
        <CompetitionTabs competitionId={compId} active="standings" />
        <CompetitionPrizes prizes={competition.prizes} currency={competition.prizeCurrency} hunt feePot={feePot} />
        {selfEntry}
        {huntEntry?.entered && <OptOutToggle competitionId={compId} initialOptedOut={huntEntry.optedOut} seats={huntEntry.seats} />}
        {seats.length > 0 && <HuntClaim competitionId={compId} proof={hunt.proof} characters={seats} />}
        {hunt.status === 'completed' && hunt.statUnit === 'kills' && (
          <div className="mb-5">
            <LuckFacts {...huntLuck(hunt.rows)} />
          </div>
        )}
        <HuntStandingsTable view={hunt} />
        <CompetitionLatest days={huntFeed} href={`/weekly/${compId}?view=feed`} />
      </div>
    );
  }

  const view = await buildCompetitionView(competition, myMemberIds);
  const groups = mode === 'solo' ? null : await buildGroupStandings(competition, { memberIds: myMemberIds });
  const myRsns = new Set(view.entries.filter((e) => e.isMe).map((e) => e.rsn.toLowerCase()));
  // The team lists tag HCW and fallen characters off the individual board, so the two never disagree.
  const tagsOf = new Map(view.entries.map((e) => [e.rsn.toLowerCase(), { hcw: e.hcw, stopped: e.stopped }]));
  // Main game + Hardcore Worlds is the one setting where two kinds of character share a board.
  const mixedGame = parseCountsOn(competition.countsOn) === MAIN_AND_HARDCORE;
  // "You're in · Opt out" — every competition, any clan's side. Opted-out players are off the board.
  const entry = session?.playerId && weeklyStatus(competition) !== 'completed' ? await entryStatus(compId, { playerId: session.playerId }) : null;

  const leader = view.entries[0]?.gained > 0
    ? {
        rsn: view.entries[0].rsn,
        gained: view.entries[0].gained,
        margin: view.entries[0].gained - (view.entries[1]?.gained ?? 0),
      }
    : null;
  // Everything day-shaped hangs off history the sweep writes. A competition from before that (or a
  // guest-only board) still ranks fine — it just shows the board without the week around it. So does
  // one whose history is too thin to be honest about: a partial account isn't a rough version of the
  // week, it's a biased one, and drawing it puts the leader underneath people he's beating. One
  // judgement gates every daily surface on the page, so they can't disagree about what's drawable.
  const showDaily = view.trust === 'ok';
  // An upcoming competition has standings-shaped rows full of zeroes. Narrating them as a race ("day
  // 1 of 7", "you are winning this one", medals on 0 KC) reads as a broken page rather than a lobby.
  const started = Date.parse(competition.startDate) <= Date.now();

  // The competition's own feed (lib/competitionFeed). Its moments were kept to this metric's bosses
  // or skill when they were stored; an efficiency contest counts everything, so it reads none. The
  // standings lines need the day-by-day, so a week whose history can't be trusted has moments only.
  const status = weeklyStatus(competition);
  const payingPlaces = parseWeeklyPrizes(competition.prizes).places.length;
  // A finished week's recap counts every death, so it reads further back than the feed needs to.
  const ended = status === 'completed';
  const compMoments = view.type === 'efficiency' ? [] : await momentsForCompetition(compId, ended ? 3000 : 400);
  const feedDays = buildCompetitionFeed({
    type: view.type,
    days: view.days,
    elapsed: started ? view.elapsed : 0,
    ended,
    entries: showDaily ? view.entries : view.entries.map((e) => ({ rsn: e.rsn, isMe: e.isMe, days: [] })),
    payingPlaces,
    moments: compMoments,
    gainWords: (v) => withUnit(v, view.type, view.unit),
  });
  const feedHref = `/weekly/${compId}?view=feed`;
  const scopeWords =
    view.type === 'boss'
      ? [`Kills at ${view.metricLabel}, from the start of the competition to its end.`, `The feed is kept to ${view.metricLabel}: drops, combat tasks and deaths there, by the players in this competition.`]
      : view.type === 'skill'
        ? [`XP gained in ${view.metricLabel}, from the start of the competition to its end.`, `The feed is kept to ${view.metricLabel}: its level milestones and its pets, by the players in this competition.`]
        : [`Efficient hours gained (${view.metricLabel}), from the start of the competition to its end.`, 'The feed shows the standings only. Efficiency counts everything you do, so drops and deaths are left out.'];
  const whatCounts = [
    ...scopeWords,
    `A place changing hands is news down to ${ordinal(watchedPlaces(payingPlaces))}. Every other move is in the standings and the daily update.`,
    'Players who opt out are off the board and the feed.',
  ];
  const feedFilters: { key: FeedFilter; label: string }[] =
    view.type === 'efficiency'
      ? [{ key: 'all', label: 'Everything' }]
      : [
          { key: 'all', label: 'Everything' },
          { key: 'standings', label: 'Standings' },
          { key: 'drops', label: view.type === 'skill' ? 'Pets' : 'Drops' },
          { key: 'milestones', label: 'Milestones' },
          ...(view.type === 'boss' ? [{ key: 'deaths' as const, label: 'Deaths' }] : []),
        ];

  // The header's art takes the clan's own colour (lib/accentStyle). The same header on both tabs.
  const hero = (
      <div className="contents" style={accentStyle(clan.accentColor)}>
      <CompetitionHero
        title={competition.title}
        type={view.type}
        metricLabel={view.metricLabel}
        unit={view.unit}
        status={status}
        startDate={competition.startDate}
        endDate={competition.endDate}
        iconUrl={competitionIconUrl(competition.type, competition.metric)}
        scene={sceneForMetric(competition.type, competition.metric)}
        clanTotal={view.clanTotal}
        todayTotal={showDaily ? view.todayTotal : null}
        scoring={view.scoring}
        entered={view.entries.length}
        leader={leader}
        projected={view.projected}
        previous={view.previous}
        elapsed={view.elapsed}
        totalDays={view.days.length}
        countsOn={competition.countsOn}
      />
      </div>
  );

  if (feedTab) {
    return (
      <div>
        <LiveRefresher url={`/api/weekly/${compId}/pulse`} />
        <ClanLink href="/events" className="mb-3 inline-block text-sm text-text-muted transition-colors hover:text-gold max-sm:inline-flex max-sm:min-h-11 max-sm:items-center">
          ← All competitions
        </ClanLink>
        {hero}
        <CompetitionTabs competitionId={compId} active="feed" recap={ended} />
        {view.mine.map((m) => (
          <YouStrip key={m.entry.rsn} me={m} type={view.type} unit={view.unit} elapsed={view.elapsed} showDaily={showDaily} started={started} />
        ))}
        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <CompetitionFeed
              days={feedDays}
              title={view.type === 'boss' ? `At ${view.metricLabel}` : view.type === 'skill' ? `In ${view.metricLabel}` : 'The standings, day by day'}
              filters={feedFilters}
              canFilterMine={!!view.me}
              emptyNote={started ? 'Nothing yet. Place changes, the daily update and what happens there show here.' : 'This fills in once the competition starts.'}
            />
          </div>
          <div className="min-w-0 [&>div]:mt-0">
            <WhatCounts lines={whatCounts} />
          </div>
        </div>
      </div>
    );
  }

  // Once it has ended the page opens on the recap; the standings as they were are one tab over.
  if (ended && viewParam !== 'standings') {
    const recap = buildCompetitionRecap({ type: view.type, days: view.days, daily: showDaily, entries: view.entries, moments: compMoments });
    return (
      <div>
        <ClanLink href="/events" className="mb-3 inline-block text-sm text-text-muted transition-colors hover:text-gold max-sm:inline-flex max-sm:min-h-11 max-sm:items-center">
          ← All competitions
        </ClanLink>
        {hero}
        <CompetitionTabs competitionId={compId} active="recap" recap />
        <CompetitionPrizes prizes={competition.prizes} currency={competition.prizeCurrency} feePot={feePot} />
        {view.me && recap.mine && (
          <RecapYourWeek
            rsn={view.me.entry.rsn}
            rank={view.me.rank}
            of={view.entries.length}
            gained={view.me.entry.gained}
            mine={recap.mine}
            days={view.days}
            type={view.type}
            unit={view.unit}
          />
        )}
        <Podium entries={view.entries} days={view.days} elapsed={view.elapsed} type={view.type} unit={view.unit} showShape={showDaily} />
        <RecapNumbers recap={recap} clanTotal={view.clanTotal} days={view.days} type={view.type} unit={view.unit} />
        <div className="grid items-start gap-7 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="min-w-0">
            {recap.deathBoard && <RecapDeaths board={recap.deathBoard} metricLabel={view.metricLabel} />}
            {recap.luck && (
              <RecapLuck
                luck={recap.luck}
                total={recap.drops}
                pets={view.type === 'skill'}
                feedHref={
                  <ClanLink href={feedHref} className="text-gold hover:text-gold-light">
                    All {recap.drops} in the feed
                  </ClanLink>
                }
              />
            )}
            <CompetitionAwards awards={view.awards} />
          </div>
          <div className="min-w-0">
            <Board entries={view.entries} elapsed={view.elapsed} type={view.type} unit={view.unit} showDaily={showDaily} />
            <SidePanels milestones={view.milestones} highlights={[]} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <LiveRefresher url={`/api/weekly/${compId}/pulse`} />

      <ClanLink href="/events" className="mb-3 inline-block text-sm text-text-muted transition-colors hover:text-gold max-sm:inline-flex max-sm:min-h-11 max-sm:items-center">
        ← All competitions
      </ClanLink>

      {hero}
      <CompetitionTabs competitionId={compId} active="standings" recap={ended} />
      <CompetitionPrizes prizes={competition.prizes} currency={competition.prizeCurrency} feePot={feePot} />
      {selfEntry}

      {/* One strip per character of yours on the board: an alt racing too is yours to see. */}
      {view.mine.map((m) => (
        <YouStrip key={m.entry.rsn} me={m} type={view.type} unit={view.unit} elapsed={view.elapsed} showDaily={showDaily} started={started} />
      ))}

      {entry?.entered && <OptOutToggle competitionId={compId} initialOptedOut={entry.optedOut} seats={entry.seats} />}

      {groups && <GroupStandings view={groups} type={view.type} unit={view.unit} myRsns={myRsns} tagsOf={tagsOf} />}

      <Podium
        entries={view.entries}
        days={view.days}
        elapsed={view.elapsed}
        type={view.type}
        unit={view.unit}
        showShape={showDaily}
      />

      <CompetitionAwards awards={view.awards} />

      <div className="grid items-start gap-7 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="min-w-0">
          {showDaily ? (
            <>
              <RaceChart
                entries={view.entries}
                days={view.days}
                elapsed={view.elapsed}
                type={view.type}
                unit={view.unit}
                trackableTotal={view.trackableTotal}
                trackedTotal={view.trackedTotal}
                guestGain={view.guestGain}
                pendingTotal={view.pendingTotal}
              />
              <DayStrip
                days={view.days}
                elapsed={view.elapsed}
                totals={view.dailyTotals}
                leaders={view.dailyLeaders}
                entries={view.entries}
                type={view.type}
                unit={view.unit}
              />
              <TrainingHeatmap
                entries={view.entries}
                days={view.days}
                elapsed={view.elapsed}
                verb={view.verb}
                type={view.type}
              />
            </>
          ) : (
            <DailyUnavailable trust={view.trust} coverage={view.coverage} started={started} />
          )}
        </div>

        <div className="min-w-0">
          <Board
            entries={view.entries}
            elapsed={view.elapsed}
            type={view.type}
            unit={view.unit}
            showDaily={showDaily}
          />
          {mixedGame && <MixedGameNote />}
          <BestDrops drops={view.bestDrops} />
          {/* The feed's newest lines stand where the old "Latest" list of moments was. */}
          <CompetitionLatest days={feedDays} href={feedHref} />
          <SidePanels milestones={view.milestones} highlights={[]} />
          <WhatCounts lines={whatCounts} />
        </div>
      </div>
    </div>
  );
}
