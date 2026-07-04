import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import {
  clanMembers,
  detectedAccounts,
  events,
  eventSignups,
  players,
  settings,
  teams,
  users,
  weeklyCompetitions,
  weeklyParticipants,
} from '@/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { avatarUrl } from '@/lib/discord-oauth';
import { signupWindowState } from '@/lib/signup';
import LinkAccountClient from './LinkAccountClient';
import PluginPlayerTokenClient from './PluginPlayerTokenClient';
import DetectedAccountsClient from './DetectedAccountsClient';
import LinkedAccountsClient from './LinkedAccountsClient';
import GettingStarted, { type GettingStartedProps } from './GettingStarted';

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const session = await verifyUser();
  if (!session) {
    redirect('/login?return=/profile');
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });
  if (!user) {
    redirect('/login');
  }

  const linkedAccounts = await db.query.clanMembers.findMany({
    where: and(eq(clanMembers.userId, user.id), isNull(clanMembers.leftAt)),
    orderBy: (m, { desc }) => [desc(m.isPrimary), desc(m.verifiedAt)],
  });

  // Plugin-detected accounts awaiting an opt-in decision. Filter out any that are already
  // linked (owned by this user) so we never suggest an account that's on the list above.
  const ownedRsns = new Set(linkedAccounts.map((m) => m.rsnNormalized));
  const ownedHashes = new Set(linkedAccounts.map((m) => m.accountHash).filter(Boolean) as string[]);
  const detectedPending = await db.query.detectedAccounts.findMany({
    where: and(eq(detectedAccounts.userId, user.id), eq(detectedAccounts.status, 'pending')),
    orderBy: (d, { desc }) => [desc(d.lastSeenAt)],
  });
  const detectedForClient = detectedPending
    .filter((d) => !ownedRsns.has(d.rsnNormalized) && !(d.accountHash && ownedHashes.has(d.accountHash)))
    .map((d) => ({ id: d.id, rsn: d.rsn, lastSeenAt: d.lastSeenAt }));

  // Player participations: events the user is signed up for via any of their linked accounts.
  const linkedIds = linkedAccounts.map((m) => m.id);
  const playerRows = linkedIds.length
    ? await db
        .select({
          id: players.id,
          name: players.name,
          clanMemberId: players.clanMemberId,
          teamId: players.teamId,
          eventId: players.eventId,
          playerToken: players.playerToken,
          eventName: events.name,
          eventEndDate: events.endDate,
          eventForceEndedAt: events.forceEndedAt,
          teamName: teams.name,
          teamColor: teams.color,
        })
        .from(players)
        .innerJoin(events, eq(players.eventId, events.id))
        .leftJoin(teams, eq(players.teamId, teams.id))
        .where(inArray(players.clanMemberId, linkedIds))
    : [];

  // Server component — Date.now() runs once per request, not on client renders.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const myActiveEvents = playerRows.filter((p) => {
    if (p.eventForceEndedAt) return false;
    if (p.eventEndDate && new Date(p.eventEndDate).getTime() < nowMs) return false;
    return true;
  });

  // Accounts currently in a live event can't be removed (the Remove button is disabled, and
  // the API rejects it). Mirrors the live-event check in /api/profile/accounts/[id].
  const activeMemberIds = new Set(myActiveEvents.map((p) => p.clanMemberId));
  const linkedForClient = linkedAccounts.map((m) => ({
    id: m.id,
    rsn: m.rsn,
    isPrimary: m.isPrimary === 1,
    verified: Boolean(m.verifiedAt),
    verificationMethod: m.verificationMethod,
    provisional: Boolean(m.provisional),
    inActiveEvent: activeMemberIds.has(m.id),
  }));

  // Getting-started checklist. Shown on first login (?welcome=1 from the OAuth callback)
  // and organically until the user has at least one verified account — the gate for
  // event sign-ups. The extra queries only run while the checklist is visible.
  const welcomeParam = (await searchParams).welcome === '1';
  const hasVerifiedAccount = linkedAccounts.some((m) => m.verifiedAt);
  let gettingStarted: GettingStartedProps | null = null;
  if (welcomeParam || !hasVerifiedAccount) {
    const clanNameRow = await db.query.settings.findFirst({ where: eq(settings.key, 'clan_name') });
    const clanName = clanNameRow?.value?.trim() || process.env.CLAN_NAME?.trim() || 'Anvil';

    // Weekly: roster members are enrolled automatically by the cron, so this step is
    // informational — "you're tracked" / "you will be once you're on the roster".
    const activeWeeklyRows = await db.query.weeklyCompetitions.findMany({
      where: eq(weeklyCompetitions.status, 'active'),
    });
    const enrolledCompIds = new Set<number>();
    if (activeWeeklyRows.length > 0 && linkedIds.length > 0) {
      const rows = await db
        .select({ competitionId: weeklyParticipants.competitionId })
        .from(weeklyParticipants)
        .where(
          and(
            inArray(weeklyParticipants.competitionId, activeWeeklyRows.map((w) => w.id)),
            inArray(weeklyParticipants.clanMemberId, linkedIds),
          ),
        );
      for (const r of rows) enrolledCompIds.add(r.competitionId);
    }
    const nextWeekly = activeWeeklyRows.length
      ? null
      : (await db.query.weeklyCompetitions.findMany({
          where: eq(weeklyCompetitions.status, 'upcoming'),
          orderBy: (w, { asc }) => [asc(w.startDate)],
          limit: 1,
        }))[0] ?? null;

    // Bingo: same public-visibility rules as the home page (drafts hidden, force-ended
    // and past events excluded), split into signup-open vs already-underway.
    const allEvents = await db.select().from(events);
    const visibleEvents = allEvents.filter((e) => {
      if (e.forceEndedAt) return false;
      if (!e.startDate) return false;
      if (e.endDate && new Date(e.endDate).getTime() < nowMs) return false;
      return true;
    });
    const signupOpen = visibleEvents.filter((e) => signupWindowState(e).open);
    const liveEvents = visibleEvents.filter(
      (e) => e.startDate && new Date(e.startDate).getTime() <= nowMs,
    );
    const mySignupStatus = new Map<number, string>();
    if (signupOpen.length > 0) {
      const rows = await db
        .select({ eventId: eventSignups.eventId, status: eventSignups.status })
        .from(eventSignups)
        .where(
          and(
            eq(eventSignups.userId, user.id),
            inArray(eventSignups.eventId, signupOpen.map((e) => e.id)),
          ),
        );
      for (const r of rows) mySignupStatus.set(r.eventId, r.status);
    }

    const verifiedRsns = linkedAccounts.filter((m) => m.verifiedAt).map((m) => m.rsn);
    const unverifiedRsns = linkedAccounts.filter((m) => !m.verifiedAt).map((m) => m.rsn);
    gettingStarted = {
      clanName,
      welcomeParam,
      accountState: hasVerifiedAccount ? 'verified' : linkedAccounts.length > 0 ? 'unverified' : 'none',
      verifiedRsns,
      unverifiedRsns,
      isRosterMember: linkedAccounts.some((m) => m.isGuest === 0),
      activeWeeklies: activeWeeklyRows.map((w) => ({
        id: w.id,
        title: w.title,
        enrolled: enrolledCompIds.has(w.id),
      })),
      nextWeekly: nextWeekly
        ? { id: nextWeekly.id, title: nextWeekly.title, startDate: nextWeekly.startDate }
        : null,
      signupOpenEvents: signupOpen.map((e) => ({
        id: e.id,
        name: e.name,
        mySignupStatus: mySignupStatus.get(e.id) ?? null,
      })),
      liveEvents: liveEvents.map((e) => ({ id: e.id, name: e.name })),
    };
  }

  // Captain seats this user holds.
  const captainSeats = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      teamColor: teams.color,
      eventId: events.id,
      eventName: events.name,
      eventEndDate: events.endDate,
      eventForceEndedAt: events.forceEndedAt,
    })
    .from(teams)
    .innerJoin(events, eq(teams.eventId, events.id))
    .where(eq(teams.captainUserId, user.id));

  const avatar = user.discordId ? avatarUrl(user.discordId, user.discordAvatar) : null;
  const isStaff = user.role === 'admin' || user.role === 'moderator';

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <span className="w-1 h-7 bg-gold rounded-full" />
        <h1 className="text-3xl font-bold text-gold">Profile</h1>
      </div>

      {gettingStarted && <GettingStarted {...gettingStarted} />}

      <section className="border border-card-border rounded-xl bg-card-bg p-5 mb-6">
        <div className="flex items-center gap-4">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" width={64} height={64} className="rounded-full" />
          ) : (
            <span className="w-16 h-16 rounded-full bg-gold/20 text-gold text-2xl flex items-center justify-center font-semibold">
              {(user.displayName || '?').charAt(0).toUpperCase()}
            </span>
          )}
          <div className="flex-1">
            <div className="text-xl font-semibold">{user.displayName}</div>
            {user.discordUsername && (
              <div className="text-sm text-text-muted">@{user.discordUsername}</div>
            )}
            <div className="mt-1 inline-flex items-center px-2 py-0.5 text-xs rounded-md bg-brown-light text-foreground/80 capitalize">
              {user.role}
            </div>
          </div>
          {isStaff && (
            <Link
              href="/admin/dashboard"
              className="text-sm px-3 py-1.5 border border-gold/40 text-gold rounded-lg hover:bg-gold/10 transition-colors"
            >
              Admin →
            </Link>
          )}
        </div>
      </section>

      {/* Captain seats */}
      {captainSeats.length > 0 && (
        <section className="border border-card-border rounded-xl bg-card-bg p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-1 h-5 bg-gold rounded-full" />
              <h2 className="text-lg font-semibold">Captain seats</h2>
            </div>
            <span className="text-xs text-text-muted">{captainSeats.length}</span>
          </div>
          <div className="space-y-2">
            {captainSeats.map((s) => {
              const ended = !!s.eventForceEndedAt || (s.eventEndDate ? new Date(s.eventEndDate).getTime() < nowMs : false);
              return (
                <Link
                  key={s.teamId}
                  href="/captain"
                  className="flex items-center justify-between gap-3 px-3 py-2.5 border border-card-border rounded-lg bg-brown-dark/40 hover:border-gold/40 hover:bg-card-bg-hover transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.teamColor }} />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{s.teamName}</div>
                      <div className="text-xs text-text-muted truncate">
                        {s.eventName} {ended && '· ended'}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gold shrink-0">Enter →</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Player participations */}
      {myActiveEvents.length > 0 && (
        <section className="border border-card-border rounded-xl bg-card-bg p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-1 h-5 bg-accent-green rounded-full" />
              <h2 className="text-lg font-semibold">My events</h2>
            </div>
            <span className="text-xs text-text-muted">{myActiveEvents.length} active</span>
          </div>
          <div className="space-y-2">
            {myActiveEvents.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 border border-card-border rounded-lg bg-brown-dark/40"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {p.teamColor && (
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.teamColor }} />
                  )}
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {p.eventName}
                      {p.teamName && <span className="text-text-muted text-sm ml-1.5">· {p.teamName}</span>}
                    </div>
                    <div className="text-xs text-text-muted truncate">Playing as {p.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/events/${p.eventId}`}
                    className="text-xs text-text-muted hover:text-foreground underline-offset-2 hover:underline"
                  >
                    Board
                  </Link>
                  {p.playerToken && (
                    <Link
                      href={`/player/${p.playerToken}`}
                      className="text-xs px-2 py-1 border border-gold/30 text-gold hover:bg-gold/10 rounded transition-colors"
                    >
                      Dashboard →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Linked accounts — status list */}
      <section className="border border-card-border rounded-xl bg-card-bg p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            <h2 className="text-lg font-semibold">RuneScape Accounts</h2>
          </div>
          <span className="text-xs text-text-muted">
            {linkedAccounts.length === 0
              ? 'No accounts linked yet'
              : `${linkedAccounts.length} linked`}
          </span>
        </div>

        {linkedAccounts.length === 0 ? (
          <div className="text-sm text-text-muted text-center py-6 border border-dashed border-card-border rounded-lg">
            No account linked yet. On RuneLite, add your token below and play — the accounts you play
            show up here for you to add with one click. On mobile or the official client, use the
            manual options.
          </div>
        ) : (
          <LinkedAccountsClient accounts={linkedForClient} />
        )}
      </section>

      {/* Opt-in inbox for accounts the plugin detected but that aren't linked yet */}
      <DetectedAccountsClient initial={detectedForClient} />

      {/* PRIMARY path: RuneLite plugin token */}
      <section className="border border-gold/30 bg-gold/5 rounded-xl p-5 mt-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-5 bg-gold rounded-full" />
          <h2 className="text-lg font-semibold">RuneLite plugin</h2>
          <span className="text-[10px] uppercase tracking-wide bg-gold/20 text-gold px-1.5 py-0.5 rounded">
            recommended
          </span>
        </div>
        <p className="text-sm text-text-muted mb-4">
          The easiest way in: paste this token into the Anvil plugin and play. It tracks your bingo
          drops, and any account you play shows up above under &ldquo;Accounts we noticed you
          playing&rdquo; for you to add with one click — no manual verification needed.
        </p>
        <PluginPlayerTokenClient />
      </section>

      {/* Secondary path: no plugin */}
      <section className="border border-card-border rounded-xl bg-card-bg p-5 mt-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-5 bg-text-muted rounded-full" />
          <h2 className="text-lg font-semibold">Not using RuneLite?</h2>
        </div>
        <p className="text-sm text-text-muted mb-4">
          On mobile or the official client? Link your account here instead — verify by gaining a bit
          of XP, or request a manual review.
        </p>
        <LinkAccountClient />
      </section>
    </div>
  );
}
