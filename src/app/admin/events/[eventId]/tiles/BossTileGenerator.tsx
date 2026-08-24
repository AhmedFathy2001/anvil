'use client';

import { useMemo, useState } from 'react';
import Input from '@/components/Input';
import Checkbox from '@/components/Checkbox';
import { clanFetch } from '@/lib/clanFetch';
import {
  bossCategoryViews,
  bossKcRows,
  monsterCategoryViews,
  npcKillRows,
  parseNpcList,
  parsePoints,
  parseThresholds,
  type GeneratedTileRow,
} from '@/lib/bossTileGen';

interface Props {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  eventId: number;
  canGrow: boolean;
  pointsMode: boolean;
  onCreated: (summary: { created: number; ignored: number; label: string }) => void;
  onError: (text: string) => void;
}

/**
 * "Generate KC tiles" — every boss you pick × every threshold you type.
 *
 * The skill generator does one goal per batch, which is right for XP: nobody wants 500K/1M/2M
 * Cooking as three tiles. Kill counts are the opposite — a board's whole shape is often 25/50/100
 * across twenty bosses, which is eighty tiles and eighty trips through the editor. So thresholds are
 * a LIST here, and the filters exist so "all the slayer bosses" is two clicks rather than six.
 *
 * The second tab covers what the hiscores never counted: slayer monsters and any other NPC, pasted
 * by name and generated as kill tiles the plugin credits directly.
 */
