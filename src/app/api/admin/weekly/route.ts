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
  const { type, metric, title, startDate, endDate, includeGuests, prizes, prizeHold, repeat } = body;
  // Team competitions (lib/competitionTeams): solo (default) | teams | clans.
  const mode = body.mode === undefined ? 'solo' : parseCompetitionMode(body.mode);
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
  const hostEntrants = body.hostEntrants === 'selected' ? 'selected' : 'all';

  if (!type || !metric || !title || !startDate || !endDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (type !== 'skill' && type !== 'boss' && type !== 'efficiency') {
    return NextResponse.json({ error: 'Type must be skill, boss or efficiency' }, { status: 400 });
  }
  // Efficiency comps rank by a derived number, so the metric isn't a free-form hiscores key — only
  // the two our engine computes. A typo here would otherwise create a comp that never scores.
  if (type === 'efficiency' && !EFFICIENCY_METRICS.some((m) => m.key === metric)) {
    return NextResponse.json({ error: 'Efficiency metric must be ehp or ehb' }, { status: 400 });
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
  }).returning();

  const comp = result[0];

  // "Repeat every week": the cron starts the next one when this one ends (lib/weeklyRepeat).
  if (repeat && typeof repeat === 'object') {
    const rotation = Array.isArray(repeat.rotation)
      ? repeat.rotation.filter((m: unknown): m is string => typeof m === 'string' && m.length > 0).slice(0, 52)
      : null;
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
      });
      if (!pool.ok) {
        await setWeeklyPool({
          clanId: clan.id,
          competitionId: comp.id,
          amount: total,
          hold: false,
          userId: user.userId > 0 ? user.userId : null,
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

  // Auto-enroll all registered players
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
