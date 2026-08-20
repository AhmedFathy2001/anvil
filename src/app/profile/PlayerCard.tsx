import type { LockerAccount, LockerCareer, LockerConnection } from '@/lib/profileLocker';
import ClanLink from '@/components/ClanLink';

// The card at the top of the locker: who you are, which accounts are yours, and — once you've
// played anything — the numbers that make the page feel earned. Before that the same slots render
// dimmed, so a new member can see the shape of what fills in rather than a page that grows a
// section later and surprises them.

interface Props {
  displayName: string;
  discordUsername: string | null;
  avatar: string | null;
  role: string;
  isStaff: boolean;
  accounts: LockerAccount[];
  connection: LockerConnection;
  career: LockerCareer | null;
  nowMs: number;
}

function ago(iso: string, nowMs: number): string {
  const ms = nowMs - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 60_000) return 'just now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function compactXp(xp: number): string {
  if (xp >= 1_000_000_000) return `${(xp / 1_000_000_000).toFixed(1)}B`;
  if (xp >= 1_000_000) return `${Math.round(xp / 1_000_000)}M`;
  if (xp >= 1_000) return `${Math.round(xp / 1_000)}K`;
  return xp.toLocaleString();
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{label}</div>
      <div className={`font-mono text-xl font-bold tabular-nums mt-0.5 ${accent ? 'text-gold-light' : ''}`}>
        {value}
        {sub && <span className="text-xs text-text-muted font-medium ml-1">{sub}</span>}
      </div>
    </div>
  );
}

export default function PlayerCard({
  displayName,
  discordUsername,
  avatar,
  role,
  isStaff,
  accounts,
  connection,
  career,
  nowMs,
}: Props) {
  const played = career && career.eventsPlayed > 0;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-card-border bg-card-bg p-5 sm:p-6">
      {/* Forge light: a single warm source at the top right, and a hairline along the top edge. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 150% at 88% -20%, rgba(212,160,23,0.16), transparent 62%), linear-gradient(180deg, #2a231b, transparent 60%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(240,201,64,0.55), transparent)' }}
      />

      <div className="relative">
        <div className="flex items-start gap-4 flex-wrap">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              width={72}
              height={72}
              className="w-[72px] h-[72px] rounded-full border-2 border-gold/45 shrink-0"
            />
          ) : (
            <span className="w-[72px] h-[72px] rounded-full bg-gold/15 border-2 border-gold/45 text-gold-light text-2xl flex items-center justify-center font-bold shrink-0">
              {(displayName || '?').charAt(0).toUpperCase()}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold tracking-tight truncate">{displayName}</h2>
              <span className="text-[10px] uppercase tracking-wider font-bold bg-gold/15 text-gold-light border border-gold/40 px-2 py-0.5 rounded-full">
                {role}
              </span>
              {career && career.weekStreak >= 2 && (
                <span
                  className="text-[10px] uppercase tracking-wider font-bold bg-brown-light border border-card-border px-2 py-0.5 rounded-full"
                  title="Consecutive weeks you've gained XP"
                >
                  🔥 {career.weekStreak}-week streak
                </span>
              )}
            </div>
            {discordUsername && <div className="text-sm text-text-muted mt-0.5">@{discordUsername} on Discord</div>}

            {/* The accounts, in the identity itself — a green dot means the plugin has heard from
                that character, so "is this thing on?" is answered without scrolling. */}
            <div className="flex flex-wrap gap-2 mt-3">
              {accounts.length === 0 ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-card-border px-3 py-1.5 text-sm text-text-muted">
                  No RuneScape account linked yet
                </span>
              ) : (
                accounts.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-2 rounded-full border border-card-border bg-brown-dark/60 pl-2 pr-3 py-1 text-sm"
                    title={a.lastPingAt ? `Last plugin ping ${ago(a.lastPingAt, nowMs)}` : 'No plugin ping yet'}
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        a.lastPingAt ? 'bg-accent-green-light ring-2 ring-accent-green/25' : 'bg-text-muted'
                      }`}
                    />
                    {a.isPrimary && <span className="text-gold text-[11px]">★</span>}
                    <span className="truncate max-w-[10rem]">{a.rsn}</span>
                    {a.playingIn ? (
                      <span className="text-[11px] text-accent-green-light">playing</span>
                    ) : !a.verified ? (
                      <span className="text-[11px] text-yellow-400">unverified</span>
                    ) : null}
                  </span>
                ))
              )}
              {/* The chips are where a member looks for their characters, so it's where they look
                  to add one. It lands on the drawer, which is where the token and the by-name path
                  actually live. */}
              <ClanLink
                href="#account-security"
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-card-border px-3 py-1 text-sm text-text-muted hover:text-gold-light hover:border-gold/40 transition-colors"
              >
                + Add a character
              </ClanLink>
            </div>
          </div>

          {isStaff && (
            <ClanLink
              href="/admin/dashboard"
              className="text-sm px-3 py-1.5 border border-gold/40 text-gold rounded-lg hover:bg-gold/10 transition-colors shrink-0"
            >
              Admin →
            </ClanLink>
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-card-border grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-4">
          {played ? (
            <>
              <Stat
                label="Events played"
                value={String(career.eventsPlayed)}
                sub={career.eventWins > 0 ? `· ${career.eventWins} won` : undefined}
              />
              <Stat label="Bingo points" value={Math.round(career.points).toLocaleString()} />
              {career.rank ? (
                <Stat
                  label={`${career.rank.metric} rank`}
                  value={`#${career.rank.place}`}
                  sub={`of ${career.rank.outOf}`}
                  accent
                />
              ) : (
                <Stat label="Clan rank" value="—" />
              )}
              <Stat label="XP tracked" value={career.totalXp ? compactXp(career.totalXp) : '—'} />
            </>
          ) : (
            <>
              <div className="col-span-2 sm:col-span-4 text-sm text-text-muted">
                Your card fills in as you play — events played, points scored, and where you sit in the clan.
              </div>
            </>
          )}
        </div>

        {/* Connection: green once the plugin has pushed something, amber while it hasn't. Either
            way it's one line — the setup detail lives in the card below or the drawer. */}
        {accounts.length > 0 && (
          <div
            className={`mt-4 flex items-center gap-2.5 flex-wrap rounded-xl border px-3 py-2 text-sm ${
              connection.connected
                ? 'border-accent-green/30 bg-accent-green/[0.07]'
                : 'border-yellow-500/25 bg-yellow-500/[0.06]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                connection.connected ? 'bg-accent-green-light animate-pulse' : 'bg-yellow-400'
              }`}
            />
            {connection.connected && connection.lastPingAt ? (
              <span>
                Plugin connected — last ping{' '}
                <span className="font-mono">{ago(connection.lastPingAt, nowMs)}</span>
                {connection.lastPingRsn && <> from <span className="font-medium">{connection.lastPingRsn}</span></>}
              </span>
            ) : (
              <span className="text-foreground/80">
                The RuneLite plugin hasn&rsquo;t reached us yet — paste your token and play to track drops
                automatically.
              </span>
            )}
            <ClanLink
              href="#account-security"
              className="ml-auto text-xs text-text-muted hover:text-foreground border border-card-border rounded-lg px-2 py-1 transition-colors"
            >
              {connection.connected ? 'Manage token' : 'Get your token'}
            </ClanLink>
          </div>
        )}
      </div>
    </section>
  );
}
