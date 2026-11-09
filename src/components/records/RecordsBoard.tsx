'use client';

import { useMemo, useState } from 'react';
import ClanLink from '@/components/ClanLink';

import {
  RECORD_PERIODS,
  formatRecordValue,
  recordMetricKind,
  recordMetricLabel,
  type RecordKind,
  type RecordPeriod,
} from '@/lib/recordsRules';

export interface RecordRow {
  metric: string;
  period: RecordPeriod;
  value: number;
  startedAt: string;
  endedAt: string;
  /** Present on clan boards: who holds it. */
  rsn?: string;
  href?: string;
}

const PERIOD_LABEL: Record<RecordPeriod, string> = { day: 'Best day', week: 'Best week', month: 'Best month', year: 'Best year' };
const KIND_LABEL: Record<RecordKind, string> = { hours: 'Hours', skill: 'Skills', boss: 'Bosses' };
const KIND_ORDER: RecordKind[] = ['hours', 'skill', 'boss'];

function when(row: RecordRow): string {
  const d = new Date(row.startedAt);
  if (Number.isNaN(d.getTime())) return '';
  const opts: Intl.DateTimeFormatOptions =
    row.period === 'year' ? { year: 'numeric', timeZone: 'UTC' }
    : row.period === 'month' ? { month: 'short', year: 'numeric', timeZone: 'UTC' }
    : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' };
  const label = d.toLocaleDateString('en-GB', opts);
  return row.period === 'week' ? `week of ${label}` : label;
}

/**
 * Records grid: a period switch, then hours / skills / bosses. The same component draws one
 * player's records (no `rsn`) and a clan's record holders (each row names its holder).
 */
export default function RecordsBoard({ rows, emptyText }: { rows: RecordRow[]; emptyText: string }) {
  const [period, setPeriod] = useState<RecordPeriod>('day');
  const grouped = useMemo(() => {
    const byKind = new Map<RecordKind, RecordRow[]>();
    for (const r of rows) {
      if (r.period !== period) continue;
      const k = recordMetricKind(r.metric);
      byKind.set(k, [...(byKind.get(k) ?? []), r]);
    }
    for (const list of byKind.values()) {
      list.sort((a, b) => (a.metric === 'overall' ? -1 : b.metric === 'overall' ? 1 : recordMetricLabel(a.metric).localeCompare(recordMetricLabel(b.metric))));
    }
    return byKind;
  }, [rows, period]);

  return (
    <div>
      <div role="tablist" aria-label="Record period" className="flex flex-wrap gap-1.5 mb-3">
        {RECORD_PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={period === p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              period === p ? 'bg-gold/15 text-gold border border-gold/40' : 'text-text-muted border border-card-border hover:text-foreground'
            }`}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>
      {grouped.size === 0 ? (
        <p className="text-sm text-text-muted">{emptyText}</p>
      ) : (
        <div className="space-y-4">
          {KIND_ORDER.filter((k) => grouped.has(k)).map((k) => (
            <section key={k}>
              <h3 className="text-xs uppercase tracking-wide text-text-muted mb-1.5">{KIND_LABEL[k]}</h3>
              <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {grouped.get(k)!.map((r) => (
                  <li key={`${r.metric}-${r.period}`} className="border border-card-border rounded-lg bg-card-bg px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm truncate">{recordMetricLabel(r.metric)}</span>
                      <span className="text-sm font-semibold text-gold tabular-nums whitespace-nowrap">{formatRecordValue(r.metric, r.value)}</span>
                    </div>
                    <div className="text-xs text-text-muted truncate">
                      {r.rsn ? (
                        <>
                          {r.href ? <ClanLink href={r.href} className="hover:text-gold">{r.rsn}</ClanLink> : r.rsn}
                          {' · '}
                        </>
                      ) : null}
                      {when(r)}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
