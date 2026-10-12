'use client';

import { useMemo, useState } from 'react';

import { Bar } from '@/components/stats/Charts';
import Input from '@/components/Input';
import Select from '@/components/Select';
import { BOSSES, SKILL_LABELS } from '@/lib/constants';
import { CLUE_TIER_KEYS } from '@/lib/hiscoresActivities';
import type { AccountProfile, ActivityStanding } from '@/lib/memberProfile';
import { trendLabel, type LevelUp, type StatTrend, type Trends } from '@/lib/statTrends';
import { activityIconUrl, bossImageForStatKey, skillIconUrl } from '@/lib/tileIcons';
import { setUrlParams } from '@/lib/urlState';
import type { ProfileStatKind } from '@/lib/profileLink';

/**
 * The character's numbers, one kind at a time: Skills · Bosses · Clues · Minigames.
 *
 * Four stacked tables made the Overview a long scroll of grey rows. Here each kind is a tab (and a
 * deep link, `?stat=`), every row carries the game's icon, a search narrows it, and the right-hand
 * column says how this week compares with last — the "what are they doing lately" question the
 * career totals beside it can't answer. A row opens to its last eight weeks.
 */

export type StatKind = ProfileStatKind;
const KINDS: { key: StatKind; label: string }[] = [
  { key: 'skills', label: 'Skills' },
  { key: 'bosses', label: 'Bosses' },
  { key: 'clues', label: 'Clues' },
  { key: 'minigames', label: 'Minigames' },
];

type Sort = 'hours' | 'level' | 'week';

interface Row {
  key: string;
  label: string;
  icon: string | null;
  /** Level for a skill; the count everywhere else. */
  primary: string;
  /** XP for a skill, nothing elsewhere. */
  secondary: string | null;
  hours: number | null;
  sortValue: number;
  trend?: StatTrend;
  /** Days a skill's level went up, oldest first — skills only. */
  levels?: LevelUp[];
  /** Gains are XP for skills, kills for bosses. */
  unit: 'xp' | 'kc' | null;
  standing?: ActivityStanding;
}

const bossLabel = (key: string) => BOSSES.find((b) => b.key === key)?.label ?? key;

function compact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  return n.toLocaleString();
}

