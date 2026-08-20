import { currentClan } from '@/lib/clanContext';
import { accounts } from '@/db/schema';
import { clansOfPerson } from '@/lib/myClans';
import PersonProfile from '@/components/PersonProfile';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { clanRoster, detectedAccounts, users } from '@/db/schema';
import { findRosterSeats } from '@/lib/roster';
import { and, eq, isNull } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { avatarUrl } from '@/lib/discord-oauth';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { buildLocker } from '@/lib/profileLocker';
import { getMemberProgress } from '@/lib/memberProgressRead';
import AccountProgressCard from '@/components/AccountProgressCard';
import PlayerCard from './PlayerCard';
import ConnectCard from './ConnectCard';
import LiveForYou from './LiveForYou';
import RunSoFar from './RunSoFar';
import { InReach, PersonalBests, PublicProfile, TrophyCase } from './LockerRail';
import LinkedAccountsClient from './LinkedAccountsClient';
import OtherAccountsClient from './OtherAccountsClient';
import DetectedAccountsClient from './DetectedAccountsClient';
import SecurityDrawer from './SecurityDrawer';
import { atLeast } from '@/lib/clanRoles';
import ClanLink from '@/components/ClanLink';

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
  searchParams: Promise<{ welcome?: string }>;
}) {
  // NOT requireClan(). This page is the person's, and a person has no clan on the apex — so the one
  // surface the identity model insists follows you between clans answered 404 there, and a signed-in
  // member clicking their own name in the header got a not-found page. Null is a legitimate answer
  // here; it selects the person-level view below rather than failing.
  const clan = await currentClan();
  const session = await verifyUser();
  if (!session) {
    redirect('/login?return=/profile');
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!user) {
    redirect('/login');
  }

  if (!clan) {
    // The apex: you, across the platform. The locker below is assembled per clan — boards, teams,
    // this week's progress — and none of that has a single answer when no clan is named. Rather than
    // merge several clans into a picture true of nobody, show what IS true of the person and link
    // into each clan for the rest.
    const [myClans, characters] = await Promise.all([
      clansOfPerson(session.playerId, session.userId),
      session.playerId == null
        ? Promise.resolve([])
        : db
            .select({ id: accounts.id, rsn: accounts.rsn, shared: accounts.shared })
            .from(accounts)
            .where(eq(accounts.playerId, session.playerId)),
    ]);
    return (
      <PersonProfile
        displayName={user.displayName}
        clans={myClans}
        characters={characters.map((a) => ({ id: a.id, rsn: a.rsn, shared: !!a.shared }))}
      />
    );
  }

  const welcome = (await searchParams).welcome === '1';
  const [locker, clanName] = await Promise.all([
    buildLocker(clan.id, session.playerId, session.userId),
    getClanDisplayName(clan.id),
  ]);

  // Quest points, combat achievements and diaries for the account they play most — the primary one,
  // falling back to the first linked. A person with several accounts sees the one this profile is
  // really about rather than a merge of all of them, which would be true of nobody.
  const progressAccount = locker.accounts.find((a) => a.isPrimary) ?? locker.accounts[0] ?? null;
  const progress = progressAccount ? await getMemberProgress(progressAccount.id) : null;

  // The opt-in inbox and the opt-out list: accounts the plugin saw this user play, minus anything
  // they already own through another path so we never suggest an account that's on the list above.
  const owned = await findRosterSeats(and(eq(clanRoster.playerId, session.playerId), isNull(clanRoster.leftAt)));
  const ownedRsns = new Set(owned.map((m) => m.rsnNormalized));
  const ownedHashes = new Set(owned.map((m) => m.accountHash).filter(Boolean) as string[]);
  const detectedRows = await db.query.detectedAccounts.findMany({
    where: eq(detectedAccounts.userId, user.id),
    orderBy: (d, { desc }) => [desc(d.lastSeenAt)],
  });
  const notOwned = detectedRows.filter(
    (d) => !ownedRsns.has(d.rsnNormalized) && !(d.accountHash && ownedHashes.has(d.accountHash)),
  );
  const detected = notOwned
    .filter((d) => d.status === 'pending')
    .map((d) => ({ id: d.id, rsn: d.rsn, lastSeenAt: d.lastSeenAt }));
  const ignored = notOwned
    .filter((d) => d.status === 'dismissed')
    .map((d) => ({ id: d.id, rsn: d.rsn, lastSeenAt: d.lastSeenAt }));

  const avatar = user.discordId ? avatarUrl(user.discordId, user.discordAvatar) : null;
  const isStaff = atLeast(user.role, 'admin') || user.role === 'moderator';
  // Server component — Date.now() runs once per request, not on client renders.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const daysIn = locker.memberSince
    ? Math.max(0, Math.floor((nowMs - Date.parse(locker.memberSince)) / 86_400_000))
    : null;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-baseline gap-3 flex-wrap mb-4">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2.5">
          <span className="w-1 h-7 bg-gold rounded-full" />
          Your locker
        </h1>
        <span className="text-sm text-text-muted">
          {clanName}
          {daysIn != null && daysIn > 0 && <> · {daysIn} day{daysIn === 1 ? '' : 's'} in the clan</>}
        </span>
      </div>

      <PlayerCard
        displayName={user.displayName}
        discordUsername={user.discordUsername}
        avatar={avatar}
        role={user.role}
        isStaff={isStaff}
        accounts={locker.accounts}
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

          {progress && !progress.empty && (
            <AccountProgressCard
              summary={progress}
              title={progressAccount ? `${progressAccount.rsn}'s progress` : 'Account progress'}
            />
          )}

          <section className="border border-card-border rounded-xl bg-card-bg p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1 h-5 bg-gold rounded-full" />
              <h2 className="text-lg font-semibold">Your accounts</h2>
              <ClanLink
                href="#account-security"
                className="text-xs font-semibold px-2.5 py-1 border border-card-border rounded-lg hover:border-gold/40 hover:text-gold-light transition-colors"
              >
                + Add a character
              </ClanLink>
              <span className="ml-auto text-xs text-text-muted">
                {locker.accounts.length === 0
                  ? 'none linked'
                  : `${locker.accounts.length} linked · ${
                      locker.accounts.every((a) => a.verified)
                        ? 'all verified'
                        : `${locker.accounts.filter((a) => a.verified).length} verified`
                    }`}
              </span>
            </div>

            <DetectedAccountsClient initial={detected} />

            {locker.accounts.length === 0 ? (
              <div className="border border-dashed border-card-border rounded-lg bg-brown-dark/40 px-4 py-6 text-center text-sm text-text-muted">
                <div className="font-medium text-foreground mb-1">Accounts add themselves.</div>
                Paste the token above, log in, and every character you play shows up here to keep or dismiss.
              </div>
            ) : (
              <LinkedAccountsClient
                accounts={locker.accounts.map((a) => ({
                  id: a.id,
                  rsn: a.rsn,
                  isPrimary: a.isPrimary,
                  verified: a.verified,
                  verificationMethod: a.verificationMethod,
                  provisional: a.provisional,
                  inActiveEvent: a.inActiveEvent,
                  playingIn: a.playingIn,
                  lastPingAt: a.lastPingAt,
                  shared: a.shared,
                  accountId: a.accountId,
                }))}
              />
            )}

            {/* Accounts of theirs this clan has no seat for. Listed only so the Share switch is
                reachable — the accounts a person most wants to publish or hold back are exactly the
                ones the clan they're looking at cannot see. */}
            {locker.otherAccounts.length > 0 && (
              <OtherAccountsClient accounts={locker.otherAccounts} />
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

      <SecurityDrawer
        accounts={locker.accounts.map((a) => ({ id: a.id, rsn: a.rsn }))}
        ignored={ignored}
        defaultOpen={locker.setupNeeded && locker.accounts.length > 0}
      />
    </div>
  );
}
