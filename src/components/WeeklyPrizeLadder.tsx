'use client';

import Input from '@/components/Input';
import Checkbox from '@/components/Checkbox';
import { formatGp, parseGpInput } from '@/lib/adminEventsFormat';
import { MAX_WEEKLY_PLACES, totalPrizeGp, type WeeklyPrizes } from '@/lib/weeklyPrizes';

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
const ordinal = (i: number) => ORDINALS[i] ?? `${i + 1}th`;

/**
 * The ladder itself: places, the two rules under them, and what it costs.
 *
 * Controlled and presentational — no fetching, no saving — because it is asked for in two places
 * that persist differently. On a running competition it saves to its own route; while creating one
 * there is nothing to save it to yet, so it rides along with the competition. Writing it twice was
 * how the create form ended up without it in the first place.
 */
export default function WeeklyPrizeLadder({
  value,
  onChange,
  cofferAvailable,
  hasCoffer,
  disabled = false,
}: {
  value: WeeklyPrizes;
  onChange: (next: WeeklyPrizes) => void;
  /** What the clan can cover right now, so an over-promise is visible while authoring. */
  cofferAvailable: number;
  /** False when the clan has never moved gp. Says so rather than pretending the ladder is free. */
  hasCoffer: boolean;
  disabled?: boolean;
}) {
  const total = totalPrizeGp(value);
  const overPromised = total > cofferAvailable;
  const patch = (next: Partial<WeeklyPrizes>) => onChange({ ...value, ...next });

  return (
    <div>
      <div className="space-y-2">
        {value.places.map((place, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="w-14 font-semibold text-gold">{ordinal(i)}</span>
            <Input
              type="text"
              inputMode="numeric"
              value={place.gp ? String(place.gp) : ''}
              onChange={(e) => {
                const gp = parseGpInput(e.target.value) ?? 0;
                patch({ places: value.places.map((p, j) => (j === i ? { gp } : p)) });
              }}
              placeholder="e.g. 50m"
              className="w-28"
              disabled={disabled}
              aria-label={`Prize for ${ordinal(i)} place`}
            />
            <span className="text-text-muted/60 flex-1 min-w-0">
              {place.gp > 0 ? `${formatGp(place.gp)} gp` : 'no prize for this place'}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={() => patch({ places: value.places.filter((_, j) => j !== i) })}
                className="text-[10px] text-text-muted hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      {value.places.length === 0 && (
        <p className="text-xs text-text-muted">No places set — this competition pays nothing but bragging rights.</p>
      )}

      {!disabled && value.places.length < MAX_WEEKLY_PLACES && (
        <button
          type="button"
          onClick={() => patch({ places: [...value.places, { gp: 0 }] })}
          className="mt-3 text-xs px-2.5 py-1 rounded-md bg-card-border/40 text-text-muted hover:text-foreground transition-colors"
        >
          + Add {value.places.length === 0 ? 'a place' : ordinal(value.places.length)}
        </button>
      )}

      {value.places.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-card-border pt-4">
          <Checkbox
            checked={value.splitTies}
            onChange={(checked) => patch({ splitTies: checked })}
            disabled={disabled}
            label="Split a place between people who finish level"
            description="Everyone tied pools the places they occupy and takes an equal share — three tied for first on a 100m / 50m / 25m ladder take 58.3m each. Off, the board's own order decides and the first of them takes the bigger prize."
          />
          <Checkbox
            checked={value.payZeroGain}
            onChange={(checked) => patch({ payZeroGain: checked })}
            disabled={disabled}
            label="Pay a place even if they gained nothing"
            description="Off by default. On a quiet week a board can have three entrants with two on zero, and paying gp for turning up is not usually what a top three meant."
          />
        </div>
      )}

      {total > 0 && (
        <p className={`mt-4 text-xs ${overPromised ? 'text-amber-300' : 'text-text-muted'}`}>
          {!hasCoffer
            ? `The clan coffer is empty — nothing has been paid into it yet. The ladder still saves, and every place is recorded as owed until somebody funds it.`
            : overPromised
              ? `This ladder promises ${formatGp(total)} gp and the coffer has ${formatGp(cofferAvailable)} available. The places it can't cover are still recorded — as owed, unpaid — so nobody's prize quietly disappears.`
              : `Promises ${formatGp(total)} gp of the coffer's ${formatGp(cofferAvailable)}.`}
        </p>
      )}
    </div>
  );
}
