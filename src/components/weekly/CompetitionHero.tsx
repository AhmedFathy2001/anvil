'use client';

import { useEffect, useState } from 'react';
import { shortValue } from './format';
import type { CompetitionType } from '@/lib/competitionInsights';

/**
 * The competition's header.
 *
 * The old page opened on a metric chip, a date range and a table — nothing that tells you whether
 * this is a big week or a dead one. What a competition actually has going for it is a clock and a
 * comparison: how much the clan has moved, how much of that landed today, who's in front and by how
 * much, and whether this pace beats the last time the clan ran this metric.
 */

interface Props {
  title: string;
  type: CompetitionType;
  metricLabel: string;
  unit: string;
  status: string;
  startDate: string;
  endDate: string;
  iconUrl: string | null;
  clanTotal: number;
  todayTotal: number;
  scoring: number;
  entered: number;
  leader: { rsn: string; gained: number; margin: number } | null;
  projected: number | null;
  previous: { title: string; total: number; deltaPct: number } | null;
  elapsed: number;
  totalDays: number;
}

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86_400), h: Math.floor((s % 86_400) / 3_600), m: Math.floor((s % 3_600) / 60), s: s % 60 };
}

const TYPE_WORD: Record<CompetitionType, string> = { skill: 'Skill', boss: 'Boss', efficiency: 'Efficiency' };

export default function CompetitionHero({
  title, type, metricLabel, unit, status, startDate, endDate, iconUrl,
  clanTotal, todayTotal, scoring, entered, leader, projected, previous, elapsed, totalDays,
}: Props) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const ended = status === 'completed';
  const upcoming = status === 'upcoming';
  const target = Date.parse(upcoming ? startDate : endDate);
  const remaining = now !== null && Number.isFinite(target) ? target - now : null;
  const { d, h, m } = parts(remaining ?? 0);

  const range = `${new Date(startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl border border-gold/25 bg-card-bg">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_80%_at_8%_0%,rgba(212,175,55,0.15),transparent_62%)]" />
      <div className="relative p-6 sm:p-7">
        <div className="flex flex-wrap items-start gap-4">
          {iconUrl && (
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-gold/25 bg-brown-dark/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={iconUrl} alt="" className="h-9 w-9 object-contain" />
            </span>
          )}
          <div className="min-w-0">
            <div className="flex h-4 items-center text-[11px] font-semibold uppercase tracking-widest">
              {now !== null && (
                <span className={`flex items-center gap-1.5 ${ended ? 'text-text-muted' : upcoming ? 'text-blue-400' : 'text-accent-green-light'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${ended ? 'bg-text-muted' : upcoming ? 'bg-blue-400' : 'animate-pulse bg-accent-green-light'}`} />
                  {ended ? 'Finished · final standings' : upcoming ? 'Starts soon' : `Live · day ${elapsed} of ${totalDays}`}
                </span>
              )}
            </div>
            <h1 className="mt-1 break-words text-2xl font-extrabold leading-tight text-gold sm:text-3xl">{title}</h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-gold/15 px-2.5 py-0.5 font-medium text-gold">
                {TYPE_WORD[type]}: {metricLabel}
              </span>
              <span className="rounded-full border border-card-border bg-brown-dark/60 px-2.5 py-0.5 text-text-muted">{range}</span>
              <span className="rounded-full border border-card-border bg-brown-dark/60 px-2.5 py-0.5 text-text-muted">
                {scoring} of {entered} scoring
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-x-7 gap-y-5">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Clan total</div>
            <div className="mt-1.5 font-mono text-3xl font-bold leading-none tabular-nums text-gold-light">
              {shortValue(clanTotal, type)}
            </div>
            <div className="mt-1.5 text-[11.5px] text-text-muted">
              {unit} gained{!ended && todayTotal > 0 && <> · {shortValue(todayTotal, type)} today</>}
            </div>
          </div>

          <span className="hidden self-stretch border-l border-card-border sm:block" />

          {leader && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">{ended ? 'Winner' : 'Leader'}</div>
              <div className="mt-1.5 truncate font-mono text-lg font-bold leading-none">{leader.rsn}</div>
              <div className="mt-1.5 text-[11.5px] text-text-muted">
                {shortValue(leader.gained, type)}
                {leader.margin > 0 && <> · {shortValue(leader.margin, type)} clear</>}
              </div>
            </div>
          )}

          {projected !== null && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                {ended ? 'Final total' : 'On pace for'}
              </div>
              <div className={`mt-1.5 font-mono text-lg font-bold leading-none ${previous && previous.deltaPct >= 0 ? 'text-accent-green-light' : ''}`}>
                {shortValue(projected, type)}
              </div>
              <div className="mt-1.5 text-[11.5px] text-text-muted">
                {previous ? (
                  <>
                    {previous.deltaPct >= 0 ? '▲' : '▼'} {Math.abs(previous.deltaPct)}% vs {previous.title}
                  </>
                ) : (
                  'no earlier week on this metric'
                )}
              </div>
            </div>
          )}

          {!ended && remaining !== null && remaining > 0 && (
            <>
              <span className="hidden self-stretch border-l border-card-border sm:block" />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-gold/60">
                  {upcoming ? 'Starts in' : 'Ends in'}
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  {[{ v: d, u: 'Days' }, { v: h, u: 'Hrs' }, { v: m, u: 'Min' }].map((seg) => (
                    <span key={seg.u} className="min-w-[3.1rem] rounded-lg border border-gold/15 bg-black/25 px-2 py-1.5 text-center">
                      <b className="block font-mono text-xl font-bold leading-none tabular-nums" suppressHydrationWarning>
                        {String(seg.v).padStart(2, '0')}
                      </b>
                      <i className="mt-1 block text-[9px] not-italic uppercase tracking-widest text-text-muted">{seg.u}</i>
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mt-5 max-w-lg">
          <div className="mb-1.5 flex justify-between text-[10px] uppercase tracking-wider text-text-muted">
            <span>{new Date(startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            <span>{ended ? 'complete' : `day ${elapsed} of ${totalDays}`}</span>
            <span>{new Date(endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full border border-card-border bg-brown-dark">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-dark to-gold-light"
              style={{ width: `${Math.round((elapsed / Math.max(1, totalDays)) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
