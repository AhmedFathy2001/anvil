'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import Checkbox from '@/components/Checkbox';
import ClanMemberPicker from '@/components/ClanMemberPicker';
import Input from '@/components/Input';
import Radio from '@/components/Radio';
import Select from '@/components/Select';
import { clanFetch, clanUrl } from '@/lib/clanFetch';
import { PRACTICE_HOURS } from '@/lib/practiceRules';
import { cn } from '@/lib/utils';

interface Board {
  id: number;
  name: string;
  startDate: string | null;
  tiles: number;
}

interface PickTile {
  id: number;
  label: string;
  kind: string;
  hidden: boolean;
}

/** A tile for the pick flow: a library task or one typed here, already in the import's row shape. */
export interface PickedRow {
  key: string;
  label: string;
  row: Record<string, unknown>;
}

interface LibraryTask {
  id: number;
  label: string;
  points: number;
  category: string | null;
  config: Record<string, unknown>;
}

const TYPED_KINDS = [
  { value: 'kill', label: 'Kills of a boss or monster' },
  { value: 'drop', label: 'A drop (item name)' },
  { value: 'xp', label: 'XP in a skill' },
  { value: 'plain', label: 'Plain tile (ticked by hand)' },
];

const SKILL_OPTIONS = [
  'attack', 'defence', 'strength', 'hitpoints', 'ranged', 'prayer', 'magic', 'cooking', 'woodcutting', 'fletching', 'fishing',
  'firemaking', 'crafting', 'smithing', 'mining', 'herblore', 'agility', 'thieving', 'slayer', 'farming', 'runecraft', 'hunter',
  'construction', 'sailing',
].map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }));

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold tracking-wide text-text-muted uppercase">{children}</div>;
}

function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            'px-3 py-1.5 rounded-md text-sm transition-colors border',
            value === o.value ? 'bg-gold text-brown-dark border-gold font-semibold' : 'border-card-border text-text-muted hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The library-or-typed tile picker, shared with the board page's "Add tiles". */
