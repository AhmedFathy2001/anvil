'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { clanFetch } from '@/lib/clanFetch';
import {
  browseCatalog,
  screenshotCandidate,
  type BrowseCategory,
  type TaskCandidate,
} from '@/lib/taskMatch';
import { draftPayload, type TileDraft } from '@/lib/tileCreatorConfig';
import type { TierBand } from '@/lib/tileFilter';
import type { Tile } from '@/lib/types';
import ConfirmStep from './ConfirmStep';
import RaidStep from './RaidStep';
import CoursesStep from './CoursesStep';
import ItemStep from './ItemStep';
import ClogStep from './ClogStep';
import { CheckIcon, Eyebrow, KindBadge, SearchIcon, StepHeader } from './parts';

type Screen =
  | { name: 'start' }
  | { name: 'browse'; category: BrowseCategory }
  | { name: 'raids'; candidate?: TaskCandidate }
  | { name: 'courses'; candidate?: TaskCandidate }
  | { name: 'items'; candidate?: TaskCandidate }
  | { name: 'clog'; candidate?: TaskCandidate }
  | { name: 'confirm'; candidate: TaskCandidate }
  | { name: 'full'; draft: TileDraft };

const CATEGORIES: { id: BrowseCategory; label: string; sub: string }[] = [
  { id: 'bosses', label: 'Bosses & raids', sub: 'Kills, clears, modes' },
  { id: 'items', label: 'Get items', sub: 'Drops, pets, gathered' },
  { id: 'clog', label: 'Collection log', sub: 'New slots, pages, chosen items' },
  { id: 'skilling', label: 'Skilling & minigames', sub: 'Rumours, herbiboar, GOTR' },
  { id: 'courses', label: 'Courses & trials', sub: 'Agility, Sepulchre, Sailing' },
  { id: 'xp', label: 'Gain XP', sub: 'Any skill, from the hiscores' },
  { id: 'achievements', label: 'Achievements', sub: 'Diaries, combat tasks, clues' },
  { id: 'challenges', label: 'Challenges', sub: 'Speed, deathless, PvP, LMS' },
  { id: 'other', label: 'Something else', sub: 'Screenshot, staff approve' },
];

const BROWSE_TITLES: Record<BrowseCategory, string> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label])) as Record<BrowseCategory, string>;

export interface TileCreatorProps {
  /** Board mode: the placeholder tile being filled. Omit in detached mode. */
  tile?: Tile;
  eventId?: number;
  pointsMode: boolean;
  tierBands: TierBand[];
  teamPlay: boolean;
  /** The task to start from (a bulk row being fixed, or a query handed over). */
  initialQuery?: string;
  initialCandidate?: TaskCandidate;
  /** Board mode: saved. `another` = the admin wants the next tile straight away. */
  onSaved?: (updated: Tile, another: boolean) => void;
  /** Detached mode (bulk review): hand the finished draft back instead of saving it. */
  onDone?: (draft: TileDraft, candidate: TaskCandidate) => void;
  /** "More options": the full editor, opened with everything chosen so far. */
  renderFullEditor?: (draft: TileDraft) => ReactNode;
  onOpenBulk?: () => void;
  /** False on a fixed grid with no blanks left — "Add & another" would have nowhere to go. */
  canAddAnother?: boolean;
}

/**
 * The new-tile flow: say what players should do, pick the match, confirm one sentence. The admin
 * never picks a "kind" — lib/taskMatch picks the engine and says in one line how it counts. Hard
 * cases get a purpose-built control (raid modes, trial course × rank, items' one question), and
 * "More options" opens the full editor prefilled, so nothing a power user needs is lost.
 */
