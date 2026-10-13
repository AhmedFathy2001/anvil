'use client';

import { useMemo, useState } from 'react';
import type { DropLine, EventStatsData, MemberStats, SeriesKey } from '@/lib/eventStats';

// The stats page body (lib/eventStats). Server-rendered data in, sorting/filtering/chart hover only.

const HOUR = 3_600_000;
const DAY = 86_400_000;

function compact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}b`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}k`;
  return n.toLocaleString();
}

function hrs(minutes: number): string {
  const h = minutes / 60;
  return h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`;
}

/** "Day 2 · 14h" — event-relative, so both clans (and every timezone) read the same label. */
function eventClock(ms: number, startMs: number): string {
  const elapsed = Math.max(0, ms - startMs);
  const day = Math.floor(elapsed / DAY) + 1;
  const hour = Math.floor((elapsed % DAY) / HOUR);
  return `Day ${day} · ${hour}h`;
}

function ago(stamp: string, nowMs: number): string {
  const ms = Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(stamp) ? `${stamp.replace(' ', 'T')}Z` : stamp);
  if (Number.isNaN(ms)) return '';
  const mins = Math.max(0, Math.round((nowMs - ms) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <span className="w-1 h-5 bg-gold rounded-sm" aria-hidden />
        {children}
      </h2>
      {aside}
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`border border-card-border rounded-xl bg-card-bg ${className}`}>{children}</div>;
}

function StatTile({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <Card className="px-3 py-3 text-center">
      <p className="text-lg leading-none mb-1" aria-hidden>{emoji}</p>
      <p className="text-xl font-extrabold text-gold tabular-nums">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </Card>
  );
}

/** Round a chart's top up to 2/4/5/10 × 10ⁿ, so the halfway gridline is a whole, readable number. */
function niceMax(v: number): number {
  if (v <= 2) return 2;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const m of [2, 4, 5, 10]) if (v <= m * mag) return m * mag;
  return 10 * mag;
}

// ── Chart ────────────────────────────────────────────────────────────────────────────────────────

const SERIES: { key: SeriesKey; label: string; format: (n: number) => string }[] = [
  { key: 'points', label: 'Score', format: (n) => n.toLocaleString() },
  { key: 'xp', label: 'XP', format: compact },
  { key: 'kc', label: 'Boss KC', format: (n) => n.toLocaleString() },
  { key: 'drops', label: 'Rares & pets', format: (n) => n.toLocaleString() },
  { key: 'deaths', label: 'Deaths', format: (n) => n.toLocaleString() },
  { key: 'loot', label: 'Loot', format: compact },
];

function ProgressChart({ data }: { data: EventStatsData }) {
  const [key, setKey] = useState<SeriesKey>('points');
  const [hover, setHover] = useState<number | null>(null);
  const { at, series } = data.hourly;
  const spec = SERIES.find((s) => s.key === key)!;
  const lines = data.sides.map((side) => ({ side, values: series[key][side.teamId] ?? [] }));
  const max = niceMax(Math.max(0, ...lines.flatMap((l) => l.values.filter((v): v is number => v != null))));
  const counterSeries = key === 'xp' || key === 'kc' || key === 'deaths' || key === 'loot';
  const empty = counterSeries && lines.every((l) => l.values.every((v) => v == null));

  // Wide and short: the page is wide, and a curve's story is its shape over time, not its height.
  const W = 1000;
  const H = 260;
  const PAD = { l: 52, r: 12, t: 12, b: 28 };
  const x0 = at[0] ?? 0;
  const x1 = Math.max(x0 + 1, at[at.length - 1] ?? x0 + 1);
  const sx = (ms: number) => PAD.l + ((ms - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const sy = (v: number) => H - PAD.b - (v / max) * (H - PAD.t - PAD.b);

  // Axis ticks: every 6h inside a day, every day across the event.
  const step = data.window.kind === 'day' ? 6 * HOUR : DAY;
  const ticks: number[] = [];
  for (let t = data.event.startMs + Math.ceil((x0 - data.event.startMs) / step) * step; t <= x1; t += step) ticks.push(t);
  const dayStart = data.event.startMs + ((data.window.day ?? 1) - 1) * DAY;
  const tickLabel = (t: number) =>
    data.window.kind === 'day' ? `${Math.round((t - dayStart) / HOUR)}h` : `D${Math.round((t - data.event.startMs) / DAY) + 1}`;

  const path = (values: (number | null)[]) => {
    let d = '';
    let pen = false;
    values.forEach((v, i) => {
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${sx(at[i]).toFixed(1)},${sy(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    at.forEach((ms, i) => {
      if (Math.abs(sx(ms) - px) < Math.abs(sx(at[best]) - px)) best = i;
    });
    setHover(best);
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap gap-2 mb-3" role="tablist" aria-label="What to chart">
        {SERIES.map((s) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={key === s.key}
            onClick={() => setKey(s.key)}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              key === s.key ? 'border-gold bg-gold/15 text-gold font-semibold' : 'border-card-border text-text-muted hover:text-gold'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {empty ? (
        <p className="text-sm text-text-muted py-10 text-center">
          Hour-by-hour {spec.label.toLowerCase()} starts recording on the event’s first full hour — the totals below already count.
        </p>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${spec.label} by hour, per team`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line x1={PAD.l} x2={W - PAD.r} y1={sy(max * f)} y2={sy(max * f)} stroke="currentColor" className="text-card-border" strokeDasharray={f ? '3 4' : undefined} />
                <text x={PAD.l - 6} y={sy(max * f) + 4} textAnchor="end" className="fill-text-muted" fontSize="12">{spec.format(max * f)}</text>
              </g>
            ))}
            {ticks.map((t) => (
              <text key={t} x={sx(t)} y={H - 8} textAnchor="middle" className="fill-text-muted" fontSize="12">{tickLabel(t)}</text>
            ))}
            {lines.map(({ side, values }) => (
              <path key={side.teamId} d={path(values)} fill="none" stroke={side.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {hover != null && <line x1={sx(at[hover])} x2={sx(at[hover])} y1={PAD.t} y2={H - PAD.b} stroke="currentColor" className="text-gold/60" />}
          </svg>
          {hover != null && (
            <div className="absolute top-1 right-1 text-xs border border-card-border bg-card-bg/95 rounded-lg px-3 py-2 shadow-lg pointer-events-none">
              <p className="font-semibold mb-1">{eventClock(at[hover], data.event.startMs)}</p>
              {lines.map(({ side, values }) => (
                <p key={side.teamId} className="flex items-center gap-2 tabular-nums">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: side.color }} aria-hidden />
                  <span className="truncate max-w-32">{side.clanName ?? side.name}</span>
                  <span className="ml-auto font-semibold">{values[hover] == null ? '—' : spec.format(values[hover]!)}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Members table ────────────────────────────────────────────────────────────────────────────────

type SortKey = 'name' | 'xp' | 'kc' | 'rares' | 'pets' | 'deaths' | 'loot' | 'minutes' | 'tiles' | 'turnIns';

const COLUMNS: { key: SortKey; label: string; title: string }[] = [
  { key: 'xp', label: 'XP', title: 'XP gained' },
  { key: 'kc', label: 'KC', title: 'Boss kills gained' },
  { key: 'rares', label: 'Rares', title: 'Rare drops seen by the plugin' },
  { key: 'pets', label: 'Pets', title: 'Pets' },
  { key: 'deaths', label: 'Deaths', title: 'Deaths (plugin)' },
  { key: 'loot', label: 'Loot', title: 'GE value of everything looted (plugin)' },
  { key: 'minutes', label: 'Played', title: 'Time logged in (plugin)' },
  { key: 'tiles', label: 'Tiles', title: 'Tiles they finished' },
  { key: 'turnIns', label: 'Subs', title: 'Submissions (a kill tile counts once per person)' },
];

function sortValue(m: MemberStats, key: SortKey): number | string {
  switch (key) {
    case 'name':
      return m.name.toLowerCase();
    case 'xp':
    case 'kc':
    case 'deaths':
    case 'loot':
    case 'minutes':
      return m.counters ? m.counters[key] : -1;
    default:
      return m[key];
  }
}

function cell(m: MemberStats, key: SortKey): string {
  if (key === 'name') return m.name;
  if (key === 'xp' || key === 'kc' || key === 'deaths' || key === 'loot' || key === 'minutes') {
    if (!m.counters) return '—';
    const v = m.counters[key];
    if (key === 'minutes') return v ? hrs(v) : '0';
    return key === 'xp' || key === 'loot' ? compact(v) : v.toLocaleString();
  }
  return m[key].toLocaleString();
}

function MembersTable({ data }: { data: EventStatsData }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'xp', dir: -1 });
  const [team, setTeam] = useState<number | 'all'>('all');
  const sideById = useMemo(() => new Map(data.sides.map((s) => [s.teamId, s])), [data.sides]);
  const rows = useMemo(() => {
    const list = data.members.filter((m) => team === 'all' || m.teamId === team);
    return [...list].sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir || a.name.localeCompare(b.name);
    });
  }, [data.members, team, sort]);
  const click = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === 'name' ? 1 : -1 }));
  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === -1 ? ' ▾' : ' ▴') : '');

  return (
    <Card className="overflow-hidden">
      {data.sides.length > 1 && (
        <div className="flex flex-wrap gap-2 p-3 border-b border-card-border">
          {[{ id: 'all' as const, label: 'Everyone', color: null as string | null }, ...data.sides.map((s) => ({ id: s.teamId, label: s.clanName ?? s.name, color: s.color }))].map((t) => (
            <button
              key={String(t.id)}
              onClick={() => setTeam(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border transition-colors ${
                team === t.id ? 'border-gold bg-gold/15 text-gold font-semibold' : 'border-card-border text-text-muted hover:text-gold'
              }`}
            >
              {t.color && <span className="inline-block w-2 h-2 rounded-full" style={{ background: t.color }} aria-hidden />}
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-text-muted border-b border-card-border">
              <th className="px-3 py-2 w-8">#</th>
              <th className="px-3 py-2">
                <button onClick={() => click('name')} className="hover:text-gold">Player{arrow('name')}</button>
              </th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-3 py-2 text-right whitespace-nowrap" title={c.title}>
                  <button onClick={() => click(c.key)} className={`hover:text-gold ${sort.key === c.key ? 'text-gold' : ''}`}>{c.label}{arrow(c.key)}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => {
              const side = m.teamId != null ? sideById.get(m.teamId) : null;
              return (
                <tr key={m.id} className="border-b border-card-border/50 last:border-0 hover:bg-gold/5">
                  <td className="px-3 py-1.5 text-text-muted tabular-nums">{i + 1}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ background: side?.color ?? 'transparent' }} aria-hidden />
                    {m.name}
                  </td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className={`px-3 py-1.5 text-right tabular-nums ${sort.key === c.key ? 'text-gold font-semibold' : ''}`}>{cell(m, c.key)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {data.members.some((m) => !m.counters) && (
        <p className="text-xs text-text-muted px-3 py-2 border-t border-card-border">
          “—” = this day’s XP, KC, deaths, loot and play time weren’t recorded (hourly tracking began later). Drops, tiles and submissions always count.
        </p>
      )}
    </Card>
  );
}

// ── Feeds ────────────────────────────────────────────────────────────────────────────────────────

const KIND_EMOJI: Record<string, string> = { pet: '🐾', unique: '✨', loot: '💰', death: '💀' };

function FeedLine({ d, nowMs, teamColor, children }: { d: DropLine; nowMs: number; teamColor?: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 py-1.5 border-b border-card-border/50 last:border-0 text-sm">
      {d.itemId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`https://static.runelite.net/cache/item/icon/${d.itemId}.png`} alt="" width={24} height={24} className="w-6 h-6 object-contain shrink-0" loading="lazy" />
      ) : (
        <span className="w-6 text-center shrink-0" aria-hidden>{KIND_EMOJI[d.kind] ?? '•'}</span>
      )}
      <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: teamColor ?? 'transparent' }} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <span className="text-xs text-text-muted whitespace-nowrap">{ago(d.occurredAt, nowMs)}</span>
    </li>
  );
}

function Feeds({ data }: { data: EventStatsData }) {
  const color = new Map(data.sides.map((s) => [s.teamId, s.color]));
  const sideName = new Map(data.sides.map((s) => [s.teamId, s.clanName ?? s.name]));
  const [dropKind, setDropKind] = useState<'all' | 'pet' | 'unique' | 'loot'>('all');
  const drops = data.drops.filter((d) => dropKind === 'all' || d.kind === dropKind);
  const now = data.event.nowMs;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="p-4 lg:col-span-1">
        <SectionTitle>Drops</SectionTitle>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {(['all', 'unique', 'pet', 'loot'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setDropKind(k)}
              className={`px-2.5 py-0.5 rounded-full text-xs border ${dropKind === k ? 'border-gold bg-gold/15 text-gold' : 'border-card-border text-text-muted hover:text-gold'}`}
            >
              {k === 'all' ? 'All' : k === 'unique' ? '✨ Rares' : k === 'pet' ? '🐾 Pets' : '💰 Big loot'}
            </button>
          ))}
        </div>
        {drops.length === 0 ? (
          <p className="text-sm text-text-muted py-4">Nothing yet.</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto pr-1">
            {drops.map((d) => (
              <FeedLine key={d.id} d={d} nowMs={now} teamColor={d.teamId != null ? color.get(d.teamId) : undefined}>
                <span className="font-semibold">{d.rsn}</span>{' '}
                <span className="text-text-muted">—</span> {d.quantity > 1 ? `${d.quantity.toLocaleString()} × ` : ''}
                {d.itemName ?? (d.kind === 'pet' ? 'a pet' : 'a drop')}
                {d.source && <span className="text-text-muted"> from {d.source}</span>}
                {d.valueGp ? <span className="text-gold"> · {compact(d.valueGp)}</span> : null}
              </FeedLine>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <SectionTitle aside={<span className="text-sm text-text-muted tabular-nums">{data.deaths.total.toLocaleString()} seen</span>}>Deaths</SectionTitle>
        {data.deaths.killers.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-text-muted mb-1">What killed us</p>
            <ol className="space-y-1">
              {data.deaths.killers.slice(0, 5).map((k, i) => (
                <li key={k.name} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-text-muted tabular-nums">{i + 1}.</span>
                  <span className="flex-1 truncate">{k.name}</span>
                  <span className="tabular-nums font-semibold">{k.count}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {data.deaths.recent.length === 0 ? (
          <p className="text-sm text-text-muted py-4">Nobody’s died. Yet.</p>
        ) : (
          <ul className="max-h-72 overflow-y-auto pr-1">
            {data.deaths.recent.map((d) => (
              <FeedLine key={d.id} d={d} nowMs={now} teamColor={d.teamId != null ? color.get(d.teamId) : undefined}>
                <span className="font-semibold">{d.rsn}</span>
                {d.source ? <span className="text-text-muted"> to {d.source}</span> : null}
              </FeedLine>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <SectionTitle aside={<span className="text-sm text-text-muted tabular-nums">{data.tiles.length}</span>}>Tiles completed</SectionTitle>
        {data.tiles.length === 0 ? (
          <p className="text-sm text-text-muted py-4">No tiles in this window.</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto pr-1">
            {data.tiles.map((t, i) => (
              <li key={i} className="flex items-center gap-2 py-1.5 border-b border-card-border/50 last:border-0 text-sm">
                <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: color.get(t.teamId) ?? 'transparent' }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold">{t.label}</span>
                  <span className="text-text-muted"> · {t.playerName ?? sideName.get(t.teamId) ?? 'team'}</span>
                </span>
                {t.points != null && <span className="text-xs text-gold tabular-nums">+{t.points}</span>}
                <span className="text-xs text-text-muted whitespace-nowrap">{ago(t.completedAt, now)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ── Page body ────────────────────────────────────────────────────────────────────────────────────

export default function StatsDashboard({ data }: { data: EventStatsData }) {
  const totals = data.sides.reduce(
    (t, s) => ({
      xp: t.xp + (s.counters?.xp ?? 0),
      kc: t.kc + (s.counters?.kc ?? 0),
      deaths: t.deaths + (s.counters?.deaths ?? 0),
      loot: t.loot + (s.counters?.loot ?? 0),
      minutes: t.minutes + (s.counters?.minutes ?? 0),
      rares: t.rares + s.rares,
      pets: t.pets + s.pets,
      tiles: t.tiles + s.tiles,
    }),
    { xp: 0, kc: 0, deaths: 0, loot: 0, minutes: 0, rares: 0, pets: 0, tiles: 0 },
  );
  const known = data.sides.some((s) => s.counters);
  const dash = (v: string) => (known ? v : '—');
  const leader = data.sides[0];
  const sideWord = data.isClanBoard ? 'Clans' : 'Teams';

  return (
    <div className="space-y-8">
      <section>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatTile emoji="📈" value={dash(compact(totals.xp))} label="XP gained" />
          <StatTile emoji="⚔️" value={dash(totals.kc.toLocaleString())} label="Boss KC" />
          <StatTile emoji="✨" value={totals.rares.toLocaleString()} label="Rare drops" />
          <StatTile emoji="🐾" value={totals.pets.toLocaleString()} label="Pets" />
          <StatTile emoji="💀" value={dash(totals.deaths.toLocaleString())} label="Deaths" />
          <StatTile emoji="💰" value={dash(compact(totals.loot))} label="Loot" />
          <StatTile emoji="⏱️" value={dash(hrs(totals.minutes))} label="Played" />
          <StatTile emoji="🧩" value={totals.tiles.toLocaleString()} label="Tiles done" />
        </div>
      </section>

      {data.sides.length > 1 && (
        <section>
          <SectionTitle>{sideWord}</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.sides.map((s, i) => (
              <Card key={s.teamId} className={`p-4 ${s === leader && s.score > 0 ? 'ring-1 ring-gold/50' : ''}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ background: s.color }} aria-hidden />
                  <span className="font-bold truncate">{s.clanName ?? s.name}</span>
                  <span className="ml-auto text-xs text-text-muted">#{i + 1}</span>
                </div>
                <p className="text-2xl font-extrabold text-gold tabular-nums">
                  {s.score.toLocaleString()} <span className="text-sm font-semibold text-text-muted">{data.unit}</span>
                </p>
                {data.window.kind === 'day' && <p className="text-xs text-text-muted mb-2">+{s.scoreGained.toLocaleString()} this day</p>}
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-2">
                  <dt className="text-text-muted">XP</dt><dd className="text-right tabular-nums">{s.counters ? compact(s.counters.xp) : '—'}</dd>
                  <dt className="text-text-muted">Boss KC</dt><dd className="text-right tabular-nums">{s.counters ? s.counters.kc.toLocaleString() : '—'}</dd>
                  <dt className="text-text-muted">Rares · pets</dt><dd className="text-right tabular-nums">{s.rares} · {s.pets}</dd>
                  <dt className="text-text-muted">Deaths</dt><dd className="text-right tabular-nums">{s.counters ? s.counters.deaths : '—'}</dd>
                  <dt className="text-text-muted">Loot</dt><dd className="text-right tabular-nums">{s.counters ? compact(s.counters.loot) : '—'}</dd>
                  <dt className="text-text-muted">Played</dt><dd className="text-right tabular-nums">{s.counters ? hrs(s.counters.minutes) : '—'}</dd>
                  <dt className="text-text-muted">Tiles</dt><dd className="text-right tabular-nums">{s.tiles}</dd>
                  <dt className="text-text-muted">Players</dt><dd className="text-right tabular-nums">{s.members}</dd>
                </dl>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle aside={<span className="text-xs text-text-muted">{data.window.kind === 'day' ? `Day ${data.window.day}, hour by hour` : 'Whole event, hour by hour'}</span>}>Progress</SectionTitle>
        <ProgressChart data={data} />
      </section>

      <section>
        <SectionTitle aside={<span className="text-xs text-text-muted">Deaths, loot & play time need the plugin</span>}>Players</SectionTitle>
        <MembersTable data={data} />
      </section>

      <Feeds data={data} />
    </div>
  );
}
