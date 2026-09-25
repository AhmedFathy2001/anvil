'use client';

import { useState, type FormEvent } from 'react';

import Input from '@/components/Input';
import { useModalA11y } from '@/hooks/useModalA11y';
import type { PersonHit } from '@/lib/platformView';

function personName(person: PersonHit): string {
  return person.displayName ?? person.accounts[0]?.rsn ?? `Person #${person.playerId}`;
}

function PersonSummary({ person, selected }: { person: PersonHit; selected?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${selected ? 'border-gold/50 bg-gold/5' : 'border-card-border bg-brown-dark/30'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">{personName(person)}</span>
        <span className="text-xs tabular-nums text-gray-500">#{person.playerId}</span>
        {person.userId != null && (
          <span className="rounded-full border border-sky-900 px-2 py-0.5 text-[11px] text-sky-300">
            Discord login
          </span>
        )}
        {person.banned && (
          <span className="rounded-full border border-red-900 px-2 py-0.5 text-[11px] text-red-300">
            banned
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-400">
        {person.accounts.length > 0
          ? person.accounts.map((account) => account.rsn).join(', ')
          : 'No characters'}
        {' · '}
        {person.clans.length === 0
          ? 'No clans'
          : person.clans.map((clan) => clan.clanName).join(', ')}
      </p>
    </div>
  );
}

function PersonPicker({
  title,
  help,
  selected,
  onSelect,
  excludeId,
}: {
  title: string;
  help: string;
  selected: PersonHit | null;
  onSelect: (person: PersonHit) => void;
  excludeId: number | null;
}) {
  const [query, setQuery] = useState(selected ? `#${selected.playerId}` : '');
  const [results, setResults] = useState<PersonHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) {
      setError('Enter a name, Discord id, or person id.');
      return;
    }

    setLoading(true);
    setSearched(false);
    setError(null);
    try {
      const response = await fetch(`/api/staff/people/search?q=${encodeURIComponent(q)}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? `Search failed (${response.status})`);
        return;
      }
      setResults(Array.isArray(body.results) ? body.results : []);
      setSearched(true);
    } catch {
      setError('Search failed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="min-w-0 rounded-xl border border-card-border bg-card-bg p-4">
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mt-1 min-h-10 text-xs leading-relaxed text-gray-400">{help}</p>

      <form onSubmit={search} className="mt-3 flex gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, #person-id, or Discord id"
          aria-label={`Search ${title.toLowerCase()}`}
          className="min-w-0 flex-1"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg border border-card-border px-3 py-2 text-xs text-gray-300 hover:border-gold/50 hover:text-gold disabled:opacity-50"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}

      {selected && (
        <div className="mt-3">
          <div className="mb-1 text-[11px] uppercase tracking-wide text-gold">Selected</div>
          <PersonSummary person={selected} selected />
        </div>
      )}

      {results.length > 0 ? (
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
          {results.map((person) => {
            const unavailable = person.playerId === excludeId;
            return (
              <button
                key={person.playerId}
                type="button"
                disabled={unavailable}
                onClick={() => onSelect(person)}
                className="block w-full text-left disabled:cursor-not-allowed disabled:opacity-35"
                aria-pressed={selected?.playerId === person.playerId}
                title={unavailable ? 'Already selected on the other side' : 'Select this person'}
              >
                <PersonSummary person={person} selected={selected?.playerId === person.playerId} />
              </button>
            );
          })}
        </div>
      ) : searched && !loading && !error ? (
        <p className="mt-3 text-xs text-gray-500">No matching people.</p>
      ) : null}
    </section>
  );
}

export default function MergePeopleDialog({
  initialSource,
  viewerPlayerId,
  onClose,
  onMerged,
}: {
  initialSource: PersonHit | null;
  viewerPlayerId: number | null;
  onClose: () => void;
  onMerged: (message: string) => void;
}) {
  const [source, setSource] = useState<PersonHit | null>(initialSource);
  const [target, setTarget] = useState<PersonHit | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useModalA11y<HTMLDivElement>({ onClose });

  const samePerson = source != null && target != null && source.playerId === target.playerId;
  const twoLogins = source?.userId != null && target?.userId != null;
  const removesViewer = source != null && source.playerId === viewerPlayerId;
  const blocked = !source || !target || samePerson || twoLogins || removesViewer || busy;

  function swap() {
    setSource(target);
    setTarget(source);
    setReviewing(false);
    setError(null);
  }

  async function merge() {
    if (!source || !target || blocked) return;
    if (!reviewing) {
      setReviewing(true);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/staff/people/${source.playerId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ into: target.playerId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? `Merge failed (${response.status})`);
        return;
      }
      const moved = body.moved as { accounts?: number; logins?: number } | undefined;
      onMerged(
        `Merged #${source.playerId} into #${target.playerId}: ${moved?.accounts ?? 0} character(s) and ${moved?.logins ?? 0} login(s) moved.`,
      );
    } catch {
      setError('Merge failed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="merge-people-title"
        tabIndex={-1}
        className="relative max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-card-border bg-brown-dark p-5 shadow-2xl focus:outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="merge-people-title" className="text-xl font-bold text-foreground">Merge duplicate people</h2>
            <p className="mt-1 text-sm text-gray-400">
              Search both sides by name, Discord id, or person id. The left row disappears; the right row survives.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-gray-400 hover:text-foreground"
            aria-label="Close merge dialog"
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid items-start gap-3 md:grid-cols-[1fr_auto_1fr]">
          <PersonPicker
            key={`source-${source?.playerId ?? 'empty'}`}
            title="Merge away"
            help="This person id is deleted after everything attached to it moves right."
            selected={source}
            onSelect={(person) => { setSource(person); setReviewing(false); setError(null); }}
            excludeId={target?.playerId ?? null}
          />
          <button
            type="button"
            onClick={swap}
            disabled={!source && !target}
            className="self-center rounded-lg border border-card-border px-3 py-2 text-xs text-gray-300 hover:border-gold/50 hover:text-gold disabled:opacity-40 md:mt-14"
            title="Swap which person survives"
          >
            ⇄ Swap
          </button>
          <PersonPicker
            key={`target-${target?.playerId ?? 'empty'}`}
            title="Keep"
            help="This person id and display name survive; all records from the left move here."
            selected={target}
            onSelect={(person) => { setTarget(person); setReviewing(false); setError(null); }}
            excludeId={source?.playerId ?? null}
          />
        </div>

        <div className="mt-4 rounded-xl border border-card-border bg-card-bg p-4 text-sm">
          {!source || !target ? (
            <p className="text-gray-400">Select one person on each side to review the merge.</p>
          ) : samePerson ? (
            <p className="text-red-300">Choose two different people.</p>
          ) : twoLogins ? (
            <p className="text-red-300">
              Both people have Discord logins. This merge is blocked because the site supports one login per person.
            </p>
          ) : removesViewer ? (
            <p className="text-red-300">You cannot merge away the person attached to your own login.</p>
          ) : (
            <div>
              <p className="text-gray-300">
                <span className="text-red-300">Delete #{source.playerId} ({personName(source)})</span>
                {' → '}
                <span className="text-emerald-300">keep #{target.playerId} ({personName(target)})</span>
              </p>
              {reviewing && (
                <p className="mt-2 leading-relaxed text-red-200">
                  Final check: #{source.playerId} will disappear. Its characters, roster seats, bans,
                  requests, invites and login move to #{target.playerId}. This cannot be undone here.
                </p>
              )}
            </div>
          )}
          {error && <p className="mt-2 text-red-300">{error}</p>}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-card-border px-4 py-2 text-sm text-gray-400 hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={merge}
            disabled={blocked}
            className="rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Merging…' : reviewing ? 'Confirm merge' : 'Review merge'}
          </button>
        </div>
      </div>
    </div>
  );
}
