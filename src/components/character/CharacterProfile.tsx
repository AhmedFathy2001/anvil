import { formatJoinDate } from '@/lib/clanJoinDate';
import RecordsCard from '@/components/records/RecordsCard';
import { getAccountRecords, type AccountRecord } from '@/lib/records';
import Persona from '@/app/members/[rsn]/Persona';
import ProfileTabs from '@/app/members/[rsn]/ProfileTabs';
import ProfileShare from '@/app/p/[rsn]/ProfileShare';
import GameClanToggle from '@/app/p/[rsn]/GameClanToggle';
import { accountTypeLabel } from '@/lib/accountType';
import {
  getActivityStandings,
  getCompetitionHistory,
  getPersona,
  ingameJoinDates,
  getUpcomingMilestones,
  getDailySeries,
  listMembers,
  getMilestones,
  getTrackingSince,
  getStandings,
  type AccountProfile,
  type ActivityStanding,
  type CompetitionHistory,
  type MemberProfile,
  type Standing,
} from '@/lib/memberProfile';
import type { ApexCharacter } from '@/lib/apexProfiles';
import { characterList } from '@/lib/apexHome';
import { gameClanForAccount, type CharacterGameClan } from '@/lib/gameClans';
import { buildPlayerShape } from '@/lib/playerShape';
import PlayerShapeRadar from '@/components/PlayerShapeRadar';
import type { ProfileLinkState } from '@/lib/profileLink';
import { bossPagesFor } from '@/lib/clogKillcounts';
import { momentsForMembers, type MomentRow } from '@/lib/momentsStore';
import { collapseMomentRuns } from '@/lib/feedRuns';
import { siteReactions } from '@/lib/siteReactions';
import { getCollectionLog } from '@/lib/clogRead';
import { getMemberItems, getMemberProgress } from '@/lib/memberProgressRead';
import AccountProgressCard from '@/components/AccountProgressCard';
import GoalsCard from '@/components/GoalsCard';
import H2hCard from '@/components/H2hCard';
import DisplayCase from '@/components/DisplayCase';
import ConnectedAccounts from '@/components/ConnectedAccounts';
import ClanCrest from '@/components/ClanCrest';
import { ProfileAvatar, ProfileBanner } from '@/components/ProfileMedia';
import { goalsForProfile } from '@/lib/goals';
import { goalRatesFrom } from '@/lib/statTrends';
import { db } from '@/db';
import { accounts, players } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { SKILLS } from '@/lib/constants';
import type { verifyUser } from '@/lib/auth';
import ClanLink from '@/components/ClanLink';
import SupporterName from '@/components/SupporterName';
import { supporterLooksByName } from '@/lib/supporter';
import { mediaForCharacter } from '@/lib/profileMedia';
import { displayCaseForPlayer } from '@/lib/displayCase';
import { profileConnectedAccounts } from '@/lib/connectedAccounts';
import { profileSections } from '@/lib/characterProfileRules';
import { streakForAccount } from '@/lib/activityStreaks';
import { STREAK_MILESTONES, type Streak } from '@/lib/activityStreak';

/** Max total level, derived from the skill list — 24 skills today, whatever Jagex adds tomorrow. */
const MAX_TOTAL_LEVEL = (SKILLS.length - 1) * 99;

/** Nothing to say without a clan, but the tabs still want the shape. */
const NO_COMPETITIONS: CompetitionHistory = {
  events: [],
  weeklies: [],
  eventWins: 0,
  eventPodiums: 0,
  weeklyWins: 0,
  weeklyPodiums: 0,
  totalPoints: 0,
};
const NO_STANDINGS: { ehp?: Standing | null; ehb?: Standing | null; xp?: Standing | null } = {};

