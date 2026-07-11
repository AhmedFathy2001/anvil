'use client';

import { useEffect, useState } from 'react';
import Select from './Select';
import { tileTierKey, tileCategories, tileHasCategory, tierColor, type TierBand } from '@/lib/tileFilter';

interface FilterTile {
  id: number;
  label: string;
  description?: string | null;
  category?: string | null;
  points?: number | null;
}

// Self-contained board filter bar (text search + content category + difficulty tier). Owns its own
// filter state and reports the matching tile ids up via `onMatched` (null = no filter active). The
// same logic the event scoreboard uses, extracted so every board surface can share it.
export default function BoardFilters({
  tiles,
  tierBands,
  pointsMode,
  onMatched,
}: {
  tiles: FilterTile[];
  tierBands: TierBand[];
  pointsMode: boolean;
  onMatched: (ids: Set<number> | null) => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = tileCategories(tiles);
  // Tier bands only make sense when tiles carry distinct point values.
  const showTierFilter = pointsMode && tierBands.length > 0;
  const showFilters = categories.length > 0 || showTierFilter;

  // Recompute + report the matched set whenever a filter changes. Derived from the primitive filter
  // state (not a memo of a fresh Set) so it fires only on real changes, never in a render loop.
  useEffect(() => {
    const search = searchQuery.trim().toLowerCase();
    const active = categoryFilter !== 'all' || tierFilter !== 'all' || search !== '';
    if (!active) {
      onMatched(null);
      return;
    }
    onMatched(
      new Set(
        tiles
          .filter((t) => categoryFilter === 'all' || tileHasCategory(t.category, categoryFilter))
          .filter((t) => tierFilter === 'all' || tileTierKey(t.points, tierBands) === tierFilter)
          .filter(
            (t) =>
              search === '' ||
              t.label.toLowerCase().includes(search) ||
              (t.description?.toLowerCase().includes(search) ?? false),
          )
          .map((t) => t.id),
      ),
    );
  }, [categoryFilter, tierFilter, searchQuery, tiles, tierBands, onMatched]);

  return (
    <div className="mb-4">
      <div className="relative mb-3">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tiles…"
          className="w-full text-sm pl-9 pr-9 py-2 bg-brown-dark border border-card-border rounded-lg text-foreground placeholder:text-text-muted focus:border-gold/50 focus:outline-none"
          aria-label="Search tiles"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-1 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground text-lg leading-none w-9 h-9 flex items-center justify-center"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {showFilters && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {categories.length > 0 && (
            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[{ value: 'all', label: 'All categories' }, ...categories.map((c) => ({ value: c, label: c }))]}
              ariaLabel="Filter board by category"
              className="shrink-0 sm:w-48"
            />
          )}
          {showTierFilter && (
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              <button
                onClick={() => setTierFilter('all')}
                className={`shrink-0 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                  tierFilter === 'all'
                    ? 'bg-gold/20 border-gold text-gold'
                    : 'border-card-border text-text-muted hover:border-gold/40'
                }`}
              >
                All tiers
              </button>
              {tierBands.map((t, i) => (
                <button
                  key={t.key}
                  onClick={() => setTierFilter(t.key)}
                  className={`shrink-0 text-xs px-2.5 py-1.5 rounded-lg border transition-colors inline-flex items-center gap-1.5 ${
                    tierFilter === t.key
                      ? 'bg-gold/20 border-gold text-gold'
                      : 'border-card-border text-text-muted hover:border-gold/40'
                  }`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: tierColor(i, tierBands.length) }}
                    aria-hidden
                  />
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
