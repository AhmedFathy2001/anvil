import ClanLink from '@/components/ClanLink';
import type { PublicClanHome as View, ClanFocus } from '@/lib/clanHome';
import ApplyToClan from '@/components/ApplyToClan';

const FOCUS_LABEL: Record<ClanFocus, string> = {
  pvm: 'PvM',
  skilling: 'Skilling',
  pvp: 'PvP',
  social: 'Social',
  ironman: 'Ironman',
};

/** A per-clan crest, matched to the nav switcher so the same clan reads the same everywhere. */
function crestStyle(slug: string): React.CSSProperties {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 360;
  return { background: `linear-gradient(135deg, hsl(${h} 42% 40%), hsl(${(h + 34) % 360} 52% 54%))` };
}

function eventWhen(e: { startDate: string | null; endDate: string | null }): string {
  const now = new Date().toISOString();
  if (e.endDate && e.endDate < now) return 'finished';
  if (e.startDate && e.startDate > now) return 'upcoming';
  return 'live';
}

/**
 * The public face of a clan for someone who isn't in it — what the clan is, what it wants, that it's
 * alive. Members get the week view instead (app/page.tsx branches on the relationship).
 */
export default function PublicClanHome({ view, signedIn }: { view: View; signedIn: boolean }) {
  const reqs = view.requirements;
  const hasReqs = reqs.minTotal != null || reqs.minEhp != null || reqs.region != null || reqs.timezone != null;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Banner */}
      <div className="flex flex-col gap-5 rounded-2xl border border-card-border bg-gradient-to-br from-card-bg to-background p-6 sm:flex-row sm:items-center">
        <span
          aria-hidden
          className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-2xl font-bold text-white"
          style={crestStyle(view.slug)}
        >
          {view.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="display text-2xl font-semibold text-foreground sm:text-3xl">{view.name}</h1>
            {view.verified && (
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                ✓ verified in-game
              </span>
            )}
          </div>
          {view.tagline && <p className="mt-1.5 max-w-[60ch] text-[15px] text-text-muted">{view.tagline}</p>}
          {view.focus.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {view.focus.map((f) => (
                <span key={f} className="rounded-full bg-gold/10 px-2.5 py-1 text-[11px] font-medium text-gold">
                  {FOCUS_LABEL[f]}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-6 sm:flex-col sm:gap-3 sm:text-right">
          <div>
            <div className="text-xl font-bold tabular-nums text-foreground">{view.memberCount}</div>
            <div className="text-[11px] uppercase tracking-wide text-text-muted">members</div>
          </div>
          <div>
            <div className="text-xl font-bold tabular-nums text-foreground">{view.eventsRun}</div>
            <div className="text-[11px] uppercase tracking-wide text-text-muted">events run</div>
          </div>
        </div>
      </div>

      {/* Recruiting */}
      {view.recruiting && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-gold/30 bg-gold/[0.06] p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="text-sm font-semibold text-gold">This clan is recruiting</div>
            <div className="text-[13px] text-text-muted">
              {view.guestPolicy === 'closed'
                ? 'Applications are currently closed.'
                : view.guestPolicy === 'open'
                  ? 'Open to join — hop in.'
                  : 'New members are reviewed before joining.'}
            </div>
          </div>
          {view.guestPolicy !== 'closed' &&
            (view.discordInvite ? (
              <a
                href={view.discordInvite}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg bg-gold px-4 py-2 text-center text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light"
              >
                Apply on Discord
              </a>
            ) : !signedIn ? (
              <ClanLink
                href="/login"
                className="shrink-0 rounded-lg bg-gold px-4 py-2 text-center text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light"
              >
                Sign in to apply
              </ClanLink>
            ) : (
              // Signed in, no Discord invite. This was `null`: the "Sign in to apply" above led here
              // and the button vanished, leaving a panel that said the clan was recruiting with no
              // way to answer it. Signing in made the page strictly less useful than being signed out.
              <ApplyToClan slug={view.slug} clanName={view.name} />
            ))}
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {/* About */}
        <div className="md:col-span-2">
          {view.description ? (
            <div className="rounded-xl border border-card-border bg-card-bg p-5">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-5 w-1 rounded bg-gold" aria-hidden />
                <h2 className="text-sm font-semibold text-foreground">About</h2>
              </div>
              <p className="whitespace-pre-line text-[14px] leading-relaxed text-text-muted">{view.description}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-card-border bg-card-bg/50 p-5 text-[13px] text-text-muted">
              This clan hasn’t written an introduction yet.
            </div>
          )}

          {/* Recent events */}
          {view.recentEvents.length > 0 && (
            <div className="mt-4 rounded-xl border border-card-border bg-card-bg p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-5 w-1 rounded bg-gold" aria-hidden />
                <h2 className="text-sm font-semibold text-foreground">Recent events</h2>
              </div>
              <ul className="grid gap-1.5">
                {view.recentEvents.map((e) => {
                  const when = eventWhen(e);
                  return (
                    <li key={e.id} className="flex items-center gap-3 text-[13.5px]">
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          when === 'live'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : when === 'upcoming'
                              ? 'bg-gold/10 text-gold'
                              : 'bg-brown-light text-text-muted'
                        }`}
                      >
                        {when}
                      </span>
                      <span className="truncate text-foreground/90">{e.name}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Requirements + quick links */}
        <div className="grid content-start gap-4">
          {hasReqs && (
            <div className="rounded-xl border border-card-border bg-card-bg p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-5 w-1 rounded bg-gold" aria-hidden />
                <h2 className="text-sm font-semibold text-foreground">To join</h2>
              </div>
              <dl className="grid gap-2 text-[13px]">
                {reqs.minTotal != null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-text-muted">Min total level</dt>
                    <dd className="font-medium tabular-nums text-foreground">{reqs.minTotal.toLocaleString()}</dd>
                  </div>
                )}
                {reqs.minEhp != null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-text-muted">Min EHP</dt>
                    <dd className="font-medium tabular-nums text-foreground">{reqs.minEhp.toLocaleString()}</dd>
                  </div>
                )}
                {reqs.region && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-text-muted">Region</dt>
                    <dd className="font-medium text-foreground">{reqs.region}</dd>
                  </div>
                )}
                {reqs.timezone && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-text-muted">Timezone</dt>
                    <dd className="font-medium text-foreground">{reqs.timezone}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
          <div className="rounded-xl border border-card-border bg-card-bg p-2">
            <ClanLink href="/events" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium hover:bg-brown-light">
              🏆 Events
            </ClanLink>
            <ClanLink href="/members" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium hover:bg-brown-light">
              👥 Members
            </ClanLink>
            <ClanLink href="/leaderboard" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium hover:bg-brown-light">
              📊 Leaderboard
            </ClanLink>
          </div>
        </div>
      </div>
    </div>
  );
}
