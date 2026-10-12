'use client';

import React, { useMemo, useState } from 'react';
import { ActivityHeatmap, Bar, LineChart, ProgressRing } from '@/components/stats/Charts';
import { SKILL_LABELS, BOSSES } from '@/lib/constants';
import { progressToLevel } from '@/lib/xp';
import CollectionLog, { type CollectionLogProps } from './CollectionLog';
import PersonalLuck from './PersonalLuck';
import StatsBrowser from './StatsBrowser';
import { statTrends } from '@/lib/statTrends';
import { setUrlParams } from '@/lib/urlState';
import { activityImageUrl, bossImageForStatKey, itemIconUrl, skillIconUrl } from '@/lib/tileIcons';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { TAB_SLUG, type ProfileLinkState, type ProfileTab } from '@/lib/profileLink';
import LocalTime from '@/components/LocalTime';
import Input from '@/components/Input';
import { momentSentence } from '@/lib/moments';
import type { MomentRow } from '@/lib/momentsStore';
import type {
  ActivityStanding,
  CompetitionHistory,
  UpcomingMilestone,
  DailyPoint,
  AccountProfile,
  MilestoneRow,
  PeriodRecord,
} from '@/lib/memberProfile';

// Every tab renders from data the server already sent, so switching is instant and costs nothing.
// The whole payload is one member's snapshot plus at most a year of ~50-byte daily rows — smaller
// than the images on the page — which is what makes fetching it all up front the cheap option.

type Tab = ProfileTab;
type Metric = 'ehp' | 'ehb' | 'xp';
type Window = 7 | 30 | 90;

/** Days in the activity grid — a year, the way a contribution graph is normally read. */
const HEATMAP_DAYS = 365;
/** Beside the tabs: six months, drawn fluid so it fits the column with no scrollbar. */
const SIDE_HEAT_DAYS = 182;

/**
 * Four tabs, one question each.
 *
 * Seven was a filing cabinet: Stats, Activities and Progress were three answers to "how are they
 * doing", and Bests and Milestones were two answers to "what have they done". Splitting those made
 * every one of them thin — a tab you visit once, find two numbers in, and never open again.
 */
const TABS: { key: Tab; label: string }[] = [
  { key: 'stats', label: 'Overview' },
  { key: 'records', label: 'Records' },
  { key: 'collection', label: 'Collection' },
  // Luck earns a tab rather than a corner of the log: it answers a different question ("am I dry?")
  // and has its own per-item breakdown, which was never going to fit above the grid.
  { key: 'luck', label: 'Luck' },
  { key: 'trophies', label: 'Trophies' },
];

const bossLabel = (key: string) => BOSSES.find((b) => b.key === key)?.label ?? key;
const SKULL_ICON = 'https://oldschool.runescape.wiki/images/Skull_(status)_icon.png';

