import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { clanMembers, events, players, teams, users } from '@/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { avatarUrl } from '@/lib/discord-oauth';
import LinkAccountClient from './LinkAccountClient';
import PluginTokensClient from './PluginTokensClient';
import PluginPlayerTokenClient from './PluginPlayerTokenClient';

export default async function ProfilePage() {
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

  // Player participations: events the user is signed up for via any of their linked accounts.
  const linkedIds = linkedAccounts.map((m) => m.id);
  const playerRows = linkedIds.length
    ? await db
        .select({
          id: players.id,
          name: players.name,
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

      {/* Linked accounts */}
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
          <div className="mb-4 text-sm text-text-muted text-center py-6 border border-dashed border-card-border rounded-lg">
            Link an account to participate in events.
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {linkedAccounts.map((m) => {
              const verified = Boolean(m.verifiedAt);
              const provisional = Boolean(m.provisional);
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between border border-card-border rounded-lg p-3 bg-brown-dark/40"
                >
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {m.rsn}
                      {m.isPrimary === 1 && (
                        <span className="text-[10px] uppercase tracking-wide bg-gold/20 text-gold px-1.5 py-0.5 rounded">
                          primary
                        </span>
                      )}
                      {provisional && (
                        <span
                          className="text-[10px] uppercase tracking-wide bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded"
                          title="Verified via stat-delta — awaiting moderator confirmation"
                        >
                          provisional
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-text-muted">
                      {verified ? `Verified via ${m.verificationMethod}` : 'Not verified'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <LinkAccountClient hasAny={linkedAccounts.length > 0} />
      </section>

      <section className="border border-card-border rounded-xl bg-card-bg p-5 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-1 h-5 bg-gold rounded-full" />
          <h2 className="text-lg font-semibold">RuneLite plugin token</h2>
        </div>
        <PluginPlayerTokenClient />
      </section>

      {isStaff && (
        <section className="border border-card-border rounded-xl bg-card-bg p-5 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1 h-5 bg-gold rounded-full" />
            <h2 className="text-lg font-semibold">Admin plugin links</h2>
          </div>
          <PluginTokensClient />
        </section>
      )}
    </div>
  );
}
