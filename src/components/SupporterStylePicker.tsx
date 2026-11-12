'use client';

import { useEffect, useState } from 'react';

import { StopsEditor, SurfaceOverride, SurfacePreview } from '@/components/NameSurfaceLooks';
import SupporterName from '@/components/SupporterName';
import { useUnsavedChanges, UnsavedIndicator } from '@/components/UnsavedChanges';
import {
  DEFAULT_PRESET,
  MIN_STOPS,
  NAME_SURFACES,
  SURFACE_BACKGROUND,
  canCustomise,
  maxCustomStops,
  presetById,
  presetsFor,
  supporterInk,
  weakestContrast,
  type Hex,
  type NameSurface,
  type SupporterLookStyle,
  type SupporterStyle,
} from '@/lib/supporterStyle';
import type { SupporterTierId } from '@/lib/supporterTiers';
import { isDefaultSupporterStyle, normalSupporterStyle as normal } from '@/lib/characterNameLooks';

/** One look being edited: a preset, or the person's own stops. */
interface LookDraft {
  mode: 'preset' | 'custom';
  preset: string;
  stops: Hex[];
}

/** "Use the default" for one character: what to store, and what the character then wears. */
export interface PickerReset {
  label: string;
  /** Sent as the style; null clears the character's own look. */
  send: SupporterStyle | null;
  /** The look the character wears afterwards, which the editor starts from again. */
  wears: SupporterStyle | null;
  disabled: boolean;
}

/**
 * "Your name's look": a Champion picks a preset gradient, a Patron a preset or their own 2–4 colours.
 * Optionally a separate look per background (dark / light), worn as-is there. The preview is their
 * own name as everyone will see it; saving goes through the server, which re-checks the choice
 * against the tier in force and answers with what is actually worn.
 *
 * The same editor serves the Anvil name (no accountId), all characters at once (applyAll) and one
 * character (accountId), each opened by SupporterNameLooks.
 */
