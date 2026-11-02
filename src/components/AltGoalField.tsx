'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { COUNTER_TARGETS } from '@/lib/constants';
import { clanFetch } from '@/lib/clanFetch';
import { altGoalPhrase, isGotrEnergyCapped, isGotrSearchGoal, GOTR_ENERGY_CAPS, type AltGoal } from '@/lib/altGoal';

/**
 * "Or finish it another way" — an either/or tile's alternative (lib/altGoal): an in-game counter or a
 * monster the plugin counts, how many, and for GOTR searches whether only searches paid for with
 * energy earned during the event count. Shared by the full tile editor and the tile creator.
 *
 * Targets are kill-tile names (plugin-counted), never hiscores keys — the alternative is credited
 * through the plugin's kill-tile path.
 */
export default function AltGoalField({
  value,
  onChange,
  npcSearchUrl = '/api/admin/npc-search',
  disabled = false,
}: {
  value: AltGoal | null;
  onChange: (next: AltGoal | null) => void;
  /** Wiki monster search endpoint (the editor passes its own lookup API). */
  npcSearchUrl?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(value != null);
  const [q, setQ] = useState('');
  const [npcs, setNpcs] = useState<string[]>([]);
  const [amountText, setAmountText] = useState(value ? String(value.amount) : '100');
  const seq = useRef(0);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 3) return;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await clanFetch(`${npcSearchUrl}?q=${encodeURIComponent(query)}`);
        const data = res.ok ? ((await res.json()) as { name: string }[]) : [];
        if (mine === seq.current) setNpcs(Array.isArray(data) ? data.map((d) => d.name) : []);
      } catch {
        if (mine === seq.current) setNpcs([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, npcSearchUrl]);

  const targets = useMemo(() => value?.targets ?? [], [value]);
  const hits = useMemo(() => {
    const f = q.trim().toLowerCase();
    if (f.length < 2) return { counters: [] as { name: string; note: string }[], monsters: [] as string[] };
    const have = new Set(targets.map((t) => t.toLowerCase()));
    const counters = COUNTER_TARGETS.filter((c) => c.name.toLowerCase().includes(f) && !have.has(c.name.toLowerCase())).slice(0, 6);
    const monsters = npcs
      .filter((n) => n.toLowerCase().includes(f) && !have.has(n.toLowerCase()) && !counters.some((c) => c.name.toLowerCase() === n.toLowerCase()))
      .slice(0, 6);
    return { counters, monsters };
  }, [q, npcs, targets]);

  const amount = Math.max(1, parseInt(amountText, 10) || 1);
  const emit = (next: Partial<AltGoal>) => {
    const t = next.targets ?? targets;
    if (t.length === 0) {
      onChange(null);
      return;
    }
    const capBy = next.capBy !== undefined ? next.capBy : value?.capBy;
    onChange({ targets: t, amount: next.amount ?? amount, ...(capBy && capBy.length > 0 ? { capBy } : {}) });
  };
  const add = (name: string) => {
    const t = [...targets, name];
    // The energy cap only means anything on GOTR searches.
    emit({ targets: t, capBy: isGotrSearchGoal({ targets: t, amount }) ? value?.capBy : undefined });
    setQ('');
  };
  const remove = (name: string) => {
    const t = targets.filter((x) => x !== name);
    emit({ targets: t, capBy: isGotrSearchGoal({ targets: t, amount }) ? value?.capBy : [] });
  };

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="text-xs text-gold hover:text-gold-light disabled:opacity-40"
      >
        + Or finish it another way
      </button>
    );
  }

  const gotr = isGotrSearchGoal(value);
  const otherCaps = value?.capBy && !isGotrEnergyCapped(value) ? value.capBy : null;
  return (
    <fieldset className="rounded-lg border border-card-border bg-brown-dark/40 p-3 space-y-2" disabled={disabled}>
      <legend className="px-1 text-xs text-text-muted">Or finish it another way</legend>
      <p className="text-[10px] text-text-muted">
        The tile also completes when the team reaches this instead — counted by the plugin, like a kill tile. It never adds to the tile’s own count.
      </p>

      {targets.length > 0 && (
        <ul aria-label="What counts instead" className="flex flex-wrap gap-1.5">
          {targets.map((t) => (
            <li key={t} className="flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 pl-2.5 pr-1 text-xs">
              <span>{t}</span>
              <button type="button" aria-label={`Remove ${t}`} onClick={() => remove(t)} className="w-6 h-6 grid place-items-center text-text-muted hover:text-foreground">
                <span aria-hidden="true">&times;</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <input
          aria-label="Counter or monster that counts instead"
          placeholder={targets.length ? 'Add another counter or monster…' : 'Search a counter or monster (e.g. GOTR searches)…'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full px-2 py-1.5 rounded bg-brown-dark border border-card-border text-xs focus:outline-none focus:border-gold"
        />
        {(hits.counters.length > 0 || hits.monsters.length > 0) && (
          <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded border border-card-border bg-brown-dark shadow-xl text-xs">
            {hits.counters.length > 0 && (
              <>
                <p className="px-2 pt-1.5 text-[9px] uppercase tracking-wider text-text-muted/70">In-game counters</p>
                {hits.counters.map((c) => (
                  <button key={c.name} type="button" onClick={() => add(c.name)} title={c.note} className="w-full text-left px-2 py-1.5 hover:bg-gold/10">
                    {c.name}
                  </button>
                ))}
              </>
            )}
            {hits.monsters.length > 0 && (
              <>
                <p className="px-2 pt-1.5 text-[9px] uppercase tracking-wider text-text-muted/70">Monsters</p>
                {hits.monsters.map((n) => (
                  <button key={n} type="button" onClick={() => add(n)} className="w-full text-left px-2 py-1.5 hover:bg-gold/10">
                    {n}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-text-muted" htmlFor="alt-goal-amount">How many</label>
        <input
          id="alt-goal-amount"
          type="number"
          min={1}
          value={amountText}
          onChange={(e) => {
            setAmountText(e.target.value);
            const n = parseInt(e.target.value, 10);
            if (n >= 1 && targets.length > 0) emit({ amount: n });
          }}
          className="w-24 px-2 py-1 rounded bg-brown-dark border border-card-border text-xs focus:outline-none focus:border-gold"
        />
      </div>

      {gotr && (
        <label className="flex items-start gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={isGotrEnergyCapped(value)}
            onChange={(e) => emit({ capBy: e.target.checked ? [...GOTR_ENERGY_CAPS] : [] })}
          />
          <span>
            Only searches paid for with energy earned during the event
            <span className="block text-[10px] text-text-muted">Each member’s searches count up to the elemental and catalytic energy they attune during the event.</span>
          </span>
        </label>
      )}
      {otherCaps && (
        <p className="text-[10px] text-text-muted">
          Capped by {otherCaps.join(' and ')} earned during the event.{' '}
          <button type="button" className="text-gold hover:text-gold-light" onClick={() => emit({ capBy: [] })}>Remove cap</button>
        </p>
      )}

      {value && <p className="text-[11px] text-foreground/80">Or: {altGoalPhrase(value)}.</p>}

      <button
        type="button"
        onClick={() => {
          onChange(null);
          setOpen(false);
        }}
        className="text-[11px] text-text-muted hover:text-red-400"
      >
        Remove the alternative
      </button>
    </fieldset>
  );
}
