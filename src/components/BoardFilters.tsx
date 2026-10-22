'use client';

import { useEffect, useState } from 'react';
import Select from './Select';
import { tileTierKey, tileCategories, tileHasCategory, tierColor, type TierBand } from '@/lib/tileFilter';
import Input from '@/components/Input';
import { tileMatchesSearch, type SearchableTile } from '@/lib/tileSearch';
import { tileKindFilterKey, tileKindOptions } from '@/lib/tileKinds';

interface FilterTile extends SearchableTile {
  id: number;
  points?: number | null;
}

// Self-contained board filter bar (text search + content category + tile type + difficulty tier). Owns its own
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
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = tileCategories(tiles);
  const typeOptions = tileKindOptions(tiles);
  // One kind on the whole board leaves nothing to choose between.
  const showTypeFilter = typeOptions.length > 2;
  // Tier bands only make sense when tiles carry distinct point values.
  const showTierFilter = pointsMode && tierBands.length > 0;
  const showFilters = categories.length > 0 || showTierFilter || showTypeFilter;

  // Recompute + report the matched set whenever a filter changes. Derived from the primitive filter
  // state (not a memo of a fresh Set) so it fires only on real changes, never in a render loop.
  useEffect(() => {
    const search = searchQuery.trim().toLowerCase();
    const active = categoryFilter !== 'all' || tierFilter !== 'all' || typeFilter !== 'all' || search !== '';
    if (!active) {
      onMatched(null);
      return;
    }
    onMatched(
      new Set(
        tiles
          .filter((t) => categoryFilter === 'all' || tileHasCategory(t.category, categoryFilter))
          .filter((t) => tierFilter === 'all' || tileTierKey(t.points, tierBands) === tierFilter)
          .filter((t) => typeFilter === 'all' || tileKindFilterKey(t) === typeFilter)
          .filter((t) => tileMatchesSearch(t, search))
          .map((t) => t.id),
      ),
    );
  }, [categoryFilter, tierFilter, typeFilter, searchQuery, tiles, tierBands, onMatched]);

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
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tiles…"
          className="pl-9 pr-9 rounded-lg placeholder:text-text-muted focus:border-gold/50"
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
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          {categories.length > 0 && (
            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[{ value: 'all', label: 'All categories' }, ...categories.map((c) => ({ value: c, label: c }))]}
              ariaLabel="Filter board by category"
              className="shrink-0 sm:w-48"
            />
          )}
          {showTypeFilter && (
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              options={typeOptions}
              ariaLabel="Filter board by tile type"
              className="shrink-0 sm:w-44"
            />
          )}
          {showTierFilter && (
            <Select
              value={tierFilter}
              onChange={setTierFilter}
              options={[
                { value: 'all', label: 'All tiers' },
                ...tierBands.map((t, i) => ({ value: t.key, label: t.label, dot: tierColor(i, tierBands.length) })),
              ]}
              ariaLabel="Filter board by tier"
              className="shrink-0 sm:w-48"
            />
          )}
        </div>
      )}
    </div>
  );
}
