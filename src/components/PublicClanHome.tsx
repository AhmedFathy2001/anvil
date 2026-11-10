import type { ReactNode } from 'react';
import MotionImg from '@/components/MotionImg';

import ClanLink from '@/components/ClanLink';
import ClanCrest from '@/components/ClanCrest';
import type { PublicClanActivity, PublicClanHome as View, ClanFocus } from '@/lib/clanHome';
import { SITE } from '@/lib/site';
import ApplyToClan from '@/components/ApplyToClan';
import ReportButton from '@/components/ReportButton';
import { accentStyle } from '@/lib/accentStyle';
import type { Moment } from '@/lib/clanMomentsRules';
import { BoostedBadge, boostedClanNameStyle } from '@/components/ClanBoost';
import { SupporterStar } from '@/components/SupporterName';
import { boostNameClass, boostPerks } from '@/lib/clanBoostRules';

const FOCUS_LABEL: Record<ClanFocus, string> = {
  pvm: 'PvM',
  skilling: 'Skilling',
  pvp: 'PvP',
  social: 'Social',
  ironman: 'Ironman',
};

/** "Nov 7" — dates on this page are day-level; the event pages carry the times. */
function shortDate(iso: string): string {
  const t = Date.parse(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
}

/** "2 days ago" — the wall is about lately, so a relative time says it better than a date. */
function ago(iso: string, now: number): string {
  const t = Date.parse(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  if (!Number.isFinite(t)) return '';
  const h = Math.max(0, Math.round((now - t) / 3_600_000));
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/**
 * What the clan's members did lately (lib/clanMoments): the weightiest one big, the rest as tiles.
 * Game art only (our cached wiki icons), so nothing on the wall is a picture a member uploaded.
 */
function MomentsWall({ moments }: { moments: Moment[] }) {
  const now = Date.now();
  return (
    <section className="mt-10" aria-label="Moments">
      <h2 className="display mb-4 text-2xl font-semibold">Moments</h2>
      <ul className="grid auto-rows-[150px] grid-cols-2 gap-3 md:grid-cols-4">
        {moments.map((m, i) => {
          const big = i === 0 && moments.length >= 3;
          return (
            <li
              key={`${m.rsn}-${m.at}-${i}`}
              className={`relative flex flex-col justify-end overflow-hidden rounded-2xl border border-card-border p-4 ${big ? 'col-span-2 row-span-2 bg-[var(--sa-deep)]' : 'bg-card-bg'}`}
            >
              {m.iconUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- cached game art (lib/assetUrls)
                <img
                  src={m.iconUrl}
                  alt=""
                  className={`absolute right-4 top-4 object-contain [image-rendering:pixelated] ${big ? 'h-24 w-24' : 'h-11 w-11'}`}
                />
              )}
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--sa-text)]">{m.tag}</span>
              <span className={`display mt-1 font-semibold leading-tight ${big ? 'text-3xl' : 'line-clamp-2 text-lg'}`}>
                {/* Milestone sentences are written to follow a name ("hit 99 Slayer"); on a tile they lead. */}
                {m.text.charAt(0).toUpperCase() + m.text.slice(1)}
              </span>
              <span className="mt-1 truncate text-[13px] text-text-muted">
                {m.rsn} · {ago(m.at, now)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** A per-clan crest, matched to the nav switcher so the same clan reads the same everywhere. */


/**
 * The public face of a clan for someone who isn't in it — what the clan is, what it wants, that it's
 * alive. Members get the week view instead (app/page.tsx branches on the relationship).
 */
export default function PublicClanHome({
  view,
  signedIn,
  canReport = false,
  hall = null,
  activity = null,
  boost = null,
  boosters = null,
}: {
  /** Its boost level in force and (Level 2+) recruiting line (lib/clanBoosts). */
  boost?: { level: number; recruitingLine: string | null; nameStyle?: import('@/lib/clanBoostRules').ClanBoostNameStyle | null } | null;
  /** The boosters wall (components/ClanBoost ClanBoostPanel), when anyone boosts it. */
  boosters?: ReactNode;
  view: View;
  signedIn: boolean;
  /** Show the Report flag: signed in and not this clan's staff (lib/platformReportRules showReportButton). */
  canReport?: boolean;
  /** What a visitor can open: live, coming and finished competitions and the week's top players. */
  activity?: PublicClanActivity | null;
  /** Who's around right now (components/ClanHall), when the clan's Discord is connected. */
  hall?: ReactNode;
}) {
  const reqs = view.requirements;
  const hasReqs = reqs.minTotal != null || reqs.minEhp != null || reqs.region != null || reqs.timezone != null;
  const level = boost?.level ?? 0;
  const perks = boostPerks(level);

  return (
    <div className="mx-auto max-w-5xl" style={accentStyle(view.accent)}>
      {/* The clan's own banner (always 3:1, like an event's), or its colour as a board grid. Animated
          uploads stay animated. */}
      <div className="relative aspect-[3/1] max-h-[300px] w-full overflow-hidden rounded-3xl border border-card-border bg-[var(--sa-deep)]">
        {view.bannerUrl ? (
          <MotionImg
            src={view.bannerUrl}
            className="h-full w-full object-cover"
            style={{ objectPosition: `50% ${view.bannerPosition ?? 50}%` }}
            // An animated banner plays from boost Level 2; below that its still frame.
            still={!perks.animatedBanner}
          />
        ) : (
          <div
            className="h-full w-full"
            aria-hidden
            style={{
              backgroundImage: 'linear-gradient(#ffffff0d 1px, transparent 1px), linear-gradient(90deg, #ffffff0d 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
        )}
      </div>

      {/* Only the crest rides up over the banner; the name and numbers start below its edge. */}
      <header className="relative -mt-14 flex flex-wrap items-start gap-x-6 gap-y-3 px-4 sm:px-6">
        <div className="rounded-full border-[5px] border-background bg-background">
          {/* The clan's front door, and the place its own image matters most. */}
          <ClanCrest variant="letter" slug={view.slug} name={view.name} logoUrl={view.logoUrl ?? null} size={112} rounded="rounded-full" className="text-4xl" />
        </div>
        <div className="min-w-0 flex-[1_1_18rem] sm:pt-[4.25rem]">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className={`display text-4xl font-semibold leading-none sm:text-5xl ${perks.gradientName ? boostNameClass(level) : 'text-foreground'}`} style={boostedClanNameStyle(level, boost?.nameStyle)}>
              {view.name}
            </h1>
            <BoostedBadge level={level} />
            {view.tenure && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-medium text-gold-light" title={`This clan has paid for Anvil without a break: ${view.tenure.line.toLowerCase()}.`}>
                <SupporterStar size={13} decorative tenure={view.tenure.id} />
                {view.tenure.line}
              </span>
            )}
            {view.verified && (
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                ✓ verified in-game
              </span>
            )}
          </div>
          {view.tagline && <p className="mt-2 max-w-[60ch] text-[15px] text-text-muted">{view.tagline}</p>}
          {perks.recruitingLine && boost?.recruitingLine && (
            <p className="mt-2 max-w-[60ch] text-[14px] text-[#ffc2de]">
              <span className="mr-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#ff9cc8]">Recruiting</span>
              {boost.recruitingLine}
            </p>
          )}
          {view.focus.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {view.focus.map((f) => (
                <span key={f} className="rounded-full bg-[var(--sa-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--sa-text)]">
                  {FOCUS_LABEL[f]}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-6 text-right sm:pt-[4.75rem]">
          <div>
            <div className="text-2xl font-bold tabular-nums text-foreground">{view.memberCount}</div>
            <div className="text-[11px] uppercase tracking-wide text-text-muted">members</div>
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-foreground">{view.eventsRun}</div>
            <div className="text-[11px] uppercase tracking-wide text-text-muted">events run</div>
          </div>
        </div>
      </header>

      {hall && <div className="mt-4">{hall}</div>}

      {/* One line on the two ways in, before either door: a guest seat and membership look alike
          from outside, and only one of them is something this page can give. */}
      {(view.recruiting || view.guestPolicy !== 'closed') && (
        <p className="mt-4 text-[13px] text-text-muted">
          Members come from the clan&rsquo;s in-game member list. Guests can play the clan&rsquo;s events.
        </p>
      )}

      {/* Recruiting */}
      {view.recruiting && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[var(--sa)]/40 bg-[var(--sa-soft)] p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="text-sm font-semibold text-[var(--sa-text)]">This clan is recruiting</div>
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
                className="shrink-0 rounded-lg bg-[var(--sa)] px-4 py-2 text-center text-[13px] font-semibold text-[var(--sa-ink)] transition-opacity hover:opacity-90"
              >
                Apply on Discord
              </a>
            ) : !signedIn ? (
              <ClanLink
                href="/login"
                className="shrink-0 rounded-lg bg-[var(--sa)] px-4 py-2 text-center text-[13px] font-semibold text-[var(--sa-ink)] transition-opacity hover:opacity-90"
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

      {/* THE GUEST DOOR, which is not the recruiting one.
          
          Asking for a seat on this clan's site is not applying to their clan: it is how you play
          their events, get your drops counted on their board, and show up on their pages as a
          visitor. Membership comes from the in-game roster and nothing here can grant it.
          
          It used to have no door of its own. The only control on this page sat inside "This clan is
          recruiting" — so a clan that was not recruiting offered nothing, and a clan with a Discord
          invite offered "Apply on Discord", which answers a different question. Somebody who just
          wanted to play an event had nowhere to ask. */}
      {view.guestPolicy !== 'closed' && (!view.recruiting || !!view.discordInvite) && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-card-border bg-card-bg p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="text-sm font-semibold">Just want to play with them?</div>
            <div className="text-[13px] text-text-muted">
              {view.guestPolicy === 'open'
                ? `Ask to join as a guest and you can enter ${view.name}’s events. You stay in your own clan.`
                : `Ask to join as a guest — a moderator answers. You can then enter ${view.name}’s events, and you stay in your own clan.`}
            </div>
          </div>
          {signedIn ? (
            <ApplyToClan
              slug={view.slug}
              clanName={view.name}
              labels={{ open: 'Guest here', approval: 'Ask to guest' }}
            />
          ) : (
            <ClanLink
              href="/login"
              className="shrink-0 rounded-lg border border-card-border px-4 py-2 text-center text-[13px] font-semibold transition-colors hover:border-[var(--sa)] hover:text-[var(--sa-text)]"
            >
              Sign in to ask
            </ClanLink>
          )}
        </div>
      )}

      {activity && activity.live.length > 0 && (
        <section className="mt-10">
          <h2 className="display mb-4 text-2xl font-semibold">Happening now</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {activity.live.map((item) => (
              <ClanLink
                key={item.key}
                href={item.href}
                className="group flex flex-col gap-2 rounded-3xl border border-card-border bg-card-bg p-6 transition-colors hover:border-[var(--sa)]"
                style={{ backgroundImage: 'linear-gradient(var(--sa-soft), transparent 75%)' }}
              >
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sa-text)]">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
                  Live · {item.kind}
                </span>
                <span className="display text-3xl font-semibold leading-tight">{item.name}</span>
                {item.top && (
                  <span className="text-[14px] text-text-muted">
                    Leading: <span className="font-semibold text-foreground">{item.top.name}</span> · {item.top.text}
                  </span>
                )}
                {item.line && <span className="text-[13px] text-text-dim">{item.line}</span>}
                <span className="mt-2 text-sm font-medium text-[var(--sa-text)] group-hover:opacity-80">See the standings →</span>
              </ClanLink>
            ))}
          </div>
        </section>
      )}

      {activity && activity.moments.length > 0 && <MomentsWall moments={activity.moments} />}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="grid content-start gap-4 md:col-span-2">
          {activity && activity.week.top.length > 0 && (
            <section className="rounded-xl border border-card-border bg-card-bg p-5">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold">This clan&rsquo;s leaderboard</h2>
                <span className="text-[12.5px] text-text-muted">
                  this week · {activity.week.activeThisWeek} played
                </span>
              </div>
              <ol>
                {activity.week.top.map((p, i) => (
                  <li key={p.rsn} className="border-t border-card-border/70 first:border-t-0">
                    <ClanLink
                      href={`/members/${encodeURIComponent(p.rsn)}`}
                      className="grid grid-cols-[1.75rem_1fr_auto] items-center gap-3 py-2 text-[14px] hover:text-[var(--sa-text)]"
                    >
                      <span className="font-mono text-text-dim">{i + 1}</span>
                      <span className="truncate">{p.rsn}</span>
                      <span className="font-mono text-[var(--sa-text)]">+{p.hours.toFixed(1)}h</span>
                    </ClanLink>
                  </li>
                ))}
              </ol>
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-[13px]">
                <ClanLink href="/members" className="text-[var(--sa-text)] hover:opacity-80">
                  Full clan leaderboard
                </ClanLink>
                {/* The cross-clan pages stay one click away, but secondary: this page is about THIS clan. */}
                <ClanLink href={`/compare/clans?a=${encodeURIComponent(view.slug)}`} className="text-text-muted hover:text-[var(--sa-text)]">
                  Compare with another clan
                </ClanLink>
              </div>
            </section>
          )}

          {view.description ? (
            <section className="rounded-xl border border-card-border bg-card-bg p-5">
              <h2 className="mb-2 text-base font-semibold">About</h2>
              <p className="whitespace-pre-line text-[14px] leading-relaxed text-text-muted">{view.description}</p>
            </section>
          ) : (
            <div className="rounded-xl border border-dashed border-card-border bg-card-bg/50 p-5 text-[13px] text-text-muted">
              This clan hasn’t written an introduction yet.
            </div>
          )}
        </div>

        <div className="grid content-start gap-4">
          {view.heat && view.heat.on > 0 && (
            // The recruiting number: does anyone actually play here week after week?
            <section className="rounded-xl border border-card-border bg-card-bg p-5" aria-labelledby="clan-heat">
              <h2 id="clan-heat" className="mb-2 text-base font-semibold">How active</h2>
              <p className="flex items-baseline gap-2">
                <span className="font-mono text-3xl font-bold text-gold-light">{view.heat.pct}%</span>
                <span className="text-[13px] text-text-muted">of members play every week</span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-card-border" aria-hidden>
                <div className="h-full rounded-full bg-[#ff8a3d]" style={{ width: `${view.heat.pct}%` }} />
              </div>
              <p className="mt-2 text-[12.5px] text-text-muted">
                {view.heat.on} of {view.heat.total} on a weekly streak{view.heat.longest > 0 ? ` · longest ${view.heat.longest} weeks` : ''}
              </p>
            </section>
          )}
          {hasReqs && (
            <section className="rounded-xl border border-card-border bg-card-bg p-5">
              <h2 className="mb-3 text-base font-semibold">To join</h2>
              <dl className="grid gap-2 text-[13px]">
                {reqs.minTotal != null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-text-muted">Min total level</dt>
                    <dd className="font-medium tabular-nums text-foreground">{reqs.minTotal.toLocaleString()}</dd>
                  </div>
                )}
                {reqs.minEhp != null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-text-muted">Min hours played</dt>
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
            </section>
          )}

          {activity && activity.upcoming.length > 0 && (
            <section className="rounded-xl border border-card-border bg-card-bg p-5">
              <h2 className="mb-2 text-base font-semibold">Coming up</h2>
              <ul className="grid gap-2.5">
                {activity.upcoming.slice(0, 4).map((item) => (
                  <li key={item.key}>
                    <ClanLink href={item.href} className="group flex flex-col">
                      <span className="text-[14px] group-hover:text-[var(--sa-text)]">{item.name}</span>
                      <span className="text-[12.5px] text-text-muted">
                        {item.kind}
                        {item.when && <> · {shortDate(item.when)}</>}
                        {item.line && <> · {item.line}</>}
                      </span>
                    </ClanLink>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <nav aria-label={`${view.name} pages`} className="rounded-xl border border-card-border bg-card-bg p-2">
            <ClanLink href="/events" className="flex items-center rounded-lg px-3 py-2 text-[13.5px] font-medium hover:bg-brown-light">
              All their events
            </ClanLink>
            <ClanLink href="/members" className="flex items-center rounded-lg px-3 py-2 text-[13.5px] font-medium hover:bg-brown-light">
              Members
            </ClanLink>
          </nav>
        </div>
      </div>

      {activity && activity.past.length > 0 && (
        <section className="mt-10">
          <h2 className="display mb-4 text-2xl font-semibold">Recently finished</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activity.past.map((item) => (
              <li key={item.key}>
                <ClanLink
                  href={item.href}
                  className="flex h-full flex-col gap-2 rounded-2xl border border-card-border bg-card-bg p-5 transition-colors hover:border-[var(--sa)]"
                >
                  <span className="text-xs text-text-muted">
                    {item.when ? shortDate(item.when) : 'Finished'} · {item.kind}
                  </span>
                  <span className="display text-xl font-semibold leading-tight">{item.name}</span>
                  <span className="mt-auto flex items-center gap-2 pt-1 text-sm">
                    {item.top ? (
                      <>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[var(--sa-text)]" aria-hidden>
                          <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 5M17 6h3a3 3 0 0 1-3 5" />
                        </svg>
                        <span>
                          <b className="font-semibold">{item.top.name}</b> <span className="text-text-muted">won · {item.top.text}</span>
                        </span>
                      </>
                    ) : (
                      <span className="text-text-dim">{item.line || 'no result'}</span>
                    )}
                  </span>
                </ClanLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      {boosters}

      {/* Anvil, said once and quietly: this page is somebody else's clan, not an ad. */}
      <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-card-border bg-card-bg px-5 py-4 text-[13.5px]">
        <span className="min-w-0 flex-[1_1_22rem] text-text-muted">
          This page runs on Anvil, a free indie project for OSRS clans. Run your own bingos and competitions the
          same way.
        </span>
        <ClanLink href="/clans/new" className="text-[var(--sa-text)] hover:opacity-80">
          Start a clan
        </ClanLink>
        <a href={SITE.supportDiscord} target="_blank" rel="noopener noreferrer" className="text-[var(--sa-text)] hover:opacity-80">
          Join the Anvil Discord
        </a>
      </div>
      {/* To Anvil staff, not the clan (lib/platformReports). Signed-in visitors who don't run it. */}
      {canReport && (
        <div className="mt-3 flex justify-end">
          <ReportButton type="clan" id={view.id} label="Report this clan" />
        </div>
      )}
    </div>
  );
}