export default function BossTileGenerator({
  open: controlledOpen, onOpenChange, hideTrigger, eventId, canGrow, pointsMode, onCreated, onError,
}: Props) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setInnerOpen(v));

  const categories = useMemo(() => bossCategoryViews(), []);
  const [mode, setMode] = useState<'boss' | 'npc'>('boss');
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [npcText, setNpcText] = useState('');
  const [npcCategory, setNpcCategory] = useState('Slayer');
  const monsterCategories = useMemo(() => monsterCategoryViews(), []);
  const [monsterFilter, setMonsterFilter] = useState<string>('all');
  const [monsterSearch, setMonsterSearch] = useState('');
  const [pickedMonsters, setPickedMonsters] = useState<Set<string>>(new Set());
  const [thresholdText, setThresholdText] = useState('25, 50, 100');
  const [pointsText, setPointsText] = useState('');
  const [creating, setCreating] = useState(false);
  const [lastBatch, setLastBatch] = useState<string | null>(null);

  const visible = useMemo(() => {
    const cats = filter === 'all' ? categories : categories.filter((c) => c.key === filter);
    const q = search.trim().toLowerCase();
    return cats
      .map((c) => ({ ...c, bosses: q ? c.bosses.filter((b) => b.label.toLowerCase().includes(q)) : c.bosses }))
      .filter((c) => c.bosses.length > 0);
  }, [categories, filter, search]);

  const thresholds = parseThresholds(thresholdText);
  const visibleMonsters = useMemo(() => {
    const cats = monsterFilter === 'all' ? monsterCategories : monsterCategories.filter((c) => c.key === monsterFilter);
    const q = monsterSearch.trim().toLowerCase();
    // Searching across 121 task groups is how anyone finds one monster; the filter is how they take
    // a whole group at once. Both narrow the same list rather than being separate modes.
    return cats
      .map((c) => ({ ...c, monsters: q ? c.monsters.filter((m) => m.name.toLowerCase().includes(q)) : c.monsters }))
      .filter((c) => c.monsters.length > 0);
  }, [monsterCategories, monsterFilter, monsterSearch]);
  // Picked from the list, plus anything typed by hand — a host who wants an NPC the wiki never
  // called a slayer monster (a quest boss, a random mob) shouldn't be blocked by our dataset.
  const npcs = useMemo(
    () => [...new Set([...pickedMonsters, ...parseNpcList(npcText)])],
    [pickedMonsters, npcText],
  );
  const sourceCount = mode === 'boss' ? selected.size : npcs.length;
  const willCreate = sourceCount * thresholds.length;

  function close() {
    setOpen(false);
    setSelected(new Set());
    setNpcText('');
    setPickedMonsters(new Set());
    setLastBatch(null);
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /** Pick or clear everything currently on screen — the point of the filters. */
  function selectVisible(on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of visible) {
        for (const b of c.bosses) {
          if (on) next.add(b.key);
          else next.delete(b.key);
        }
      }
      return next;
    });
  }

  async function create() {
    if (thresholds.length === 0) {
      onError('Enter the kill counts you want, like 25, 50, 100.');
      return;
    }
    if (sourceCount === 0) {
      onError(mode === 'boss' ? 'Pick at least one boss.' : 'Paste at least one NPC name.');
      return;
    }
    const points = pointsMode ? parsePoints(pointsText, thresholds.length) : null;
    if (points === 'mismatch') {
      onError(`Points must be one number for every tile, or ${thresholds.length} numbers to match your kill counts.`);
      return;
    }

    let rows: GeneratedTileRow[];
    if (mode === 'boss') {
      const picked = categories.flatMap((c) => c.bosses).filter((b) => selected.has(b.key));
      rows = bossKcRows({ bosses: picked, thresholds, points });
    } else {
      rows = npcKillRows({ npcs, thresholds, points, category: npcCategory.trim() || 'Kills' });
    }

    setCreating(true);
    try {
      const res = await clanFetch(`/api/events/${eventId}/tiles/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, append: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error || 'Could not create tiles.');
        return;
      }
      const what = mode === 'boss' ? 'boss' : 'NPC';
      const summary = `${thresholds.join('/')} KC × ${sourceCount} ${what}${sourceCount === 1 ? '' : 's'}`;
      onCreated({ created: data.created ?? 0, ignored: data.ignored ?? 0, label: summary });
      setLastBatch(`Added ${summary}.`);
      // Keep the thresholds — the next batch is usually the same ladder against different bosses.
      setSelected(new Set());
      setNpcText('');
      setPickedMonsters(new Set());
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      {!hideTrigger && (
        <button
          onClick={() => setOpen(true)}
          disabled={!canGrow}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Generate KC tiles…
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={close}>
          <div
            className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-xl border border-card-border bg-card-bg p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-1">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span className="w-1 h-5 bg-gold rounded-full" />
                Generate KC tiles
              </h3>
              <button onClick={close} className="text-text-muted hover:text-foreground text-lg leading-none">×</button>
            </div>
            <p className="text-xs text-text-muted mb-3">
              Every source you pick × every kill count you type. 25/50/100 across twelve bosses is
              thirty-six tiles in one go.
            </p>

            <div className="flex gap-1 mb-3">
              {(['boss', 'npc'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    mode === m ? 'border-gold/40 bg-gold/15 text-gold' : 'border-card-border text-text-muted hover:text-foreground'
                  }`}
                >
                  {m === 'boss' ? 'Bosses (hiscores)' : 'Slayer & other NPCs'}
                </button>
              ))}
            </div>

            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <label className="block text-[10px] text-text-muted mb-1">Kill counts</label>
                <Input
                  value={thresholdText}
                  onChange={(e) => setThresholdText(e.target.value)}
                  placeholder="25, 50, 100, 200"
                  aria-label="Kill counts"
                />
              </div>
              {pointsMode && (
                <div className="w-44">
                  <label className="block text-[10px] text-text-muted mb-1">
                    Points {thresholds.length > 1 && <span className="text-text-muted/70">(one, or {thresholds.length})</span>}
                  </label>
                  <Input
                    value={pointsText}
                    onChange={(e) => setPointsText(e.target.value)}
                    placeholder={thresholds.length > 1 ? '10, 20, 40' : 'e.g. 20'}
                    aria-label="Points per tile"
                  />
                </div>
              )}
            </div>

            {mode === 'boss' ? (
              <>
                <div className="flex flex-wrap gap-1 mb-2">
                  <button
                    onClick={() => setFilter('all')}
                    className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${
                      filter === 'all' ? 'border-gold/40 bg-gold/15 text-gold' : 'border-card-border text-text-muted hover:text-foreground'
                    }`}
                  >
                    All
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setFilter(c.key)}
                      title={c.blurb}
                      className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${
                        filter === c.key ? 'border-gold/40 bg-gold/15 text-gold' : 'border-card-border text-text-muted hover:text-foreground'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 mb-1.5">
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bosses…" aria-label="Search bosses" />
                  <span className="flex gap-2 text-[10px] shrink-0">
                    <button onClick={() => selectVisible(true)} className="text-gold/80 hover:text-gold">Pick shown</button>
                    <button onClick={() => selectVisible(false)} className="text-text-muted hover:text-foreground">Clear</button>
                  </span>
                </div>

                <div className="overflow-y-auto border border-card-border/60 rounded-lg p-2 mb-3 min-h-[8rem]">
                  {visible.map((c) => (
                    <div key={c.key} className="mb-2 last:mb-0">
                      <div className="text-[10px] uppercase tracking-wide text-text-muted mb-1">{c.label}</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-0.5">
                        {c.bosses.map((b) => (
                          <Checkbox
                            key={b.key}
                            checked={selected.has(b.key)}
                            onChange={() => toggle(b.key)}
                            className="px-2 py-1.5 rounded-lg hover:bg-white/5"
                            labelClassName={selected.has(b.key) ? 'text-xs text-foreground' : 'text-xs text-text-muted'}
                            label={b.label}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  {visible.length === 0 && <p className="text-xs text-text-muted p-2">Nothing matches that search.</p>}
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-1 mb-2 max-h-[4.5rem] overflow-y-auto">
                  <button
                    onClick={() => setMonsterFilter('all')}
                    className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${
                      monsterFilter === 'all' ? 'border-gold/40 bg-gold/15 text-gold' : 'border-card-border text-text-muted hover:text-foreground'
                    }`}
                  >
                    All tasks
                  </button>
                  {monsterCategories.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setMonsterFilter(c.key)}
                      className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${
                        monsterFilter === c.key ? 'border-gold/40 bg-gold/15 text-gold' : 'border-card-border text-text-muted hover:text-foreground'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 mb-1.5">
                  <Input
                    value={monsterSearch}
                    onChange={(e) => setMonsterSearch(e.target.value)}
                    placeholder="Search monsters…"
                    aria-label="Search monsters"
                  />
                  <span className="flex gap-2 text-[10px] shrink-0">
                    <button
                      onClick={() =>
                        setPickedMonsters((prev) => {
                          const next = new Set(prev);
                          for (const c of visibleMonsters) for (const m of c.monsters) next.add(m.name);
                          return next;
                        })
                      }
                      className="text-gold/80 hover:text-gold"
                    >
                      Pick shown
                    </button>
                    <button onClick={() => setPickedMonsters(new Set())} className="text-text-muted hover:text-foreground">
                      Clear
                    </button>
                  </span>
                </div>

                <div className="overflow-y-auto border border-card-border/60 rounded-lg p-2 mb-2 max-h-56 min-h-[6rem]">
                  {visibleMonsters.map((c) => (
                    <div key={c.key} className="mb-2 last:mb-0">
                      <div className="text-[10px] uppercase tracking-wide text-text-muted mb-1">{c.label}</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-0.5">
                        {c.monsters.map((m) => (
                          <Checkbox
                            key={`${c.key}:${m.name}`}
                            className="px-2 py-1.5 rounded-lg hover:bg-white/5"
                            checked={pickedMonsters.has(m.name)}
                            onChange={() =>
                                setPickedMonsters((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(m.name)) next.delete(m.name);
                                  else next.add(m.name);
                                  return next;
                                })
                            }
                            labelClassName={
                              pickedMonsters.has(m.name) ? 'text-xs text-foreground' : 'text-xs text-text-muted'
                            }
                            label={m.name}
                            trailing={
                              m.slayerLevel != null ? (
                                <span className="text-[10px] text-text-muted/70">{m.slayerLevel}</span>
                              ) : null
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  {visibleMonsters.length === 0 && <p className="text-xs text-text-muted p-2">Nothing matches that search.</p>}
                </div>

                <div className="flex gap-2 mb-3">
                  <div className="w-40">
                    <label className="block text-[10px] text-text-muted mb-1">Category tag</label>
                    <Input value={npcCategory} onChange={(e) => setNpcCategory(e.target.value)} placeholder="Slayer" aria-label="Category" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] text-text-muted mb-1">
                      Anything else, by name <span className="text-text-muted/70">(one per line)</span>
                    </label>
                    <textarea
                      value={npcText}
                      onChange={(e) => setNpcText(e.target.value)}
                      rows={2}
                      placeholder={'Man\nGiant rat'}
                      aria-label="Extra NPC names"
                      className="w-full rounded-lg border border-card-border bg-brown-dark/40 px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-text-muted">
                {willCreate > 0
                  ? `${willCreate} tile${willCreate === 1 ? '' : 's'} — ${sourceCount} × ${thresholds.length} kill count${thresholds.length === 1 ? '' : 's'}`
                  : 'Pick sources and kill counts'}
              </span>
              <div className="flex gap-2">
                <button onClick={close} className="text-xs px-3 py-1.5 rounded-lg text-text-muted hover:text-foreground transition-colors">
                  Done
                </button>
                <button
                  onClick={create}
                  disabled={creating || willCreate === 0}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating…' : `Create ${willCreate || ''} tile${willCreate === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>

            {lastBatch && <p className="text-xs text-accent-green-light mt-2">{lastBatch} Kill counts kept — pick the next batch.</p>}
          </div>
        </div>
      )}
    </>
  );
}