export function PickTiles({ picked, onChange, max }: { picked: PickedRow[]; onChange: (rows: PickedRow[]) => void; max: number }) {
  const [tasks, setTasks] = useState<LibraryTask[] | null>(null);
  const [libError, setLibError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('kill');
  const [target, setTarget] = useState('');
  const [skill, setSkill] = useState('fishing');
  const [amount, setAmount] = useState('1');

  useEffect(() => {
    clanFetch('/api/admin/practice?library=1')
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error('The tile library could not be loaded.'))))
      .then((d: { tasks: LibraryTask[] }) => setTasks(d.tasks ?? []))
      .catch((e: Error) => {
        setLibError(e.message);
        setTasks([]);
      });
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (tasks ?? []).filter((t) => !needle || `${t.label} ${t.category ?? ''}`.toLowerCase().includes(needle)).slice(0, 40);
  }, [tasks, q]);

  const has = (key: string) => picked.some((p) => p.key === key);
  const toggleTask = (t: LibraryTask) => {
    const key = `lib:${t.id}`;
    if (has(key)) onChange(picked.filter((p) => p.key !== key));
    else if (picked.length < max) {
      onChange([...picked, { key, label: t.label, row: { ...t.config, label: t.label, points: t.points, category: t.category ?? undefined } }]);
    }
  };

  const addTyped = () => {
    const n = Math.max(1, Math.floor(Number(amount) || 1));
    let label = '';
    let row: Record<string, unknown>;
    if (kind === 'xp') {
      label = `Gain ${n.toLocaleString()} ${skill[0].toUpperCase()}${skill.slice(1)} XP`;
      row = { label, tileType: 'standard', trackedStat: skill, statType: 'skill', statGoal: n };
    } else {
      const t = target.trim();
      if (!t) return;
      if (kind === 'kill') {
        label = `${n} ${t} kill${n === 1 ? '' : 's'}`;
        row = { label, tileType: 'kill', targetNpcs: [t], requiredAmount: n };
      } else if (kind === 'drop') {
        label = n > 1 ? `${n} × ${t}` : t;
        row = { label, tileType: 'drop', items: [{ name: t, count: n }] };
      } else {
        label = t;
        row = { label, tileType: 'standard' };
      }
    }
    if (picked.length >= max) return;
    onChange([...picked, { key: `typed:${Date.now()}`, label, row }]);
    setTarget('');
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-card-border p-3 space-y-2">
        <div className="text-sm font-medium">From the tile library</div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the library…" aria-label="Search the library" />
        {tasks === null ? (
          <div className="text-xs text-text-muted">Loading…</div>
        ) : libError ? (
          <div className="text-xs text-red-300">{libError}</div>
        ) : shown.length === 0 ? (
          <div className="text-xs text-text-muted">Nothing in the library matches. Type a tile below instead.</div>
        ) : (
          <div className="max-h-56 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            {shown.map((t) => (
              <Checkbox
                key={t.id}
                checked={has(`lib:${t.id}`)}
                onChange={() => toggleTask(t)}
                disabled={!has(`lib:${t.id}`) && picked.length >= max}
                label={t.label}
                labelClassName="text-sm"
              />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-card-border p-3 space-y-2">
        <div className="text-sm font-medium">Or type one</div>
        <div className="grid grid-cols-1 sm:grid-cols-[1.3fr_1.5fr_0.6fr_auto] gap-2">
          <Select value={kind} onChange={setKind} options={TYPED_KINDS} ariaLabel="Kind of tile" />
          {kind === 'xp' ? (
            <Select value={skill} onChange={setSkill} options={SKILL_OPTIONS} ariaLabel="Skill" />
          ) : (
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={kind === 'kill' ? 'Zulrah' : kind === 'drop' ? 'Dragon bones' : 'Tile name'}
              aria-label="What it tracks"
            />
          )}
          {kind !== 'plain' ? (
            <Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" aria-label="How many" />
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={addTyped}
            disabled={picked.length >= max}
            className="px-3 py-2 rounded-md border border-card-border text-sm hover:border-gold/60 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>

      {picked.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {picked.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => onChange(picked.filter((x) => x.key !== p.key))}
              className="px-2.5 py-1 rounded-full border border-card-border bg-brown-dark text-xs hover:border-red-400/60"
              title="Remove"
            >
              {p.label} <span className="text-text-muted">×</span>
            </button>
          ))}
        </div>
      )}
      <div className="text-xs text-text-muted">
        {picked.length} / {max} tiles
      </div>
    </div>
  );
}

/** Pick some of a clan board's tiles. Shared with the board page's "Add tiles". */
export function CopyTiles({
  boards,
  boardId,
  onBoard,
  picked,
  onChange,
  max,
}: {
  boards: Board[];
  boardId: number | null;
  onBoard: (id: number | null) => void;
  picked: number[];
  onChange: (ids: number[]) => void;
  max: number;
}) {
  const [tiles, setTiles] = useState<PickTile[] | null>(null);
  useEffect(() => {
    if (boardId == null) return;
    let gone = false;
    clanFetch(`/api/admin/practice?board=${boardId}`)
      .then(async (r) => (r.ok ? r.json() : { tiles: [] }))
      .then((d: { tiles: PickTile[] }) => {
        if (gone) return;
        setTiles(d.tiles);
        onChange(d.tiles.slice(0, max).map((t) => t.id));
      })
      .catch(() => !gone && setTiles([]));
    return () => {
      gone = true;
    };
    // onChange is the parent's setter; re-running on it would undo the admin's own ticks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, max]);

  return (
    <div className="space-y-2">
      <Select
        value={boardId == null ? '' : String(boardId)}
        onChange={(v) => {
          setTiles(null);
          onBoard(v ? Number(v) : null);
        }}
        options={boards.map((b) => ({ value: String(b.id), label: `${b.name} · ${b.tiles} tile${b.tiles === 1 ? '' : 's'}` }))}
        placeholder={boards.length ? 'Choose a board to copy' : 'This clan has no boards yet'}
        disabled={boards.length === 0}
        ariaLabel="Board to copy"
      />
      {boardId != null && tiles === null && <div className="text-xs text-text-muted">Loading tiles…</div>}
      {tiles && tiles.length > 0 && (
        <>
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Untick the slow ones and keep the tiles you want to watch work.</span>
            <span>
              {picked.length} / {Math.min(max, tiles.length)}
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-card-border p-3">
            {tiles.map((t) => {
              const on = picked.includes(t.id);
              return (
                <Checkbox
                  key={t.id}
                  checked={on}
                  disabled={!on && picked.length >= max}
                  onChange={() => onChange(on ? picked.filter((id) => id !== t.id) : [...picked, t.id])}
                  label={t.label}
                  description={t.hidden ? 'Hidden until it reveals' : undefined}
                  labelClassName="text-sm"
                />
              );
            })}
          </div>
        </>
      )}
      {tiles && tiles.length === 0 && <div className="text-xs text-text-muted">That board has no tiles yet.</div>}
    </div>
  );
}

/** Push picked rows into a practice board's blank tiles through the ordinary import, then tidy up. */
export async function fillPicked(eventId: number, rows: PickedRow[]): Promise<string | null> {
  const res = await clanFetch(`/api/events/${eventId}/tiles/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows: rows.map((r) => r.row), append: true }),
  });
  const data = await res.json().catch(() => ({}));
  await clanFetch(`/api/admin/practice/${eventId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'filled' }),
  }).catch(() => null);
  return res.ok ? null : (data.error as string) || 'Some tiles could not be added.';
}

