'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

// One shape for boards and weeklies alike — see lib/eventIndex.
interface Item {
  kind: 'board' | 'weekly';
  id: number;
  title: string;
  badge: string;
  status: 'draft' | 'upcoming' | 'running' | 'ended';
  startDate: string;
  endDate: string;
  href: string;
  headline: string;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatMonthYear(d: Date): string {
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

function classForItem(item: Item): string {
  if (item.status === 'running') return 'bg-accent-green/20 text-accent-green-light border-accent-green/40';
  if (item.status === 'upcoming') return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  if (item.kind === 'weekly') return 'bg-purple-400/20 text-purple-300 border-purple-400/40';
  return 'bg-text-muted/20 text-text-muted border-text-muted/40';
}

export default function ScheduleClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));

  useEffect(() => {
    fetch('/api/admin/schedule')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setItems((data.items ?? []) as Item[]))
      .finally(() => setLoading(false));
  }, []);

  const monthGrid = useMemo(() => {
    // 6-week grid starting from Sunday of the week containing the 1st
    const first = cursor;
    const start = addDays(first, -first.getDay());
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) days.push(addDays(start, i));
    return days;
  }, [cursor]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const day of monthGrid) {
      const key = day.toISOString().slice(0, 10);
      const hits = items.filter((it) => {
        const s = new Date(it.startDate);
        const e = new Date(it.endDate);
        return day >= new Date(s.getFullYear(), s.getMonth(), s.getDate())
          && day <= new Date(e.getFullYear(), e.getMonth(), e.getDate());
      });
      map.set(key, hits);
    }
    return map;
  }, [monthGrid, items]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return [...items]
      .filter((it) => new Date(it.endDate) > now)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 8);
  }, [items]);

  const today = new Date();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gold">Schedule</h1>
          <p className="text-text-muted text-sm mt-1">
            Bingo events and weekly competitions in one view.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/dashboard"
            className="px-3 py-1.5 text-sm border border-card-border rounded-lg hover:border-gold/40 transition-colors"
          >
            Back
          </Link>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        <span className="px-2 py-0.5 rounded border border-gold/40 bg-gold/20 text-gold">Bingo event</span>
        <span className="px-2 py-0.5 rounded border border-accent-green/40 bg-accent-green/20 text-accent-green-light">
          Active weekly
        </span>
        <span className="px-2 py-0.5 rounded border border-blue-500/40 bg-blue-500/20 text-blue-300">
          Upcoming weekly
        </span>
        <span className="px-2 py-0.5 rounded border border-text-muted/40 bg-text-muted/20 text-text-muted">
          Completed weekly
        </span>
        <span className="px-2 py-0.5 rounded border border-red-500/40 bg-red-500/20 text-red-300">Force-ended</span>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">{formatMonthYear(cursor)}</h2>
        <div className="flex gap-1">
          <button
            onClick={() => setCursor(addMonths(cursor, -1))}
            className="px-3 py-1 text-sm border border-card-border rounded hover:border-gold/40 transition-colors"
          >
            &larr;
          </button>
          <button
            onClick={() => setCursor(startOfMonth(new Date()))}
            className="px-3 py-1 text-sm border border-card-border rounded hover:border-gold/40 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="px-3 py-1 text-sm border border-card-border rounded hover:border-gold/40 transition-colors"
          >
            &rarr;
          </button>
        </div>
      </div>

      {/* Calendar — min-width keeps day cells usable on phones; the card scrolls sideways instead */}
      <div className="border border-card-border rounded-xl bg-card-bg overflow-x-auto">
        <div className="min-w-[560px]">
        <div className="grid grid-cols-7 border-b border-card-border text-xs text-text-muted">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="px-2 py-2 text-center font-medium">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {monthGrid.map((day, idx) => {
            const key = day.toISOString().slice(0, 10);
            const dayItems = itemsByDay.get(key) || [];
            const inMonth = day.getMonth() === cursor.getMonth();
            const isToday = sameDay(day, today);
            return (
              <div
                key={idx}
                className={`border-r border-b border-card-border/60 min-h-[88px] p-1.5 text-xs flex flex-col gap-1 ${
                  inMonth ? '' : 'bg-brown-dark/40 text-text-muted/60'
                }`}
              >
                <div
                  className={`flex items-center justify-end ${
                    isToday
                      ? 'w-6 h-6 ml-auto rounded-full bg-gold text-brown-dark font-bold flex items-center justify-center'
                      : 'text-text-muted'
                  }`}
                >
                  {day.getDate()}
                </div>
                {dayItems.slice(0, 3).map((it) => (
                  <Link
                    key={`${it.kind}-${it.id}`}
                    href={it.href}
                    className={`block truncate px-1.5 py-0.5 border rounded text-[10px] ${classForItem(it)}`}
                  >
                    {it.kind === 'board' ? '🎯 ' : '🏆 '}
                    {it.title}
                  </Link>
                ))}
                {dayItems.length > 3 && (
                  <span className="text-[10px] text-text-muted">+{dayItems.length - 3} more</span>
                )}
              </div>
            );
          })}
        </div>
        </div>
      </div>

      {/* Upcoming list */}
      <div className="mt-8">
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <span className="w-1 h-5 bg-gold rounded-full" />
          Upcoming & active
        </h2>
        {loading ? (
          <p className="text-text-muted text-sm">Loading...</p>
        ) : upcoming.length === 0 ? (
          <p className="text-text-muted text-sm">Nothing scheduled.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((it) => (
              <Link
                key={`${it.kind}-${it.id}`}
                href={it.href}
                className="flex items-center justify-between border border-card-border rounded-lg p-3 bg-card-bg hover:border-gold/40 hover:bg-card-bg-hover transition-all"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">
                      {it.kind === 'board' ? '🎯' : '🏆'} {it.badge} · {it.headline}
                    </span>
                    <span className="font-semibold">{it.title}</span>
                    {it.kind === 'weekly' && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${classForItem(it)}`}>
                        {it.status}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">
                    {new Date(it.startDate).toLocaleDateString()} → {new Date(it.endDate).toLocaleDateString()}
                  </div>
                </div>
                <span className="text-text-muted">&rarr;</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
