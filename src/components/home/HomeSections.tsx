import Link from 'next/link';
import type { HomeEvent, HomeView, HomeWeekly, HomeYou } from '@/lib/homeView';

/**
 * The home page, in the pieces it's made of.
 *
 * Server components throughout — nothing here needs state, and the one thing that would (a live
 * countdown) already exists as EventTimer. What each piece is FOR:
 *
 *   hero      — the clan, in numbers, including how much it did this week
 *   you       — where the viewer stands in everything running at once
 *   live      — the two things worth opening today, or (when nothing is) what's next and what ended
 *   weeklies  — every Skill and Boss of the Week, finished ones included: a finished week carries a
 *               winner, a number and the shape of the week, which is the most interesting thing on
 *               the page for anyone who missed it
 *   events    — bingos, ladders and races, live and done
 *   clan week — the sweep's own daily rollup, so the page says what the clan actually did
 */

const short = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(Math.round(n));

const weekday = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });

/** The UTC day key `i` days into a competition — the sparkline's bars are aligned to its day range. */
const dayAt = (startIso: string, i: number) =>
  new Date(Date.parse(startIso) + i * 86_400_000).toISOString().slice(0, 10);

const dateShort = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function unitFor(w: HomeWeekly): string {
  return w.type === 'skill' ? 'XP' : w.type === 'boss' ? 'KC' : 'h';
}

function weeklyValue(w: HomeWeekly, value: number): string {
  if (w.type === 'efficiency') return `${(value / 1000).toFixed(1)}h`;
  return `${short(value)} ${unitFor(w)}`;
}

/* ---------------------------------------------------------------- hero ---- */