export default function PracticeSetup({
  clanName,
  ownSeats,
  maxPlayers,
  maxTiles,
}: {
  clanName: string;
  ownSeats: { id: number; rsn: string }[];
  maxPlayers: number;
  maxTiles: number;
}) {
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [mode, setMode] = useState<'copy' | 'pick'>('copy');
  const [boardId, setBoardId] = useState<number | null>(null);
  const [copyIds, setCopyIds] = useState<number[]>([]);
  const [picked, setPicked] = useState<PickedRow[]>([]);
  const [seats, setSeats] = useState<number[]>(ownSeats.map((s) => s.id));
  const [sides, setSides] = useState<1 | 2>(1);
  const [postTo, setPostTo] = useState<'hook' | 'none'>('hook');
  const [hook, setHook] = useState('');
  const [hours, setHours] = useState<number>(6);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clanFetch('/api/admin/practice')
      .then((r) => (r.ok ? r.json() : { boards: [] }))
      .then((d: { boards: Board[]; active: { id: number } | null }) => {
        if (d.active) {
          router.replace(clanUrl(`/events/practice/${d.active.id}`));
          return;
        }
        setBoards(d.boards);
        if (d.boards.length === 0) setMode('pick');
        else setBoardId(d.boards[0].id);
      })
      .catch(() => null);
  }, [router]);

  const tileCount = mode === 'copy' ? copyIds.length : picked.length;
  const ready = tileCount > 0 && seats.length > 0 && (sides === 1 || seats.length >= 2) && (postTo === 'none' || hook.trim().length > 0);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch('/api/admin/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tiles: mode === 'copy' ? { mode: 'copy', eventId: boardId, tileIds: copyIds } : { mode: 'pick', count: picked.length },
          seats,
          sides,
          webhookUrl: postTo === 'hook' ? hook.trim() : null,
          hours,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'The practice board could not be started.');
        return;
      }
      if (mode === 'pick') {
        const problem = await fillPicked(data.id, picked);
        if (problem) {
          router.push(clanUrl(`/events/practice/${data.id}?note=${encodeURIComponent(problem)}`));
          return;
        }
      }
      router.push(clanUrl(`/events/practice/${data.id}`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gold mb-1">Start a practice board</h1>
        <p className="text-sm text-text-muted">
          Real characters, real kills and drops, in {clanName}. Only the people on it see it, and it counts for nothing.
        </p>
      </div>

      <div className="border border-card-border rounded-xl bg-card-bg p-5 space-y-6">
        <section className="space-y-2">
          <SectionLabel>Tiles</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(
              [
                { key: 'copy', title: 'Copy a board', blurb: boards.length ? 'Its tiles, rules, hidden tiles and conditions' : 'This clan has no boards yet', off: boards.length === 0 },
                { key: 'pick', title: 'Pick tiles', blurb: 'From the tile library, or type them', off: false },
              ] as const
            ).map((c) => (
              <button
                key={c.key}
                type="button"
                disabled={c.off}
                onClick={() => setMode(c.key)}
                className={cn(
                  'text-left p-3 rounded-lg border transition-colors disabled:opacity-40',
                  mode === c.key ? 'border-gold bg-gold/10' : 'border-card-border hover:border-gold/40',
                )}
              >
                <div className="text-sm font-semibold">{c.title}</div>
                <div className="text-xs text-text-muted mt-0.5">{c.blurb}</div>
              </button>
            ))}
          </div>
          {mode === 'copy' ? (
            <CopyTiles boards={boards} boardId={boardId} onBoard={setBoardId} picked={copyIds} onChange={setCopyIds} max={maxTiles} />
          ) : (
            <PickTiles picked={picked} onChange={setPicked} max={maxTiles} />
          )}
        </section>

        <section className="space-y-2">
          <SectionLabel>Who plays</SectionLabel>
          <ClanMemberPicker
            mode="multi"
            value={seats}
            onChange={(ids) => setSeats(ids.slice(0, maxPlayers))}
            emptyState="Nobody in the roster yet."
          />
          <div className="text-xs text-text-muted">
            Anyone in the clan, up to {maxPlayers} people. People without a staff role see this board while it runs and can’t manage it.
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted pt-1">
            Sides
            <Seg value={sides} onChange={setSides} options={[{ value: 1, label: 'Solo (one team)' }, { value: 2, label: '2 teams' }]} />
          </div>
        </section>

        <section className="space-y-2">
          <SectionLabel>Discord posts</SectionLabel>
          <label className="flex gap-3 rounded-lg border border-card-border p-3 cursor-pointer">
            <Radio name="practice-post" checked={postTo === 'hook'} onChange={() => setPostTo('hook')} />
            <span className="flex-1 space-y-2">
              <span className="block text-sm">A test webhook</span>
              <span className="block text-xs text-text-muted">Tile completions, board posts and the rules card post here, as they would for the real event.</span>
              {postTo === 'hook' && (
                <Input value={hook} onChange={(e) => setHook(e.target.value)} placeholder="https://discord.com/api/webhooks/…" aria-label="Test webhook URL" />
              )}
            </span>
          </label>
          <label className="flex gap-3 rounded-lg border border-card-border p-3 cursor-pointer">
            <Radio name="practice-post" checked={postTo === 'none'} onChange={() => setPostTo('none')} />
            <span className="text-sm">No posts</span>
          </label>
          <div className="text-xs text-text-muted">Never the clan’s own channels, even when the copied board names them.</div>
        </section>

        <section className="space-y-2">
          <SectionLabel>How long</SectionLabel>
          <Seg value={hours} onChange={setHours} options={PRACTICE_HOURS.map((h) => ({ value: h as number, label: h === 1 ? '1 hour' : `${h} hours` }))} />
        </section>

        <div className="border-t border-card-border pt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-text-muted">
          <div>✓ Counts the players’ real plugin play</div>
          <div>✗ Not in the clan feed or any event list</div>
          <div>✓ Popups and chat lines in game</div>
          <div>✗ No points, prizes, coffer or recap</div>
          <div>✓ Posts to your test webhook only</div>
          <div>✗ Deleted 7 days after it ends</div>
        </div>

        {error && <div className="text-sm text-red-300">{error}</div>}
        <button
          type="button"
          onClick={start}
          disabled={!ready || busy}
          className="w-full h-11 rounded-lg bg-gold hover:bg-gold-light text-brown-dark font-bold transition-colors disabled:opacity-40"
        >
          {busy ? 'Starting…' : 'Start now'}
        </button>
      </div>
    </div>
  );
}
