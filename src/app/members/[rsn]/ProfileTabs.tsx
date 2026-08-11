'use client';

import { useMemo, useState } from 'react';
import { ActivityHeatmap, Bar, LineChart, ProgressRing } from '@/components/stats/Charts';
import { SKILL_LABELS, BOSSES } from '@/lib/constants';
import { progressToLevel } from '@/lib/xp';
import type { DailyPoint, MemberProfile, MilestoneRow, PeriodRecord } from '@/lib/memberProfile';

// Every tab renders from data the server already sent, so switching is instant and costs nothing.
// The whole payload is one member's snapshot plus at most a year of ~50-byte daily rows — smaller
// than the images on the page — which is what makes fetching it all up front the cheap option.

type Tab = 'overview' | 'gained' | 'records' | 'achievements';
type Metric = 'ehp' | 'ehb' | 'xp';
type Window = 7 | 30 | 90;

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'gained', label: 'Gained' },
  { key: 'records', label: 'Records' },
  { key: 'achievements', label: 'Achievements' },
];

const bossLabel = (key: string) => BOSSES.find((b) => b.key === key)?.label ?? key;

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
}: {
  profile: MemberProfile;
  series: DailyPoint[];
  records: PeriodRecord[];
  milestones: MilestoneRow[];
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const [metric, setMetric] = useState<Metric>('ehp');
  const [days, setDays] = useState<Window>(30);

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
  const heatDays = useMemo(
    () => series.slice(-90).map((p) => ({ day: p.day, value: p.ehpGained + p.ehbGained })),
    [series],
  );
  const windowTotal = chartPoints.reduce((sum, p) => sum + p.value, 0);

  const maxSkillEhp = Math.max(...profile.skills.map((s) => s.ehp), 0.01);
  const maxBossEhb = Math.max(...profile.bosses.map((b) => b.ehb), 0.01);
  const skillsByHours = [...profile.skills].sort((a, b) => b.ehp - a.ehp || b.xp - a.xp);

  const chip = (active: boolean) =>
    `px-2.5 py-1 text-xs rounded-md border transition-colors ${
      active ? 'bg-gold/20 border-gold text-gold' : 'border-card-border text-text-muted hover:border-gold/50'
    }`;

  return (
    <>
      <div className="flex gap-1 border-b border-card-border mb-6 overflow-x-auto" role="tablist">
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
            {t.key === 'achievements' && milestones.length > 0 && (
              <span className="ml-1.5 text-[10px] text-text-muted">{milestones.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          {nearest99s.length > 0 && (
            <Section title="Nearest 99s">
              <div className="grid sm:grid-cols-3 gap-4 border border-card-border rounded-xl bg-card-bg p-4">
                {nearest99s.map(({ skill, prog }) => (
                  <ProgressRing
                    key={skill.key}
                    progress={prog.progress}
                    label={`99 ${SKILL_LABELS[skill.key] ?? skill.key}`}
                    sub={`${fmtXp(prog.xpToNext)} to go · lvl ${prog.level}`}
                  />
                ))}
              </div>
            </Section>
          )}

          {heatDays.length > 0 && (
            <Section title="Activity" aside="efficient hours gained, last 90 days">
              <div className="border border-card-border rounded-xl bg-card-bg p-4">
                <ActivityHeatmap days={heatDays} ariaLabel={`${profile.rsn}'s activity over the last 90 days`} />
              </div>
            </Section>
          )}

          <Section title="Skills" aside="by hours invested">
            <div className="border border-card-border rounded-xl overflow-hidden">
              <div className="grid grid-cols-[minmax(0,1fr)_3rem_5rem_4rem] sm:grid-cols-[minmax(0,1fr)_8rem_3rem_6rem_4.5rem] gap-2 px-4 py-2 bg-tile-bg text-xs text-text-muted">
                <span>Skill</span>
                <span className="hidden sm:block">Share</span>
                <span className="text-right">Lvl</span>
                <span className="text-right">XP</span>
                <span className="text-right">EHP</span>
              </div>
              {skillsByHours.map((s, i) => (
                <div
                  key={s.key}
                  className={`grid grid-cols-[minmax(0,1fr)_3rem_5rem_4rem] sm:grid-cols-[minmax(0,1fr)_8rem_3rem_6rem_4.5rem] gap-2 px-4 py-2 text-sm items-center ${i % 2 ? 'bg-card-bg' : ''}`}
                >
                  <span className="truncate">{SKILL_LABELS[s.key] ?? s.key}</span>
                  <span className="hidden sm:block">
                    <Bar value={s.ehp} max={maxSkillEhp} muted={s.ehp === 0} />
                  </span>
                  <span className="text-right tabular-nums text-text-muted">{s.level || '—'}</span>
                  <span className="text-right tabular-nums text-text-muted">{fmtXp(s.xp)}</span>
                  <span className={`text-right tabular-nums ${s.ehp > 0 ? '' : 'text-text-muted/50'}`}>
                    {s.ehp.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-text-muted">
              A skill can read 0.00 with millions of XP — Attack and Strength arrive as bonus XP from
              Slayer in the efficiency tables, so they cost no time of their own.
            </p>
          </Section>

          {profile.bosses.length > 0 && (
            <Section title="Bosses" aside="by hours invested">
              <div className="border border-card-border rounded-xl overflow-hidden">
                <div className="grid grid-cols-[minmax(0,1fr)_5rem_4.5rem] sm:grid-cols-[minmax(0,1fr)_8rem_5rem_4.5rem] gap-2 px-4 py-2 bg-tile-bg text-xs text-text-muted">
                  <span>Boss</span>
                  <span className="hidden sm:block">Share</span>
                  <span className="text-right">KC</span>
                  <span className="text-right">EHB</span>
                </div>
                {profile.bosses.map((b, i) => (
                  <div
                    key={b.key}
                    className={`grid grid-cols-[minmax(0,1fr)_5rem_4.5rem] sm:grid-cols-[minmax(0,1fr)_8rem_5rem_4.5rem] gap-2 px-4 py-2 text-sm items-center ${i % 2 ? 'bg-card-bg' : ''}`}
                  >
                    <span className="truncate">{bossLabel(b.key)}</span>
                    <span className="hidden sm:block">
                      <Bar value={b.ehb} max={maxBossEhb} muted={b.ehb === 0} />
                    </span>
                    <span className="text-right tabular-nums text-text-muted">{b.kc.toLocaleString()}</span>
                    <span className={`text-right tabular-nums ${b.ehb > 0 ? '' : 'text-text-muted/50'}`}>
                      {b.ehb.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      {tab === 'gained' && (
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
              {series.length === 0 && ' — history starts from the day this was deployed, so it fills in as they play.'}
            </div>
          </div>
        </Section>
      )}

      {tab === 'records' && (
        <Section title="Records" aside="best stretch we've recorded">
          {records.length === 0 ? (
            <p className="text-sm text-text-muted border border-card-border rounded-xl bg-card-bg p-6 text-center">
              Nothing yet. Records build from daily history, so they appear once they&rsquo;ve played a
              few days with tracking on.
            </p>
          ) : (
            <div className="grid sm:grid-cols-3 gap-3">
              {(['day', 'week', 'month'] as const).map((period) => {
                const forPeriod = records.filter((r) => r.period === period);
                if (forPeriod.length === 0) return null;
                return (
                  <div key={period} className="border border-card-border rounded-xl bg-card-bg p-4">
                    <div className="text-[11px] uppercase tracking-widest text-text-muted mb-2">Best {period}</div>
                    {forPeriod.map((r) => (
                      <div key={r.metric} className="flex items-baseline justify-between text-sm py-1">
                        <span className="text-text-muted uppercase text-xs">{r.metric}</span>
                        <span className="tabular-nums">
                          {r.metric === 'xp' ? fmtXp(r.value) : `${r.value.toFixed(2)}h`}
                        </span>
                      </div>
                    ))}
                    <div className="text-[11px] text-text-muted mt-2 pt-2 border-t border-card-border">
                      ending {forPeriod[0].endedOn}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {tab === 'achievements' && (
        <Section title="Achievements" aside="milestones as we noticed them">
          {milestones.length === 0 ? (
            <p className="text-sm text-text-muted border border-card-border rounded-xl bg-card-bg p-6 text-center">
              None recorded yet. These are logged the first time we see one crossed, so they start
              accumulating from now rather than listing everything they ever did.
            </p>
          ) : (
            <div className="border border-card-border rounded-xl overflow-hidden">
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
            </div>
          )}
        </Section>
      )}

      {!eff && (
        <div className="border border-card-border rounded-xl bg-card-bg px-4 py-8 text-center text-sm text-text-muted">
          We haven&rsquo;t read this account from the hiscores yet.
        </div>
      )}
    </>
  );
}