export function Hero({ view }: { view: HomeView }) {
  const { clanWeek, live } = view;
  const stats = [
    { k: 'Members', v: view.memberCount.toLocaleString(), sub: 'in the clan right now' },
    {
      k: 'Live events',
      v: String(view.liveEventCount),
      sub: view.liveEventCount > 0 ? 'running now' : 'nothing running',
      cls: view.liveEventCount > 0 ? 'text-gold-light' : '',
    },
    {
      k: 'This week',
      v: live.weekly ? live.weekly.metricLabel : 'Between weeks',
      sub: live.weekly ? `${live.weekly.entrants} scoring` : live.next ? `next one starts ${dateShort(live.next.startDate)}` : 'nothing scheduled',
      small: true,
    },
    {
      k: 'Clan XP this week',
      v: short(clanWeek.total),
      sub: clanWeek.deltaPct === null ? 'first tracked week' : `${clanWeek.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(clanWeek.deltaPct)}% on last week`,
      cls: 'text-accent-green-light',
      rule: true,
    },
    { k: 'Competitions run', v: String(view.competitionsRun), sub: 'every one of them below' },
  ];

  return (
    <section className="relative mb-4 overflow-hidden rounded-2xl border border-gold/25 bg-card-bg p-7 sm:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_10%_0%,rgba(212,175,55,0.17),transparent_60%),radial-gradient(90%_90%_at_90%_110%,rgba(45,133,68,0.14),transparent_66%)]" />
      <div className="relative">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold/70">OSRS clan events</span>
        <h1 className="mt-2 bg-gradient-to-b from-[#ffe9a8] via-[#f2c14e] to-[#c8962c] bg-clip-text text-4xl font-black leading-none tracking-tight text-transparent sm:text-6xl">
          {view.clanName}
        </h1>
        <p className="mt-3 max-w-[54ch] text-sm text-text-muted">
          Bingos, the ladder, Skill and Boss of the Week — and every result the clan has ever put up.
        </p>

        <div className="mt-6 flex flex-wrap gap-x-7 gap-y-5">
          {stats.map((s) => (
            <div key={s.k} className={s.rule ? 'border-l border-card-border pl-7' : ''}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{s.k}</div>
              <div className={`mt-1.5 font-mono font-bold leading-none tabular-nums ${s.small ? 'text-lg' : 'text-3xl'} ${s.cls ?? ''}`}>
                {s.v}
              </div>
              <div className="mt-1.5 text-[11.5px] text-text-muted">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- you ---- */

export function YouStrip({ you, discordInvite }: { you: HomeYou | null; discordInvite: string | null }) {
  if (!you) {
    return (
      <div className="mb-7 grid grid-cols-1 items-center gap-4 rounded-xl border border-gold/25 bg-gradient-to-r from-gold/10 to-card-bg p-3.5 sm:grid-cols-[1fr_auto]">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg border border-card-border bg-brown-dark/60 text-base">👤</span>
          <div>
            <div className="font-bold">Sign in to see your week</div>
            <div className="text-xs text-text-muted">Your rank in everything running, and your own gains</div>
          </div>
        </div>
        <Link
          href="/login"
          className="justify-self-start rounded-lg border border-gold/35 bg-gold/15 px-4 py-2 text-xs font-bold text-gold-light transition-colors hover:bg-gold/25 sm:justify-self-end"
        >
          Sign in with Discord
        </Link>
      </div>
    );
  }

  const pills = [
    you.weekly && {
      key: 'weekly',
      icon: you.weekly.iconUrl,
      emoji: null,
      label: you.weekly.label,
      value: `#${you.weekly.rank}`,
      sub: `of ${you.weekly.total}`,
    },
    you.ladder && {
      key: 'ladder',
      icon: null,
      emoji: '🪜',
      label: 'Ladder',
      value: `#${you.ladder.rank}`,
      sub: `of ${you.ladder.total}`,
    },
    you.xpThisWeek > 0 && {
      key: 'xp',
      icon: null,
      emoji: '📈',
      label: 'Your XP',
      value: short(you.xpThisWeek),
      sub: 'this week',
    },
    you.milestones > 0 && {
      key: 'ms',
      icon: null,
      emoji: '🏅',
      label: 'Milestones',
      value: String(you.milestones),
      sub: 'this week',
    },
  ].filter(Boolean) as { key: string; icon: string | null; emoji: string | null; label: string; value: string; sub: string }[];

  return (
    <div className="mb-7 grid grid-cols-1 items-center gap-4 rounded-xl border border-accent-green/25 bg-gradient-to-r from-accent-green/15 via-card-bg to-card-bg p-3.5 lg:grid-cols-[auto_1fr_auto]">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg border border-card-border bg-brown-dark/60 text-base">🔥</span>
        <div className="min-w-0">
          <div className="truncate font-bold">{you.rsn}</div>
          <div className="text-xs text-text-muted">
            {you.activeDays > 0 ? `${you.activeDays} of ${you.daysElapsed} days active this week` : 'nothing tracked this week yet'}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {pills.length === 0 ? (
          <span className="text-xs text-text-muted">Nothing scored yet — get on a board and this fills in.</span>
        ) : (
          pills.map((p) => (
            <span
              key={p.key}
              className="inline-flex items-center gap-2 rounded-full border border-card-border bg-brown-dark/50 px-3 py-1.5 text-xs text-text-muted"
            >
              {p.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.icon} alt="" className="h-4 w-4 object-contain" />
              ) : (
                <span aria-hidden>{p.emoji}</span>
              )}
              {p.label} <b className="font-mono font-bold text-foreground">{p.value}</b>
              <span className="text-text-muted/70">{p.sub}</span>
            </span>
          ))
        )}
      </div>

      <Link
        href="/profile"
        className="justify-self-start whitespace-nowrap rounded-lg border border-gold/35 bg-gold/15 px-4 py-2 text-xs font-bold text-gold-light transition-colors hover:bg-gold/25 lg:justify-self-end"
      >
        Your profile →
      </Link>
      {discordInvite === null && null}
    </div>
  );
}

/* ------------------------------------------------------------ live now ---- */

export function LiveNow({ view }: { view: HomeView }) {
  const { weekly, event, next, justFinished } = view.live;
  const anythingLive = !!weekly || !!event;

  return (
    <>
      <SectionHead
        title={anythingLive ? 'Happening now' : 'Nothing live right now'}
        note={anythingLive ? 'the things worth opening today' : 'what is next, and what just finished'}
      />
      <div className="mb-9 grid gap-3.5 lg:grid-cols-2">
        {weekly && <WeeklyLiveCard w={weekly} />}
        {event && <EventLiveCard e={event} />}
        {!anythingLive && next && <NextUpCard w={next} members={view.memberCount} />}
        {!anythingLive && justFinished && <JustFinishedCard w={justFinished} />}
        {!anythingLive && !next && !justFinished && (
          <div className="rounded-xl border border-dashed border-card-border px-5 py-10 text-center text-sm text-text-muted lg:col-span-2">
            No events or competitions yet — an admin can start one from the Admin tab.
          </div>
        )}
      </div>
    </>
  );
}

function CardShell({
  href,
  tone,
  children,
}: {
  href: string;
  tone: 'gold' | 'blue' | 'quiet';
  children: React.ReactNode;
}) {
  const toneCls =
    tone === 'gold'
      ? 'border-gold/30 bg-[radial-gradient(110%_90%_at_100%_0%,rgba(212,175,55,0.12),transparent_62%)]'
      : tone === 'blue'
        ? 'border-blue-400/25 bg-[radial-gradient(110%_90%_at_100%_0%,rgba(74,163,212,0.12),transparent_62%)]'
        : 'border-card-border';
  return (
    <Link
      href={href}
      className={`block rounded-2xl border bg-card-bg p-5 transition-colors hover:border-gold/50 ${toneCls}`}
    >
      {children}
    </Link>
  );
}

function WeeklyLiveCard({ w }: { w: HomeWeekly }) {
  const max = Math.max(...w.days, 1);
  return (
    <CardShell href={`/weekly/${w.id}`} tone="blue">
      <div className="flex items-start gap-3.5">
        {w.iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={w.iconUrl} alt="" className="h-10 w-10 shrink-0 object-contain" />
        )}
        <div className="min-w-0">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-accent-green-light">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-green-light" />
            Live
          </span>
          <h3 className="mt-1.5 truncate text-xl font-extrabold">{w.title}</h3>
          <p className="mt-0.5 text-[12.5px] text-text-muted">
            {w.entrants} scoring · ends {dateShort(w.endDate)}
          </p>
        </div>
      </div>

      {w.top && (
        <div className="mt-4 flex items-center gap-2.5 text-sm">
          <span aria-hidden>🥇</span>
          <span className="truncate font-semibold text-gold-light">{w.top.rsn}</span>
          <span className="ml-auto font-mono font-bold text-accent-green-light">{weeklyValue(w, w.top.value)}</span>
        </div>
      )}

      {w.days.length > 0 && (
        <>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
            the whole clan, day by day
          </p>
          <div className="mt-1.5 flex h-9 items-end gap-1">
            {w.days.map((d, i) => (
              <i
                key={i}
                title={`${weekday(dayAt(w.startDate, i))} · ${d > 0 ? `${short(d)} ${unitFor(w)}` : 'nothing'}`}
                className={`block flex-1 rounded-sm ${d === max ? 'bg-gold-light' : d > 0 ? 'bg-blue-400/50' : 'bg-card-border'}`}
                style={{ height: `${d > 0 ? Math.max(2, (d / max) * 36) : 2}px` }}
              />
            ))}
          </div>
        </>
      )}
    </CardShell>
  );
}

function EventLiveCard({ e }: { e: HomeEvent }) {
  return (
    <CardShell href={`/events/${e.id}`} tone="gold">
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-accent-green-light">
        <span className="h-1.5 w-1.5 rounded-full bg-accent-green-light" />
        Live
      </span>
      <h3 className="mt-1.5 truncate text-xl font-extrabold">{e.name}</h3>
      <p className="mt-0.5 text-[12.5px] text-text-muted">
        {e.shape}
        {e.chips.length > 0 && <> · {e.chips.join(' · ')}</>}
      </p>

      {e.top && (
        <>
          <div className="mt-4 flex items-center gap-2.5 text-sm">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: e.top.color }} />
            <span className="truncate">
              leading <b className="font-bold">{e.top.name}</b>
            </span>
            <span className="ml-auto shrink-0 font-mono font-bold" style={{ color: e.top.color }}>
              {e.top.score.toLocaleString()}
              <span className="font-normal text-text-muted">
                /{e.top.total.toLocaleString()} {e.top.unit}
              </span>
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brown-dark">
            <div
              className="h-full rounded-full"
              style={{ width: `${pct(e.top.score, e.top.total)}%`, backgroundColor: e.top.color }}
            />
          </div>
        </>
      )}
      <p className="mt-3 text-[11.5px] text-text-muted">{e.foot}</p>
    </CardShell>
  );
}

