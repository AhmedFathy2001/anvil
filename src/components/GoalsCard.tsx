'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { clanFetch } from '@/lib/clanFetch';
import type { GoalView } from '@/lib/goalProgress';

/**
 * A character's goals — the same ones the plugin's You tab sets (lib/goals) — on its profile.
 *
 * Everyone who can see the profile sees the goals; only the owner gets the add form and the ×.
 * Progress comes from the numbers already on the page (lib/goalProgress), so a goal and the stat
 * beside it can't disagree.
 */
export interface GoalOptions {
  skills: string[];
  bosses: { key: string; label: string }[];
  /** Empty until the log is synced — log-page goals are offered only then. */
  pages: string[];
}

export default function GoalsCard({
  accountId,
  goals,
  editable,
  options,
}: {
  accountId: number;
  goals: GoalView[];
  editable: boolean;
  options: GoalOptions;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<'skill' | 'boss' | 'clog'>('skill');
  const [metric, setMetric] = useState(options.skills[0] ?? '');
  const [target, setTarget] = useState(99);
  const [dueOn, setDueOn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (goals.length === 0 && !editable) return null;

  function pickKind(k: 'skill' | 'boss' | 'clog') {
    setKind(k);
    setMetric(k === 'skill' ? options.skills[0] ?? '' : k === 'boss' ? options.bosses[0]?.key ?? '' : options.pages[0] ?? '');
    setTarget(k === 'skill' ? 99 : k === 'boss' ? 100 : 0);
  }

  async function send(method: 'POST' | 'DELETE', id?: number) {
    setBusy(true);
    setError(null);
    try {
      const res =
        method === 'POST'
          ? await clanFetch('/api/profile/goals', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accountId, kind, metric, target, dueOn: dueOn || null }),
            })
          : await clanFetch(`/api/profile/goals?accountId=${accountId}&id=${id}`, { method: 'DELETE' });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? 'Could not save that goal.');
        return;
      }
      setAdding(false);
      setDueOn('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const input = 'rounded-lg border border-card-border bg-brown-dark px-2 py-1.5 text-sm text-foreground';

  return (
    <section className="mb-6 rounded-xl border border-card-border bg-card-bg p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gold">
          <span className="h-5 w-1 rounded bg-gold" />
          Goals
        </h2>
        {editable && !adding && (
          <button type="button" onClick={() => setAdding(true)} className="text-sm text-gold hover:underline">
            + Add goal
          </button>
        )}
      </div>

      {goals.length === 0 ? (
        <p className="text-sm text-text-muted">
          No goals yet — set one here or from the RuneLite plugin&apos;s You tab: 99 a skill, a kill count to hit, a
          log page to finish.
        </p>
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => {
            const pct = g.current == null || g.of <= 0 ? 0 : Math.min(100, Math.floor((g.current / g.of) * 100));
            return (
              <li key={g.id}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className={g.done ? 'text-accent-green-light' : 'text-foreground'}>{g.label}</span>
                  <span className="flex items-center gap-3">
                    <span className={`tabular-nums ${g.done ? 'text-accent-green-light' : 'text-text-muted'}`}>{g.text}</span>
                    {editable && (
                      <button
                        type="button"
                        aria-label={`Remove ${g.label}`}
                        disabled={busy}
                        onClick={() => send('DELETE', g.id)}
                        className="text-text-dim hover:text-red-300"
                      >
                        ×
                      </button>
                    )}
                  </span>
                </div>
                {g.due && (
                  <p className="mt-1 text-xs">
                    <span className={g.due.tone === 'overdue' ? 'text-accent-red' : 'text-text-muted'}>{g.due.text}</span>
                    {g.due.pace && (
                      <span className={g.due.tone === 'behind' ? 'text-gold' : 'text-accent-green-light'}> · {g.due.pace}</span>
                    )}
                  </p>
                )}
                {g.current != null && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brown-dark">
                    <div
                      className={`h-full rounded-full ${g.done ? 'bg-accent-green' : 'bg-gold'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editable && adding && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-card-border pt-4">
          <select className={input} value={kind} onChange={(e) => pickKind(e.target.value as 'skill' | 'boss' | 'clog')}>
            <option value="skill">Skill level</option>
            <option value="boss">Boss kills</option>
            {options.pages.length > 0 && <option value="clog">Log page</option>}
          </select>
          <select className={input} value={metric} onChange={(e) => setMetric(e.target.value)}>
            {kind === 'skill' &&
              options.skills.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            {kind === 'boss' &&
              options.bosses.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            {kind === 'clog' &&
              options.pages.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
          </select>
          {kind !== 'clog' && (
            <input
              type="number"
              className={`${input} w-24`}
              min={kind === 'skill' ? 2 : 1}
              max={kind === 'skill' ? 99 : 100000}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
            />
          )}
          <label className="flex items-center gap-2 text-sm text-text-muted">
            by
            <input
              type="date"
              value={dueOn}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDueOn(e.target.value)}
              aria-label="Deadline (optional)"
              className={input}
            />
          </label>
          <button
            type="button"
            disabled={busy || !metric}
            onClick={() => send('POST')}
            className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-brown-dark disabled:opacity-50"
          >
            Add
          </button>
          <button type="button" onClick={() => setAdding(false)} className="text-sm text-text-muted hover:text-foreground">
            Cancel
          </button>
          {error && <p className="w-full text-sm text-red-300">{error}</p>}
        </div>
      )}
    </section>
  );
}