function fmtXp(xp: number): string {
  if (xp >= 1_000_000_000) return `${(xp / 1_000_000_000).toFixed(2)}B`;
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}M`;
  if (xp >= 1_000) return `${(xp / 1_000).toFixed(0)}K`;
  return Math.round(xp).toLocaleString();
}

/**
 * One number and its clan placing, as a single chip.
 *
 * The placing used to be grey small-print under a card; here it rides with the number, because
 * "277 EHP" means nothing on its own and "#1 of 41" is the whole point of tracking a clan. With no
 * clan behind the page (/p/) the chip is the number alone.
 */
function Placing({ label, value, standing }: { label: string; value: string; standing?: Standing | null }) {
  return (
    <span className="text-xs border border-card-border rounded-full px-3 py-1 bg-brown-dark text-text-muted">
      {label} <span className="text-foreground font-semibold tabular-nums">{value}</span>
      {standing && standing.outOf > 1 && (
        <>
          {' · '}
          <span className="text-gold tabular-nums">#{standing.rank}</span> of {standing.outOf}
        </>
      )}
    </span>
  );
}

/** Total level as the progress it is: a ring against the 2,376 cap, with the levels still to go. */
function TotalLevelDial({ level }: { level: number }) {
  const pct = Math.max(0, Math.min(1, level / MAX_TOTAL_LEVEL));
  const r = 47;
  const circumference = 2 * Math.PI * r;
  const remaining = Math.max(0, MAX_TOTAL_LEVEL - level);

  return (
    <div className="text-center sm:ml-auto">
      <svg
        width="112"
        height="112"
        viewBox="0 0 112 112"
        role="img"
        aria-label={`Total level ${level.toLocaleString()} of ${MAX_TOTAL_LEVEL.toLocaleString()}`}
      >
        <circle cx="56" cy="56" r={r} fill="none" stroke="var(--tile-bg)" strokeWidth="9" />
        <circle
          cx="56"
          cy="56"
          r={r}
          fill="none"
          stroke="var(--gold)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(circumference * pct).toFixed(1)} ${circumference.toFixed(1)}`}
          transform="rotate(-90 56 56)"
        />
        <text x="56" y="53" textAnchor="middle" fill="var(--foreground)" fontSize="23" fontWeight="700">
          {level.toLocaleString()}
        </text>
        <text x="56" y="70" textAnchor="middle" fill="var(--text-muted)" fontSize="10" letterSpacing="1.4">
          OF {MAX_TOTAL_LEVEL.toLocaleString()}
        </text>
      </svg>
      <div className="text-xs text-text-muted mt-1">
        {remaining > 0 ? `${remaining.toLocaleString()} levels to max` : 'every skill at 99'}
      </div>
    </div>
  );
}

/**
 * Where the profile is being shown.
 *
 *   public — /p/<rsn>: the caller has already applied apexCharacter's rule (shared, or the owner).
 *   clan   — a clan's view of its seat: /c/<clan>/members/<rsn>, and the owner's locker /profile.
 */
export type CharacterProfileContext =
  | { kind: 'public'; character: ApexCharacter; profile: AccountProfile }
  | { kind: 'clan'; clanId: number; seat: MemberProfile };

export interface CharacterProfileProps {
  context: CharacterProfileContext;
  viewer: Awaited<ReturnType<typeof verifyUser>>;
  /** Deep links: ?tab=, ?stat=, ?page=. */
  link: ProfileLinkState;
  /** ?progress= (quests / diaries / combat). */
  progressTab?: string;
  /** The character's name is the page heading, except on /profile, which has its own. */
  nameAs?: 'h1' | 'h2';
  /**
   * 'embedded' — inside the owner's /profile, under their own person card. No banner and no hero
   * band (the card above already is one): a compact character line with the placings and best
   * days, then the rest of the profile. The page's own chips switch characters, so no switcher.
   */
  variant?: 'full' | 'embedded';
}

/**
 * THE character profile — one component for /p/<rsn>, a clan's member page and the owner's locker.
 *
 * Three pages used to render three different subsets of the same character: the clan page had the
 * placings, persona and radar; /p/ had the display case, head-to-head and the owner's pictures; the
 * locker had neither and a member had to find themselves on the roster. Every section is now here,
 * each gated by `profileSections` (lib/characterProfileRules) on where it is shown and who is
 * looking — never wider than the stricter of the old pages showed it.
 *
 * Every query is for ONE character; callers render this for the selected character only.
 */
