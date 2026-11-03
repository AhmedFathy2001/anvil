'use client';

import { useState } from 'react';

import SupporterName from '@/components/SupporterName';
import {
  DEFAULT_PRESET,
  MAX_STOPS,
  MIN_STOPS,
  canCustomise,
  normalizeHex,
  presetById,
  presetsFor,
  tooDark,
  type Hex,
  type SupporterStyle,
} from '@/lib/supporterStyle';
import type { SupporterTierId } from '@/lib/supporterTiers';

/**
 * "Your name's look": a Champion picks a preset gradient, a Patron a preset or their own 2–4 colours.
 * The preview is their own name as everyone will see it; saving goes through the server, which
 * re-checks the choice against the tier in force and answers with what is actually worn.
 */
export default function SupporterStylePicker({
  tier,
  name,
  initial,
}: {
  tier: SupporterTierId;
  name: string;
  initial: SupporterStyle | null;
}) {
  const presets = presetsFor(tier);
  const custom = canCustomise(tier);
  const fallback = DEFAULT_PRESET[tier] ?? presets[0]?.id ?? '';
  const startStops = (): Hex[] => [...(initial?.stops ?? presetById(initial?.preset ?? fallback)?.stops ?? ['#ffd27a', '#ff7ab8'])];

  const [saved, setSaved] = useState<SupporterStyle | null>(initial);
  const [mode, setMode] = useState<'preset' | 'custom'>(initial?.stops && custom ? 'custom' : 'preset');
  const [preset, setPreset] = useState(initial?.preset ?? fallback);
  const [stops, setStops] = useState<Hex[]>(startStops);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  if (tier === 'supporter') {
    return (
      <p className="mt-3 text-[13px] text-text-muted">
        Supporter names are gold. Champions pick a gradient, and Patrons mix their own.
      </p>
    );
  }

  const dark = stops.filter((s) => tooDark(s));
  const draft: SupporterStyle = mode === 'custom' ? { stops } : preset === fallback ? {} : { preset };
  const same = JSON.stringify(normal(draft)) === JSON.stringify(normal(saved));

  async function save(next: SupporterStyle) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch('/api/profile/supporter-style', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const json = (await res.json().catch(() => ({}))) as { style?: SupporterStyle | null; error?: string };
      if (!res.ok) {
        setNote({ ok: false, text: json.error ?? 'Could not save that.' });
        return;
      }
      setSaved(json.style ?? null);
      setNote({ ok: true, text: 'Saved. Your name looks like this everywhere now.' });
    } catch {
      setNote({ ok: false, text: 'Could not reach Anvil. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setMode('preset');
    setPreset(fallback);
    setStops([...(presetById(fallback)?.stops ?? stops)]);
    void save({});
  }

  return (
    <div className="mt-4 rounded-lg border border-card-border bg-background/40 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">Your name&rsquo;s look</p>
        <span className="text-[12px] text-text-dim">On the site, in the plugin panel and on your Discord star</span>
      </div>

      <div className="mt-3 flex min-h-11 items-center rounded-lg border border-card-border bg-card-bg px-3 py-2">
        <SupporterName name={name} tier={tier} style={draft} className="text-base font-semibold" plain />
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Preset gradients">
        {presets.map((p) => {
          const on = mode === 'preset' && preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setMode('preset');
                setPreset(p.id);
              }}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px] transition-colors ${
                on ? 'border-gold/70 bg-gold/10 text-foreground' : 'border-card-border text-text-muted hover:border-gold/40'
              }`}
            >
              <span aria-hidden className="h-3 w-8 rounded-full" style={{ backgroundImage: `linear-gradient(90deg, ${p.stops.join(', ')})` }} />
              {p.name}
              {p.id === fallback && <span className="text-text-dim">(default)</span>}
            </button>
          );
        })}
        {custom && (
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'custom'}
            onClick={() => setMode('custom')}
            className={`rounded-lg border px-2.5 py-1.5 text-[12.5px] transition-colors ${
              mode === 'custom' ? 'border-gold/70 bg-gold/10 text-foreground' : 'border-card-border text-text-muted hover:border-gold/40'
            }`}
          >
            Your own
          </button>
        )}
      </div>

      {custom && mode === 'custom' && (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            {stops.map((s, i) => (
              <label
                key={i}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 ${tooDark(s) ? 'border-red-500/60' : 'border-card-border'}`}
              >
                <input
                  type="color"
                  value={s}
                  aria-label={`Colour ${i + 1}`}
                  onChange={(e) => {
                    const h = normalizeHex(e.target.value);
                    if (h) setStops((cur) => cur.map((c, j) => (j === i ? h : c)));
                  }}
                  className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <span className="font-mono text-[11.5px] text-text-muted">{s}</span>
                {stops.length > MIN_STOPS && (
                  <button
                    type="button"
                    aria-label={`Remove colour ${i + 1}`}
                    onClick={() => setStops((cur) => cur.filter((_, j) => j !== i))}
                    className="text-text-dim hover:text-foreground"
                  >
                    ×
                  </button>
                )}
              </label>
            ))}
            {stops.length < MAX_STOPS && (
              <button
                type="button"
                onClick={() => setStops((cur) => [...cur, cur[cur.length - 1]])}
                className="rounded-lg border border-dashed border-card-border px-2.5 py-1 text-[12.5px] text-text-muted hover:border-gold/40"
              >
                Add colour
              </button>
            )}
          </div>
          <p className={`mt-2 text-[12px] ${dark.length ? 'text-red-400' : 'text-text-dim'}`}>
            {dark.length
              ? `${dark.join(', ')} ${dark.length === 1 ? 'is' : 'are'} too dark to read on Anvil's background. Pick something lighter.`
              : `${MIN_STOPS} to ${MAX_STOPS} colours, left to right. Very dark ones are refused so your name stays readable.`}
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || same || (mode === 'custom' && dark.length > 0)}
          onClick={() => void save(draft)}
          className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          disabled={busy || saved == null}
          onClick={reset}
          className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-gold/40 disabled:opacity-50"
        >
          Reset to default
        </button>
        {note && (
          <span role="status" className={`text-[12.5px] ${note.ok ? 'text-accent-green-light' : 'text-red-400'}`}>
            {note.text}
          </span>
        )}
      </div>
    </div>
  );
}

/** Compare a draft with what is saved: the default is `{}` and `null` alike. */
function normal(s: SupporterStyle | null | undefined): SupporterStyle {
  if (!s) return {};
  if (s.stops?.length) return { stops: s.stops };
  return s.preset ? { preset: s.preset } : {};
}
