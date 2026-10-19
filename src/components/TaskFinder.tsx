'use client';

import { useEffect, useRef, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';
import type { TaskSuggestion } from '@/lib/taskSuggest';

const SOURCE_BADGE: Record<TaskSuggestion['source'], string> = {
  library: 'Task',
  boss: 'Boss KC',
  skill: 'Skill XP',
  item: 'Drop',
};

/**
 * "What's the task?" — type it the way you'd say it and pick a tile that's already set up to track.
 * Suggestions come from lib/taskSuggest; picking one hands its fields to the editor below, which the
 * admin still checks and saves.
 */
export default function TaskFinder({ onPick, picked }: { onPick: (s: TaskSuggestion) => void; picked: string | null }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<TaskSuggestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await clanFetch(`/api/admin/task-suggest?q=${encodeURIComponent(query)}`);
        const data = res.ok ? ((await res.json()) as TaskSuggestion[]) : [];
        if (mine === seq.current) {
          setResults(data);
          setActive(0);
        }
      } catch {
        if (mine === seq.current) setResults([]);
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // Results for a query too short to search are stale, not empty — hide them rather than clear them.
  const shown = q.trim().length >= 2 ? results : null;

  function pick(s: TaskSuggestion) {
    onPick(s);
    setQ('');
    setResults(null);
  }

  return (
    <div className="mb-5 rounded-lg border border-gold/30 bg-gold/[0.05] p-3">
      <label htmlFor="task-finder" className="block text-sm font-medium mb-1">
        What&apos;s the task?
      </label>
      <input
        id="task-finder"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (!shown || shown.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, shown.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            pick(shown[active]);
          }
        }}
        placeholder="e.g. zenyte shard, 100 zulrah, 5m fishing, fire cape"
        autoComplete="off"
        className="w-full bg-brown-dark border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
      />
      {shown && (
        <ul className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-card-border bg-brown-dark divide-y divide-card-border/60">
          {shown.length === 0 ? (
            <li className="px-3 py-2.5 text-xs text-text-muted">
              {loading ? 'Looking…' : 'Nothing matched. Pick the kind yourself below.'}
            </li>
          ) : (
            shown.map((s, i) => (
              <li key={s.key}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(s)}
                  className={`w-full text-left px-3 py-2 flex items-start gap-2 ${i === active ? 'bg-gold/10' : 'hover:bg-gold/5'}`}
                >
                  <span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-card-border/70 text-text-muted">
                    {SOURCE_BADGE[s.source]}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground">{s.title}</span>
                    <span className="block text-[11px] text-text-muted">{s.hint}</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      <p className="mt-1.5 text-[11px] text-text-muted">
        {picked ? (
          <>
            <span className="text-accent-green-light">✓ Set up as “{picked}”.</span> Check the details below, then save.
          </>
        ) : (
          'Type it the way you’d say it. A leading number sets the amount. Or pick the kind yourself below.'
        )}
      </p>
    </div>
  );
}