function NextUpCard({ w, members }: { w: HomeWeekly; members: number }) {
  return (
    <CardShell href={`/weekly/${w.id}`} tone="blue">
      <div className="flex items-start gap-3.5">
        {w.iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={w.iconUrl} alt="" className="h-10 w-10 shrink-0 object-contain" />
        )}
        <div className="min-w-0">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-blue-400">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            Next up
          </span>
          <h3 className="mt-1.5 truncate text-xl font-extrabold">{w.title}</h3>
          <p className="mt-0.5 text-[12.5px] text-text-muted">starts {dateShort(w.startDate)}</p>
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-[11.5px] text-text-muted">
          <span>Enrolled</span>
          <span>
            <b className="font-semibold text-foreground">{w.entrants}</b> of {members}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-brown-dark">
          <div className="h-full rounded-full bg-blue-400" style={{ width: `${pct(w.entrants, members)}%` }} />
        </div>
      </div>
    </CardShell>
  );
}

function JustFinishedCard({ w }: { w: HomeWeekly }) {
  return (
    <CardShell href={`/weekly/${w.id}`} tone="quiet">
      <div className="flex items-start gap-3.5">
        {w.iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={w.iconUrl} alt="" className="h-10 w-10 shrink-0 object-contain opacity-80" />
        )}
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">Just finished</span>
          <h3 className="mt-1.5 truncate text-xl font-extrabold">{w.title}</h3>
          <p className="mt-0.5 text-[12.5px] text-text-muted">
            {dateShort(w.startDate)} – {dateShort(w.endDate)} · {w.entrants} scored
          </p>
        </div>
      </div>
      {w.top && (
        <div className="mt-4 flex items-center gap-2.5 text-sm">
          <span aria-hidden>🥇</span>
          <span className="truncate font-semibold text-gold-light">{w.top.rsn}</span>
          <span className="ml-auto font-mono font-bold text-accent-green-light">{weeklyValue(w, w.top.value)}</span>
        </div>
      )}
    </CardShell>
  );
}