export default async function CharacterProfile({
  context,
  viewer,
  link,
  progressTab,
  nameAs = 'h1',
  variant = 'full',
}: CharacterProfileProps) {
  const Name = nameAs;
  const embedded = variant === 'embedded';
  const clanCtx = context.kind === 'clan' ? context : null;
  const pubCtx = context.kind === 'public' ? context : null;
  const profile: AccountProfile = clanCtx ? clanCtx.seat : pubCtx!.profile;
  const accountId = profile.accountId;
  // Started now, read after the big batch below: decoration, so a failed read is no chip.
  const streakP = streakForAccount(accountId).catch(() => null);
  const rsn = profile.rsn;
  const viewerPlayerId = viewer?.playerId ?? null;

  // The character behind the page: who owns it (goals are theirs to edit), whether it is published
  // (the platform links and head-to-head only make sense if it is) and whether it is verified; and
  // that person's "show my characters as one person" switch.
  // clan-scope: global -- an OSRS account is one account however many clans roster it.
  const acct = await db.query.accounts.findFirst({
    where: eq(accounts.id, accountId),
    columns: { playerId: true, shared: true, verifiedAt: true },
  });
  const personId = acct?.playerId ?? null;
  // clan-scope: global -- the person's own switches, not a clan's.
  const owner = personId != null
    ? await db.query.players.findFirst({ where: eq(players.id, personId), columns: { banned: true, linkAccountsPublicly: true } })
    : null;
  const viewerOwns = viewerPlayerId != null && personId === viewerPlayerId;
  const show = profileSections({
    context: context.kind,
    viewerOwns,
    signedIn: !!viewer,
    shared: !!acct?.shared,
    personId,
    owner,
  });

  // Every tab's data in one round trip — every query is small and the tabs then switch instantly.
  //
  // TWO IDS, AND WHICH ONE EACH CALL WANTS IS THE WHOLE POINT. `accountId` is the OSRS character,
  // which is what every stats table is keyed by; `seat.id` is the seat, which is what "their place
  // in THIS clan" is keyed by. Passing the seat to the account-keyed ones drew another member's
  // history on every profile in the app, silently, because both are small integers and the wrong
  // row is always a plausible one.
  //
  // The persona ties an RSN to a Discord identity and names that person's other accounts — in OSRS
  // exactly what people keep private (ironman and PK alts especially) — so it resolves only for a
  // signed-in clan viewer: the clan can see who owns an alt; the open internet can't.
  const [
    milestones, records, series, collection, progress, questItems, caItems, trackingSince, supporterLooks,
    media, showcase, connected,
    joinedOn, standings, history, persona, activityStandings, moments, roster,
    gameClanRow, myCharacters,
  ] = await Promise.all([
    getMilestones(accountId, 50),
    getAccountRecords(accountId),
    getDailySeries(accountId, 365),
    getCollectionLog(accountId, rsn, clanCtx?.clanId ?? null),
    getMemberProgress(accountId),
    getMemberItems(accountId, 'quest'),
    getMemberItems(accountId, 'ca'),
    getTrackingSince(accountId),
    // Supporter flair on this character's name only — the person behind it stays out of it.
    supporterLooksByName([rsn]),

    // This character's own banner/avatar where it has one, else the person's (lib/profileMedia).
    show.personMedia ? mediaForCharacter(accountId, personId) : Promise.resolve({ avatar: null, banner: null }),
    // This character's own pins only; a pin from a non-shared character reaches only its owner.
    show.displayCase
      ? displayCaseForPlayer(personId!, { accountId, publicView: show.displayCasePublicView })
      : Promise.resolve([]),
    show.personStreams ? profileConnectedAccounts(personId!, viewerOwns) : Promise.resolve([]),

    // ── What only a clan knows ──
    clanCtx ? ingameJoinDates([clanCtx.seat.id]).then((m) => m.get(clanCtx.seat.id) ?? null) : Promise.resolve(null),
    clanCtx ? getStandings(clanCtx.seat.id) : Promise.resolve(NO_STANDINGS),
    clanCtx ? getCompetitionHistory(clanCtx.seat.id, rsn) : Promise.resolve(NO_COMPETITIONS),
    clanCtx && show.persona ? getPersona(clanCtx.seat.id) : Promise.resolve(null),
    // Standings are a clan's answer — "#3 of 47" says nothing on a page with no clan behind it.
    clanCtx ? getActivityStandings(clanCtx.clanId, rsn) : Promise.resolve({} as Record<string, ActivityStanding>),
    // The drops, pets and combat tasks we watched happen. Keyed by the SEAT: a moment belongs to
    // the clan it happened in, so the platform profile never carries one clan's social content.
    // Back-to-back repeats (a run of deaths) are one line with a count (lib/feedRuns), cut to 20 after.
    clanCtx ? momentsForMembers([clanCtx.seat.id], 60).then((rows) => collapseMomentRuns(rows).slice(0, 20)) : Promise.resolve([] as MomentRow[]),
    // Everyone's totals, for the shape's percentiles — one query for the whole roster.
    clanCtx ? listMembers(clanCtx.clanId) : Promise.resolve([]),

    // ── What only the apex says ──
    pubCtx ? gameClanForAccount(accountId) : Promise.resolve(null),
    // The owner's other characters, so a person with three accounts can move between them. Only
    // ever the viewer's OWN list — it says these accounts are one person.
    show.publicSwitcher && !embedded ? characterList(viewerPlayerId) : Promise.resolve([]),
  ]);
  const streak = await streakP;

  // In a clan, its drops / pets / deaths in "Lately" take the clan feed's reactions (lib/siteReactions).
  const reactions = clanCtx ? await siteReactions(moments, { clanId: clanCtx.clanId }, viewer?.userId ?? null).catch(() => undefined) : undefined;
  const goals = await goalsForProfile(accountId, profile, collection.synced ? collection.pages : null, goalRatesFrom(series));
  const upcoming = getUpcomingMilestones(profile);
  const shape = clanCtx
    ? buildPlayerShape({
        members: roster.map((m) => ({
          id: m.id,
          // The directory hands these back already divided out of milli — the shape only cares
          // about the ordering, so whichever unit they arrive in is the unit the percentile is taken in.
          ehpMilli: m.ehp ?? 0,
          ehbMilli: m.ehb ?? 0,
          overallXp: m.overallXp ?? 0,
        })),
        standings: activityStandings,
        memberId: clanCtx.seat.id,
      })
    : null;

  // The in-game clan their plugin reported (lib/gameClans). A hidden one is the owner's to see.
  const gameClan = gameClanRow && (!gameClanRow.hidden || viewerOwns) ? gameClanRow : null;
  const character = pubCtx?.character ?? null;
  // The same clan as their Anvil seat: the rank title joins that chip instead of a second one.
  const seatIsGameClan = !!gameClan && !!character?.clan && gameClan.anvilClan?.slug === character.clan.slug;
  const clanJoinedOn = character?.clan?.joinedOn ?? (seatIsGameClan ? gameClan?.joinedOn ?? null : null);

  const eff = profile.efficiency;
  // Summed from the skill rows: `skills` carries the real skills only, so looking for an 'overall'
  // row found nothing and the chip read 0 XP.
  const skillXp = profile.skills.reduce((sum, s) => sum + (s.key === 'overall' ? 0 : s.xp), 0);
  const totalXp = skillXp > 0 ? skillXp : character?.overallXp ?? 0;
  const seat = clanCtx?.seat ?? null;

  // The character's identity, shared by the full hero band and the embedded line.
  const identity = (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {!embedded && <ProfileAvatar avatar={media.avatar} size={44} eager className="border-2 border-gold/45" />}
        <Name className={`${embedded ? 'text-2xl' : 'text-3xl'} font-bold text-gold break-words`}>
          <SupporterName name={rsn} tier={supporterLooks[rsn]?.tier} style={supporterLooks[rsn]?.style} tenure={supporterLooks[rsn]?.tenure} />
        </Name>
        {acct?.verifiedAt && (
          <span className="rounded-md border border-accent-green/35 bg-accent-green/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-accent-green-light">
            Verified
          </span>
        )}
        {show.clanSections && accountTypeLabel(profile.accountType) && profile.accountType !== 'normal' && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-brown-light text-foreground/80">
            {accountTypeLabel(profile.accountType)}
          </span>
        )}
        {seat?.isGuest && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-text-muted/15 text-text-muted">guest</span>
        )}
        {seat?.rank && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-gold/15 text-gold capitalize">{seat.rank}</span>
        )}
        {seat?.leftAt && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300">left the clan</span>
        )}
        {joinedOn && (
          <span
            className="text-[11px] px-2 py-0.5 rounded-full bg-brown-light text-foreground/80"
            title="When this character joined the clan in game"
          >
            In the clan since {formatJoinDate(joinedOn, true)}
          </span>
        )}
      </div>

      {/* The apex's answer to "which clan?" — the listed clan they are a member of, the
          in-game clan the plugin reported, and the person, when they chose to be shown as one. */}
      {show.platformHeader && character && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-text-muted">
          {character.clan && (
            <ClanLink href={`/c/${character.clan.slug}`} className="flex items-center gap-2 transition-colors hover:text-gold">
              <ClanCrest name={character.clan.name} logoUrl={character.clan.logoUrl} size={18} />
              {character.clan.name}
              {seatIsGameClan && gameClan?.title && <span className="text-text-dim">· {gameClan.title}</span>}
              {/* The roster sync's date, else the one the player's own plugin reported. */}
              {clanJoinedOn && <span className="text-text-dim">· since {formatJoinDate(clanJoinedOn)}</span>}
            </ClanLink>
          )}
          {gameClan && !seatIsGameClan && <GameClanChip clan={gameClan} />}
          {gameClan && show.ownerControls && <GameClanToggle accountId={accountId} hidden={gameClan.hidden} />}
          {character.clan ? (
            // The same character, seen by its clan: standings, competition history, moments.
            <ClanLink
              href={`/c/${character.clan.slug}/members/${encodeURIComponent(rsn)}`}
              className="text-gold hover:underline"
            >
              Clan profile →
            </ClanLink>
          ) : gameClan ? null : (
            <span className="text-text-dim">No clan</span>
          )}
          {/* Only present when its owner turned linking on, and named by another RSN they
              shared — never by anything from Discord (apexCharacter). */}
          {character.owner && (
            <span>
              also plays{' '}
              <ClanLink href={`/u/${character.owner.playerId}`} className="text-gold hover:underline">
                {character.owner.label}
              </ClanLink>
            </span>
          )}
        </div>
      )}

      <p className="text-xs text-text-muted mt-1">
        {profile.statsAt
          ? `Stats as at ${new Date(profile.statsAt).toLocaleString()}`
          : 'Stats from the last hiscores sweep'}
        {trackingSince && (
          <>
            {' · '}
            <span title="History before this day was never recorded">
              Tracked since {new Date(`${trackingSince}T12:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </>
        )}
        {show.platformLinks && (
          <>
            {show.clanSections && (
              <>
                {' · '}
                {/* The same character on the platform — the two pages used to have no way between them. */}
                <ClanLink href={`/p/${encodeURIComponent(rsn)}`} className="text-gold hover:underline">
                  Public profile ↗
                </ClanLink>
              </>
            )}
            {' · '}
            {/* Their year and finished months as shareable cards (app/p/[rsn]/wrapped). */}
            <ClanLink href={`/p/${encodeURIComponent(rsn)}/wrapped`} className="text-gold hover:underline">
              Wrapped
            </ClanLink>
            {' · '}
            {/* Side by side with somebody else — the compare page asks for the other name. */}
            <ClanLink href={`/compare?a=${encodeURIComponent(rsn)}`} className="text-gold hover:underline">
              Compare ↗
            </ClanLink>
          </>
        )}
      </p>

      {(eff || totalXp > 0 || embedded) && (
        <div className="flex flex-wrap gap-2 mt-3">
          {eff && <Placing label="Hours played" value={eff.ehp.toFixed(1)} standing={standings.ehp} />}
          {eff && <Placing label="Hours bossed" value={eff.ehb.toFixed(1)} standing={standings.ehb} />}
          <Placing label="XP" value={fmtXp(totalXp)} standing={standings.xp} />
          {streak && streak.best > 0 && <StreakChip streak={streak} />}
          {eff && (
            <span className="text-xs border border-card-border rounded-full px-3 py-1 bg-brown-dark text-text-muted">
              {eff.ttm >= 1 ? (
                <>
                  <span className="text-gold font-semibold tabular-nums">{Math.round(eff.ttm).toLocaleString()}h</span> to max
                </>
              ) : (
                <span className="text-gold font-semibold">maxed</span>
              )}
            </span>
          )}
          {embedded && <EmbeddedFacts profile={profile} records={records} />}
        </div>
      )}
    </>
  );

  return (
    <>
      {embedded ? (
        // Inside /profile: the person card above is the hero, so this is one compact line — who the
        // character is, where it places, its best stretches — and no banner.
        <div className="mt-6 mb-6 border-b border-card-border pb-5">{identity}</div>
      ) : (
        <>
          {media.banner && <ProfileBanner banner={media.banner} className="mt-3" />}

          {/* Identity band: who they are, where they place, and how far from max — one object rather
              than a name followed by five identically-weighted stat cards. Combat sits on the shield
              because that is where an OSRS player looks for it. */}
          <div
            className="relative overflow-hidden rounded-xl border border-card-border p-5 sm:p-6 mt-3 mb-6"
            style={{
              background:
                'radial-gradient(80% 160% at 0% 0%, rgba(212,160,23,.14), transparent 60%), var(--card-bg)',
            }}
          >
            <div className="flex flex-wrap items-center gap-5 sm:gap-6">
              {/* Drawn as SVG rather than a clip-path: clipping cuts the border off with the corners,
                  which left the number floating with four stray edge marks instead of a shield. */}
              <svg
                width="84"
                height="92"
                viewBox="0 0 84 92"
                className="hidden sm:block shrink-0"
                role="img"
                aria-label={profile.combatLevel ? `Combat level ${profile.combatLevel}` : 'Combat level unknown'}
              >
                <defs>
                  <linearGradient id="shield-fill" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="var(--brown-light)" />
                    <stop offset="100%" stopColor="var(--tile-bg)" />
                  </linearGradient>
                </defs>
                <path
                  d="M42 1 L82 14 V64 L42 91 L2 64 V14 Z"
                  fill="url(#shield-fill)"
                  stroke="var(--gold-dark)"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <text x="42" y="46" textAnchor="middle" fill="var(--gold-light)" fontSize="27" fontWeight="700">
                  {profile.combatLevel ?? '—'}
                </text>
                <text x="42" y="62" textAnchor="middle" fill="var(--text-muted)" fontSize="9" letterSpacing="1.5">
                  COMBAT
                </text>
              </svg>

              <div className="min-w-0 flex-1">
                {identity}

                {myCharacters.length > 1 && (
                  <nav aria-label="Your characters" className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[11px] uppercase tracking-[0.12em] text-text-dim">Your characters</span>
                    {myCharacters
                      .slice()
                      .sort((a, b) => a.rsn.localeCompare(b.rsn))
                      .map((c) =>
                        c.id === accountId ? (
                          <span key={c.id} aria-current="page" className="rounded-full border border-gold/50 bg-gold/10 px-2.5 py-0.5 text-xs text-gold">
                            {c.rsn}
                          </span>
                        ) : (
                          <ClanLink
                            key={c.id}
                            href={`/p/${encodeURIComponent(c.rsn)}`}
                            className="rounded-full border border-card-border px-2.5 py-0.5 text-xs text-text-muted transition-colors hover:border-gold/40 hover:text-foreground"
                          >
                            {c.rsn}
                          </ClanLink>
                        ),
                      )}
                  </nav>
                )}
              </div>

              {profile.totalLevel > 0 && <TotalLevelDial level={profile.totalLevel} />}
            </div>
          </div>
        </>
      )}

      {/* The owner's streams and their Supporter display case. */}
      <ConnectedAccounts links={connected} className="-mt-3 mb-6" />
      <DisplayCase entries={showcase} showRsn={false} className="mb-6" />
      {streak && streak.best > 0 && !embedded && <StreakHistory streak={streak} />}

      {/* One human, several accounts. Null for a single linked account, and for a signed-out visitor. */}
      {/* Not on the owner's own /profile: the characters above already list them all, with switching. */}
      {persona && seat && !embedded && <Persona persona={persona} currentMemberId={seat.id} />}

      {/* What kind of account this is, against the clan, before the tabs break it into numbers. */}
      {shape && !shape.empty && (
        <div className="mb-6">
          <PlayerShapeRadar shape={shape} rsn={rsn} />
        </div>
      )}

      {/* The tabs render with or without a hiscores snapshot: gating them hid everything the plugin
          pushes on its own (collection log, quests, combat achievements, records). */}
      {!profile.statsAt && profile.skills.length === 0 && (
        <div className="mb-5 rounded-xl border border-dashed border-card-border px-5 py-4 text-center text-sm text-text-muted">
          No stats yet for this character. They appear within minutes of playing with the Anvil plugin running,
          or once we next check the OSRS Hiscores.
        </div>
      )}

      {/* Head-to-head (lib/h2h): this character's public record and a Challenge button; the owner
          sees their whole record and anything waiting on them. Its record is cross-clan, so it shows
          only where /p/ would. */}
      {show.h2h && <H2hCard accountId={accountId} rsn={rsn} viewerPlayerId={viewerPlayerId} />}

      <GoalsCard accountId={accountId} goals={goals.goals} editable={show.ownerControls} options={goals.options} />

      <RecordsCard accountId={accountId} />

      <ProfileTabs
        // A same-profile display-case link changes only the query. Keying its destination remounts
        // the tab state so the requested collection page opens instead of preserving a stale tab.
        key={`${progressTab && !link.tab ? 'collection' : link.tab ?? 'stats'}:${link.page ?? ''}`}
        bossPages={bossPagesFor(profile.bosses)}
        initial={progressTab && !link.tab ? { ...link, tab: 'collection' } : link}
        profile={profile}
        series={series}
        milestones={milestones}
        history={history}
        upcoming={upcoming}
        activityStandings={activityStandings}
        collection={collection}
        moments={moments}
        reactions={reactions}
        accountProgress={
          <AccountProgressCard summary={progress} quests={questItems} combat={caItems} initialTab={progressTab} />
        }
      />

      {/* /p/ only: the owner's share link (or the private notice); anyone else is told why they can see it. */}
      {character &&
        (show.ownerControls ? (
          <ProfileShare rsn={rsn} shared={!character.privateToViewer} />
        ) : (
          <p className="mt-8 text-xs text-text-dim">
            Shown because this account is shared. Its owner can turn that off from their profile.
          </p>
        ))}
    </>
  );
}

const BEST_LABEL: Record<string, string> = { day: 'Best day', week: 'Best week', month: 'Best month' };

/**
 * The embedded line's extra chips: combat and total level (the hero's shield and dial), and the
 * best XP day / week / month — the numbers /profile's old "Personal bests" card carried.
 */
function EmbeddedFacts({ profile, records }: { profile: AccountProfile; records: AccountRecord[] }) {
  const chip = 'text-xs border border-card-border rounded-full px-3 py-1 bg-brown-dark text-text-muted';
  return (
    <>
      {profile.combatLevel != null && (
        <span className={chip}>
          Combat <span className="text-foreground font-semibold tabular-nums">{profile.combatLevel}</span>
        </span>
      )}
      {profile.totalLevel > 0 && (
        <span className={chip}>
          Total <span className="text-foreground font-semibold tabular-nums">{profile.totalLevel.toLocaleString()}</span>
        </span>
      )}
      {(['day', 'week', 'month'] as const).map((period) => {
        const r = records.find((x) => x.period === period && x.metric === 'overall');
        if (!r) return null;
        return (
          <span key={period} className={chip} title={`Ending ${r.endedAt.slice(0, 10)}`}>
            {BEST_LABEL[period]} <span className="text-gold font-semibold tabular-nums">{fmtXp(r.value)}</span> XP
          </span>
        );
      })}
    </>
  );
}

/**
 * The in-game clan, when it is not the Anvil clan already shown: its Anvil page when it has a listed
 * one, else its ghost page — or plain text for an Anvil clan that keeps itself off public pages.
 */
function GameClanChip({ clan }: { clan: CharacterGameClan }) {
  const body = (
    <>
      {!clan.anvilClanUnlisted && (
        <ClanCrest name={clan.anvilClan?.name ?? clan.name} logoUrl={clan.anvilClan?.logoUrl ?? null} size={18} />
      )}
      {clan.name}
      {clan.title && <span className="text-text-dim">· {clan.title}</span>}
      {clan.joinedOn && <span className="text-text-dim">· since {formatJoinDate(clan.joinedOn)}</span>}
    </>
  );
  if (clan.anvilClanUnlisted) return <span className="flex items-center gap-2">{body}</span>;
  return (
    <ClanLink
      href={clan.anvilClan ? `/c/${clan.anvilClan.slug}` : `/clans/g/${encodeURIComponent(clan.key)}`}
      className="flex items-center gap-2 transition-colors hover:text-gold"
      title={clan.joinedOn ? `In-game clan · joined ${clan.joinedOn}` : 'In-game clan'}
    >
      {body}
    </ClanLink>
  );
}

/** The weekly activity streak (lib/activityStreak) as one chip, its last 12 weeks in the hover. */
function StreakChip({ streak }: { streak: Streak }) {
  const recent = streak.history.slice(-12);
  const label = streak.weeks > 0 ? `${streak.weeks}-week streak` : 'No streak this week';
  const detail = streak.safe ? 'this week counts' : `${streak.thisWeek} of ${streak.needed} days this week`;
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-card-border bg-brown-dark px-3 py-1 text-xs text-text-muted"
      title={`Weeks with ${streak.needed}+ active days, in a row · ${detail}${streak.restBanked ? ' · rest week banked' : ''}`}
    >
      <span className={`font-semibold tabular-nums ${streak.weeks > 0 ? 'text-[#ff8a3d]' : ''}`}>{label}</span>
      <span className="flex gap-[2px]" aria-hidden>
        {recent.map((m, i) => (
          <i key={i} className={`block h-2.5 w-1.5 rounded-[1px] ${m === 'active' ? 'bg-[#ff8a3d]' : m === 'rest' ? 'bg-[#7ae0ff]' : 'bg-card-border'}`} />
        ))}
      </span>
      <span>best {streak.best}</span>
    </span>
  );
}

/** The last 52 weeks of the activity streak, with the milestones it has passed and the next. */
function StreakHistory({ streak }: { streak: Streak }) {
  const weeks = streak.history.slice(-52);
  return (
    <section className="mb-6 rounded-xl border border-card-border bg-card-bg p-5" aria-labelledby="streak-history">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="streak-history" className="flex items-center gap-2 font-semibold">
          <span className="h-5 w-1 bg-gold" aria-hidden />
          Activity streak
        </h2>
        <span className="text-[13px] text-text-muted">weeks with {streak.needed}+ active days · the week resets Wednesday</span>
      </div>
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <dt className="text-[12px] text-text-muted">Current</dt>
          <dd className="text-2xl font-bold tabular-nums text-[#ff8a3d]">{streak.weeks} wk</dd>
        </div>
        <div>
          <dt className="text-[12px] text-text-muted">Best</dt>
          <dd className="text-2xl font-bold tabular-nums">{streak.best} wk</dd>
        </div>
        <div>
          <dt className="text-[12px] text-text-muted">This week</dt>
          <dd className="text-2xl font-bold tabular-nums">
            {streak.safe ? 'counts' : `${streak.thisWeek} of ${streak.needed}`}
          </dd>
        </div>
        <div>
          <dt className="text-[12px] text-text-muted">Rest week</dt>
          <dd className="text-2xl font-bold text-[#7ae0ff]">{streak.restBanked ? 'banked' : 'used'}</dd>
        </div>
      </dl>
      <div className="mt-4 grid gap-1" style={{ gridTemplateColumns: 'repeat(26, minmax(0, 1fr))' }} role="img" aria-label={`Last ${weeks.length} weeks: ${weeks.filter((w) => w === 'active').length} counted`}>
        {weeks.map((w, i) => (
          <i key={i} className={`block h-3.5 rounded-[2px] ${w === 'active' ? 'bg-[#ff8a3d]' : w === 'rest' ? 'bg-[#7ae0ff]' : 'bg-card-border'}`} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-[12px] text-text-muted">
        <span className="flex items-center gap-1.5"><i className="block h-2.5 w-2.5 rounded-[2px] bg-[#ff8a3d]" />counted</span>
        <span className="flex items-center gap-1.5"><i className="block h-2.5 w-2.5 rounded-[2px] bg-[#7ae0ff]" />rest week</span>
        <span className="flex items-center gap-1.5"><i className="block h-2.5 w-2.5 rounded-[2px] bg-card-border" />missed</span>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-4">
        {STREAK_MILESTONES.map((m) => {
          const got = streak.best >= m.weeks;
          return (
            <li key={m.weeks} className={`rounded-lg border px-3 py-2 ${got ? 'border-[#ff8a3d]/40' : 'border-card-border opacity-60'}`}>
              <span className={`font-mono text-lg font-bold ${got ? 'text-[#ff8a3d]' : 'text-text-muted'}`}>{m.weeks}</span>{' '}
              <span className="text-[13px] font-semibold">{m.name}</span>
              <span className="block text-[11px] text-text-muted">{got ? 'reached' : `${m.weeks - streak.weeks} weeks to go`}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