export default function TileCreator(props: TileCreatorProps) {
  const { tile, eventId, pointsMode, tierBands, teamPlay, onSaved, onDone, renderFullEditor, onOpenBulk } = props;
  const detached = !!onDone;
  const [stack, setStack] = useState<Screen[]>(() =>
    props.initialCandidate ? [{ name: 'start' }, screenFor(props.initialCandidate)] : [{ name: 'start' }],
  );
  const screen = stack[stack.length - 1];
  const push = (s: Screen) => setStack((st) => [...st, s]);
  const back = () => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st));

  const [q, setQ] = useState(props.initialQuery ?? '');
  const [results, setResults] = useState<TaskCandidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [starters, setStarters] = useState<TaskCandidate[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    clanFetch('/api/admin/task-suggest?starters=1')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: TaskCandidate[]) => { if (!cancelled) setStarters(Array.isArray(d) ? d : []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await clanFetch(`/api/admin/task-suggest?q=${encodeURIComponent(query)}`);
        const data = res.ok ? ((await res.json()) as TaskCandidate[]) : [];
        if (mine === seq.current) setResults(data);
      } catch {
        if (mine === seq.current) setResults([]);
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const shown = q.trim().length >= 2 ? results : null;

  function screenFor(c: TaskCandidate): Screen {
    // A finished config goes straight to the sentence; an unfinished one to its own control.
    const unfinished = Object.keys(c.config).length === 0 || c.source === 'clog';
    if (c.flow === 'raids' && unfinished) return { name: 'raids', candidate: c };
    if ((c.flow === 'trials' || c.flow === 'courses') && unfinished) return { name: 'courses', candidate: c };
    if (c.flow === 'items' && unfinished) return { name: 'items', candidate: c };
    if (c.flow === 'clog' && Object.keys(c.config).length === 0) return { name: 'clog', candidate: c };
    return { name: 'confirm', candidate: c };
  }

  function pick(c: TaskCandidate) {
    setError(null);
    push(screenFor(c));
  }

  async function submit(draft: TileDraft, another: boolean, candidate: TaskCandidate) {
    if (onDone) {
      onDone(draft, candidate);
      return;
    }
    if (!tile || !eventId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/tiles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftPayload(draft, tile.id, tile.updatedAt ?? null)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not add the tile.');
        return;
      }
      onSaved?.(data as Tile, another);
    } catch {
      setError('Could not add the tile.');
    } finally {
      setSaving(false);
    }
  }

  // ── Screens ──────────────────────────────────────────────────────────────────────────────

  if (screen.name === 'full' && renderFullEditor) {
    return (
      <div>
        <StepHeader title="All options" onBack={back} />
        {renderFullEditor(screen.draft)}
      </div>
    );
  }

  if (screen.name === 'confirm') {
    const c = screen.candidate;
    return (
      <ConfirmStep
        key={c.key}
        candidate={c}
        pointsMode={pointsMode}
        tierBands={tierBands}
        teamPlay={teamPlay}
        eventId={eventId}
        tileId={tile?.id}
        initialPoints={tile?.points ?? null}
        saving={saving}
        error={error}
        detached={detached}
        canAddAnother={props.canAddAnother !== false}
        onBack={back}
        onMoreOptions={renderFullEditor ? (draft) => push({ name: 'full', draft }) : undefined}
        onSubmit={(draft, another) => submit(draft, another, c)}
      />
    );
  }

  if (screen.name === 'raids') {
    return <RaidStep seed={screen.candidate?.seed?.raids} amount={screen.candidate?.amount ?? null} onBack={back} onNext={pick} />;
  }
  if (screen.name === 'courses') {
    return <CoursesStep seed={screen.candidate?.seed} amount={screen.candidate?.amount ?? null} onBack={back} onNext={pick} />;
  }
  if (screen.name === 'items') {
    return <ItemStep seed={screen.candidate?.seed} amount={screen.candidate?.amount ?? null} onBack={back} onNext={pick} />;
  }
  if (screen.name === 'clog') {
    return <ClogStep seed={screen.candidate?.seed?.clog} amount={screen.candidate?.amount ?? null} onBack={back} onNext={pick} />;
  }
  if (screen.name === 'browse') {
    return <BrowseList category={screen.category} onBack={back} onPick={pick} onRaids={() => push({ name: 'raids' })} />;
  }

  // start: one big search; browse cards until something is typed, results after.
  return (
    <div>
      <label htmlFor="tile-creator-q" className="block text-lg font-bold mb-2">
        What should players do?
      </label>
      <div className="flex items-center gap-2 rounded-xl border-2 border-gold/50 bg-brown-dark px-3 focus-within:border-gold">
        <SearchIcon className="text-gold shrink-0" />
        <input
          id="tile-creator-q"
          autoFocus
          autoComplete="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && shown && shown.length > 0) {
              e.preventDefault();
              pick(shown[0]);
            }
          }}
          placeholder="e.g. 150 herbiboars, any raid, Zulrah pet…"
          className="w-full min-h-12 bg-transparent text-base focus:outline-none placeholder:text-text-muted/60"
        />
      </div>
      <p className="mt-1.5 text-xs text-text-muted">Type it the way your clan wrote it. Numbers are picked up too.</p>
      {onOpenBulk && (
        <button type="button" onClick={onOpenBulk} className="min-h-11 text-sm text-gold hover:text-gold-light underline underline-offset-2">
          Got a whole list? Paste it all at once
        </button>
      )}

      {shown ? (
        <Results results={shown} loading={loading} query={q} onPick={pick} />
      ) : (
        <>
          <div className="mt-5">
            <Eyebrow>Or browse</Eyebrow>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    if (c.id === 'items') push({ name: 'items' });
                    else if (c.id === 'courses') push({ name: 'courses' });
                    else if (c.id === 'clog') push({ name: 'clog' });
                    else if (c.id === 'other') pick(screenshotCandidate(q || 'New task'));
                    else push({ name: 'browse', category: c.id });
                  }}
                  className="min-h-16 text-left rounded-xl border border-card-border bg-card-bg hover:border-gold/50 px-3 py-2.5 transition-colors"
                >
                  <span className="block text-sm font-semibold">{c.label}</span>
                  <span className="block text-xs text-text-muted">{c.sub}</span>
                </button>
              ))}
            </div>
          </div>
          {starters.length > 0 && (
            <div className="mt-5">
              <Eyebrow>{starters.some((s) => s.key.startsWith('library-')) ? 'From your clan’s past boards' : 'Ready-made tasks'}</Eyebrow>
              <div className="flex flex-wrap gap-2">
                {starters.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => pick(s)}
                    className="min-h-11 px-3 rounded-full border border-card-border hover:border-gold/50 text-sm"
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ResultRow({ c, best = false, onPick }: { c: TaskCandidate; best?: boolean; onPick: (c: TaskCandidate) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(c)}
      className={`w-full min-h-11 text-left rounded-xl border px-3 py-2.5 transition-colors ${
        best ? 'border-gold/60 bg-gold/[0.07] hover:bg-gold/[0.12]' : 'border-card-border bg-card-bg hover:border-gold/50'
      }`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className={`${best ? 'text-base' : 'text-sm'} font-semibold`}>{c.title}</span>
        <KindBadge>{c.badge}</KindBadge>
      </span>
      <span className={`mt-1 flex items-start gap-1.5 text-xs ${c.engine === 'screenshot' ? 'text-amber-200' : 'text-accent-green-light'}`}>
        {c.engine !== 'screenshot' && <CheckIcon className="mt-0.5 shrink-0" />}
        {c.hint}
      </span>
    </button>
  );
}

function Results({ results, loading, query, onPick }: { results: TaskCandidate[]; loading: boolean; query: string; onPick: (c: TaskCandidate) => void }) {
  const [best, ...rest] = results;
  const library = rest.filter((r) => r.source === 'library');
  const also = rest.filter((r) => r.source !== 'library').slice(0, 5);
  return (
    <div className="mt-5" aria-live="polite">
      {!best ? (
        <p className="text-sm text-text-muted">{loading ? 'Looking…' : 'Nothing matched that.'}</p>
      ) : (
        <>
          <Eyebrow>Best match</Eyebrow>
          <ResultRow c={best} best onPick={onPick} />
          {also.length > 0 && (
            <>
              <div className="mt-4"><Eyebrow>Also matches</Eyebrow></div>
              <div className="space-y-2">
                {also.map((c) => <ResultRow key={c.key} c={c} onPick={onPick} />)}
              </div>
            </>
          )}
          {library.length > 0 && (
            <>
              <div className="mt-4"><Eyebrow>From your task library</Eyebrow></div>
              <div className="space-y-2">
                {library.map((c) => <ResultRow key={c.key} c={c} onPick={onPick} />)}
              </div>
            </>
          )}
        </>
      )}
      <p className="mt-5 text-sm text-text-muted">
        Not here?{' '}
        <button type="button" onClick={() => onPick(screenshotCandidate(query))} className="min-h-11 text-gold hover:text-gold-light underline underline-offset-2">
          Make it a screenshot tile
        </button>
        : staff approve each one.
      </p>
    </div>
  );
}

function BrowseList({
  category,
  onBack,
  onPick,
  onRaids,
}: {
  category: BrowseCategory;
  onBack: () => void;
  onPick: (c: TaskCandidate) => void;
  onRaids: () => void;
}) {
  const [filter, setFilter] = useState('');
  const all = useMemo(() => browseCatalog(category), [category]);
  const f = filter.trim().toLowerCase();
  const list = f ? all.filter((c) => c.title.toLowerCase().includes(f) || c.noun.toLowerCase().includes(f)) : all;
  return (
    <div>
      <StepHeader title={BROWSE_TITLES[category]} onBack={onBack} />
      {category === 'bosses' && (
        <button
          type="button"
          onClick={onRaids}
          className="w-full min-h-14 mb-3 text-left rounded-xl border border-gold/50 bg-gold/[0.07] hover:bg-gold/[0.12] px-3 py-2.5"
        >
          <span className="block text-sm font-semibold">Raids: CoX, ToB, ToA, TFA</span>
          <span className="block text-xs text-text-muted">Pick which modes count, Entry included or not</span>
        </button>
      )}
      {all.length > 8 && (
        <input
          aria-label="Filter"
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full min-h-11 mb-3 px-3 rounded-lg bg-brown-dark border border-card-border text-sm focus:outline-none focus:border-gold"
        />
      )}
      <ul className="space-y-1.5">
        {list.map((c) => (
          <li key={c.key}>
            <button
              type="button"
              onClick={() => onPick(c)}
              className="w-full min-h-11 text-left rounded-lg border border-card-border bg-card-bg hover:border-gold/50 px-3 py-2 flex items-center justify-between gap-2"
            >
              <span className="text-sm">{c.titleOne && c.amount === 1 ? c.titleOne : c.title}</span>
              <KindBadge>{c.badge}</KindBadge>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