/* ------------------------------------------------------------ weeklies ---- */

export function WeeklyRail({ weeklies }: { weeklies: HomeWeekly[] }) {
  if (weeklies.length === 0) return null;
  return (
    <>
      <SectionHead
        title="Weekly events, past and present"
        note="Skill and Boss of the Week"
        more={{ href: '/weekly', label: 'All competitions →' }}
      />
      <div className="mb-9 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(232px,1fr))]">
        {weeklies.map((w) => {
          const max = Math.max(...w.days, 1);
          const state = w.status === 'active' ? 'live' : w.status === 'upcoming' ? 'next' : 'done';
          return (
            <Link
              key={w.id}
              href={`/weekly/${w.id}`}
              className={`block rounded-xl border p-4 transition-colors ${
                state === 'live'
                  ? 'border-accent-green/40 bg-gradient-to-b from-accent-green/10 to-card-bg'
                  : state === 'next'
                    ? 'border-blue-400/35 bg-card-bg'
                    : 'border-card-border bg-card-bg opacity-90 hover:opacity-100'
              } hover:border-gold/45`}
            >
              <div className="flex items-center gap-2.5">
                {w.iconUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.iconUrl} alt="" className="h-7 w-7 shrink-0 object-contain" />
                )}
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.13em] text-text-muted">{w.kind}</div>
                  <div className="truncate text-[14.5px] font-bold">{w.metricLabel}</div>
                </div>
                <span
                  className={`ml-auto shrink-0 rounded-full px-2 py-[3px] text-[9.5px] font-bold uppercase tracking-wider ${
                    state === 'live'
                      ? 'bg-accent-green/20 text-accent-green-light'
                      : state === 'next'
                        ? 'bg-blue-500/15 text-blue-400'
                        : 'bg-card-border/70 text-text-muted'
                  }`}
                >
                  {state === 'live' ? 'Live' : state === 'next' ? 'Next up' : 'Finished'}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2 text-[12.5px]">
                {w.top ? (
                  <>
                    <span aria-hidden>{state === 'live' ? '👑' : '🥇'}</span>
                    <span className="truncate font-bold">{w.top.rsn}</span>
                    <span className="ml-auto shrink-0 font-mono font-bold text-gold-light">
                      {weeklyValue(w, w.top.value)}
                    </span>
                  </>
                ) : (
                  <span className="text-text-muted">nobody has scored yet</span>
                )}
              </div>

              <div className="mt-2.5 flex h-[30px] items-end gap-[3px]">
                {(w.days.length > 0 ? w.days : new Array(7).fill(0)).map((d, i) => (
                  <i
                    key={i}
                    className={`block flex-1 rounded-t-[3px] ${
                      w.days.length === 0
                        ? 'bg-card-border/40'
                        : d === max
                          ? 'bg-gold/60'
                          : state === 'live'
                            ? 'bg-accent-green/50'
                            : 'bg-text-muted/40'
                    }`}
                    style={{ height: `${w.days.length === 0 ? 3 : d > 0 ? Math.max(1, (d / max) * 30) : 1}px` }}
                  />
                ))}
              </div>

              <div className="mt-2.5 flex flex-wrap gap-x-2.5 text-[11.5px] text-text-muted">
                <span>{w.entrants} entered</span>
                <span aria-hidden>·</span>
                <span>
                  {dateShort(w.startDate)} – {dateShort(w.endDate)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

/* -------------------------------------------------------------- events ---- */

export function EventGrid({ events }: { events: HomeEvent[] }) {
  if (events.length === 0) return null;
  return (
    <>
      <SectionHead title="Events" note="bingos, ladders and races" more={{ href: '/events', label: 'All events →' }} />
      <div className="mb-9 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(268px,1fr))]">
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/events/${e.id}`}
            className={`block rounded-xl border border-card-border bg-card-bg p-4 transition-colors hover:border-gold/45 ${
              e.status === 'past' ? 'opacity-85 hover:opacity-100' : ''
            }`}
          >
            <div className="flex items-baseline gap-2">
              <span className="truncate text-[15px] font-bold">{e.name}</span>
              <span
                className={`ml-auto shrink-0 rounded-full px-2 py-[3px] text-[9.5px] font-bold uppercase tracking-wider ${
                  e.status === 'live' ? 'bg-accent-green/20 text-accent-green-light' : 'bg-card-border/70 text-text-muted'
                }`}
              >
                {e.status === 'live' ? 'Live' : 'Done'}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full border border-gold/20 bg-gold/15 px-2 py-[2.5px] text-[10.5px] text-gold-light">
                {e.shape}
              </span>
              {e.chips.map((c) => (
                <span key={c} className="rounded-full border border-card-border bg-brown-dark/50 px-2 py-[2.5px] text-[10.5px] text-text-muted">
                  {c}
                </span>
              ))}
            </div>

            {e.top && (
              <>
                <div className="mt-3 flex items-center gap-2 text-[12.5px]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: e.top.color }} />
                  <span className="min-w-0 truncate">
                    {e.status === 'live' ? 'leading' : 'won by'} <b className="font-bold">{e.top.name}</b>
                  </span>
                  <span className="ml-auto shrink-0 whitespace-nowrap font-mono font-bold" style={{ color: e.top.color }}>
                    {e.top.score.toLocaleString()}
                    <span className="font-normal text-text-muted">
                      /{e.top.total.toLocaleString()} {e.top.unit}
                    </span>
                  </span>
                </div>
                <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-brown-dark">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct(e.top.score, e.top.total)}%`, backgroundColor: e.top.color }}
                  />
                </div>
              </>
            )}
            <p className="mt-2.5 text-[11.5px] text-text-muted">{e.foot}</p>
          </Link>
        ))}
      </div>
    </>
  );
}