export default function StatsBrowser({
  profile,
  trends,
  levels = {},
  standings,
  initial,
  bossPages = {},
  onOpenLogPage,
}: {
  profile: AccountProfile;
  trends: Trends;
  /** Skill key → the days its level went up (lib/statTrends levelUps). */
  levels?: Record<string, LevelUp[]>;
  standings: Record<string, ActivityStanding>;
  initial?: StatKind;
  /** Boss key → its collection log page (computed on the server; the catalogue is too big to ship). */
  bossPages?: Record<string, string>;
  /** Open a log page in the Collection tab — a boss's name links to the page its kills fill. */
  onOpenLogPage?: (page: string) => void;
}) {
  const clueRows = useMemo(
    () => profile.activities.filter((a) => (CLUE_TIER_KEYS as readonly string[]).includes(a.key) || a.key === 'cluesAll'),
    [profile.activities],
  );
  const minigameRows = useMemo(
    () => profile.activities.filter((a) => (a.group === 'minigames' || a.group === 'collection') && (a.score > 0 || a.rank != null)),
    [profile.activities],
  );
  const available: Record<StatKind, boolean> = {
    skills: profile.skills.length > 0,
    bosses: profile.bosses.length > 0,
    clues: clueRows.some((a) => a.score > 0),
    minigames: minigameRows.length > 0,
  };
  const kinds = KINDS.filter((k) => available[k.key]);
  const [kind, setKind] = useState<StatKind>(initial && available[initial] ? initial : kinds[0]?.key ?? 'skills');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('hours');
  const [open, setOpen] = useState<string | null>(null);
  const comparable = trends.days >= 14;

  const rows: Row[] = useMemo(() => {
    if (kind === 'skills') {
      return profile.skills.map((s) => ({
        key: s.key,
        label: SKILL_LABELS[s.key] ?? s.key,
        icon: skillIconUrl(s.key),
        primary: s.level ? String(s.level) : '—',
        secondary: compact(s.xp),
        hours: s.ehp,
        sortValue: sort === 'level' ? s.xp : sort === 'week' ? trends.skills[s.key]?.week ?? 0 : s.ehp * 1e9 + s.xp,
        trend: trends.skills[s.key],
        levels: levels[s.key],
        unit: 'xp',
      }));
    }
    if (kind === 'bosses') {
      return profile.bosses.map((b) => ({
        key: b.key,
        label: bossLabel(b.key),
        icon: bossImageForStatKey(b.key),
        primary: b.kc.toLocaleString(),
        secondary: null,
        hours: b.ehb,
        sortValue: sort === 'level' ? b.kc : sort === 'week' ? trends.bosses[b.key]?.week ?? 0 : b.ehb * 1e9 + b.kc,
        trend: trends.bosses[b.key],
        unit: 'kc',
      }));
    }
    const list = kind === 'clues' ? clueRows : minigameRows;
    return list.map((a) => ({
      key: a.key,
      label: kind === 'clues' ? a.shortLabel : a.label,
      icon: activityIconUrl(a.key),
      // A rank-scaled entry's score is a rating nobody quotes; its position is the number that means
      // something, so it stands in for the score there.
      primary: a.scale === 'rank' ? (a.rank != null ? `#${a.rank.toLocaleString()}` : '—') : a.score.toLocaleString(),
      secondary: a.scale !== 'rank' && a.rank != null ? `world #${a.rank.toLocaleString()}` : null,
      hours: null,
      sortValue: a.score,
      unit: null,
      standing: standings[a.key],
    }));
  }, [kind, sort, profile, trends, levels, clueRows, minigameRows, standings]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? rows.filter((r) => r.label.toLowerCase().includes(q)) : rows;
    // Clues stay in tier order — beginner to master is the order everyone reads them in.
    return kind === 'clues' ? filtered : [...filtered].sort((a, b) => b.sortValue - a.sortValue);
  }, [rows, query, kind]);

  const maxHours = Math.max(...rows.map((r) => r.hours ?? 0), 0.01);
  const hasTrendColumn = (kind === 'skills' || kind === 'bosses') && comparable;

  function pick(k: StatKind) {
    setKind(k);
    setOpen(null);
    setQuery('');
    if (k === 'clues' || k === 'minigames') setSort('hours');
    setUrlParams({ stat: k === kinds[0]?.key ? null : k });
  }

  if (kinds.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="w-1 h-5 bg-gold rounded-full" />
        <div className="flex gap-1" role="tablist" aria-label="Stats">
          {kinds.map((k) => (
            <button
              key={k.key}
              type="button"
              role="tab"
              aria-selected={kind === k.key}
              onClick={() => pick(k.key)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                kind === k.key ? 'bg-gold/15 text-gold font-semibold' : 'text-text-muted hover:text-foreground'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {(kind === 'skills' || kind === 'bosses') && (
            <Select
              value={sort}
              onChange={(v) => setSort(v as Sort)}
              ariaLabel="Sort by"
              className="w-40"
              options={[
                { value: 'hours', label: 'Most hours' },
                { value: 'level', label: kind === 'skills' ? 'Highest XP' : 'Most kills' },
                ...(comparable ? [{ value: 'week', label: 'Most this week' }] : []),
              ]}
            />
          )}
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Find a ${kind === 'skills' ? 'skill' : kind === 'bosses' ? 'boss' : kind === 'clues' ? 'tier' : 'minigame'}`}
            aria-label="Search"
            className="w-44"
          />
        </div>
      </div>

      <div className="border border-card-border rounded-xl overflow-hidden bg-card-bg">
        <div className="grid grid-cols-[2rem_minmax(0,1fr)_4.5rem_5rem] sm:grid-cols-[2rem_minmax(0,1fr)_7rem_4.5rem_6rem_7rem] gap-3 px-4 py-2 bg-tile-bg text-xs text-text-muted">
          <span />
          <span>{kind === 'skills' ? 'Skill' : kind === 'bosses' ? 'Boss' : kind === 'clues' ? 'Tier' : 'Activity'}</span>
          <span className="hidden sm:block">{kind === 'skills' || kind === 'bosses' ? 'Hours' : ''}</span>
          <span className="text-right">{kind === 'skills' ? 'Level' : kind === 'bosses' ? 'Kills' : 'Score'}</span>
          <span className="hidden sm:block text-right">{kind === 'skills' ? 'XP' : kind === 'clues' || kind === 'minigames' ? 'World' : 'EHB'}</span>
          <span className="text-right">{hasTrendColumn ? 'This week' : kind === 'clues' || kind === 'minigames' ? 'In clan' : ''}</span>
        </div>

        {shown.length === 0 && <p className="px-4 py-6 text-center text-sm text-text-muted">Nothing matches “{query}”.</p>}

        {shown.map((r, i) => {
          const t = trendLabel(r.trend);
          const expandable = (!!r.trend && r.trend.weeks.some((w) => w > 0)) || !!r.levels?.length;
          const isOpen = open === r.key;
          return (
            <div key={r.key} className={i % 2 ? 'bg-brown-dark/30' : ''}>
              {/* The row opens the eight-week chart; a boss's name is its own link, to its log page —
                  two actions, so the row is a div with a keyboard handler rather than one big button
                  (a button can't hold another). */}
              <div
                role={expandable ? 'button' : undefined}
                tabIndex={expandable ? 0 : undefined}
                aria-expanded={expandable ? isOpen : undefined}
                onClick={expandable ? () => setOpen(isOpen ? null : r.key) : undefined}
                onKeyDown={
                  expandable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setOpen(isOpen ? null : r.key);
                        }
                      }
                    : undefined
                }
                className={`grid w-full grid-cols-[2rem_minmax(0,1fr)_4.5rem_5rem] sm:grid-cols-[2rem_minmax(0,1fr)_7rem_4.5rem_6rem_7rem] items-center gap-3 px-4 py-2 text-left text-sm ${
                  expandable ? 'cursor-pointer hover:bg-gold/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-gold/60' : ''
                }`}
              >
                <span className="flex h-7 w-7 items-center justify-center">
                  {r.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote game sprites, tiny and cached
                    <img src={r.icon} alt="" className="max-h-7 max-w-7 object-contain [image-rendering:pixelated]" loading="lazy" />
                  ) : null}
                </span>
                {kind === 'bosses' && bossPages[r.key] && onOpenLogPage ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenLogPage(bossPages[r.key]);
                    }}
                    title={`Open the ${bossPages[r.key]} collection log page`}
                    className="truncate text-left hover:text-gold hover:underline"
                  >
                    {r.label}
                  </button>
                ) : (
                  <span className="truncate">{r.label}</span>
                )}
                <span className="hidden sm:block">
                  {r.hours != null && <Bar value={r.hours} max={maxHours} muted={r.hours === 0} />}
                </span>
                <span className="text-right tabular-nums">{r.primary}</span>
                <span className="hidden sm:block text-right tabular-nums text-text-muted">
                  {kind === 'bosses' ? (r.hours ?? 0).toFixed(1) : r.secondary ?? '—'}
                </span>
                <span className="text-right tabular-nums text-xs">
                  {hasTrendColumn ? (
                    r.trend && r.trend.week > 0 ? (
                      <>
                        <span className="text-foreground">+{r.unit === 'xp' ? compact(r.trend.week) : r.trend.week.toLocaleString()}</span>{' '}
                        <span
                          className={
                            t.tone === 'up' ? 'text-accent-green-light' : t.tone === 'down' ? 'text-accent-red' : 'text-text-muted'
                          }
                        >
                          {t.text}
                        </span>
                      </>
                    ) : (
                      <span className="text-text-dim">—</span>
                    )
                  ) : r.standing ? (
                    <span className="text-text-muted">
                      #{r.standing.position} of {r.standing.of}
                    </span>
                  ) : (
                    <span className="text-text-dim">—</span>
                  )}
                </span>
              </div>
              {isOpen && r.trend && <WeekBars trend={r.trend} unit={r.unit} />}
              {isOpen && !!r.levels?.length && <LevelTrail levels={r.levels} />}
            </div>
          );
        })}
      </div>
      {kind === 'skills' && (
        <p className="mt-2 text-xs text-text-muted">
          Hours are efficient hours (EHP). Attack and Strength can read zero with millions of XP — they arrive as bonus
          XP from Slayer, so they cost no time of their own.
        </p>
      )}
      {(kind === 'skills' || kind === 'bosses') && !comparable && (
        <p className="mt-2 text-xs text-text-muted">This week against last appears once two weeks of daily history exist.</p>
      )}
    </section>
  );
}

/** The last eight weeks for one stat, as bars — opened from its row. */
function WeekBars({ trend, unit }: { trend: StatTrend; unit: 'xp' | 'kc' | null }) {
  const max = Math.max(...trend.weeks, 1);
  return (
    <div className="px-4 pb-4 pt-1 sm:pl-16">
      <div className="flex h-20 items-end gap-1.5" role="img" aria-label="Gained per week, last eight weeks">
        {trend.weeks.map((w, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] tabular-nums text-text-muted">{w > 0 ? (unit === 'xp' ? compact(w) : w.toLocaleString()) : ''}</span>
            <div
              className={`w-full rounded-t ${i === trend.weeks.length - 1 ? 'bg-gold' : 'bg-gold/40'}`}
              style={{ height: `${Math.max(w > 0 ? 6 : 2, (w / max) * 56)}px` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-text-dim">
        <span>8 weeks ago</span>
        <span>this week</span>
      </div>
    </div>
  );
}

const trailDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

/** The days this skill's level went up — only the levels that changed, never a day it stood still. */
function LevelTrail({ levels }: { levels: LevelUp[] }) {
  // The most recent dozen; a year of a fast skill can level fifty times.
  const shown = levels.slice(-12);
  return (
    <div className="px-4 pb-4 pt-1 sm:pl-16">
      <p className="mb-1.5 text-[10px] uppercase tracking-wide text-text-dim">Level-ups</p>
      <ol className="flex flex-wrap gap-1.5">
        {levels.length > shown.length && <li className="px-1 text-xs text-text-dim">…</li>}
        {shown.map((l) => (
          <li
            key={l.day}
            title={l.from != null ? `${l.from} → ${l.level} on ${l.day}` : `${l.level} on ${l.day}`}
            className="rounded-md border border-card-border bg-brown-dark/40 px-2 py-0.5 text-xs tabular-nums"
          >
            <span className="text-gold">{l.level}</span> <span className="text-text-muted">{trailDay(l.day)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
