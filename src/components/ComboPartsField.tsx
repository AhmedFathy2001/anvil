'use client';

import { useState } from 'react';
import TileTrackingConfig from '@/components/TileTrackingConfig';
import NumberInput from '@/components/NumberInput';
import {
  MAX_COMBO_PARTS,
  MIN_COMBO_PARTS,
  comboSentence,
  type ComboMode,
  type ComboRule,
} from '@/lib/combo';
import { configKind } from '@/lib/tileCreatorConfig';
import type { ComboPartConfig, TileConfig } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// The COMBO editor (lib/combo): the rule ("any one", "all", "at least N", "mix to 100%") and the parts,
// each edited with the ordinary tile editor in its compact part form — so every kind a board tile can
// be, a part can be, with the same validation. Parts are only written when the combo is saved (the
// tiles PUT takes them together), and they freeze with the combo once the event runs.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** One part as the combo editor holds it. `key` is local; `id` names a saved part. */
export interface ComboPartDraft extends ComboPartConfig {
  key: string;
}

let seq = 0;
const nextKey = () => `part-${++seq}`;

/** A fresh, kind-less part. */
export function blankPart(base: TileConfig, n: number): ComboPartDraft {
  return {
    ...base,
    key: nextKey(),
    label: `Part ${n}`,
    description: null,
    tileType: 'standard',
    requiredAmount: null,
    trackedStat: null,
    statType: null,
    statGoal: null,
    statBasis: 'gain',
    trackingMode: 'team',
    trackedItemIds: null,
    itemRequirements: null,
    groupMode: null,
    setsRequired: null,
    countMode: null,
    perKillCap: null,
    coopCredit: null,
    coopMinMembers: null,
    sourceNpcs: null,
    targetNpcs: null,
    timedActivity: null,
    timeThresholdSeconds: null,
    partySize: null,
    minRaidLevel: null,
    partyTeamOnly: null,
    pvpMinLootValue: null,
    capBy: null,
    comboRule: null,
    parts: null,
    comboWeight: null,
    mission: false,
    missionRules: null,
    points: 0,
  } as ComboPartDraft;
}

export function draftsFromParts(parts: ComboPartConfig[] | null | undefined): ComboPartDraft[] {
  return (parts ?? []).map((p) => ({ ...p, key: nextKey() }));
}

/** The kind fields a saved part sends back in the combo's PUT (`parts[i]`). */
const PART_FIELDS = [
  'label', 'description', 'tileType', 'requiredAmount', 'trackedStat', 'statType', 'statGoal', 'statBasis', 'trackingMode',
  'trackedItemIds', 'itemRequirements', 'groupMode', 'setsRequired', 'countMode', 'perKillCap', 'coopCredit', 'coopMinMembers',
  'sourceNpcs', 'targetNpcs', 'timedActivity', 'timeThresholdSeconds', 'partySize', 'minRaidLevel', 'partyTeamOnly',
  'pvpMinLootValue', 'capBy', 'autoTrackDisabled', 'effortConfig',
] as const;

export function partPayload(p: ComboPartDraft, mode: ComboMode): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of PART_FIELDS) if ((p as unknown as Record<string, unknown>)[k] !== undefined) out[k] = (p as unknown as Record<string, unknown>)[k];
  if (p.id != null) out.id = p.id;
  out.comboWeight = mode === 'mix' && p.comboWeight != null && p.comboWeight > 0 && p.comboWeight < 1 ? p.comboWeight : null;
  return out;
}

const RULES: { mode: ComboMode; label: string; blurb: string }[] = [
  { mode: 'any', label: 'Any one', blurb: 'Done when any one part is done.' },
  { mode: 'all', label: 'All of them', blurb: 'Done when every part is done.' },
  { mode: 'nOf', label: 'At least N', blurb: 'Done when N of the parts are done.' },
  { mode: 'mix', label: 'Mix and match', blurb: 'Any combination adding up to 100%: each part adds its share (1 of 2 zenytes + 100 of 200 kills = 100%).' },
];

const KIND_WORD: Record<string, string> = {
  standard: 'manual',
  skill: 'skill XP',
  boss: 'boss KC',
  kill: 'kills',
  drop: 'drop',
  collection: 'item set',
  lap: 'laps',
  pvp: 'PvP kills',
  gain: 'item gain',
  timed: 'timed',
  deathless: 'deathless',
  lms: 'LMS',
  value: 'loot value',
  valuetotal: 'loot value',
  diary: 'diary',
  ca: 'combat task',
};

