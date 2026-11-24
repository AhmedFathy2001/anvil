import { getSetting } from '@/lib/settings';
import { checkCountsOn, cleanPingRole, HCW_COFFER_SETTING_KEY, prizeCurrencyFor } from '@/lib/competitionGame';
import { cleanEntryFee } from '@/lib/weeklySignups';
import { parseStamp } from '@/lib/dbTime';
import { NextResponse } from 'next/server';
import { verifyAdmin, verifyAdminOrModerator } from '@/lib/auth';
import { db } from '@/db';
import { requireClan } from '@/lib/clanContext';
import { weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { eq, count } from 'drizzle-orm';
import { enrollAllPlayers } from '@/lib/weekly';
import { inviteOnCreateRefused, parseCompetitionMode } from '@/lib/competitionTeams';
import { MAX_RACING_CLANS, MAX_TEAMS, autoBalanceTeams, createTeam, inviteClanToCompetition } from '@/lib/competitionTeamsDb';
import { announceCompetitionStart } from '@/lib/competitionTeamsPosts';
import { EFFICIENCY_METRICS } from '@/lib/constants';
import { verifyFeeCollector } from '@/lib/auth';
import { parseWeeklyPrizes, serializeWeeklyPrizes, totalPrizeGp } from '@/lib/weeklyPrizes';
import { setWeeklyPool } from '@/lib/coffer';
import { track } from '@/lib/analytics';
import { setWeeklyRepeat } from '@/lib/weeklyRepeat';
import { refuseForCreatorSpace } from '@/lib/creatorGuard';
import { huntBountyTotal, huntFromInput, huntTargetsLabel, killsOfForItems, serializeHunt } from '@/lib/itemHunt';
import { checkWeeklyMetric } from '@/lib/weeklyMetricInput';

export async function GET() {
  const user = await verifyAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // This clan's weeks. Unscoped, every clan's staff listed every other clan's competitions.
  const clan = await requireClan();
  const comps = await db
    .select()
    .from(weeklyCompetitions)
    .where(eq(weeklyCompetitions.clanId, clan.id))
    .orderBy(weeklyCompetitions.createdAt);

  // Get participant counts
  const participantCounts = await db
    .select({ competitionId: weeklyParticipants.competitionId, count: count() })
    .from(weeklyParticipants)
    .groupBy(weeklyParticipants.competitionId);

  const countMap = new Map(participantCounts.map((p) => [p.competitionId, p.count]));

  const result = comps.map((c) => ({
    ...c,
    participantCount: countMap.get(c.id) || 0,
  }));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  // In-game clans only: a creator space has no roster, weeklies or coffer (lib/creatorGuard).
  const notForCreators = await refuseForCreatorSpace();
  if (notForCreators) return notForCreators;
  const user = await verifyAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { type, title, startDate, endDate, includeGuests, prizes, prizeHold, repeat } = body;
  // An item hunt (lib/itemHunt) has rules instead of a hiscores metric: its targets, where each one
  // counts from, and the rule. They are checked here and stored whole; `metric` becomes the targets
  // in words, so everything that names a competition by type and metric names the hunt.
  let huntJson: string | null = null;
  let metric: string = body.metric;
  if (type === 'hunt') {
    const checked = huntFromInput(body.hunt);
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
    const config = checked.config;
    // A bounty spends the clan's money, so it asks what the prize ladder below asks.
    if (huntBountyTotal(config) > 0 && !(await verifyFeeCollector())) {
      return NextResponse.json({ error: 'Only a treasurer or admin can set a bounty. Create the hunt without one and ask one of them to add it.' }, { status: 403 });
    }
    // Kills at the source come from the chosen sources when every one is a hiscores boss. With
    // "any source" the organiser may have picked a boss to show instead. A pet hunt's come from the
    // pets' own bosses, worked out in huntFromInput. A v2 hunt's comes from its rows' own stats.
    if (config.v === 1 && config.target === 'items') config.killsOf = killsOfForItems(config.items) ?? config.killsOf;
    if (config.killsOf) config.xpSkill = null;
    huntJson = serializeHunt(config);
    metric = huntTargetsLabel(config);
  }
  // Team competitions (lib/competitionTeams): solo (default) | teams | clans.
  // An item hunt is always everyone for themselves: no teams, no clan vs clan.
  const mode = body.type === 'hunt' || body.mode === undefined ? 'solo' : parseCompetitionMode(body.mode);
  if (!mode) return NextResponse.json({ error: 'Mode must be solo, teams or clans' }, { status: 400 });
  const teamNames: { name: string; colour?: string }[] = Array.isArray(body.teams)
    ? body.teams
        .filter((t: unknown): t is { name: string; colour?: string } => !!t && typeof (t as { name?: unknown }).name === 'string')
        .slice(0, MAX_TEAMS)
    : [];
  const inviteSlugs: string[] = Array.isArray(body.inviteClans)
    ? body.inviteClans.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, MAX_RACING_CLANS - 1)
    : [];
  // Inviting other clans speaks for this one: owner/admin only, the same bar as the Clans page. A
  // moderator may still create a clan-vs-clan competition and leave the inviting to an admin.
  if (inviteOnCreateRefused(mode, inviteSlugs.length, await verifyAdmin())) {
    return NextResponse.json({ error: 'Only an owner or admin can invite other clans.' }, { status: 403 });
  }
  // Who from this clan races: everyone (default) or only the people an admin adds.
  // 'signup' is "selected people" who select themselves: members enter from the competition's page (lib/weeklySignups).
  const selfSignup = body.hostEntrants === 'signup';
  const hostEntrants = body.hostEntrants === 'selected' || selfSignup ? 'selected' : 'all';
  // The fee is the clan's money: the same bar as changing it later (PUT) and as setting prizes.
  const entryFee = selfSignup ? cleanEntryFee(body.entryFee) : null;
  if (entryFee && !(await verifyFeeCollector())) {
    return NextResponse.json({ error: 'Only a treasurer or admin can set an entry fee. Create it free, or ask one of them.' }, { status: 403 });
  }

  if (!type || !metric || !title || !startDate || !endDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const startMs = parseStamp(startDate);
  const endMs = parseStamp(endDate);
  if (startMs === null || endMs === null) {
    return NextResponse.json({ error: 'The start and end have to be real dates.' }, { status: 400 });
  }
  if (endMs <= startMs) {
    return NextResponse.json({ error: 'The end has to come after the start.' }, { status: 400 });
  }

  if (type !== 'skill' && type !== 'boss' && type !== 'efficiency' && type !== 'hunt') {
    return NextResponse.json({ error: 'Type must be skill, boss, efficiency or hunt' }, { status: 400 });
  }
  // Efficiency comps rank by a derived number, so the metric isn't a free-form hiscores key — only
  // the two our engine computes. A typo here would otherwise create a comp that never scores.
  if (type === 'efficiency' && !EFFICIENCY_METRICS.some((m) => m.key === metric)) {
    return NextResponse.json({ error: 'Efficiency metric must be ehp or ehb' }, { status: 400 });
  }

  // A skill or boss metric is one hiscores key or several added together. The form builds it, but it
  // arrives as text: every key has to be a real one, and the list has a cap (lib/weeklyMetricInput).
  if (type === 'skill' || type === 'boss') {
    const checked = checkWeeklyMetric(type, metric);
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
    metric = checked.metric;
  }
  // The same check for every step of a rotation, before anything is written: each step becomes a
  // later week's metric, and a bad one would surface as a dead competition weeks from now.
  let rotation: string[] | null = null;
  if (repeat && typeof repeat === 'object' && Array.isArray(repeat.rotation)) {
    rotation = [];
    for (const step of repeat.rotation.slice(0, 52)) {
      if (typeof step !== 'string' || step.length === 0) continue;
      const checked = checkWeeklyMetric(type, step);
      if (!checked.ok) return NextResponse.json({ error: `Rotation: ${checked.error}` }, { status: 400 });
      rotation.push(checked.metric);
    }
  }

  // A ladder may ride along with the competition, so a host sets the prizes in the same breath as
  // the dates rather than creating the week and then going to find where prizes live. It is the one
  // field here a moderator may not set: the rest of this form schedules a competition, and this
  // spends the clan's money — the same grant the dedicated prizes route asks for.
  let prizesJson: string | null = null;
  if (prizes) {
    if (!(await verifyFeeCollector())) {
      return NextResponse.json(
        { error: 'Only a treasurer or admin can set the prizes. Create the competition without them and ask one to add them.' },
        { status: 403 },
      );
    }
    prizesJson = serializeWeeklyPrizes(parseWeeklyPrizes(JSON.stringify(prizes)));
  }

  // Determine initial status based on dates
  const now = new Date().toISOString();
  let status = 'upcoming';
  if (startDate <= now && endDate > now) status = 'active';
  else if (endDate <= now) status = 'completed';

  const clan = await requireClan();
  // Which game counts (lib/competitionGame): the main game unless the form says otherwise. A skill or
  // boss competition needs a mode with hiscores to be scored from.
  const counts = checkCountsOn(body.countsOn, type);
  if (!counts.ok) return NextResponse.json({ error: counts.error }, { status: 400 });
  // HCW gp only from a clan that keeps a Hardcore Worlds coffer, on a competition that counts it.
  const prizeCurrency = prizeCurrencyFor(body.prizeCurrency, counts.value, (await getSetting(clan.id, HCW_COFFER_SETTING_KEY)) === '1');
  const result = await db.insert(weeklyCompetitions).values({
    clanId: clan.id,
    type,
    metric,
    title,
    startDate,
    endDate,
    createdById: user.userId > 0 ? user.userId : null,
    status,
    // Members only unless the admin ticked "Guests race too". Guests are visitors on an event-only
    // seat; a clan's weekly is its own members' race by default.
    includeGuests: includeGuests === true ? 1 : 0,
    prizes: prizesJson,
    mode,
    teamLateJoin: body.teamLateJoin !== false,
    hostEntrants,
    selfSignup,
    entryFee,
    // Only with a fee, and the fee was a treasurer's to set above.
    feesToPrizes: !!entryFee && body.feesToPrizes === true,
    // On unless it was switched off: a winner who still owes holds the prizes (lib/weeklyPrizeSettle).
    feeGatesPrize: body.feeGatesPrize !== false,
    hunt: huntJson,
    countsOn: counts.value,
    prizeCurrency,
    // A role to ping on the start and/or results post (lib/discord rolePing); off without a role.
    pingRoleId: cleanPingRole(body.pingRoleId),
    pingOnStart: !!cleanPingRole(body.pingRoleId) && body.pingOnStart === true,
    pingOnEnd: !!cleanPingRole(body.pingRoleId) && body.pingOnEnd === true,
  }).returning();

  const comp = result[0];

  // "Repeat every week": the cron starts the next one when this one ends (lib/weeklyRepeat).
  if (repeat && typeof repeat === 'object') {
    await setWeeklyRepeat(clan.id, comp.id, { rotation: rotation && rotation.length > 0 ? rotation : null });
  }

  // A ladder set at creation holds its gp the same as one added later — the promise costs the pot
  // when it is made, wherever it was typed. A coffer too short to cover it does NOT fail the
  // creation: the competition is real and already announced, so the ladder is recorded as a promise
  // (planned) instead, and the response says so rather than pretending the gp is set aside.
  let prizesHeld = false;
  if (prizesJson) {
    const total = totalPrizeGp(parseWeeklyPrizes(prizesJson));
    if (total > 0) {
      const pool = await setWeeklyPool({
        clanId: clan.id,
        competitionId: comp.id,
        amount: total,
        hold: prizeHold !== false,
        userId: user.userId > 0 ? user.userId : null,
        currency: prizeCurrency,
      });
      if (!pool.ok) {
        await setWeeklyPool({
          clanId: clan.id,
          competitionId: comp.id,
          amount: total,
          hold: false,
          userId: user.userId > 0 ? user.userId : null,
          currency: prizeCurrency,
        });
      } else {
        prizesHeld = pool.entry?.status === 'reserved';
      }
    }
  }

  // Teams mode: the teams typed on the form exist before enrolment, so everyone lands on one.
  if (mode === 'teams') {
    for (const t of teamNames) await createTeam(comp.id, t.name, t.colour);
  }

  // Enter the roster — or, for a competition created as "Selected people", nobody from this clan:
  // enrollAllPlayers reads the choice and leaves the host side to the Participants page.
  const enrolled = await enrollAllPlayers(comp.id);

  // ...and then split them evenly by current level/KC rather than by enrolment order.
  if (mode === 'teams' && teamNames.length >= 2) await autoBalanceTeams(comp);

  // Clan vs clan: invite each clan named on the form; an admin of each accepts from their side.
  const inviteErrors: string[] = [];
  if (mode === 'clans') {
    for (const slug of inviteSlugs) {
      const r = await inviteClanToCompetition(comp, clan.id, slug, user.userId > 0 ? user.userId : null);
      if (!r.ok) inviteErrors.push(`${slug}: ${r.error}`);
    }
  }

  // A comp created to start immediately is born 'active', so the weekly cron's upcoming→active
  // transition never fires for it — announce the start here instead. Future-dated ('upcoming')
  // comps are announced by the cron when it flips them. Fire-and-forget so a webhook hiccup
  // never fails creation.
  if (status === 'active') {
    // Team standings ride along for a teams competition (lib/competitionTeamsPosts).
    announceCompetitionStart(comp).catch(() => {});
  }

  track('weekly.created', { clanId: clan.id, userId: user.userId, props: { type: comp.type } });
  return NextResponse.json({ ...comp, enrolled, prizesHeld, inviteErrors });
}