export default function SupporterStylePicker({
  tier,
  name,
  initial,
  accountId,
  applyAll = false,
  title = 'Your name’s look',
  where = 'On the site, in the plugin panel and on your Discord star',
  framed = true,
  saveLabel,
  savedText,
  reset,
  defaultBlocked,
  pageOnly = false,
  onSaved,
  trying = false,
  onDraft,
}: {
  /**
   * `tier` is one they are TRYING, above the one they hold (Settings → Profile & look): the choice is
   * saved as that tier's look (`as`), default preset included by name, and worn once they hold it.
   */
  trying?: boolean;
  /** The look as edited, on every change (the page's live preview). */
  onDraft?: (style: SupporterStyle) => void;
  tier: SupporterTierId;
  name: string;
  initial: SupporterStyle | null;
  /** Save this character's override; omitted preserves the legacy account-wide picker. */
  accountId?: number;
  /** Apply this choice to every linked character. */
  applyAll?: boolean;
  /** Heading and the "where it shows" line; only drawn when `framed`. */
  title?: string;
  where?: string;
  /** Its own bordered box with a heading. Off inside a panel that already has both. */
  framed?: boolean;
  saveLabel?: string;
  savedText?: string;
  /** Replaces "Reset to default" (save the tier default); null hides the button. */
  reset?: PickerReset | null;
  /** Characters can't store the default look apart from the Anvil name: say why Save is off. */
  defaultBlocked?: string;
  /** The editor stays on the page while a panel opens over it: guard leaving the page only. */
  pageOnly?: boolean;
  onSaved?: (style: SupporterStyle | null) => void;
}) {
  const presets = presetsFor(tier);
  const custom = canCustomise(tier);
  const customMax = maxCustomStops(tier);
  const fallback = DEFAULT_PRESET[tier] ?? presets[0]?.id ?? '';
  const startLook = (look: SupporterLookStyle | null | undefined): LookDraft => ({
    mode: look?.stops && custom ? 'custom' : 'preset',
    preset: look?.preset ?? fallback,
    stops: [...(look?.stops ?? presetById(look?.preset ?? fallback)?.stops ?? ['#ffd27a', '#ff7ab8'])].slice(0, Math.max(customMax, 1)),
  });

  const [saved, setSaved] = useState<SupporterStyle | null>(initial);
  const [main, setMain] = useState<LookDraft>(() => startLook(initial));
  const [over, setOver] = useState<Record<NameSurface, LookDraft | null>>(() => ({
    dark: initial?.dark ? startLook(initial.dark) : null,
    light: initial?.light ? startLook(initial.light) : null,
  }));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const lookOf = (d: LookDraft, keepDefault: boolean): SupporterLookStyle =>
    d.mode === 'custom' ? { stops: d.stops } : !keepDefault && d.preset === fallback ? {} : { preset: d.preset };
  // Trying a tier: its default preset is a choice like any other, so it is kept by name.
  const draft: SupporterStyle = { ...lookOf(main, trying) };
  for (const surface of NAME_SURFACES) {
    const d = over[surface];
    if (d) draft[surface] = lookOf(d, true);
  }
  const same = JSON.stringify(normal(draft)) === JSON.stringify(normal(saved));
  useUnsavedChanges(!same, { pageOnly });
  const blocked = !!defaultBlocked && !same && isDefaultSupporterStyle(draft);
  const draftKey = JSON.stringify(draft);
  useEffect(() => {
    onDraft?.(JSON.parse(draftKey) as SupporterStyle);
  }, [draftKey, onDraft]);

  if (tier === 'supporter') {
    return (
      <p className="mt-3 text-[13px] text-text-muted">
        Supporter names are gold. Champions pick a gradient, and Patrons mix their own.
      </p>
    );
  }

  const draftInk = supporterInk(tier, draft);
  const contrastOn = (surface: NameSurface) => {
    const own = draftInk[surface];
    return own ? weakestContrast(own, SURFACE_BACKGROUND[surface]) : null;
  };

  async function save(next: SupporterStyle, wears?: SupporterStyle | null) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch('/api/profile/supporter-style', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          accountId == null
            ? { ...next, ...(trying ? { as: tier } : {}) }
            : { accountId, style: next, allCharacters: applyAll, ...(trying ? { as: tier } : {}) },
        ),
      });
      const json = (await res.json().catch(() => ({}))) as { style?: SupporterStyle | null; error?: string };
      if (!res.ok) {
        setNote({ ok: false, text: json.error ?? 'Could not save that.' });
        return;
      }
      setSaved(wears !== undefined ? wears : (json.style ?? null));
      setNote({
        ok: true,
        text: trying
          ? 'Saved. Only you see it for now.'
          : (savedText ?? (applyAll ? 'Saved for every character.' : 'Saved. Your name looks like this everywhere now.')),
      });
      onSaved?.(json.style ?? null);
    } catch {
      setNote({ ok: false, text: 'Could not reach Anvil. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  function restart(look: SupporterStyle | null) {
    setMain(startLook(look));
    setOver({ dark: look?.dark ? startLook(look.dark) : null, light: look?.light ? startLook(look.light) : null });
  }

  function resetToDefault() {
    if (reset) {
      restart(reset.wears);
      void save(reset.send ?? {}, reset.wears);
      return;
    }
    restart(null);
    void save({});
  }

  return (
    <div className={framed ? 'mt-4 rounded-lg border border-card-border bg-background/40 p-3' : ''}>
      {framed && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">{title}</p>
          <span className="text-[12px] text-text-dim">{where}</span>
        </div>
      )}

      <div className={`${framed ? 'mt-3 ' : ''}space-y-2`}>
        <SurfacePreview surface="dark" contrast={contrastOn('dark')}>
          <SupporterName name={name} tier={tier} style={draft} className="text-base font-semibold" plain />
        </SurfacePreview>
        <SurfacePreview surface="light" contrast={contrastOn('light')}>
          <SupporterName name={name} tier={tier} style={draft} surface="opaque-chat" className="text-base font-semibold" plain />
        </SurfacePreview>
      </div>

      <LookFields tier={tier} fallback={fallback} value={main} onChange={setMain} label="Preset gradients" />

      {NAME_SURFACES.map((surface) => (
        <SurfaceOverride
          key={surface}
          surface={surface}
          open={over[surface] != null}
          onToggle={(open) => setOver((cur) => ({ ...cur, [surface]: open ? { ...main, stops: [...main.stops] } : null }))}
        >
          {over[surface] && (
            <LookFields
              tier={tier}
              fallback={fallback}
              value={over[surface]}
              onChange={(next) => setOver((cur) => ({ ...cur, [surface]: next }))}
              label={`Presets for ${surface} backgrounds`}
              compact
            />
          )}
        </SurfaceOverride>
      ))}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || same || blocked}
          onClick={() => void save(draft)}
          className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
        >
          {busy ? 'Saving…' : (saveLabel ?? (applyAll ? 'Save for all characters' : 'Save'))}
        </button>
        <UnsavedIndicator dirty={!same} />
        {reset !== null && (
          <button
            type="button"
            disabled={busy || (reset ? reset.disabled : saved == null)}
            onClick={resetToDefault}
            className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-gold/40 disabled:opacity-50"
          >
            {reset ? reset.label : 'Reset to default'}
          </button>
        )}
        {note && (
          <span role="status" className={`text-[12.5px] ${note.ok ? 'text-accent-green-light' : 'text-red-400'}`}>
            {note.text}
          </span>
        )}
      </div>
      {blocked && <p className="mt-2 text-[12px] text-text-dim">{defaultBlocked}</p>}
    </div>
  );
}

