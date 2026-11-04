import { currentClan } from '@/lib/clanContext';
import { isCreatorSpace } from '@/lib/creatorSpaces';
import { isFriendsHost } from '@/lib/friendEventRules';
import { accounts, clanRoster, users, detectedAccounts } from '@/db/schema';
import { characterStandings } from '@/lib/characterStandingRead';
import ProfileTabs, { HostForFriendsButton, profileClans, SettingsButton } from './ProfileTabs';
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
import { getAccountProfile, getMemberProfile } from '@/lib/memberProfile';
import { apexCharacter } from '@/lib/apexProfiles';
import { profileLinkState } from '@/lib/profileLink';
import { pickViewedCharacter, sortFold, type FoldCharacter } from '@/lib/characterFold';
import CharacterStrip from './CharacterStrip';
import { foldStats } from '@/lib/characterFoldRead';
import CharacterProfile from '@/components/character/CharacterProfile';
import PlayerCard from './PlayerCard';
import ConnectCard from './ConnectCard';
import LiveForYou from './LiveForYou';
import RunSoFar from './RunSoFar';
import { TrophyCase } from './LockerRail';
import { membershipConflicts } from '@/lib/homeClan';
import { atLeast } from '@/lib/clanRoles';
import { supporterForUser } from '@/lib/supporter';
import { supporterView } from '@/components/SupporterSection';
import { myBoosts } from '@/lib/clanBoosts';
import ClanLink from '@/components/ClanLink';
import { onboardingNext } from '@/lib/firstLogin';

export const dynamic = 'force-dynamic';

