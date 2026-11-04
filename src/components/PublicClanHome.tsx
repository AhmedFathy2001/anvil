import type { ReactNode } from 'react';
import MotionImg from '@/components/MotionImg';

import ClanLink from '@/components/ClanLink';
import ClanCrest from '@/components/ClanCrest';
import type { PublicClanActivity, PublicClanHome as View, ClanFocus } from '@/lib/clanHome';
import { SITE } from '@/lib/site';
import ApplyToClan from '@/components/ApplyToClan';
import ReportButton from '@/components/ReportButton';

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
}: {
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

  return (
    <div className="mx-auto max-w-4xl">
      {/* The clan's own banner, when it has one — the same always-3:1 frame as an event's (EventHero),
          so what the admin previewed is what shows. Animated uploads stay animated: a plain <img>. */}
      {view.bannerUrl && (
        <div className="relative mb-4 aspect-[3/1] w-full overflow-hidden rounded-2xl border border-card-border">
          <MotionImg
            src={view.bannerUrl}
            className="h-full w-full object-cover"
            style={{ objectPosition: `50% ${view.bannerPosition ?? 50}%` }}
          />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-5 rounded-2xl border border-card-border bg-gradient-to-br from-card-bg to-background p-6 sm:flex-row sm:items-center">
        {/* The clan's front door, and the place its own image matters most. */}
        <ClanCrest
          variant="letter"
          slug={view.slug}
          name={view.name}
          logoUrl={view.logoUrl ?? null}
          size={64}
          rounded="rounded-2xl"
          className="text-2xl"
        />
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
              className="shrink-0 rounded-lg border border-card-border px-4 py-2 text-center text-[13px] font-semibold transition-colors hover:border-gold/40 hover:text-gold"
            >
              Sign in to ask
            </ClanLink>
          )}
        </div>
      )}

      {activity && activity.live.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Happening now</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {activity.live.map((item) => (
              <ClanLink
                key={item.key}
                href={item.href}
                className="group flex flex-col gap-1.5 rounded-xl border border-emerald-500/30 bg-card-bg p-4 transition-colors hover:border-emerald-400/60 hover:bg-card-bg-hover"
              >
                <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-emerald-400">● Live · {item.kind}</span>
                <span className="display text-lg font-semibold">{item.name}</span>
                {item.top && (
                  <span className="text-[13.5px] text-text-muted">
                    Leading: <span className="text-foreground">{item.top.name}</span> · {item.top.text}
                  </span>
                )}
                {item.line && <span className="text-[12.5px] text-text-dim">{item.line}</span>}
                <span className="mt-1 text-[13px] text-gold group-hover:text-gold-light">See the standings →</span>
              </ClanLink>
            ))}
          </div>
        </section>
      )}

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
                      className="grid grid-cols-[1.75rem_1fr_auto] items-center gap-3 py-2 text-[14px] hover:text-gold"
                    >
                      <span className="font-mono text-text-dim">{i + 1}</span>
                      <span className="truncate">{p.rsn}</span>
                      <span className="font-mono text-gold">+{p.hours.toFixed(1)}h</span>
                    </ClanLink>
                  </li>
                ))}
              </ol>
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-[13px]">
                <ClanLink href="/members" className="text-gold hover:text-gold-light">
                  Full clan leaderboard
                </ClanLink>
                {/* The cross-clan pages stay one click away, but secondary: this page is about THIS clan. */}
                <ClanLink href={`/compare/clans?a=${encodeURIComponent(view.slug)}`} className="text-text-muted hover:text-gold">
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
            </section>
          )}

          {activity && activity.upcoming.length > 0 && (
            <section className="rounded-xl border border-card-border bg-card-bg p-5">
              <h2 className="mb-2 text-base font-semibold">Coming up</h2>
              <ul className="grid gap-2.5">
                {activity.upcoming.slice(0, 4).map((item) => (
                  <li key={item.key}>
                    <ClanLink href={item.href} className="group flex flex-col">
                      <span className="text-[14px] group-hover:text-gold">{item.name}</span>
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
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Recently finished</h2>
          <ul className="overflow-hidden rounded-xl border border-card-border bg-card-bg">
            {activity.past.map((item) => (
              <li key={item.key} className="border-t border-card-border/70 first:border-t-0">
                <ClanLink
                  href={item.href}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-card-bg-hover sm:grid-cols-[1fr_auto_4.5rem]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.name}</span>
                    <span className="block text-[12.5px] text-text-muted">{item.line}</span>
                  </span>
                  <span className="text-right text-[13.5px]">
                    {item.top ? (
                      <>
                        <span className="block">{item.top.name}</span>
                        <span className="block text-[12.5px] text-text-muted">{item.top.text}</span>
                      </>
                    ) : (
                      <span className="text-text-dim">no result</span>
                    )}
                  </span>
                  <span className="hidden text-right font-mono text-[12.5px] text-text-dim sm:block">
                    {item.when ? shortDate(item.when) : ''}
                  </span>
                </ClanLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Anvil, said once and quietly: this page is somebody else's clan, not an ad. */}
      <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-card-border bg-card-bg px-5 py-4 text-[13.5px]">
        <span className="min-w-0 flex-[1_1_22rem] text-text-muted">
          This page runs on Anvil, a free indie project for OSRS clans. Run your own bingos and competitions the
          same way.
        </span>
        <ClanLink href="/clans/new" className="text-gold hover:text-gold-light">
          Start a clan
        </ClanLink>
        <a href={SITE.supportDiscord} target="_blank" rel="noopener noreferrer" className="text-gold hover:text-gold-light">
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