/** The preset choices and (Champion+) the person's own colours, for one look. */
function LookFields({
  tier,
  fallback,
  value,
  onChange,
  label,
  compact = false,
}: {
  tier: SupporterTierId;
  fallback: string;
  value: LookDraft;
  onChange: (next: LookDraft) => void;
  label: string;
  /** A surface override: no long help line under the colours. */
  compact?: boolean;
}) {
  const presets = presetsFor(tier);
  const custom = canCustomise(tier);
  const customMax = maxCustomStops(tier);
  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {presets.map((p) => {
          const on = value.mode === 'preset' && value.preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange({ ...value, mode: 'preset', preset: p.id })}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px] transition-colors ${
                on ? 'border-gold/70 bg-gold/10 text-foreground' : 'border-card-border text-text-muted hover:border-gold/40'
              }`}
            >
              <span aria-hidden className="h-3 w-8 rounded-full" style={{ backgroundImage: `linear-gradient(90deg, ${p.stops.join(', ')})` }} />
              {p.name}
              {p.id === fallback && !compact && <span className="text-text-dim">(default)</span>}
            </button>
          );
        })}
        {custom && (
          <button
            type="button"
            role="radio"
            aria-checked={value.mode === 'custom'}
            onClick={() => onChange({ ...value, mode: 'custom', stops: value.stops.slice(0, customMax) })}
            className={`rounded-lg border px-2.5 py-1.5 text-[12.5px] transition-colors ${
              value.mode === 'custom' ? 'border-gold/70 bg-gold/10 text-foreground' : 'border-card-border text-text-muted hover:border-gold/40'
            }`}
          >
            Your own
          </button>
        )}
      </div>

      {custom && value.mode === 'custom' && (
        <div className="mt-3">
          <StopsEditor stops={value.stops} max={customMax} onChange={(stops) => onChange({ ...value, stops })} />
          {!compact && (
            <p className="mt-2 text-[12px] text-text-dim">
              {tier === 'champion'
                ? 'One static colour. Champions may use at most two distinct custom colours across all characters.'
                : `${MIN_STOPS} colour is static; 2 to ${customMax} animate left to right. Dark source colours are converted for each background unless you set a separate look for it.`}
            </p>
          )}
        </div>
      )}
    </>
  );
}
