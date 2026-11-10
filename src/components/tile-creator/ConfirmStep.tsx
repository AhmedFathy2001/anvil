'use client';

import { useEffect, useMemo, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';
import { applyAmount, killCandidate, titleAt, type TaskCandidate } from '@/lib/taskMatch';
import KillPicksField from './KillPicksField';
import { comboCandidate } from '@/lib/taskMatch';
import { comboLabel, comboSentence, type ComboRule } from '@/lib/combo';
import {
  draftKindFields,
  howItCountsLine,
  killPicksOf,
  supportsTrackingMode,
  type TileDraft,
} from '@/lib/tileCreatorConfig';
import { tileTierKey, tierColor, type TierBand } from '@/lib/tileFilter';
import { formatTileAmount } from '@/lib/tileKinds';
import { clogTileSetupNote } from '@/lib/clogTileWords';
import TileBeforeYouStart from '@/components/TileBeforeYouStart';
import { AmountField, ChoiceButton, CountsBanner, Eyebrow, PrimaryButton, SecondaryButton, StepHeader, configIcon } from './parts';

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

type ConfirmProps = {
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
};

/**
 * One sentence, done: "Players must <verb> [N] <thing>", who it counts for, how it counts, what it's
 * worth, and how it shows on the board. Everything else lives behind "More options", which opens
 * the full editor with all of this already filled in. A COMBO (lib/combo) gets its own short screen.
 */
export default function ConfirmStep(props: ConfirmProps) {
  if (props.candidate.source === 'combo' && props.candidate.comboParts?.length) return <ComboConfirm {...props} />;
  return <SingleConfirm {...props} />;
}

function SingleConfirm({
  candidate: original,
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
}: ConfirmProps) {
  const bands = useMemo(() => [...tierBands].sort((a, b) => a.min - b.min), [tierBands]);
  const [amount, setAmount] = useState<number | null>(original.amount);
  const [label, setLabel] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [trackingMode, setTrackingMode] = useState<'team' | 'individual'>('team');
  // A points board starts with no tier picked (a placeholder's 1 point is not a choice anyone made).
  const [points, setPoints] = useState<number | null>(original.points ?? (pointsMode ? null : initialPoints ?? 1));
  const [capText, setCapText] = useState(clockText(original.config.timeThresholdSeconds));
  // Kills tiles can take more bosses: their kills count together (lib/killSource picks the engine).
  const killable = ['boss', 'counter', 'monster'].includes(original.source) && killPicksOf(original.config).length > 0;
  const [picks, setPicks] = useState<string[]>(() => killPicksOf(original.config));
  const picksChanged = killable && picks.join('|') !== killPicksOf(original.config).join('|');
  const candidate = (picksChanged && killCandidate(picks, amount, { tileCategory: original.tileCategory, points: original.points })) || original;
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
    // A tiles-scored board still keeps points typed with the task (they score nothing there).
    points: pointsMode ? points ?? suggestion?.suggestedPoints ?? 1 : points ?? initialPoints ?? 1,
    trackingMode: showTracking ? trackingMode : 'team',
    category: candidate.tileCategory ?? null,
  };

  const icon = configIcon(config);
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

      {/* The task as one sentence, big: the number and the name are the two things you change. */}
      <Eyebrow>Players must</Eyebrow>
      <div className="display flex flex-wrap items-center gap-x-2.5 gap-y-2 text-xl font-semibold leading-snug mb-4">
        <span>{candidate.verb}</span>
        {candidate.amountField && <AmountField value={amount} onChange={setAmount} label="Amount" />}
        <button
          type="button"
          onClick={onBack}
          title="Pick a different task"
          className="min-h-11 max-w-full px-3 py-1.5 rounded-lg border border-card-border hover:border-gold/50 text-left break-words"
        >
          {candidate.noun} <span aria-hidden="true" className="text-text-muted">▾</span>
        </button>
      </div>
      {killable && <KillPicksField picks={picks} onChange={setPicks} />}
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

      <div className="mb-6">
        <CountsBanner engine={how.engine} text={how.text} />
        {candidate.config.tileType === 'clog' && (
          <p className="mt-2 text-xs leading-relaxed text-amber-200/90">{clogTileSetupNote(candidate.config.countMode === 'complete' ? 'complete' : 'slots')}</p>
        )}
        <div className="mt-2">
          <TileBeforeYouStart tile={{ ...config, trackingMode: showTracking ? trackingMode : 'team' }} compact />
        </div>
      </div>

      {!pointsMode && original.points != null && (
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="pts-quiet" className="text-text-muted">Points</label>
          <AmountField id="pts-quiet" value={points} onChange={setPoints} label="Points" />
          <span className="text-xs text-text-muted">Saved with the tile; points only matter on a points-scoring board.</span>
        </div>
      )}
      {pointsMode && (
        <div className="mb-6">
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

      <div className="mb-6">
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
      {/* Pinned to the bottom of the panel, so the button to add it never scrolls away. */}
      <div className={detached ? 'flex flex-wrap justify-end gap-2' : 'sticky bottom-0 z-10 -mx-5 sm:-mx-6 px-5 sm:px-6 py-3 border-t border-card-border bg-card-bg/95 backdrop-blur flex flex-wrap justify-end gap-2'}>
        {detached ? (
          <PrimaryButton onClick={() => onSubmit(draft, false)}>Use this</PrimaryButton>
        ) : (
          <>
            {canAddAnother && (
              <SecondaryButton onClick={() => onSubmit(draft, true)} disabled={saving}>
                Add &amp; next tile
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

/**
 * A COMBO (lib/combo): the rule, each part with its own amount, and "drop this part". Dropping down to
 * one part turns it back into that part's own tile, on the ordinary confirm screen.
 */
function ComboConfirm(props: ConfirmProps) {
  const { candidate: original, pointsMode, initialPoints, saving, error, detached = false, canAddAnother = true, onBack, onMoreOptions, onSubmit } = props;
  const [parts, setParts] = useState<TaskCandidate[]>(original.comboParts ?? []);
  // Mix only: each part's share (blank = 1), by position in `parts`.
  const [weights, setWeights] = useState<(number | null)[]>(() => (original.config.parts ?? []).map((p) => p.comboWeight ?? null));
  const initialRule = (original.config.comboRule as ComboRule | null | undefined) ?? { mode: 'any' };
  const [mode, setMode] = useState<ComboRule['mode']>(initialRule.mode);
  const [n, setN] = useState<number | null>(initialRule.n ?? 2);
  const [label, setLabel] = useState<string | null>(null);
  const [points, setPoints] = useState<number | null>(original.points ?? (pointsMode ? null : initialPoints ?? 1));

  if (parts.length === 1) {
    return <SingleConfirm {...props} candidate={{ ...parts[0], confident: true }} />;
  }
  const nClamped = Math.max(1, Math.min(n ?? 1, parts.length));
  const rule: ComboRule = mode === 'nOf'
    ? nClamped >= parts.length ? { mode: 'all' } : nClamped === 1 ? { mode: 'any' } : { mode: 'nOf', n: nClamped }
    : { mode };
  const base = comboCandidate(rule, parts);
  const weightOk = (w: number | null | undefined) => w != null && w > 0 && w <= 1;
  const combo = rule.mode === 'mix'
    ? {
        ...base,
        config: {
          ...base.config,
          parts: (base.config.parts ?? []).map((p, i) => (weightOk(weights[i]) ? { ...p, comboWeight: weights[i] } : p)),
        },
      }
    : base;
  const autoLabel = comboLabel(rule, parts.map((p) => p.title));
  const effectiveLabel = (label ?? autoLabel).trim() || autoLabel;
  const how = howItCountsLine(combo.config);
  const draft: TileDraft = {
    label: effectiveLabel,
    config: combo.config,
    points: pointsMode ? points ?? 1 : points ?? initialPoints ?? 1,
    trackingMode: 'team',
    category: original.tileCategory ?? null,
  };
  const setPartAmount = (i: number, v: number | null) =>
    setParts((prev) => prev.map((p, j) => (j === i ? applyAmount(p, v) : p)));

  return (
    <div>
      <StepHeader title={detached ? 'Edit this line' : 'Check and add'} onBack={onBack} />
      <p className="text-sm text-foreground/85 mb-3" data-testid="combo-sentence">
        {comboSentence(rule, parts.map((p) => p.title))}
      </p>

      <Eyebrow>Done when the team does</Eyebrow>
      <div role="group" aria-label="Combo rule" className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <ChoiceButton pressed={rule.mode === 'any'} onClick={() => setMode('any')} title="Any one part finishes the tile.">
          Any one
        </ChoiceButton>
        <ChoiceButton pressed={rule.mode === 'all'} onClick={() => setMode('all')} title="Every part has to be done.">
          All of them
        </ChoiceButton>
        <ChoiceButton pressed={rule.mode === 'nOf'} onClick={() => { setMode('nOf'); if (n == null || n < 2) setN(2); }} title="At least this many of the parts.">
          At least N
        </ChoiceButton>
        <ChoiceButton pressed={rule.mode === 'mix'} onClick={() => setMode('mix')} title="Mix and match — any combination adding up to 100%: each part adds its share.">
          Mix and match
        </ChoiceButton>
      </div>
      {mode === 'mix' && (
        <p className="text-xs text-text-muted mb-3">
          Any combination adding up to 100%: each part adds its share of its own goal. A weight under 1 makes a part count for less (blank = 1).
        </p>
      )}
      {mode === 'nOf' && (
        <div className="flex items-center gap-2 text-sm mb-3">
          <span className="text-text-muted">At least</span>
          <AmountField value={n} onChange={setN} label="How many parts" />
          <span className="text-text-muted">of {parts.length}</span>
        </div>
      )}

      <Eyebrow>Parts</Eyebrow>
      <ul className="mb-4 space-y-2">
        {parts.map((p, i) => (
          <li key={`${p.key}-${i}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-card-border bg-card-bg p-2">
            <span className="text-xs px-1.5 py-0.5 rounded bg-brown-dark text-text-muted">{p.badge}</span>
            <span className="text-sm">{p.verb}</span>
            {p.amountField && <AmountField value={p.amount} onChange={(v) => setPartAmount(i, v)} label={`Amount for ${p.noun}`} />}
            <span className="text-sm font-medium min-w-0 break-words flex-1">{p.noun}</span>
            {mode === 'mix' && (
              <label className="flex items-center gap-1 text-xs text-text-muted">
                Weight
                <input
                  type="number"
                  min={0.01}
                  max={1}
                  step={0.05}
                  inputMode="decimal"
                  aria-label={`Weight for ${p.noun}`}
                  value={weights[i] ?? ''}
                  placeholder="1"
                  onChange={(e) => {
                    const v = e.target.value === '' ? null : Number(e.target.value);
                    setWeights((prev) => parts.map((_, j) => (j === i ? (v != null && Number.isFinite(v) ? v : null) : prev[j] ?? null)));
                  }}
                  className="w-16 min-h-11 px-1.5 rounded bg-brown-dark border border-card-border text-right focus:outline-none focus:border-gold"
                />
              </label>
            )}
            <button
              type="button"
              onClick={() => {
                setParts((prev) => prev.filter((_, j) => j !== i));
                setWeights((prev) => prev.filter((_, j) => j !== i));
              }}
              className="min-h-11 px-3 text-sm text-text-muted hover:text-red-300"
              title="Drop this part"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="mb-6">
        <CountsBanner engine={how.engine} text={how.text} />
        <div className="mt-2">
          <TileBeforeYouStart tile={{ ...combo.config, comboRule: rule }} compact />
        </div>
      </div>

      {!pointsMode && original.points != null && (
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="combo-pts-quiet" className="text-text-muted">Points</label>
          <AmountField id="combo-pts-quiet" value={points} onChange={setPoints} label="Points" />
          <span className="text-xs text-text-muted">Saved with the tile; points only matter on a points-scoring board.</span>
        </div>
      )}
      {pointsMode && (
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="combo-pts" className="text-text-muted">Points</label>
          <AmountField id="combo-pts" value={points} onChange={setPoints} label="Points" />
        </div>
      )}

      <div className="mb-6">
        <Eyebrow>Shows on the board as</Eyebrow>
        <input
          aria-label="Tile name"
          value={label ?? autoLabel}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full min-h-11 px-3 rounded-lg bg-brown-dark border border-card-border text-sm font-semibold focus:outline-none focus:border-gold"
        />
      </div>

      {onMoreOptions && !detached && (
        <button
          type="button"
          onClick={() => onMoreOptions(draft)}
          className="w-full min-h-11 mb-5 text-left text-sm text-text-muted hover:text-foreground border-t border-card-border pt-3"
        >
          More options: description, categories, each part in full →
        </button>
      )}

      {error && <p role="alert" className="mb-3 text-sm text-red-300">{error}</p>}
      {/* Pinned to the bottom of the panel, so the button to add it never scrolls away. */}
      <div className={detached ? 'flex flex-wrap justify-end gap-2' : 'sticky bottom-0 z-10 -mx-5 sm:-mx-6 px-5 sm:px-6 py-3 border-t border-card-border bg-card-bg/95 backdrop-blur flex flex-wrap justify-end gap-2'}>
        {detached ? (
          <PrimaryButton onClick={() => onSubmit(draft, false)}>Use this</PrimaryButton>
        ) : (
          <>
            {canAddAnother && (
              <SecondaryButton onClick={() => onSubmit(draft, true)} disabled={saving}>
                Add &amp; next tile
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
