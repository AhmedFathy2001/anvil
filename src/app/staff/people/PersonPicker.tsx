'use client';

import { useState, type FormEvent } from 'react';

import Input from '@/components/Input';
import type { PersonHit } from '@/lib/platformView';

export function personName(person: PersonHit): string {
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

export default function PersonPicker({
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
