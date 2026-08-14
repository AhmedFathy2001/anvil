'use client';

import { cumulative, heatLevel } from '@/lib/competitionInsights';
import type { CompetitionType } from '@/lib/competitionInsights';
import type { CompetitionEntry } from '@/lib/competitionView';
import { dateLabel, exactValue, shortValue, weekdayLabel } from './format';

/**
 * The week itself: the race, the days, and who turned up on which of them.
 *
 * A competition's total says who won. Only the daily shape says HOW — whether the leader put it all
 * in on Monday, whether someone is closing, whether the clan had one big night or seven steady ones.
 * All of it is `member_daily_stats` read back over the competition's day range.
 */

const LINE_COLORS = ['#f0c940', '#4aa3d4', '#5cbf7a', '#e0603f', '#a78bfa'];

export function RaceChart({
  entries,
  days,
  elapsed,
  type,
  unit,
}: {
  entries: CompetitionEntry[];
  days: string[];
  elapsed: number;
  type: CompetitionType;
  unit: string;
}) {
  const top = entries.slice(0, 5).filter((e) => e.gained > 0);
  if (top.length === 0 || elapsed < 2) return null;

  const W = 640;
  const H = 210;
  const PAD_L = 46;
  const PAD_B = 22;
  const series = top.map((e) => cumulative(e.days, elapsed));
  const max = Math.max(...series.flat(), 1);
  const x = (i: number) => PAD_L + (i / Math.max(1, elapsed - 1)) * (W - PAD_L - 10);
  const y = (v: number) => H - PAD_B - (v / max) * (H - PAD_B - 12);

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4 sm:p-5">
      <h3 className="text-sm font-bold">The race, day by day</h3>
      <p className="mt-0.5 text-xs text-text-muted">
        cumulative {unit} for the top {top.length} — the shape of the week, not just its total
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 block w-full overflow-visible" role="img" aria-label="Cumulative gains per day">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={PAD_L} y1={y(max * f)} x2={W - 10} y2={y(max * f)} stroke="rgba(61,50,38,0.85)" strokeWidth={1} />
            <text x={PAD_L - 8} y={y(max * f) + 4} textAnchor="end" fontSize="10" fill="#8a7e6c" fontFamily="ui-monospace, monospace">
              {shortValue(Math.round(max * f), type)}
            </text>
          </g>
        ))}
        {series.map((s, i) => (
          <g key={top[i].rsn}>
            <polyline
              points={s.map((v, k) => `${x(k)},${y(v)}`).join(' ')}
              fill="none"
              stroke={LINE_COLORS[i]}
              strokeWidth={i === 0 ? 2.4 : 1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={i === 0 ? 1 : 0.85}
            />
            <circle cx={x(s.length - 1)} cy={y(s[s.length - 1])} r={3.2} fill={LINE_COLORS[i]} />
          </g>
        ))}
        {days.slice(0, elapsed).map((day, k) => (
          <text key={day} x={x(k)} y={H - 6} textAnchor="middle" fontSize="10" fill="#8a7e6c">
            {weekdayLabel(day)}
          </text>
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-text-muted">
        {top.map((e, i) => (
          <span key={e.rsn} className="inline-flex items-center gap-1.5">
            <i className="block h-[3px] w-3 rounded-full" style={{ backgroundColor: LINE_COLORS[i] }} />
            <b className="font-semibold text-foreground">{e.rsn}</b> {shortValue(e.gained, type)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function DayStrip({
  days,
  elapsed,
  totals,
  leaders,
  entries,
  type,
  unit,
}: {
  days: string[];
  elapsed: number;
  totals: number[];
  leaders: (string | null)[];
  entries: CompetitionEntry[];
  type: CompetitionType;
  unit: string;
}) {
  const max = Math.max(...totals, 1);
  const elapsedTotals = totals.slice(0, elapsed);
  const bestIdx = elapsedTotals.indexOf(Math.max(...elapsedTotals));
  const quietIdx = elapsedTotals.indexOf(Math.min(...elapsedTotals));
  const peopleOnBest = entries.filter((e) => (e.days[bestIdx] ?? 0) > 0).length;

  return (
    <div className="mt-4 rounded-xl border border-card-border bg-card-bg p-4 sm:p-5">
      <h3 className="text-sm font-bold">Every day of the week</h3>
      <p className="mt-0.5 text-xs text-text-muted">the clan&apos;s total, and who led each day</p>

      <div className="mt-3.5 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(66px, 1fr))' }}>
        {days.map((day, i) => {
          const future = i >= elapsed;
          const today = i === elapsed - 1;
          return (
            <div
              key={day}
              className={`rounded-lg border px-1.5 py-2 text-center ${
                today ? 'border-gold/50 bg-gold/[0.08]' : 'border-card-border bg-brown-dark/40'
              } ${future ? 'opacity-35' : ''}`}
              title={dateLabel(day)}
            >
              <div className="text-[10px] uppercase tracking-wider text-text-muted">{weekdayLabel(day)}</div>
              <div className={`mt-1.5 font-mono text-sm font-bold ${today ? 'text-gold-light' : future ? 'text-text-muted' : ''}`}>
                {future ? '—' : shortValue(totals[i] ?? 0, type)}
              </div>
              <div className="mt-1 truncate text-[10.5px] text-text-muted">{future ? 'to come' : leaders[i] ?? 'nobody'}</div>
              <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-brown-dark">
                <div className="h-full rounded-full bg-accent-green" style={{ width: future ? 0 : `${((totals[i] ?? 0) / max) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {elapsedTotals.some((t) => t > 0) && (
        <div className="mt-4 rounded-lg border border-purple-400/25 bg-gradient-to-r from-purple-500/10 to-card-bg px-4 py-3 text-[13px] text-text-muted">
          <span className="font-mono text-lg font-bold text-purple-300">{weekdayLabel(days[bestIdx])}</span> was the
          clan&apos;s biggest day — <b className="font-semibold text-foreground">{shortValue(totals[bestIdx], type)} {unit}</b> across{' '}
          <b className="font-semibold text-foreground">{peopleOnBest} {peopleOnBest === 1 ? 'person' : 'people'}</b>
          {leaders[bestIdx] && <>, led by <b className="font-semibold text-foreground">{leaders[bestIdx]}</b></>}.
          {elapsed > 1 && quietIdx !== bestIdx && (
            <> {weekdayLabel(days[quietIdx])} was the quietest at {shortValue(totals[quietIdx], type)}.</>
          )}
        </div>
      )}
    </div>
  );
}

export function TrainingHeatmap({
  entries,
  days,
  elapsed,
  verb,
  type,
  limit = 12,
}: {
  entries: CompetitionEntry[];
  days: string[];
  elapsed: number;
  verb: string;
  type: CompetitionType;
  limit?: number;
}) {
  const rows = entries.filter((e) => e.gained > 0).slice(0, limit);
  if (rows.length === 0) return null;
  const max = Math.max(...rows.flatMap((e) => e.days.slice(0, elapsed)), 1);
  const SHADES = ['bg-card-border/50', 'bg-accent-green/25', 'bg-accent-green/45', 'bg-accent-green/70', 'bg-accent-green'];

  return (
    <div className="mt-4 rounded-xl border border-card-border bg-card-bg p-4 sm:p-5">
      <h3 className="text-sm font-bold">Who {verb} when</h3>
      <p className="mt-0.5 text-xs text-text-muted">
        one square per member per day — darker means a bigger day
        {entries.filter((e) => e.gained > 0).length > rows.length && <> · top {rows.length} shown</>}
      </p>

      <div className="mt-3.5 overflow-x-auto">
        <table className="border-separate border-spacing-[3px] text-[11.5px]">
          <thead>
            <tr>
              <th />
              {days.slice(0, elapsed).map((day) => (
                <th key={day} className="pb-1 text-center text-[10px] uppercase tracking-wider text-text-muted">
                  {weekdayLabel(day).slice(0, 2)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.rsn}>
                <th className="max-w-[130px] truncate pr-2 text-left font-normal text-text-muted">{e.rsn}</th>
                {days.slice(0, elapsed).map((day, i) => {
                  const v = e.days[i] ?? 0;
                  return (
                    <td
                      key={day}
                      className={`h-[22px] w-[26px] rounded ${SHADES[heatLevel(v, max)]}`}
                      title={`${e.rsn} · ${dateLabel(day)} · ${v > 0 ? exactValue(v, type) : 'nothing'}`}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-text-muted">
        <span>none</span>
        {SHADES.map((s) => (
          <i key={s} className={`block h-3 w-4 rounded ${s}`} />
        ))}
        <span>biggest day</span>
      </div>
    </div>
  );
}