export default function ComboPartsField({
  rule,
  onRule,
  parts,
  onParts,
  base,
  locked,
  eventStarted,
  isAdmin,
  teamPlay,
  solo,
}: {
  rule: ComboRule;
  onRule: (r: ComboRule) => void;
  parts: ComboPartDraft[];
  onParts: (p: ComboPartDraft[]) => void;
  /** The combo's own config, as a base for a new part (event-wide context only). */
  base: TileConfig;
  /** Parts can't be added or removed (event running, no override). */
  locked: boolean;
  eventStarted?: boolean;
  isAdmin?: boolean;
  teamPlay?: boolean;
  solo?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const n = rule.n ?? 2;

  const update = (key: string, patch: Partial<ComboPartDraft>) => onParts(parts.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const remove = (key: string) => {
    onParts(parts.filter((p) => p.key !== key));
    if (open === key) setOpen(null);
  };
  const add = () => {
    const p = blankPart(base, parts.length + 1);
    onParts([...parts, p]);
    setOpen(p.key);
  };

  return (
    <div className="space-y-3 rounded-lg border border-gold/20 bg-gold/5 p-3">
      <div>
        <label className="block text-xs text-text-muted mb-1">Done when the team does…</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {RULES.map((r) => (
            <button
              key={r.mode}
              type="button"
              disabled={locked}
              title={r.blurb}
              onClick={() => onRule(r.mode === 'nOf' ? { mode: 'nOf', n: Math.min(Math.max(2, n), Math.max(2, parts.length)) } : { mode: r.mode })}
              className={`min-h-[2.25rem] rounded border px-2 py-1 text-xs leading-tight transition-colors disabled:opacity-50 ${
                rule.mode === r.mode ? 'bg-gold/20 border-gold text-gold' : 'border-card-border text-text-muted hover:border-gold/50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {rule.mode === 'nOf' && (
          <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
            At least
            <NumberInput
              value={n}
              onChange={(k) => {
                if (Number.isInteger(k)) onRule({ mode: 'nOf', n: Math.max(1, Math.min(MAX_COMBO_PARTS, k)) });
              }}
              min={1}
              max={Math.max(1, parts.length)}
              disabled={locked}
              className="w-16"
            />
            of {parts.length} parts
          </div>
        )}
        <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
          {parts.length > 0
            ? comboSentence(rule, parts.map((p) => p.label), solo)
            : RULES.find((r) => r.mode === rule.mode)?.blurb}
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-text-muted">
          Parts <span className="text-text-muted/60">({MIN_COMBO_PARTS}–{MAX_COMBO_PARTS}; each is an ordinary tile of any kind, tracked its own way)</span>
        </label>
        {parts.map((p, i) => {
          const kind = configKind(p as Partial<TileConfig>);
          return (
            <div key={p.key} className="rounded border border-card-border bg-card-bg/60">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="text-[10px] text-text-muted w-4 text-right">{i + 1}</span>
                <button
                  type="button"
                  onClick={() => setOpen(open === p.key ? null : p.key)}
                  className="flex-1 min-w-0 text-left text-xs text-foreground hover:text-gold truncate"
                  aria-expanded={open === p.key}
                >
                  {p.label || `Part ${i + 1}`}
                  <span className="ml-1.5 text-[10px] text-text-muted">{KIND_WORD[kind] ?? kind}</span>
                </button>
                {rule.mode === 'mix' && (
                  <span className="flex items-center gap-1 text-[10px] text-text-muted" title="A whole part is worth this share of the combo (blank = 1, all of it)">
                    weight
                    <input
                      type="number"
                      step="0.05"
                      min="0.01"
                      max="1"
                      value={p.comboWeight ?? ''}
                      placeholder="1"
                      disabled={locked}
                      onChange={(e) => {
                        const v = e.target.value === '' ? null : Number(e.target.value);
                        update(p.key, { comboWeight: v != null && Number.isFinite(v) ? v : null });
                      }}
                      className="w-14 px-1 py-0.5 bg-brown-dark border border-card-border rounded text-[11px] text-foreground disabled:opacity-50"
                      aria-label={`Weight of part ${i + 1}`}
                    />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(open === p.key ? null : p.key)}
                  className="text-[11px] text-gold hover:underline"
                >
                  {open === p.key ? 'Close' : 'Edit'}
                </button>
                <button
                  type="button"
                  onClick={() => remove(p.key)}
                  disabled={locked}
                  className="text-[11px] text-red-300 hover:underline disabled:opacity-40"
                  aria-label={`Remove part ${i + 1}`}
                >
                  Remove
                </button>
              </div>
              {open === p.key && (
                <div className="border-t border-card-border/60 p-2">
                  <TileTrackingConfig
                    asPart
                    initial={p as unknown as TileConfig}
                    eventStarted={eventStarted}
                    isAdmin={isAdmin}
                    teamPlay={teamPlay}
                    missionsAllowed={false}
                    onSave={async (payload) => {
                      const saved = { ...p, ...(payload as Partial<ComboPartDraft>), key: p.key, id: p.id } as ComboPartDraft;
                      update(p.key, saved);
                      return saved as unknown as TileConfig;
                    }}
                    onSaved={() => setOpen(null)}
                  />
                </div>
              )}
            </div>
          );
        })}
        {parts.length < MAX_COMBO_PARTS && (
          <button
            type="button"
            onClick={add}
            disabled={locked}
            className="w-full rounded border border-dashed border-card-border py-1.5 text-xs text-text-muted hover:border-gold/50 hover:text-gold disabled:opacity-40"
          >
            + Add a part
          </button>
        )}
        {locked && <p className="text-[10px] text-text-muted">Parts are locked once the event starts — like a tile’s kind and amount.</p>}
      </div>
    </div>
  );
}
