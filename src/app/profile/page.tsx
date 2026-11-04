import { currentClan } from '@/lib/clanContext';
import { accounts, clanRoster, users, detectedAccounts } from '@/db/schema';
import { characterStandings } from '@/lib/characterStandingRead';
import ProfileTabs, { profileClans, SettingsButton } from './ProfileTabs';
import LegacyAnchors from './LegacyAnchors';
import { profileMediaForUser } from '@/lib/profileMedia';
import OtherAccountsClient from './OtherAccountsClient';
import { onboardingState } from '@/lib/onboarding';
import { clansOfPerson } from '@/lib/myClans';
import PersonProfile from '@/components/PersonProfile';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { findRosterSeats } from '@/lib/roster';
import { and, eq, isNull } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { avatarUrl } from '@/lib/discord-oauth';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { buildLocker } from '@/lib/profileLocker';
import { Suspense } from 'react';
import { getMemberProfile } from '@/lib/memberProfile';
import { profileLinkState } from '@/lib/profileLink';
import { pickProfileCharacter } from '@/lib/characterProfileRules';
import CharacterProfile from '@/components/character/CharacterProfile';
import PlayerCard from './PlayerCard';
import ConnectCard from './ConnectCard';
import LiveForYou from './LiveForYou';
import RunSoFar from './RunSoFar';
import { InReach, PersonalBests, PublicProfile, TrophyCase } from './LockerRail';
import { membershipConflicts } from '@/lib/homeClan';
import { atLeast } from '@/lib/clanRoles';
import { supporterForUser } from '@/lib/supporter';
import { supporterView } from '@/components/SupporterSection';
import SupporterName from '@/components/SupporterName';
import ClanLink from '@/components/ClanLink';
import { onboardingNext } from '@/lib/firstLogin';

export const dynamic = 'force-dynamic';

