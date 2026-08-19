'use client';

import { useMemo, useState } from 'react';
import Input from '@/components/Input';
import { filterItems, itemGroups, type ItemFilter, type ProgressItem } from '@/lib/memberProgressItems';

/**
 * The list behind a progress counter — every quest (and, later, every combat task), searchable and
 * filterable, with what's left first.
 *
 * Shows EVERY item, not only the finished ones: "which of these haven't I done" is the question
 * this answers, and a list of completions can't answer it. Collapsed until asked for, because a
 * profile is a summary and two hundred rows is not.
 */

const FILTERS: { key: ItemFilter; label: string }[] = [
  { key: 'todo', label: 'Not done' },
  { key: 'done', label: 'Done' },
  { key: 'started', label: 'In progress' },
  { key: 'all', label: 'All' },
];

const STATE_STYLE: Record<number, string> = {
  0: 'text-text-muted/70',
  1: 'text-yellow-300',
  2: 'text-accent-green-light',
};

const STATE_MARK: Record<number, string> = { 0: '·', 1: '…', 2: '✓' };

export default function ProgressItemBrowser({
  items,
  label,
  done,
  total,
}: {
  items: ProgressItem[];
  /** What these are — "quests", "combat tasks". Used in the toggle and the empty line. */
  label: string;
  done: number;
  total: number;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ItemFilter>('todo');
  const [group, setGroup] = useState<string | null>(null);

  const groups = useMemo(() => itemGroups(items), [items]);
  const shown = useMemo(
    () => filterItems(items, { search, filter, group }),
    [items, search, filter, group],
  );

  if (items.length === 0) return null;

  return (
    <div className="border-t border-card-border pt-3 mt-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 text-left text-sm"
      >
        <span className="font-semibold">{label}</span>
        <span className="text-text-muted tabular-nums">
          {done}/{total}
        </span>
        <span className={`ml-auto text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="flex-1 min-w-[10rem]"
              aria-label={`Search ${label}`}
            />
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`text-[11px] font-semibold rounded-lg px-2.5 py-1.5 border transition-colors ${
                  filter === f.key
                    ? 'bg-gold text-brown-dark border-gold'
                    : 'border-card-border text-text-muted hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {groups.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setGroup(null)}
                className={`text-[11px] rounded-lg px-2 py-1 border transition-colors ${
                  group === null ? 'border-gold/50 text-gold' : 'border-card-border text-text-muted hover:text-foreground'
                }`}
              >
                Every kind
              </button>
              {groups.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroup(g === group ? null : g)}
                  className={`text-[11px] rounded-lg px-2 py-1 border transition-colors ${
                    group === g ? 'border-gold/50 text-gold' : 'border-card-border text-text-muted hover:text-foreground'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}

          <p className="text-[11px] text-text-muted">
            {shown.length === items.length
              ? `${items.length} ${label.toLowerCase()}`
              : `${shown.length} of ${items.length}`}
          </p>

          <ul className="max-h-80 overflow-y-auto divide-y divide-card-border/60 border border-card-border rounded-lg">
            {shown.length === 0 ? (
              <li className="px-3 py-3 text-sm text-text-muted">Nothing matches that.</li>
            ) : (
              shown.map((item) => (
                <li key={item.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <span className={`w-4 text-center ${STATE_STYLE[item.state]}`} aria-hidden>
                    {STATE_MARK[item.state]}
                  </span>
                  <span className={item.state === 2 ? 'text-text-muted' : ''}>{item.name}</span>
                  {item.group && (
                    <span className="ml-auto text-[10px] text-text-muted/70 shrink-0">{item.group}</span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
