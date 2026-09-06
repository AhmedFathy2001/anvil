'use client';

import Input from '@/components/Input';
import { formatGp, parseGpInput } from '@/lib/adminEventsFormat';
import { MAX_MISSION_PLACES, type MissionPlace, type MissionReward } from '@/lib/eventRules';

/**
 * What a mission pays, place by place.
 *
 * Authored as a LADDER rather than as a single prize because that is how clans actually run these:
 * "first takes the gp", "top three split it", "everyone who finishes banks points". One row per
 * place, and a tail rule for everybody after them.
 *
 * The row that carries the design is the third column. A prize comes out of the clan coffer, and a
 * coffer runs dry — so a place offering gp also has to say what it is worth when the pot cannot pay,
 * and the editor asks that question inline instead of leaving the host to discover the answer the
 * night it happens.
 */

/** A blank line, worth the tile's own points and no money — the least surprising place to start. */
const EMPTY_PLACE: MissionPlace = { points: null, gp: 0, unfundedPoints: null };

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

export default function MissionRewardEditor({
  value,
  onChange,
  pointsMode,
  teamPlay,
  cofferAvailable,
}: {
  value: MissionReward | null;
  onChange: (next: MissionReward | null) => void;
  /** Points fields only mean something in a points-scored event; gp works either way. */
  pointsMode: boolean;
  teamPlay: boolean;
  /** What the clan can actually cover right now, so an over-promise is visible while authoring. */
  cofferAvailable?: number | null;
}) {
  const places = value?.places ?? [];
  const finisher = teamPlay ? 'team' : 'player';

  function patch(next: Partial<MissionReward>) {
    const merged: MissionReward = {
      places: next.places ?? places,
      restPoints: next.restPoints !== undefined ? next.restPoints : (value?.restPoints ?? null),
      maxClaims: next.maxClaims !== undefined ? next.maxClaims : (value?.maxClaims ?? null),
    };
    // A ladder with nothing in it is not a ladder — hand back null so the tile stores no rules at all.
    const empty = merged.places.length === 0 && merged.restPoints == null && merged.maxClaims == null;
    onChange(empty ? null : merged);
  }

  function setPlace(index: number, patchPlace: Partial<MissionPlace>) {
    patch({ places: places.map((p, i) => (i === index ? { ...p, ...patchPlace } : p)) });
  }

  const promised = places.reduce((sum, p) => sum + p.gp, 0);
  const overPromised = cofferAvailable != null && promised > cofferAvailable;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-text-muted mb-1">
          Prizes &amp; places{' '}
          <span className="text-text-muted/60">(what each finishing position wins)</span>
        </label>
        {places.length === 0 && (
          <p className="text-[10px] text-text-muted leading-relaxed mb-2">
            No places set — every {finisher} who finishes scores the tile&apos;s own points. Add a place to
            pay the first finisher differently, in points, in gp from the coffer, or both.
          </p>
        )}
      </div>

      {places.map((place, i) => (
        <div key={i} className="rounded-lg border border-card-border/60 bg-black/10 p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gold">{ORDINALS[i] ?? `${i + 1}th`} to finish</span>
            <button
              type="button"
              onClick={() => patch({ places: places.filter((_, j) => j !== i) })}
              className="text-[10px] text-text-muted hover:text-red-400 transition-colors"
            >
              Remove
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="w-12">Points</span>
            <Input
              type="number"
              min="0"
              value={place.points == null ? '' : String(place.points)}
              onChange={(e) => setPlace(i, { points: e.target.value === '' ? null : Math.max(0, parseInt(e.target.value, 10) || 0) })}
              placeholder="tile value"
              disabled={!pointsMode}
              className="w-24"
              aria-label={`Points for place ${i + 1}`}
            />
            <span className="text-text-muted/60">blank = the tile&apos;s own value · 0 = none</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="w-12">Prize</span>
            <Input
              type="text"
              inputMode="numeric"
              value={place.gp ? String(place.gp) : ''}
              onChange={(e) => setPlace(i, { gp: parseGpInput(e.target.value) ?? 0 })}
              placeholder="e.g. 50m"
              className="w-24"
              aria-label={`Prize for place ${i + 1}`}
            />
            <span className="text-text-muted/60">
              {place.gp > 0 ? `${formatGp(place.gp)} gp from the coffer` : 'gp from the clan coffer'}
            </span>
          </div>

          {place.gp > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted border-l border-gold/25 pl-2 ml-1">
              <span>If the coffer is empty, award</span>
              <Input
                type="number"
                min="0"
                value={place.unfundedPoints == null ? '' : String(place.unfundedPoints)}
                onChange={(e) =>
                  setPlace(i, {
                    unfundedPoints: e.target.value === '' ? null : Math.max(0, parseInt(e.target.value, 10) || 0),
                  })
                }
                placeholder="tile value"
                disabled={!pointsMode}
                className="w-24"
                aria-label={`Unfunded points for place ${i + 1}`}
              />
              <span>points instead</span>
            </div>
          )}
        </div>
      ))}

      {places.length < MAX_MISSION_PLACES && (
        <button
          type="button"
          onClick={() => patch({ places: [...places, { ...EMPTY_PLACE }] })}
          className="text-xs px-2.5 py-1 rounded-md bg-card-border/40 text-text-muted hover:text-foreground transition-colors"
        >
          + Add {places.length === 0 ? 'a place' : ORDINALS[places.length] ?? 'another place'}
        </button>
      )}

      {places.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span>Everyone after that scores</span>
            <Input
              type="number"
              min="0"
              value={value?.restPoints == null ? '' : String(value.restPoints)}
              onChange={(e) => patch({ restPoints: e.target.value === '' ? null : Math.max(0, parseInt(e.target.value, 10) || 0) })}
              placeholder="tile value"
              disabled={!pointsMode}
              className="w-24"
              aria-label="Points for everyone past the last place"
            />
            <span className="text-text-muted/60">points · blank = the tile&apos;s own value</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span>Close the mission after</span>
            <Input
              type="number"
              min="1"
              value={value?.maxClaims == null ? '' : String(value.maxClaims)}
              onChange={(e) => patch({ maxClaims: e.target.value === '' ? null : Math.max(1, parseInt(e.target.value, 10) || 1) })}
              placeholder="never"
              className="w-24"
              aria-label="Close after this many claims"
            />
            <span className="text-text-muted/60">
              {value?.maxClaims === 1
                ? `claim — the first ${finisher} locks it`
                : 'claims · blank = stays open until it expires'}
            </span>
          </div>
        </>
      )}

      {promised > 0 && (
        <p className={`text-[10px] leading-relaxed ${overPromised ? 'text-amber-300' : 'text-text-muted'}`}>
          {overPromised
            ? `This mission promises ${formatGp(promised)} gp but the coffer only has ${formatGp(cofferAvailable ?? 0)} available. It will still drop — the places it can't fund pay points instead.`
            : `Promises ${formatGp(promised)} gp from the coffer when every place is claimed.`}
        </p>
      )}
      {!pointsMode && places.length > 0 && (
        <p className="text-[10px] text-amber-300/80">
          This event scores tiles, not points, so only the gp prizes and the claim limit apply here.
        </p>
      )}
    </div>
  );
}