/**
 * /profile — the member's locker.
 *
 * This page used to be a settings form: link an account, copy a token, and never open it again. It
 * is now the surface a member checks between sessions — what's running for them, what they've won,
 * what they're close to — with the setup it replaces kept to one card that removes itself once it's
 * done, and every form folded into the drawer at the bottom.
 *
 * All the assembly lives in lib/profileLocker; this file is layout.
 */
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // NOT requireClan(). This page is the person's, and a person has no clan on the apex — so the one
  // surface the identity model insists follows you between clans answered 404 there, and a signed-in
  // member clicking their own name in the header got a not-found page. Null is a legitimate answer
  // here; it selects the person-level view below rather than failing.
  const clan = await currentClan();
  const session = await verifyUser();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);
  const params = { welcome: one(sp.welcome), connect: one(sp.connect), account: one(sp.account), next: one(sp.next), everywhere: one(sp.everywhere) };
  // A name the apex home believes is theirs. Trimmed and capped at the RSN limit because it is a URL
  // parameter that ends up in an input: it is a convenience, not a claim about anybody.
  const suggestedRsn = (params.connect ?? '').trim().slice(0, 12);
  // COME BACK TO THE PAGE THEY ASKED FOR. The return was hardcoded to '/profile', which is the apex
  // person page — so anyone who followed a link to their clan locker while signed out logged in and
  // landed somewhere else, with no sign that they had been moved.
  //
  // The clan-prefix lint rule cannot catch this: '/login' IS a platform path, so the href is
  // correct; the clan-scoped path is hiding inside a query parameter where the rule does not look.
  const back = clan ? `/c/${clan.slug}/profile` : '/profile';
  if (!session) {
    redirect(`/login?return=${encodeURIComponent(back)}`);
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!user) {
    redirect(`/login?return=${encodeURIComponent(back)}`);
  }

  // Adding a character moved to settings; old `/profile?connect=<rsn>` links follow it there.
  if (suggestedRsn && session.playerId != null) {
    redirect(`/settings/add?connect=${encodeURIComponent(suggestedRsn)}#link-account`);
  }

  const myClans = await clansOfPerson(session.playerId, session.userId);

  if (!clan) {
    // ONE PROFILE, A TAB PER CLAN. Plain /profile on the apex opens the home clan's tab — that is
    // where people spend their time — and "Everywhere" (?everywhere=1) is the person view below.
    // Someone with no clan seat only has the person view, so they stay here.
    const home = profileClans(myClans)[0];
    if (home && params.everywhere !== '1') redirect(`/c/${home.slug}/profile`); // clan-prefix: platform -- the home clan's tab

    // The apex: you, across the platform — clans and characters, nothing per board. Settings live on
    // /settings; this view only reads.
    const [characters, onboarding, detectedRows, supporter] = await Promise.all([
      session.playerId == null
        ? Promise.resolve([])
        : db
            .select({
              id: accounts.id,
              rsn: accounts.rsn,
              rsnNormalized: accounts.rsnNormalized,
              accountHash: accounts.accountHash,
              shared: accounts.shared,
              isPrimary: accounts.isPrimary,
            })
            .from(accounts)
            .where(eq(accounts.playerId, session.playerId)),
      onboardingState(session.userId, session.playerId),
      db.query.detectedAccounts.findMany({
        where: and(eq(detectedAccounts.userId, user.id), eq(detectedAccounts.status, 'pending')),
      }),
      supporterForUser(session.userId),
    ]);
    const ownedRsns = new Set(characters.map((a) => a.rsnNormalized));
    const ownedHashes = new Set(characters.map((a) => a.accountHash).filter(Boolean) as string[]);
    const detectedCount = detectedRows.filter(
      (d) => !ownedRsns.has(d.rsnNormalized) && !(d.accountHash && ownedHashes.has(d.accountHash)),
    ).length;
    // eslint-disable-next-line react-hooks/purity -- server component, runs once per request
    const standings = await characterStandings(characters.map((a) => a.id), Date.now());
    // Their own avatar and banner (Anvil Supporter), at the tier in force now. Edited on /settings/look.
    const media = await profileMediaForUser(session.userId, { tier: supporter?.tier.id ?? null });
    return (
      <>
        <LegacyAnchors />
        <PersonProfile
          // The Discord display name, and this is the one page it belongs on: /profile is private,
          // signed-in and yours. It is deliberately absent from /u/ and /p/, which are public.
          displayName={user.displayName}
          clans={myClans}
          characters={characters
            .sort((x, y) => y.isPrimary - x.isPrimary || x.rsn.localeCompare(y.rsn))
            .map((a) => ({
              id: a.id,
              rsn: a.rsn,
              shared: !!a.shared,
              isPrimary: a.isPrimary === 1,
              standing: standings.lineByAccount.get(a.id),
            }))}
          detectedCount={detectedCount}
          suggestedRsn={suggestedRsn}
          unfinishedSetup={onboarding.offer}
          supporter={supporterView(supporter)}
          media={media}
          discordAvatar={user.discordId ? avatarUrl(user.discordId, user.discordAvatar) : null}
        />
      </>
    );
  }

  const welcome = params.welcome === '1';
  // A first sign-in from a deep link (lib/firstLogin): offer the way back to it on the connect card.
  const continueTo = welcome ? onboardingNext(params.next) : null;
  const [locker, clanName, supporterState] = await Promise.all([
    buildLocker(clan.id, session.playerId, session.userId, new Date(), params.account ?? null),
    getClanDisplayName(clan.id),
    supporterForUser(session.userId),
  ]);
  // Their own avatar (Anvil Champion+), animated on their own card; else the Discord one below.
  const ownMedia = await profileMediaForUser(session.userId, { tier: supporterState?.tier.id ?? null });
  // Nothing left to set up (the plugin got there first): no card to put the link on, so just go.
  if (continueTo && !locker.setupNeeded) redirect(continueTo); // clan-prefix: platform -- literal path they signed in from

  // THE CHARACTER PROFILE, for one character: the one the chips on the card picked (?account=),
  // else their main, else the first. The same component as /members/<rsn> and /p/<rsn>, so a member
  // no longer has to find themselves on the roster to see their own records. Only this character's
  // data is read, and it streams in under the locker (Suspense) so the locker never waits on it.
  const recordsAccount = pickProfileCharacter(locker.accounts, locker.focusRsn);
  const link = profileLinkState(sp);
  const progressTab = one(sp.progress);

  // Things waiting on them in settings, surfaced here as one line each: characters the plugin saw
  // them play that aren't linked, and characters two in-game rosters both claim (lib/homeClan).
  // clan-scope: global -- the subject is a PERSON, whose seats span clans by design; scoped to the viewer's own.
  const owned = await findRosterSeats(and(eq(clanRoster.playerId, session.playerId), isNull(clanRoster.leftAt)));
  const ownedRsns = new Set(owned.map((m) => m.rsnNormalized));
  const ownedHashes = new Set(owned.map((m) => m.accountHash).filter(Boolean) as string[]);
  const detectedRows = await db.query.detectedAccounts.findMany({
    where: and(eq(detectedAccounts.userId, user.id), eq(detectedAccounts.status, 'pending')),
  });
  const detected = detectedRows.filter(
    (d) => !ownedRsns.has(d.rsnNormalized) && !(d.accountHash && ownedHashes.has(d.accountHash)),
  );
  const homeConflicts = await membershipConflicts(session.playerId);
  // Per character: member of which clan (and how fresh its list is), guest where — lib/characterStanding.
  // eslint-disable-next-line react-hooks/purity -- server component, runs once per request
  const lockerStandings = await characterStandings(locker.accounts.map((a) => a.accountId), Date.now());

  const avatar = user.discordId ? avatarUrl(user.discordId, user.discordAvatar) : null;
  // session.role, NOT user.role. `users.role` is the LEGACY GLOBAL column, and lib/auth says what
  // reading it costs: "it made every admin an admin of every clan on the deployment, which is the
  // single worst thing a shared app can get wrong." This page was the last place still doing it —
  // opening your locker in a clan you only guest in showed an ADMIN badge and an Admin button,
  // because the answer came from a different clan entirely. verifyUser resolves the grant for the
  // clan actually being looked at.
  const isStaff = atLeast(session.role, 'admin') || session.role === 'moderator';
  // Server component — Date.now() runs once per request, not on client renders.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const daysIn = locker.memberSince
    ? Math.max(0, Math.floor((nowMs - Date.parse(locker.memberSince)) / 86_400_000))
    : null;

  return (
    <div className="max-w-6xl mx-auto">
      <LegacyAnchors />
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2.5">
          <span className="w-1 h-7 bg-gold rounded-full" />
          Your profile
        </h1>
        <span className="text-sm text-text-muted">
          {daysIn != null && daysIn > 0 && <>{daysIn} day{daysIn === 1 ? '' : 's'} in {clanName}</>}
        </span>
        <span className="ml-auto">
          <SettingsButton />
        </span>
      </div>
      <ProfileTabs clans={myClans} current={clan.slug} />

      <PlayerCard
        displayName={user.displayName}
        supporterTier={supporterState?.tier.id ?? null}
        supporterStyle={supporterState?.style ?? null}
        discordUsername={user.discordUsername}
        avatar={avatar}
        customAvatar={ownMedia.avatar}
        role={session.role}
        isStaff={isStaff}
        accounts={locker.accounts}
        focusRsn={locker.focusRsn}
        connection={locker.connection}
        career={locker.career}
        nowMs={nowMs}
      />

      {locker.setupNeeded && (
        <ConnectCard
          welcomeTo={welcome ? clanName : null}
          discordUsername={user.discordUsername}
          linkedCount={locker.accounts.length}
          verifiedCount={locker.accounts.filter((a) => a.verified).length}
          detectedCount={detected.length}
          connected={locker.connection.connected}
          continueTo={continueTo}
        />
      )}

      <div className="grid gap-5 mt-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="grid gap-5 content-start">
          <LiveForYou
            events={locker.liveEvents}
            weeklies={locker.liveWeeklies}
            signups={locker.openSignups}
            connected={locker.connection.connected}
          />

          {locker.captainSeats.length > 0 && (
            <section className="border border-card-border rounded-xl bg-card-bg p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1 h-5 bg-gold rounded-full" />
                <h2 className="text-lg font-semibold">Captain&rsquo;s deck</h2>
                <span className="ml-auto text-xs text-text-muted">
                  {locker.captainSeats.length} seat{locker.captainSeats.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="space-y-2.5">
                {locker.captainSeats.map((s) => (
                  <ClanLink
                    key={s.teamId}
                    href={`/team/${s.teamId}`}
                    className={`flex items-center gap-2.5 flex-wrap border border-card-border rounded-lg bg-brown-dark/40 px-3.5 py-3 hover:border-gold/40 hover:bg-card-bg-hover transition-colors ${
                      s.ended ? 'opacity-60' : ''
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.teamColor }} />
                    <span className="font-semibold">{s.teamName}</span>
                    <span className="text-sm text-text-muted truncate">
                      · {s.eventName} · {s.players} player{s.players === 1 ? '' : 's'}
                      {s.ended && ' · ended'}
                    </span>
                    <span className="ml-auto text-xs text-gold shrink-0">Open deck →</span>
                  </ClanLink>
                ))}
              </div>
            </section>
          )}

          <RunSoFar rows={locker.history} totals={locker.historyTotals} focusRsn={locker.focusRsn} />

          {/* Your characters, to look at. Everything you can change about one (sharing, main,
              its clans, rename, remove) is on its settings page — the cog on each row. */}
          <section className="border border-card-border rounded-xl bg-card-bg p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1 h-5 bg-gold rounded-full" />
              <h2 className="text-lg font-semibold">Your characters</h2>
              <ClanLink href="/settings/add" className="ml-auto text-xs text-text-muted hover:text-gold">
                + Add a character
              </ClanLink>
            </div>

            {(detected.length > 0 || homeConflicts.length > 0) && (
              <div className="mb-3 grid gap-2">
                {homeConflicts.map((c) => (
                  <ClanLink
                    key={c.accountId}
                    href={`/settings/characters/${c.accountId}#clans`}
                    className="flex items-center gap-2 rounded-lg border border-gold/35 bg-gold/[0.06] px-3.5 py-2.5 text-[13px] hover:border-gold/60"
                  >
                    <span>
                      Two clans list <b>{c.rsn}</b> ({c.member.name} and {c.listedBy.name}). Which is home?
                    </span>
                    <span className="ml-auto text-gold">Choose →</span>
                  </ClanLink>
                ))}
                {detected.length > 0 && (
                  <ClanLink
                    href="/settings/add"
                    className="flex items-center gap-2 rounded-lg border border-gold/35 bg-gold/[0.06] px-3.5 py-2.5 text-[13px] hover:border-gold/60"
                  >
                    <span>
                      We noticed you playing {detected.length} character{detected.length === 1 ? '' : 's'} that aren&rsquo;t linked yet.
                    </span>
                    <span className="ml-auto text-gold">Review →</span>
                  </ClanLink>
                )}
              </div>
            )}

            {locker.accounts.length === 0 ? (
              <div className="border border-dashed border-card-border rounded-lg bg-brown-dark/40 px-4 py-6 text-center text-sm text-text-muted">
                <div className="font-medium text-foreground mb-1">Play once and it appears here.</div>
                New accounts can link immediately. Existing roster accounts ask for the one-time ownership check first.
              </div>
            ) : (
              <ul className="grid gap-2">
                {locker.accounts.map((a) => (
                  <li key={a.accountId} className="flex items-center gap-2 rounded-lg border border-tile-border bg-tile-bg px-3 py-2.5">
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <SupporterName
                          name={a.rsn}
                          tier={supporterState?.tier.id}
                          style={supporterState?.style}
                          plain
                          className="font-semibold"
                        />
                        {a.isPrimary && <span className="rounded-full border border-gold-dark px-1.5 text-[10.5px] text-gold">main</span>}
                        {!a.shared && <span className="rounded-full border border-card-border px-1.5 text-[10.5px] text-text-muted">private</span>}
                      </span>
                      {lockerStandings.lineByAccount.get(a.accountId) && (
                        <span className="block text-xs text-text-muted">{lockerStandings.lineByAccount.get(a.accountId)}</span>
                      )}
                    </span>
                    <ClanLink
                      href={`/settings/characters/${a.accountId}`}
                      className="ml-auto shrink-0 rounded-md border border-card-border px-2 py-1 text-[12px] text-text-muted hover:border-gold/40 hover:text-gold"
                      aria-label={`Settings for ${a.rsn}`}
                    >
                      ⚙ Settings
                    </ClanLink>
                  </li>
                ))}
              </ul>
            )}

            {/* Their characters this clan holds no seat for — offered here as guests, because asking
                THIS clan is the one thing about them that only makes sense on this clan's tab. */}
            {locker.otherAccounts.length > 0 && (
              <OtherAccountsClient accounts={locker.otherAccounts} clanName={clan.name} clanSlug={clan.slug} />
            )}
          </section>
        </div>

        <div className="grid gap-5 content-start">
          <TrophyCase trophies={locker.trophies} />
          {locker.bests && <PersonalBests bests={locker.bests} focusRsn={locker.focusRsn} />}
          <InReach milestones={locker.milestones} />
          {locker.focusRsn && <PublicProfile rsn={locker.focusRsn} />}
        </div>
      </div>

      {recordsAccount && (
        <section id="records" className="mt-8 scroll-mt-20" aria-label={`${recordsAccount.rsn}'s profile`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-1 h-5 bg-gold rounded-full" />
            <h2 className="text-lg font-semibold">{recordsAccount.rsn}&rsquo;s records</h2>
            {locker.accounts.length > 1 && (
              <span className="text-xs text-text-muted">· pick another character on your card above</span>
            )}
            <ClanLink
              href={`/members/${encodeURIComponent(recordsAccount.rsn)}`}
              className="ml-auto text-sm text-gold hover:underline"
            >
              View full profile →
            </ClanLink>
          </div>
          <Suspense key={recordsAccount.accountId} fallback={<RecordsSkeleton />}>
            <LockerCharacterProfile clanId={clan.id} rsn={recordsAccount.rsn} viewer={session} link={link} progressTab={progressTab} />
          </Suspense>
        </section>
      )}

    </div>
  );
}

/** The selected character's profile, resolved inside the Suspense boundary so the locker streams first. */
async function LockerCharacterProfile({
  clanId,
  rsn,
  viewer,
  link,
  progressTab,
}: {
  clanId: number;
  rsn: string;
  viewer: Awaited<ReturnType<typeof verifyUser>>;
  link: ReturnType<typeof profileLinkState>;
  progressTab?: string;
}) {
  const seat = await getMemberProfile(clanId, rsn);
  if (!seat) return null;
  return <CharacterProfile context={{ kind: 'clan', clanId, seat }} viewer={viewer} link={link} progressTab={progressTab} nameAs="h2" />;
}

function RecordsSkeleton() {
  return (
    <div className="mt-3 grid gap-4" aria-busy="true" aria-label="Loading records">
      <div className="h-36 rounded-xl border border-card-border bg-card-bg animate-pulse" />
      <div className="h-72 rounded-xl border border-card-border bg-card-bg animate-pulse" />
    </div>
  );
}
