'use client';

import { useEffect, useMemo, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';
import { applyAmount, titleAt, type TaskCandidate } from '@/lib/taskMatch';
import {
  draftKindFields,
  howItCountsLine,
  supportsTrackingMode,
  type TileDraft,
} from '@/lib/tileCreatorConfig';
import { tileTierKey, tierColor, type TierBand } from '@/lib/tileFilter';
import { deriveTileIcon } from '@/lib/tileIcons';
import { formatTileAmount } from '@/lib/tileKinds';
import { AmountField, ChoiceButton, CountsBanner, Eyebrow, PrimaryButton, SecondaryButton, StepHeader } from './parts';

interface Suggestion {
  suggestedPoints: number | null;
  averageHours: number | null;
}

function clockText(s: number | null | undefined): string {
  if (!s) return '';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
function clockSeconds(v: string): number | null {
  const parts = v.trim().split(':').map((p) => parseInt(p, 10));
  if (parts.length === 0 || parts.some((p) => !Number.isFinite(p))) return null;
  if (parts.length === 1) return parts[0] * 60;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

/**
 * One sentence, done: "Players must <verb> [N] <thing>", who it counts for, how it counts, what it's
 * worth, and how it shows on the board. Everything else lives behind "More options", which opens
 * the full editor with all of this already filled in.
 */
export default function ConfirmStep({
  candidate,
  pointsMode,
  tierBands,
  teamPlay,
  eventId,
  tileId,
  initialPoints,
  saving,
  error,
  detached = false,
  canAddAnother = true,
  onBack,
  onMoreOptions,
  onSubmit,
}: {
  candidate: TaskCandidate;
  pointsMode: boolean;
  tierBands: TierBand[];
  teamPlay: boolean;
  eventId?: number;
  tileId?: number;
  initialPoints: number | null;
  saving: boolean;
  error: string | null;
  /** Editing a bulk row: one "Use this" button, no full editor. */
  detached?: boolean;
  canAddAnother?: boolean;
  onBack: () => void;
  onMoreOptions?: (draft: TileDraft) => void;
  onSubmit: (draft: TileDraft, another: boolean) => void;
}) {
  const bands = useMemo(() => [...tierBands].sort((a, b) => a.min - b.min), [tierBands]);
  const [amount, setAmount] = useState<number | null>(candidate.amount);
  const [label, setLabel] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [trackingMode, setTrackingMode] = useState<'team' | 'individual'>('team');
  // A points board starts with no tier picked (a placeholder's 1 point is not a choice anyone made).
  const [points, setPoints] = useState<number | null>(candidate.points ?? (pointsMode ? null : initialPoints ?? 1));
  const [capText, setCapText] = useState(clockText(candidate.config.timeThresholdSeconds));
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  const isTimedCap = candidate.config.tileType === 'timed' && candidate.source !== 'trial';
  const current = applyAmount(candidate, amount);
  const config = useMemo(
    () => (isTimedCap ? { ...current.config, timeThresholdSeconds: clockSeconds(capText) } : current.config),
    [current.config, isTimedCap, capText],
  );
  const autoLabel = titleAt(candidate, amount);
  const effectiveLabel = (label ?? autoLabel).trim() || autoLabel;
  const how = howItCountsLine(config);
  const showTracking = teamPlay && supportsTrackingMode(config);
  const configKey = JSON.stringify(draftKindFields(config));

  // The effort model's view of this tile on this board — only on points boards, and only what the
  // model actually knows: an unmodelled tile suggests nothing rather than inventing hours.
  useEffect(() => {
    if (!pointsMode || !eventId || how.engine === 'screenshot') {
      setSuggestion(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await clanFetch(`/api/admin/events/${eventId}/balance/draft`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tileId, tile: { ...JSON.parse(configKey), trackingMode, label: effectiveLabel, points: points ?? 1 } }),
        });
        const data = res.ok ? ((await res.json()) as Suggestion) : null;
        if (!cancelled) setSuggestion(data);
      } catch {
        if (!cancelled) setSuggestion(null);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // Points and the label don't change what the model estimates; re-pricing on every keystroke would.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey, trackingMode, pointsMode, eventId, tileId, how.engine]);

  const suggestedBand = suggestion?.suggestedPoints != null ? bands.find((b) => b.key === tileTierKey(suggestion.suggestedPoints, bands)) : null;
  const pickedBand = points != null ? tileTierKey(points, bands) : null;

  const draft: TileDraft = {
    label: effectiveLabel,
    config,
    points: pointsMode ? points ?? suggestion?.suggestedPoints ?? 1 : initialPoints ?? 1,
    trackingMode: showTracking ? trackingMode : 'team',
    category: candidate.tileCategory ?? null,
  };

  const icon = deriveTileIcon({
    tileType: config.tileType ?? 'standard',
    trackedStat: config.trackedStat ?? null,
    statType: config.statType ?? null,
    trackedItemIds: config.trackedItemIds ? JSON.stringify(config.trackedItemIds) : null,
    itemRequirements: config.itemRequirements ? JSON.stringify(config.itemRequirements) : null,
    timedActivity: config.timedActivity ?? null,
    targetNpcs: config.targetNpcs ? JSON.stringify(config.targetNpcs) : null,
  });
  const goal = (candidate.amountField ? config[candidate.amountField] : null) as number | null;
  const progress =
    goal == null ? null
    : config.statType === 'skill' ? `0 / ${goal.toLocaleString('en-US')} XP`
    : config.statType === 'boss' ? `0 / ${goal.toLocaleString('en-US')} KC`
    : candidate.source === 'counter' ? `0 / ${goal.toLocaleString('en-US')}`
    : `0 / ${formatTileAmount({ tileType: config.tileType, targetNpcs: config.targetNpcs ?? null }, goal)}`;

  return (
    <div>
      <StepHeader title={detached ? 'Edit this line' : 'Check and add'} onBack={onBack} />

      <Eyebrow>Players must</Eyebrow>
      <div className="flex flex-wrap items-center gap-2 text-base mb-3">
        <span>{candidate.verb}</span>
        {candidate.amountField && <AmountField value={amount} onChange={setAmount} label="Amount" />}
        <button
          type="button"
          onClick={onBack}
          title="Pick a different task"
          className="min-h-11 px-3 rounded-lg border border-card-border hover:border-gold/50 text-left font-medium"
        >
          {candidate.noun} <span aria-hidden="true" className="text-text-muted">▾</span>
        </button>
      </div>
      {isTimedCap && (
        <div className="flex flex-wrap items-center gap-2 text-sm mb-3">
          <label htmlFor="cap" className="text-text-muted">In under</label>
          <input
            id="cap"
            value={capText}
            onChange={(e) => setCapText(e.target.value)}
            placeholder="mm:ss"
            className="w-28 min-h-11 px-3 rounded-lg bg-brown-dark border border-card-border text-center focus:outline-none focus:border-gold"
          />
          <span className="text-xs text-text-muted">(leave blank for any time)</span>
        </div>
      )}
      {showTracking && (
        <div role="group" aria-label="Who it counts for" className="grid grid-cols-2 gap-2 mb-4">
          <ChoiceButton pressed={trackingMode === 'team'} onClick={() => setTrackingMode('team')} title="Every member's progress adds up toward the goal.">
            As a team
          </ChoiceButton>
          <ChoiceButton pressed={trackingMode === 'individual'} onClick={() => setTrackingMode('individual')} title="One member has to reach the goal on their own; the first to get there completes it for the team.">
            One player alone
          </ChoiceButton>
        </div>
      )}

      <div className="mb-5">
        <CountsBanner engine={how.engine} text={how.text} />
      </div>

      {pointsMode && (
        <div className="mb-5">
          <Eyebrow>Worth</Eyebrow>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {bands.map((b, i) => (
              <ChoiceButton key={b.key} pressed={pickedBand === b.key} onClick={() => setPoints(Math.max(1, b.min))} className="flex flex-col items-center leading-tight">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="w-2 h-2 rounded-full" style={{ background: tierColor(i, bands.length) }} />
                  {b.label}
                </span>
                <span className="text-[11px] text-text-muted">{Math.max(1, b.min)}{i < bands.length - 1 ? `–${bands[i + 1].min - 1}` : '+'}</span>
              </ChoiceButton>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="pts" className="text-text-muted">Points</label>
            <AmountField id="pts" value={points} onChange={setPoints} label="Points" />
            {!suggestedBand && suggestion?.averageHours != null && (
              <span className="text-xs text-text-muted">About {suggestion.averageHours} h for an average player (effort model).</span>
            )}
            {suggestedBand && suggestion?.suggestedPoints != null && (
              <button
                type="button"
                onClick={() => setPoints(suggestion.suggestedPoints)}
                className="min-h-11 text-xs text-gold hover:text-gold-light underline underline-offset-2"
              >
                Suggested: {suggestedBand.label}, {suggestion.suggestedPoints} pts
                {suggestion.averageHours != null ? ` (about ${suggestion.averageHours} h for an average player)` : ''}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mb-5">
        <Eyebrow>Shows on the board as</Eyebrow>
        <div className="flex items-center gap-3 rounded-xl border border-card-border bg-card-bg p-3">
          <div className="w-12 h-12 shrink-0 rounded-lg border border-card-border bg-brown-dark grid place-items-center overflow-hidden">
            {icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={icon} alt="" className="max-w-10 max-h-10 object-contain" />
            ) : (
              <span aria-hidden="true" className="w-2 h-2 rounded-full bg-gold/60" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {renaming ? (
              <input
                aria-label="Tile name"
                autoFocus
                value={label ?? autoLabel}
                onChange={(e) => setLabel(e.target.value)}
                onBlur={() => setRenaming(false)}
                onKeyDown={(e) => { if (e.key === 'Enter') setRenaming(false); }}
                className="w-full min-h-11 px-2 rounded bg-brown-dark border border-card-border text-sm font-semibold focus:outline-none focus:border-gold"
              />
            ) : (
              <p className="text-sm font-semibold break-words">{effectiveLabel}</p>
            )}
            <p className="text-xs text-text-muted">
              {[progress, pointsMode ? (points != null ? `${points} pts` : 'pick a tier') : null].filter(Boolean).join(' · ')}
            </p>
          </div>
          {!renaming && (
            <button type="button" onClick={() => setRenaming(true)} className="min-h-11 px-3 text-sm text-gold hover:text-gold-light">
              Rename
            </button>
          )}
        </div>
      </div>

      {onMoreOptions && !detached && (
        <button
          type="button"
          onClick={() => onMoreOptions(draft)}
          className="w-full min-h-11 mb-5 text-left text-sm text-text-muted hover:text-foreground border-t border-card-border pt-3"
        >
          More options: description, categories, tile kind, start-of-event rules →
        </button>
      )}

      {error && <p role="alert" className="mb-3 text-sm text-red-300">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        {detached ? (
          <PrimaryButton onClick={() => onSubmit(draft, false)}>Use this</PrimaryButton>
        ) : (
          <>
            {canAddAnother && (
              <SecondaryButton onClick={() => onSubmit(draft, true)} disabled={saving}>
                Add &amp; another
              </SecondaryButton>
            )}
            <PrimaryButton onClick={() => onSubmit(draft, false)} disabled={saving}>
              {saving ? 'Adding…' : 'Add tile'}
            </PrimaryButton>
          </>
        )}
      </div>
    </div>
  );
}
