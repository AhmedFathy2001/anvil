'use client';

import { useEffect, useMemo, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';
import Select from '@/components/Select';
import type { LibraryBoard } from '@/lib/libraryBoards';
import type { EventMode } from '@/lib/eventModes';

const AUDIENCE_LABEL: Record<string, string> = { casual: 'Casual', mid: 'Mid-level', endgame: 'Endgame', mixed: 'Mixed' };
const TAG_LABEL: Record<string, string> = {
  pvm: 'PvM',
  raids: 'Raids',
  skilling: 'Skilling',
  slayer: 'Slayer',
  clues: 'Clues',
  pets: 'Pets',
  'collection-log': 'Collection log',
  wilderness: 'Wilderness',
  minigames: 'Minigames',
  ironman: 'Ironman-friendly',
  f2p: 'F2P',
  fun: 'Just for fun',
};

/**
 * The board library inside "New event": Anvil's boards and every published community board for the
 * format being made, filterable by who it's for, what it's about and where it came from. Picking one
 * hands its tiles to the form; nothing is created until the form is submitted.
 */
export default function BoardLibraryPicker({
  mode,
  selectedId,
  onPick,
}: {
  mode: EventMode;
  selectedId: number | null;
  onPick: (board: LibraryBoard) => void;
}) {
  const [boards, setBoards] = useState<LibraryBoard[] | null>(null);
  const [origin, setOrigin] = useState('');
  const [audience, setAudience] = useState('');
  const [tag, setTag] = useState('');
  const [preview, setPreview] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    clanFetch('/api/admin/library/boards')
      .then((r) => (r.ok ? r.json() : { boards: [] }))
      .then((d) => alive && setBoards((d.boards as LibraryBoard[]).filter((b) => b.status === 'published')))
      .catch(() => alive && setBoards([]));
    return () => {
      alive = false;
    };
  }, []);

  const forMode = useMemo(() => (boards ?? []).filter((b) => b.mode === mode), [boards, mode]);
  const tags = useMemo(() => [...new Set(forMode.flatMap((b) => b.tags))], [forMode]);
  const shown = forMode.filter(
    (b) => (!origin || b.origin === origin) && (!audience || b.audience === audience) && (!tag || b.tags.includes(tag)),
  );

  if (boards === null) return <p className="text-sm text-text-muted">Loading the board library…</p>;
  if (forMode.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        No boards for this format in the library yet. Start blank, and once it&apos;s built you can share it from the
        event&apos;s Settings.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <Select
          value={origin}
          onChange={setOrigin}
          ariaLabel="Made by"
          options={[
            { value: '', label: 'Anvil and community' },
            { value: 'anvil', label: 'Anvil’s boards' },
            { value: 'community', label: 'Community boards' },
          ]}
        />
        <Select
          value={audience}
          onChange={setAudience}
          ariaLabel="Who it's for"
          options={[{ value: '', label: 'Any level' }, ...Object.entries(AUDIENCE_LABEL).map(([value, label]) => ({ value, label }))]}
        />
        <Select
          value={tag}
          onChange={setTag}
          ariaLabel="What it's about"
          options={[{ value: '', label: 'Any focus' }, ...tags.map((t) => ({ value: t, label: TAG_LABEL[t] ?? t }))]}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {shown.map((b) => {
          const active = selectedId === b.id;
          return (
            <div key={b.id} className={`rounded-lg border ${active ? 'border-gold bg-gold/15' : 'border-card-border bg-brown-dark/30'}`}>
              <button type="button" onClick={() => onPick(b)} className="w-full text-left px-3 py-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-medium ${active ? 'text-gold' : ''}`}>{b.title}</span>
                  <span
                    className={`text-[9px] uppercase tracking-wide px-1 py-0.5 rounded ${
                      b.origin === 'anvil' ? 'bg-gold/20 text-gold' : 'bg-blue-500/15 text-blue-300'
                    }`}
                  >
                    {b.origin === 'anvil' ? 'Anvil' : `by ${b.clanName ?? 'a clan'}`}
                  </span>
                </div>
                {b.description && <p className="text-xs text-text-muted mt-0.5 leading-snug line-clamp-2">{b.description}</p>}
                <p className="text-[11px] text-text-muted mt-1">
                  {[
                    `${b.tiles.length} tiles`,
                    AUDIENCE_LABEL[b.audience],
                    b.suggestedDays ? `~${b.suggestedDays} days` : null,
                    b.teamsMin ? `${b.teamsMin}${b.teamsMax && b.teamsMax !== b.teamsMin ? `–${b.teamsMax}` : ''} teams` : null,
                    b.useCount ? `used ${b.useCount}×` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {b.tags.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-1">
                    {b.tags.map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-text-muted">
                        {TAG_LABEL[t] ?? t}
                      </span>
                    ))}
                  </p>
                )}
              </button>
              <div className="px-3 pb-2">
                <button type="button" onClick={() => setPreview(preview === b.id ? null : b.id)} className="text-[11px] text-text-muted hover:text-gold">
                  {preview === b.id ? 'Hide tiles' : 'See the tiles'}
                </button>
                {preview === b.id && (
                  <ol className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-text-muted list-decimal ml-4">
                    {b.tiles.map((t, i) => (
                      <li key={i} className="truncate">
                        {t.label}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {shown.length === 0 && <p className="text-sm text-text-muted">Nothing matches those filters.</p>}
    </div>
  );
}