function fmtXp(xp: number): string {
  if (xp >= 1_000_000_000) return `${(xp / 1_000_000_000).toFixed(2)}B`;
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(2)}M`;
  if (xp >= 1_000) return `${(xp / 1_000).toFixed(1)}K`;
  return Math.round(xp).toLocaleString();
}

const shortDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

function milestoneText(m: MilestoneRow): string {
  const label = m.metric ? (SKILL_LABELS[m.metric] ?? bossLabel(m.metric)) : null;
  switch (m.kind) {
    case 'level':
      return `${m.threshold} ${label}`;
    case 'xp':
      return `${fmtXp(m.threshold)} ${label} XP`;
    case 'kc':
      return `${m.threshold.toLocaleString()} ${label} kills`;
    case 'ehp':
      return `${m.threshold.toLocaleString()} efficient hours played`;
    case 'ehb':
      return `${m.threshold.toLocaleString()} efficient hours bossed`;
    default:
      return `${m.kind} ${m.threshold}`;
  }
}

/**
 * Where a member sits in the clan for one activity. Renders a dash rather than "#1 of 1" when
 * they're the only person with any — a placing among one is a fact about the clan, not about them.
 */
/**
 * The last fortnight as bars — the "are they still playing" answer, before any number is read.
 *
 * Deliberately not the heatmap: a year of squares shows a career, and the question a profile is
 * usually opened to answer is about this week. Zero days keep a stub bar so a gap reads as a day
 * off rather than a rendering hole.
 */
function FormStrip({ series }: { series: DailyPoint[] }) {
  const days = useMemo(() => {
    const byDay = new Map(series.map((p) => [p.day, p.ehpGained + p.ehbGained]));
    const out: { day: string; hours: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      out.push({ day, hours: byDay.get(day) ?? 0 });
    }
    return out;
  }, [series]);

  const max = Math.max(...days.map((d) => d.hours), 0.01);
  const best = days.reduce((b, d) => (d.hours > b.hours ? d : b), days[0]);
  const quiet = days.filter((d) => d.hours === 0).length;
  const weekday = (day: string) =>
    new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short' });

  return (
    <div className="border border-card-border rounded-xl bg-card-bg p-4">
      <div className="text-[11px] uppercase tracking-widest text-text-muted mb-3">
        Form · last 14 days
      </div>
      <div className="flex items-end gap-1 h-14">
        {days.map((d) => (
          <span
            key={d.day}
            className={`flex-1 rounded-t-sm ${
              d.hours === 0 ? 'bg-tile-bg' : d.hours >= max * 0.85 ? 'bg-gold' : 'bg-gold-dark'
            }`}
            style={{ height: d.hours === 0 ? '6%' : `${Math.max(10, (d.hours / max) * 100)}%` }}
            title={`${d.day} · ${d.hours.toFixed(2)}h`}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-text-muted mt-2">
        <span>{quiet === 0 ? 'played every day' : `${quiet} quiet ${quiet === 1 ? 'day' : 'days'}`}</span>
        {best && best.hours > 0 && (
          <span className="tabular-nums">
            best: {best.hours.toFixed(1)}h on {weekday(best.day)}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Rows past this many scroll inside the card instead of stretching the page.
 *
 * A profile stacks a 24-row skill table, a 60-row boss table and a milestone log; rendered whole,
 * reaching the tab under them meant a dozen flicks of the wheel. The header row stays put — it's a
 * sibling of the scroll container, not inside it — so a scrolled table never loses its labels.
 */
function Rows({ children, cap, rowPx = 37 }: { children: React.ReactNode; cap: number; rowPx?: number }) {
  const count = React.Children.count(children);
  return (
    <div className="overflow-y-auto" style={{ maxHeight: count > cap ? cap * rowPx : undefined }}>
      {children}
    </div>
  );
}

/**
 * The "Lately" gutter label, per kind.
 *
 * A lookup rather than nested ternaries because there are six of these now: the three the player
 * worked toward (a best, a milestone, an unlock) and the three that happened to them (a drop, a
 * combat task, a death). Colour carries the same split — gold and purple for earned, green for
 * arrived, red for the one nobody is celebrating.
 */
const LATELY_KIND: Record<string, { label: string; tone: string }> = {
  time: { label: 'Best', tone: 'text-gold' },
  unlock: { label: 'Unlock', tone: 'text-purple-300' },
  milestone: { label: 'Milestone', tone: 'text-accent-green-light' },
  drop: { label: 'Drop', tone: 'text-gold' },
  task: { label: 'Task', tone: 'text-purple-300' },
  death: { label: 'Death', tone: 'text-red-400' },
};

function Section({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1 h-5 bg-gold rounded-full" />
        <h2 className="text-lg font-bold">{title}</h2>
        {aside && <span className="text-xs text-text-muted">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

export default function ProfileTabs({
  profile,
  series,
  records,
  milestones,
  history,
  upcoming,
  activityStandings,
  collection,
  moments,
  accountProgress,
  initial,
  bossPages,
}: {
  /**
   * ACCOUNT-level, not seat-level. Everything drawn here — skills, bosses, activities, efficiency —
   * comes off the character, so the apex's /p/<rsn> renders exactly the same tabs with no clan
   * behind it. Narrowing the prop is what proved that: nothing in this file wanted the seat.
   */
  profile: AccountProfile;
  series: DailyPoint[];
  records: PeriodRecord[];
  milestones: MilestoneRow[];
  history: CompetitionHistory;
  upcoming: UpcomingMilestone[];
  activityStandings: Record<string, ActivityStanding>;
  /** The synced collection log + best times. Its own tab because it's a page's worth of grid. */
  collection: CollectionLogProps;
  /** Drops, pets and combat tasks we watched happen — see lib/moments. Merged into "Lately". */
  moments: MomentRow[];
  /** Quests / diaries / combat achievements, drawn game-style. Rendered above the log. */
  accountProgress?: React.ReactNode;
  /** Where to open — from the URL (`?tab=&stat=&page=`), so a tab, a stat view or a log page links. */
  initial?: ProfileLinkState;
  /** Boss key → its collection log page, so a boss in the stats links to its log. */
  bossPages?: Record<string, string>;
}) {
  const [tab, setTabState] = useState<Tab>(initial?.tab ?? 'stats');
  // The tab is part of the address: copy the URL and the person you send it to lands here too.
  const setTab = (next: Tab) => {
    setTabState(next);
    // A log page only means something on the Collection tab; leaving it, the link stops naming one.
    setUrlParams({ tab: next === 'stats' ? null : TAB_SLUG[next], stat: null, ...(next === 'collection' ? {} : { page: null }) });
  };
  const trends = useMemo(() => statTrends(series), [series]);
  // The log page the Collection tab opens on: the link's, or one a boss in the stats asked for.
  const [logPage, setLogPage] = useState<string | undefined>(initial?.page);
  const openLogPage = (page: string) => {
    setLogPage(page);
    setTabState('collection');
    setUrlParams({ tab: 'collection', stat: null, page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // Whether the side column is beside the tabs (lg+) — it only has room for part of the year there.
  const wide = useMediaQuery('(min-width: 1024px)');
  const [bestFilter, setBestFilter] = useState('');
  const [metric, setMetric] = useState<Metric>('ehp');
  const [days, setDays] = useState<Window>(30);

  /**
   * One dated stream of everything they've achieved, newest first.
   *
   * Times and milestones are the same kind of news — "I did a thing, on a day" — and splitting them
   * across two lists meant neither could answer "what has this person been up to?". Undated entries
   * are left out rather than dated to now: a personal best imported from a client we've never seen
   * set could be years old.
   */
  const recentFeed = useMemo(() => {
    const entries: {
      key: string;
      kind: 'time' | 'milestone' | 'unlock' | 'drop' | 'task' | 'death';
      label: string;
      value: string | null;
      at: string;
      /** The game picture for the row: the item, the boss, the skill. */
      icon: string | null;
    }[] = [];
    for (const b of collection.bests) {
      if (b.at) {
        entries.push({ key: `pb-${b.activity}`, kind: 'time', label: b.activity, value: b.time, at: b.at, icon: activityImageUrl(b.activity) });
      }
    }
    for (const m of milestones) {
      entries.push({
        key: `ms-${m.kind}-${m.metric ?? ''}-${m.threshold}`,
        kind: 'milestone',
        label: milestoneText(m),
        value: null,
        at: m.noticedAt,
        icon: m.metric ? (skillIconUrl(m.metric) ?? bossImageForStatKey(m.metric)) : skillIconUrl('overall'),
      });
    }
    // Collection-log unlocks. This list read as "records only" while the Collection tab, one click
    // away, knew the exact day someone got their Ancestral bottom — the drop is the thing a player
    // actually wants dated, and it was the one thing missing. Only unlocks we WITNESSED carry a date
    // (`clogProfile` already filters on firstSeenAt), so a first sync can't backfill years of items
    // into "Lately" as if they happened today.
    for (const u of collection.recent) {
      entries.push({
        key: `clog-${u.itemId}`,
        kind: 'unlock',
        label: u.name,
        // The KC is the story on a drop — 12 KC is a spoon, 1,400 is a drought. Null where the item
        // arrived in a bulk sync and the log can't say which kill produced it.
        value: u.kcAtUnlock != null ? `${u.kcAtUnlock.toLocaleString()} KC` : null,
        at: u.at,
        icon: itemIconUrl(u.itemId),
      });
    }
    // Drops, pets and combat tasks. The other three sources are all things the player WORKED
    // toward; these are the things that happened TO them, which is the half of "what have you been
    // up to?" the feed was missing — and, since the clan backstop, the half that keeps arriving on
    // a week with no competition and no board running.
    for (const m of moments) {
      entries.push({
        key: `moment-${m.id}`,
        kind: m.kind === 'ca' ? 'task' : m.kind === 'death' ? 'death' : 'drop',
        label: momentSentence(m),
        // The KC is the story on a drop, the same as it is on a log unlock above.
        value: m.kc != null && m.kc > 0 ? `${m.kc.toLocaleString()} KC` : null,
        at: m.occurredAt,
        icon:
          m.kind === 'death'
            ? SKULL_ICON
            : m.itemId != null
              ? itemIconUrl(m.itemId)
              : null,
      });
    }
    // Everything we have, newest first; the list shows a page at a time. It stopped at twelve, and the
    // plugin's "See all" lands here — on twelve.
    return entries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200);
  }, [collection.bests, collection.recent, milestones, moments]);

  const [latelyFilter, setLatelyFilter] = useState<'all' | 'drops' | 'bests' | 'milestones'>('all');
  const [latelyShown, setLatelyShown] = useState(12);
  const latelyRows = useMemo(() => {
    const keep: Record<typeof latelyFilter, (k: string) => boolean> = {
      all: () => true,
      drops: (k) => k === 'unlock' || k === 'drop',
      bests: (k) => k === 'time',
      milestones: (k) => k === 'milestone' || k === 'task',
    };
    return recentFeed.filter((e) => keep[latelyFilter](e.kind));
  }, [recentFeed, latelyFilter]);

  const shownTimes = useMemo(() => {
    const q = bestFilter.trim().toLowerCase();
    return q ? collection.bests.filter((b) => b.activity.toLowerCase().includes(q)) : collection.bests;
  }, [collection.bests, bestFilter]);

  const eff = profile.efficiency;

  // The three skills closest to 99, by XP remaining rather than levels remaining — 98 to 99 is a
  // seventh of the entire skill, so counting levels would rank someone at 98 beside someone at 92.
  const nearest99s = useMemo(() => {
    return profile.skills
      .map((s) => ({ skill: s, prog: progressToLevel(s.xp, 99) }))
      .filter((r) => r.prog.progress < 1 && r.skill.xp > 0)
      .sort((a, b) => a.prog.xpToNext - b.prog.xpToNext)
      .slice(0, 3);
  }, [profile.skills]);


  const windowed = useMemo(() => series.slice(-days), [series, days]);
  const chartPoints = useMemo(
    () =>
      windowed.map((p) => ({
        label: shortDay(p.day),
        value: metric === 'xp' ? p.xpGained : metric === 'ehp' ? p.ehpGained : p.ehbGained,
      })),
    [windowed, metric],
  );
  // The heatmap always draws the full 90-day calendar, even on an instance that only started
  // tracking yesterday. An empty cell reads as "nothing happened", which is exactly right; one lone
  // square floating in a blank card reads as a broken chart.
  //
  // The line chart deliberately does NOT do this: a flat zero line claims they were inactive, and for
  // days before tracking began we simply weren't looking. Empty grid, honest chart.
  const heatDays = useMemo(() => {
    // A year, not a quarter: 90 columns of 12px squares occupy a third of the card and read as a
    // fragment. Twelve months is also the window that makes a break in play visible.
    const byDay = new Map(series.map((p) => [p.day, p.ehpGained + p.ehbGained]));
    const out: { day: string; value: number }[] = [];
    for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      out.push({ day, value: byDay.get(day) ?? 0 });
    }
    return out;
  }, [series]);
  const windowTotal = chartPoints.reduce((sum, p) => sum + p.value, 0);
  // How much history there is to draw. A brand-new install has a day or two, and a heatmap of 90
  // empty squares looks broken rather than new — so say which it is.
  const activeDays = series.filter((p) => p.ehpGained + p.ehbGained + p.xpGained > 0).length;
  const trackedFor = series.length;
  const totalWins = history.eventWins + history.weeklyWins;
  const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`);


  const chip = (active: boolean) =>
    `px-2.5 py-1 text-xs rounded-md border transition-colors ${
      active ? 'bg-gold/20 border-gold text-gold' : 'border-card-border text-text-muted hover:border-gold/50'
    }`;

  return (
    <>
      {/* Wraps rather than scrolls: an overflow container renders a scrollbar gutter across the whole
          strip, which on a five-tab row that already fits is a scrollbar for nothing. */}
      <div className="flex flex-wrap gap-1 border-b border-card-border mb-6" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-gold text-gold font-medium'
                : 'border-transparent text-text-muted hover:text-foreground'
            }`}
          >
            {t.label}
            {t.key === 'records' && milestones.length > 0 && (
              <span className="ml-1.5 text-[10px] text-text-muted">{milestones.length}</span>
            )}
            {t.key === 'trophies' && totalWins > 0 && (
              <span className="ml-1.5 text-[10px] text-gold">{totalWins}🏆</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'luck' &&
        // PersonalLuck draws nothing when no item has a rate to compare against, so the empty state
        // has to cover that case too — a blank tab looked like a broken page.
        (collection.luck && collection.luck.total.items > 0 && collection.luck.total.expected > 0 ? (
          <PersonalLuck {...collection.luck} full />
        ) : (
          <div className="border border-dashed border-card-border rounded-xl p-8 text-center text-sm text-text-muted">
            No luck to read yet — it needs a synced collection log and kills at something the rates
            cover.
          </div>
        ))}

      {tab === 'stats' && (
        <>
          {/* Recent form first, career second — the two questions in the order they're asked. */}
          <div className="grid lg:grid-cols-2 gap-4 mb-8">
            <FormStrip series={series} />
            {nearest99s.length > 0 && (
              <div className="border border-card-border rounded-xl bg-card-bg p-4">
                <div className="text-[11px] uppercase tracking-widest text-text-muted mb-3">
                  Closest to 99
                </div>
                {/* Stacked, not side-by-side: three rings with the label beside them inside a
                    half-width card truncated every skill name to "99 Stren…". */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  {nearest99s.map(({ skill, prog }) => (
                    <div key={skill.key}>
                      <div className="flex justify-center">
                        <ProgressRing progress={prog.progress} label="" sub="" size={52} />
                      </div>
                      <div className="text-sm font-medium mt-2">99 {SKILL_LABELS[skill.key] ?? skill.key}</div>
                      <div className="text-xs text-text-muted">
                        {fmtXp(prog.xpToNext)} to go · lvl {prog.level}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* The numbers on the left change with the tab; the two pictures on the right are the whole
              account and don't — so they sit beside the tabs rather than under them, and stay in view
              while the list scrolls. Stacked again below lg, where there's no room beside anything. */}
          <div className="grid items-start gap-x-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              <StatsBrowser profile={profile} trends={trends} standings={activityStandings} initial={initial?.stat} bossPages={bossPages} onOpenLogPage={openLogPage} />
            </div>
            <aside className="min-w-0 lg:sticky lg:top-4">
              <Section title="Gained over time">
                <div className="border border-card-border rounded-xl bg-card-bg p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div className="flex gap-1.5">
                      {(['ehp', 'ehb', 'xp'] as Metric[]).map((m) => (
                        <button key={m} type="button" onClick={() => setMetric(m)} className={chip(metric === m)}>
                          {m.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      {([7, 30, 90] as Window[]).map((d) => (
                        <button key={d} type="button" onClick={() => setDays(d)} className={chip(days === d)}>
                          {d}d
                        </button>
                      ))}
                    </div>
                  </div>
                  {activeDays > 0 ? (
                    <>
                      <LineChart
                        points={chartPoints}
                        format={(n) => (metric === 'xp' ? fmtXp(n) : `${n.toFixed(2)}h`)}
                        ariaLabel={`${metric.toUpperCase()} gained per day over the last ${days} days`}
                      />
                      <div className="mt-3 pt-3 border-t border-card-border text-sm text-text-muted">
                        <span className="text-foreground font-medium">
                          {metric === 'xp' ? fmtXp(windowTotal) : `${windowTotal.toFixed(2)}h`}
                        </span>{' '}
                        gained in the last {days} days
                      </div>
                    </>
                  ) : (
                    // An empty axis with "0.00h gained" reads as "this player does nothing", when the truth
                    // is that we only started recording. Say which it is.
                    <p className="text-sm text-text-muted py-10 text-center">
                      Daily tracking started {trackedFor <= 1 ? 'today' : `${trackedFor} days ago`} — the chart
                      fills in from here as they play.
                    </p>
                  )}
                </div>
              </Section>
              <Section title="Activity" aside={wide ? "last 6 months" : "efficient hours gained, last 12 months"}>
                <div className="border border-card-border rounded-xl bg-card-bg p-4">
                  <ActivityHeatmap fluid={wide} days={wide ? heatDays.slice(-SIDE_HEAT_DAYS) : heatDays} ariaLabel={`${profile.rsn}'s activity over the last 90 days`} />
                  {trackedFor <= 14 && (
                    // Say why most of the grid is empty, so it isn't mistaken for a very quiet player.
                    <p className="text-xs text-text-muted mt-3">
                      Daily tracking started {trackedFor <= 1 ? 'today' : `${trackedFor} days ago`} — earlier
                      squares are empty because nothing was recorded yet, not because nothing happened.
                    </p>
                  )}
                </div>
              </Section>
            </aside>
          </div>


        </>
      )}


      {tab === 'trophies' && (
        <>
          {/* Four zeros above "nothing here yet" said the same thing five times. The counters only
              appear once there's something to count. */}
          {(history.events.length > 0 || history.weeklies.length > 0) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="border border-card-border rounded-xl bg-card-bg px-4 py-3">
              <div className="text-[11px] uppercase tracking-widest text-text-muted">Events played</div>
              <div className="text-xl font-bold text-gold tabular-nums mt-0.5">{history.events.length}</div>
            </div>
            <div className="border border-card-border rounded-xl bg-card-bg px-4 py-3">
              <div className="text-[11px] uppercase tracking-widest text-text-muted">Bingos won</div>
              <div className="text-xl font-bold text-gold tabular-nums mt-0.5">{history.eventWins}</div>
              {history.eventPodiums > history.eventWins && (
                <div className="text-[11px] text-text-muted mt-0.5">{history.eventPodiums} podiums</div>
              )}
            </div>
            <div className="border border-card-border rounded-xl bg-card-bg px-4 py-3">
              <div className="text-[11px] uppercase tracking-widest text-text-muted">Weeklies won</div>
              <div className="text-xl font-bold text-gold tabular-nums mt-0.5">{history.weeklyWins}</div>
              {history.weeklyPodiums > history.weeklyWins && (
                <div className="text-[11px] text-text-muted mt-0.5">{history.weeklyPodiums} podiums</div>
              )}
            </div>
            <div className="border border-card-border rounded-xl bg-card-bg px-4 py-3">
              <div className="text-[11px] uppercase tracking-widest text-text-muted">Points scored</div>
              <div className="text-xl font-bold text-gold tabular-nums mt-0.5">
                {Math.round(history.totalPoints).toLocaleString()}
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">across all bingos</div>
            </div>
          </div>
          )}

          {history.events.length === 0 && history.weeklies.length === 0 ? (
            <p className="text-sm text-text-muted border border-card-border rounded-xl bg-card-bg p-6 text-center">
              No trophies yet — finished bingos and weekly competitions land here, with placings and the
              points they scored.
            </p>
          ) : (
            <>
              {history.events.length > 0 && (
                <Section title="Bingos" aside="most recent first">
                  <div className="border border-card-border rounded-xl overflow-hidden">
                    {history.events.map((e, i) => (
                      <div
                        key={e.eventId}
                        className={`grid grid-cols-[minmax(0,1fr)_4.5rem_5rem] sm:grid-cols-[minmax(0,1fr)_7rem_5rem_5rem] gap-2 px-4 py-2.5 text-sm items-center ${i % 2 ? 'bg-card-bg' : 'bg-tile-bg'}`}
                      >
                        <span className="min-w-0 truncate">{e.name}</span>
                        <span className="hidden sm:block text-xs text-text-muted">
                          {e.endedOn ? new Date(e.endedOn).toLocaleDateString() : '—'}
                        </span>
                        <span className="text-right tabular-nums text-text-muted">
                          {e.points === null ? '—' : `${Math.round(e.points).toLocaleString()} pts`}
                        </span>
                        <span className={`text-right tabular-nums ${e.teamRank === 1 ? 'text-gold' : 'text-text-muted'}`}>
                          {e.teamRank ? `${medal(e.teamRank)}${e.teamsTotal ? ` /${e.teamsTotal}` : ''}` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-text-muted">
                    Placing is their TEAM&rsquo;s finish; points are what they personally contributed. A
                    dash means the format doesn&rsquo;t score points, or the event finished before
                    per-player results were recorded.
                  </p>
                </Section>
              )}

              {history.weeklies.length > 0 && (
                <Section title="Weekly competitions" aside="most recent first">
                  <div className="border border-card-border rounded-xl overflow-hidden">
                    {history.weeklies.map((w, i) => (
                      <div
                        key={w.competitionId}
                        className={`grid grid-cols-[minmax(0,1fr)_4.5rem_5rem] sm:grid-cols-[minmax(0,1fr)_7rem_5rem_5rem] gap-2 px-4 py-2.5 text-sm items-center ${i % 2 ? 'bg-card-bg' : 'bg-tile-bg'}`}
                      >
                        <span className="min-w-0 truncate">{w.title}</span>
                        <span className="hidden sm:block text-xs text-text-muted">
                          {new Date(w.endedOn).toLocaleDateString()}
                        </span>
                        <span className="text-right tabular-nums text-text-muted">
                          {w.type === 'efficiency' ? `${(w.gained / 1000).toFixed(2)}h` : fmtXp(w.gained)}
                        </span>
                        <span className={`text-right tabular-nums ${w.rank === 1 ? 'text-gold' : 'text-text-muted'}`}>
                          {medal(w.rank)}/{w.entrants}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-text-muted">
                    Placed against everyone who actually scored, not everyone enrolled.
                  </p>
                </Section>
              )}
            </>
          )}
        </>
      )}

      {tab === 'records' && (
        <>
        {/* What they've done LATELY. A record only feels like one when you can see it happen: four
            static lists said what this player has ever managed and nothing about this week. */}
        {recentFeed.length > 0 && (
          <Section title="Lately" aside="newest first">
            <div className="flex flex-wrap gap-1.5 mb-2" role="tablist" aria-label="Show">
              {(
                [
                  ['all', 'Everything'],
                  ['drops', 'Drops'],
                  ['bests', 'Best times'],
                  ['milestones', 'Milestones'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={latelyFilter === key}
                  onClick={() => {
                    setLatelyFilter(key);
                    setLatelyShown(12);
                  }}
                  className={chip(latelyFilter === key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="border border-card-border rounded-xl bg-card-bg divide-y divide-card-border">
              {latelyRows.slice(0, latelyShown).map((entry) => (
                <div key={entry.key} className="flex items-center gap-3 px-4 py-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brown-dark/60">
                    {entry.icon && (
                      // eslint-disable-next-line @next/next/no-img-element -- remote game sprites, tiny and cached
                      <img src={entry.icon} alt="" loading="lazy" className="max-h-6 max-w-6 object-contain [image-rendering:pixelated]" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{entry.label}</span>
                    <span className={`block text-[11px] ${LATELY_KIND[entry.kind].tone}`}>{LATELY_KIND[entry.kind].label}</span>
                  </span>
                  {entry.value && <span className="text-sm font-mono text-gold shrink-0">{entry.value}</span>}
                  <span className="text-[11px] text-text-muted shrink-0 w-20 text-right">
                    <LocalTime date={entry.at} format="date" />
                  </span>
                </div>
              ))}
              {latelyRows.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-text-muted">Nothing of that kind yet.</p>
              )}
            </div>
            {latelyRows.length > latelyShown && (
              <button
                type="button"
                onClick={() => setLatelyShown((n) => n + 24)}
                className="mt-2 w-full rounded-lg border border-card-border py-2 text-sm text-text-muted hover:border-gold/50 hover:text-foreground"
              >
                Show more ({latelyRows.length - latelyShown} older)
              </button>
            )}
          </Section>
        )}

        <Section title="Best days" aside="the biggest stretch we've recorded">
          {records.length === 0 ? (
            <p className="text-sm text-text-muted border border-card-border rounded-xl bg-card-bg p-6 text-center">
              Nothing yet. Records build from daily history, so they appear once they&rsquo;ve played a
              few days with tracking on.
            </p>
          ) : (
            // One small table: periods down, measures across. Nine identical cards made the reader do
            // the grid in their head; this IS the grid, and the best of each reads at a glance.
            <div className="overflow-hidden rounded-xl border border-card-border bg-card-bg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-tile-bg text-xs text-text-muted">
                    <th className="px-4 py-2 text-left font-normal">Best</th>
                    {(['xp', 'ehp', 'ehb'] as const).map((m) => (
                      <th key={m} className="px-4 py-2 text-right font-normal">
                        {m === 'xp' ? 'XP' : m.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border">
                  {(['day', 'week', 'month'] as const).map((period) => (
                    <tr key={period}>
                      <td className="px-4 py-3 capitalize text-text-muted">{period}</td>
                      {(['xp', 'ehp', 'ehb'] as const).map((metric) => {
                        const r = records.find((x) => x.period === period && x.metric === metric);
                        return (
                          <td key={metric} className="px-4 py-3 text-right">
                            {r ? (
                              <>
                                <span className="block font-semibold tabular-nums text-gold">
                                  {r.metric === 'xp' ? fmtXp(r.value) : `${r.value.toFixed(1)}h`}
                                </span>
                                <span className="block text-[11px] text-text-dim">ending {r.endedOn}</span>
                              </>
                            ) : (
                              <span className="text-text-dim">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {history.totalPoints > 0 && (
                <p className="border-t border-card-border px-4 py-2.5 text-sm text-text-muted">
                  <span className="font-semibold tabular-nums text-gold">{history.totalPoints.toLocaleString()}</span> event
                  points across {history.events.length} {history.events.length === 1 ? 'event' : 'events'}
                </p>
              )}
            </div>
          )}
        </Section>

          {/* Times, from the synced profile. They belong beside the other bests rather than under
              the collection log grid, which is where they were and where nobody would look. */}
          {collection.bests.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <span className="w-1 h-4 bg-gold rounded-full" />
                  Personal bests
                  <span className="text-xs text-text-muted font-normal">{collection.bests.length}</span>
                </h3>
                <Input
                  value={bestFilter}
                  onChange={(e) => setBestFilter(e.target.value)}
                  placeholder="Find a time…"
                  className="w-44 px-2 py-1 text-xs"
                />
              </div>
              <div className="border border-card-border rounded-xl bg-card-bg divide-y divide-card-border max-h-96 overflow-y-auto">
                {shownTimes.map((b) => (
                  <div key={b.activity} className="flex items-center gap-3 px-3 py-1.5 text-xs">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                      {activityImageUrl(b.activity) && (
                        // eslint-disable-next-line @next/next/no-img-element -- remote game sprites, tiny and cached
                        <img src={activityImageUrl(b.activity)!} alt="" loading="lazy" className="max-h-5 max-w-5 object-contain [image-rendering:pixelated]" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{b.activity}</span>
                    <span className="font-mono text-gold shrink-0">{b.time}</span>
                  </div>
                ))}
                {shownTimes.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-text-muted">
                    No time matches &ldquo;{bestFilter}&rdquo;.
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'collection' && (
        <div className="space-y-6">
          {/* The log and the three progress interfaces are one question — "what has this account
              actually done" — so they live on one tab rather than in a card floating above it. */}
          {accountProgress}
          <CollectionLog key={logPage ?? ''} {...collection} initialPage={logPage} />
        </div>
      )}

      {tab === 'records' && (
        <>
          {upcoming.length > 0 && (
            <Section title="In reach" aside="closest first">
              <div className="grid sm:grid-cols-2 gap-2">
                {upcoming.map((u) => (
                  <div
                    key={u.label}
                    className="border border-card-border rounded-lg bg-card-bg px-3 py-2.5"
                  >
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">{u.label}</span>
                      <span className="text-xs text-text-muted shrink-0">{u.remaining} to go</span>
                    </div>
                    <div className="mt-1.5">
                      <Bar value={u.progress} max={1} />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

        <Section title="Earned" aside="as we noticed them">
          {milestones.length === 0 ? (
            <p className="text-sm text-text-muted border border-card-border rounded-xl bg-card-bg p-6 text-center">
              None recorded yet. These are logged the first time we see one crossed, so they start
              accumulating from now rather than listing everything they ever did.
            </p>
          ) : (
            <div className="border border-card-border rounded-xl overflow-hidden">
              <Rows cap={12} rowPx={41}>
              {milestones.map((m, i) => (
                <div
                  key={`${m.kind}-${m.metric}-${m.threshold}`}
                  className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${i % 2 ? 'bg-card-bg' : 'bg-tile-bg'}`}
                >
                  <span className="min-w-0 truncate">{milestoneText(m)}</span>
                  <span className="text-xs text-text-muted shrink-0">
                    {new Date(m.noticedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
              </Rows>
            </div>
          )}
        </Section>
        </>
      )}

      {!eff && (
        <div className="border border-card-border rounded-xl bg-card-bg px-4 py-8 text-center text-sm text-text-muted">
          We haven&rsquo;t read this account from the hiscores yet.
        </div>
      )}
    </>
  );
}