/**
 * /profile — the member's locker, as ONE page.
 *
 * Top to bottom: their person card (who they are, their characters as chips that pick the one the
 * page is about), the owner-only band nobody else sees (live for you, captain's deck, their run,
 * trophies), then the selected character's profile inline — the same component as the member page
 * and /p/, in its embedded variant, so it adds no second banner under the card.
 *
 * In a creator space there is no roster and no member page: the locker counts the event seats the
 * person entered its events with, the card lists every character they own, and the character's
 * profile is the public one (/p/), owner controls included.
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
    // Their clan boosts and badges: this page is private, so it's the one place they're listed whole.
    const boosts = await myBoosts(session.userId, session.playerId ?? null).catch(() => null);
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
          boosts={boosts}
        />
      </>
    );
  }

  const welcome = params.welcome === '1';
  // A first sign-in from a deep link (lib/firstLogin): offer the way back to it on the connect card.
  const continueTo = welcome ? onboardingNext(params.next) : null;
  // A creator space's tab (lib/creatorSpaces): no roster, member page or guest seats to offer.
  // A friends host's (lib/friendEventRules) too: nobody holds a roster seat there either.
  const space = isCreatorSpace(clan) || isFriendsHost(clan);
  const [locker, clanName, supporterState] = await Promise.all([
    buildLocker(clan.id, session.playerId, session.userId, new Date(), params.account ?? null, { space }),
    getClanDisplayName(clan.id),
    supporterForUser(session.userId),
  ]);
  // Their own avatar (Anvil Champion+), animated on their own card; else the Discord one below.
  const ownMedia = await profileMediaForUser(session.userId, { tier: supporterState?.tier.id ?? null });
  // Nothing left to set up (the plugin got there first): no card to put the link on, so just go.
  if (continueTo && !locker.setupNeeded) redirect(continueTo); // clan-prefix: platform -- literal path they signed in from

  // EVERY CHARACTER OF THEIRS, for the card's folded list: the ones seated here, then — on a clan's
  // tab — the ones this clan holds no seat for ("no seat"). A creator space's locker already lists
  // all of them (lib/profileLocker `space`).
  const unseated = space ? [] : locker.otherAccounts;
  const foldBase: Omit<FoldCharacter, 'totalLevel' | 'totalXp'>[] = [
    ...locker.accounts.map((a) => ({
      accountId: a.accountId,
      rsn: a.rsn,
      isPrimary: a.isPrimary,
      seat: a.seat,
      playingIn: a.playingIn,
      lastPingAt: a.lastPingAt,
      verified: a.verified,
    })),
    ...unseated.map((o) => ({
      accountId: o.accountId,
      rsn: o.rsn,
      isPrimary: o.isPrimary,
      seat: null,
      playingIn: null,
      lastPingAt: null,
      verified: o.verified,
    })),
  ];
  const levels = await foldStats(foldBase.map((c) => c.accountId));
  const foldCharacters: FoldCharacter[] = sortFold(
    foldBase.map((c) => ({ ...c, totalLevel: null, totalXp: null, ...levels.get(c.accountId) })),
  );

  // TWO VIEWS. With no ?account= (or one that isn't theirs) this is the OVERVIEW: the person, their
  // characters folded, and what only they see. ?account=<rsn> — a row in the fold — is that
  // CHARACTER'S VIEW: the same profile as /members/<rsn> and /p/<rsn>, at the top of the page, under
  // a slim strip that leads back. Only that character's data is read.
  //
  // A character this clan holds no seat for has no clan view to show, so it gets its own public one
  // (/p/), owner controls included — the same as every character in a creator space.
  const picked = pickViewedCharacter(params.account, locker.accounts, unseated);
  const recordsAccount = picked
    ? { accountId: picked.row.accountId, rsn: picked.row.rsn, clanView: picked.seated && !space }
    : null;
  const viewed = recordsAccount ? foldCharacters.find((c) => c.accountId === recordsAccount.accountId) ?? null : null;
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
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <HostForFriendsButton />
          <SettingsButton />
        </span>
      </div>
      <ProfileTabs clans={myClans} current={clan.slug} />

      {viewed && recordsAccount ? (
        // THE CHARACTER VIEW: no owner band — this page is about the character now.
        <>
          <CharacterStrip
            displayName={user.displayName}
            supporterTier={supporterState?.tier.id ?? null}
            supporterStyle={supporterState?.style ?? null}
            avatar={avatar}
            customAvatar={ownMedia.avatar}
            characters={foldCharacters}
            selected={viewed}
            space={space}
          />
          <section id="records" className="mt-2 scroll-mt-20" aria-label={`${recordsAccount.rsn}'s profile`}>
            <Suspense key={recordsAccount.accountId} fallback={<RecordsSkeleton />}>
              <LockerCharacterProfile
                clanId={clan.id}
                publicView={!recordsAccount.clanView}
                rsn={recordsAccount.rsn}
                viewer={session}
                link={link}
                progressTab={progressTab}
              />
            </Suspense>
          </section>
        </>
      ) : (
        // THE OVERVIEW: the person, their characters folded, and what only they see.
        <>
          <PlayerCard
            displayName={user.displayName}
            supporterTier={supporterState?.tier.id ?? null}
            supporterStyle={supporterState?.style ?? null}
            discordUsername={user.discordUsername}
            avatar={avatar}
            customAvatar={ownMedia.avatar}
            role={session.role}
            isStaff={isStaff}
            characters={foldCharacters}
            space={space}
            connection={locker.connection}
            career={locker.career}
            nowMs={nowMs}
          />

          {/* Things waiting on them in settings, one line each, under the card that lists the characters. */}
          {(detected.length > 0 || homeConflicts.length > 0) && (
            <div className="mt-3 grid gap-2">
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

          {/* The owner band: what only they see. Live and captaincy on one side, the record on the other. */}
          <div className="grid gap-5 mt-5 lg:grid-cols-2 lg:items-start">
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
            </div>

            <div className="grid gap-5 content-start">
              {/* A creator space has no member pages (lib/creatorSpaces), so no "All events →" into one. */}
              <RunSoFar rows={locker.history} totals={locker.historyTotals} focusRsn={space ? null : locker.focusRsn} />
              <TrophyCase trophies={locker.trophies} />
            </div>
          </div>

          {/* Their characters this clan holds no seat for — offered here as guests, because asking
              THIS clan is the one thing about them that only makes sense on this clan's tab. Not in a
              creator space: it has no roster to guest on (a viewer gets in through an event), and its
              card already lists every character they own. */}
          {!space && locker.otherAccounts.length > 0 && (
            <section className="mt-5 border border-card-border rounded-xl bg-card-bg px-5 pb-5 pt-1">
              <OtherAccountsClient accounts={locker.otherAccounts} clanName={clan.name} clanSlug={clan.slug} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** The selected character's profile, resolved inside the Suspense boundary so the locker streams first. */
async function LockerCharacterProfile({
  clanId,
  publicView,
  rsn,
  viewer,
  link,
  progressTab,
}: {
  clanId: number;
  /** No clan seat to show (a creator space, or a character this clan doesn't seat): its public profile, as /p/ renders it. */
  publicView: boolean;
  rsn: string;
  viewer: Awaited<ReturnType<typeof verifyUser>>;
  link: ReturnType<typeof profileLinkState>;
  progressTab?: string;
}) {
  if (publicView) {
    // The owner always passes apexCharacter's rule (shared, or theirs), so this is their own /p/ page.
    const character = await apexCharacter(rsn, viewer?.playerId ?? null);
    const profile = character ? await getAccountProfile(character.accountId) : null;
    if (!character || !profile) return null;
    return (
      <CharacterProfile
        context={{ kind: 'public', character, profile }}
        viewer={viewer}
        link={link}
        progressTab={progressTab}
        nameAs="h2"
        variant="embedded"
      />
    );
  }
  const seat = await getMemberProfile(clanId, rsn);
  if (!seat) return null;
  return (
    <CharacterProfile
      context={{ kind: 'clan', clanId, seat }}
      viewer={viewer}
      link={link}
      progressTab={progressTab}
      nameAs="h2"
      variant="embedded"
    />
  );
}

function RecordsSkeleton() {
  return (
    <div className="mt-6 grid gap-4" aria-busy="true" aria-label="Loading records">
      <div className="h-20 rounded-xl border border-card-border bg-card-bg animate-pulse" />
      <div className="h-72 rounded-xl border border-card-border bg-card-bg animate-pulse" />
    </div>
  );
}