/* ----------------------------------------------------------- clan week ---- */

export function ClanWeek({ view }: { view: HomeView }) {
  const { clanWeek, milestones } = view;
  if (clanWeek.total === 0 && milestones.length === 0) return null;
  const max = Math.max(...clanWeek.days.map((d) => d.xp), 1);
  const bestIdx = clanWeek.days.findIndex((d) => d.xp === max);

  return (
    <>
      <SectionHead title="This week in the clan" note="every gain the sweep recorded, rolled up" />
      <div className="grid gap-3.5 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-2xl border border-card-border bg-card-bg p-5">
          <h3 className="text-sm font-bold">Clan XP, day by day</h3>
          <p className="mt-0.5 text-[11.5px] text-text-muted">
            {short(clanWeek.total)} XP across {view.memberCount} members
            {clanWeek.total > 0 && (
              <>
                {' '}· biggest day was <b className="font-semibold text-foreground">{weekday(clanWeek.days[bestIdx].day)}</b>
              </>
            )}
          </p>
          <div className="mt-4 grid h-32 grid-cols-7 gap-2">
            {clanWeek.days.map((d, i) => (
              <div key={d.day} className="grid grid-rows-[auto_minmax(0,1fr)_auto] gap-1.5">
                <span className={`text-center font-mono text-[11px] font-bold ${d.xp === 0 ? 'text-text-muted' : ''}`}>
                  {d.xp === 0 ? '—' : short(d.xp)}
                </span>
                <span className="flex items-end">
                  <i
                    className={`block w-full rounded-t-md ${
                      i === clanWeek.days.length - 1
                        ? 'bg-gradient-to-b from-gold-light to-gold-dark/30'
                        : 'bg-gradient-to-b from-accent-green/75 to-accent-green/25'
                    }`}
                    style={{ height: `${d.xp === 0 ? 2 : Math.max(2, (d.xp / max) * 100)}%`, opacity: d.xp === 0 ? 0.25 : 1 }}
                  />
                </span>
                <span className="text-center text-[10px] text-text-muted">{weekday(d.day)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-card-border bg-card-bg p-5">
          <h3 className="text-sm font-bold">Milestones</h3>
          <p className="mt-0.5 text-[11.5px] text-text-muted">levels and thresholds crossed this week</p>
          <div className="mt-2.5">
            {milestones.length === 0 ? (
              <p className="py-4 text-center text-xs text-text-muted">Nothing crossed yet this week.</p>
            ) : (
              milestones.map((m, i) => (
                <div key={i} className="flex items-center gap-2.5 border-t border-card-border/60 py-2 text-[12.5px] first:border-t-0">
                  {m.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.iconUrl} alt="" className="h-[18px] w-[18px] shrink-0 object-contain" />
                  ) : (
                    <span aria-hidden>🏅</span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-text-muted">
                    <b className="font-semibold text-foreground">{m.rsn}</b> {m.text}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-text-muted">{weekday(m.day)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* --------------------------------------------------------------- bits ----- */

function SectionHead({
  title,
  note,
  more,
}: {
  title: string;
  note?: string;
  more?: { href: string; label: string };
}) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-3">
      <h2 className="flex items-center gap-2 text-[17px] font-extrabold">
        <span className="h-5 w-1 rounded-full bg-gold" />
        {title}
      </h2>
      {note && <span className="text-xs text-text-muted">{note}</span>}
      {more && (
        <Link href={more.href} className="ml-auto text-xs text-text-muted transition-colors hover:text-gold">
          {more.label}
        </Link>
      )}
    </div>
  );
}

const pct = (score: number, total: number) => (total > 0 ? Math.min(100, Math.round((score / total) * 100)) : 0);
