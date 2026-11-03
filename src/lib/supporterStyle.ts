// Anvil Supporter name colours, per person: the pure half (no database), so the profile picker, the
// plugin panel, Discord and the tests all agree on what a name looks like.
//
// A Champion picks one of the curated preset gradients; a Patron a preset or their own 2–4 stops.
// Supporter stays solid gold. What is stored is only a WISH (users.supporter_style); every read
// checks it against the tier in force right now, so a lapsed Patron's custom colours fall back to the
// default on their own, with nothing to clean up.

// Type-only import: supporterTiers re-exports SUPPORTER_INK from here, so no runtime cycle.
import type { SupporterTierId } from './supporterTiers.ts';

export type Hex = `#${string}`;

/** What a person asked for. Both optional; stops win over a preset when the tier allows them. */
export interface SupporterStyle {
  preset?: string;
  stops?: Hex[];
}

/** Everything a page needs to draw one person's flair: their tier and their (gated) colours. */
export interface SupporterLook {
  tier: SupporterTierId;
  style: SupporterStyle | null;
}

/** How a name is drawn: a solid colour every renderer understands, and the gradient a newer one draws. */
export interface SupporterInk {
  color: Hex;
  grad?: Hex[];
  move?: boolean;
}

/**
 * Each tier's DEFAULT name colours where CSS can't reach (the plugin panel, Discord, chat): a solid
 * colour every renderer understands, and the gradient stops a newer one draws across the name.
 * Matches `.supporter-name-*` in globals.css. A person's own choice goes through supporterInk.
 */
export const SUPPORTER_INK: Record<SupporterTierId, SupporterInk> = {
  supporter: { color: '#ffd35c' },
  champion: { color: '#e05ad0', grad: ['#ff9a5a', '#e05ad0', '#7a8cff'] },
  patron: { color: '#ff7ab8', grad: ['#ffd27a', '#ff7ab8', '#7ae0ff'], move: true },
};

const RANK: Record<SupporterTierId, number> = { supporter: 1, champion: 2, patron: 3 };
const TIER_NAME: Record<SupporterTierId, string> = { supporter: 'Supporter', champion: 'Champion', patron: 'Patron' };

export interface SupporterPreset {
  id: string;
  name: string;
  stops: Hex[];
  /** The lowest tier that may wear it. */
  minTier: SupporterTierId;
}

/**
 * The curated gradients. Every stop reads at 5.5:1 or better on the card background (#1c1714); the
 * tests hold them to it. `classic` is Champion's default and `prism` Patron's, so a Patron's own
 * default stays theirs alone.
 */
export const SUPPORTER_PRESETS: SupporterPreset[] = [
  { id: 'classic', name: 'Classic', stops: ['#ff9a5a', '#e05ad0', '#7a8cff'], minTier: 'champion' },
  { id: 'ember', name: 'Ember', stops: ['#ffd27a', '#ff8a3d', '#ff5a4d'], minTier: 'champion' },
  { id: 'ocean', name: 'Ocean', stops: ['#7ae0ff', '#4da3ff', '#9a8cff'], minTier: 'champion' },
  { id: 'aurora', name: 'Aurora', stops: ['#7affc1', '#5ad1e0', '#b48aff'], minTier: 'champion' },
  { id: 'rose-gold', name: 'Rose gold', stops: ['#ffd6a5', '#f7a8b8', '#d98aa8'], minTier: 'champion' },
  { id: 'toxic', name: 'Toxic', stops: ['#e4ff6a', '#7aff7a', '#3de0a0'], minTier: 'champion' },
  { id: 'prism', name: 'Prism', stops: ['#ffd27a', '#ff7ab8', '#7ae0ff'], minTier: 'patron' },
];

/** The tier's own preset, worn when nothing (valid) is chosen. Supporter has none: it is solid gold. */
export const DEFAULT_PRESET: Partial<Record<SupporterTierId, string>> = { champion: 'classic', patron: 'prism' };

export const MIN_STOPS = 2;
export const MAX_STOPS = 4;
/** The dark card every name sits on. */
export const FLAIR_BACKGROUND: Hex = '#1c1714';
/** A custom stop must read at least this well against FLAIR_BACKGROUND (WCAG large-text contrast). */
export const MIN_STOP_CONTRAST = 3;

const HEX = /^#[0-9a-f]{6}$/;

export function presetById(id: string | null | undefined): SupporterPreset | null {
  return SUPPORTER_PRESETS.find((p) => p.id === id) ?? null;
}

function rank(tier: SupporterTierId): number {
  return RANK[tier] ?? 0;
}

/** The presets a tier may wear (none for Supporter). */
export function presetsFor(tier: SupporterTierId | null | undefined): SupporterPreset[] {
  if (!tier || tier === 'supporter') return [];
  return SUPPORTER_PRESETS.filter((p) => rank(p.minTier) <= rank(tier));
}

/** Can this tier set its own stops? Patron only. */
export function canCustomise(tier: SupporterTierId | null | undefined): boolean {
  return tier === 'patron';
}

/** '#RRGGBB' / 'rrggbb' → '#rrggbb', anything else null. */
export function normalizeHex(v: unknown): Hex | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  const withHash = s.startsWith('#') ? s : `#${s}`;
  return HEX.test(withHash) ? (withHash as Hex) : null;
}

/** WCAG relative luminance of a '#rrggbb'. */
export function luminance(hex: Hex): number {
  const ch = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Contrast ratio of a colour against the card background (1–21). */
export function contrastOnCard(hex: Hex): number {
  const a = luminance(hex);
  const b = luminance(FLAIR_BACKGROUND);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Would this stop vanish into the card? */
export function tooDark(hex: Hex): boolean {
  return contrastOnCard(hex) < MIN_STOP_CONTRAST;
}

/** A stop list that may be worn: 2–4 valid colours, none too dark to read. */
function cleanStops(v: unknown): Hex[] | null {
  if (!Array.isArray(v) || v.length < MIN_STOPS || v.length > MAX_STOPS) return null;
  const out: Hex[] = [];
  for (const s of v) {
    const h = normalizeHex(s);
    if (!h || tooDark(h)) return null;
    out.push(h);
  }
  return out;
}

/**
 * The stored column, read leniently: malformed JSON or a bad field is dropped, never thrown, so a
 * name always renders. Tier gating happens later (effectiveSupporterStyle).
 */
export function parseSupporterStyle(raw: string | null | undefined): SupporterStyle | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const style: SupporterStyle = {};
  if (typeof o.preset === 'string' && presetById(o.preset)) style.preset = o.preset;
  const stops = cleanStops(o.stops);
  if (stops) style.stops = stops;
  return style.preset || style.stops ? style : null;
}

/**
 * What a tier actually wears of what was asked: custom stops for a Patron, else a preset the tier may
 * wear, else nothing (the tier's default). A lapsed or lower tier falls back on its own.
 */
export function effectiveSupporterStyle(
  tier: SupporterTierId | null | undefined,
  style: SupporterStyle | null | undefined,
): SupporterStyle | null {
  if (!tier || !style || tier === 'supporter') return null;
  if (style.stops && canCustomise(tier)) {
    const stops = cleanStops(style.stops);
    if (stops) return { stops };
  }
  const preset = presetById(style.preset);
  if (preset && rank(preset.minTier) <= rank(tier) && preset.id !== DEFAULT_PRESET[tier]) return { preset: preset.id };
  return null;
}

/** The one answer to "what colour is this name": tier plus their (gated) choice. */
export function supporterInk(tier: SupporterTierId, style?: SupporterStyle | null): SupporterInk {
  const base = SUPPORTER_INK[tier];
  const eff = effectiveSupporterStyle(tier, style);
  const stops = eff?.stops ?? presetById(eff?.preset)?.stops;
  if (!stops) return { ...base, ...(base.grad ? { grad: [...base.grad] } : {}) };
  // The solid colour (Discord, chat lines, old plugins) is the brightest-reading stop of the middle
  // ones: the first stop alone is often the pale end of a gradient.
  const color = stops.length > 2 ? stops[1] : stops[0];
  return { color, grad: [...stops], ...(base.move ? { move: true } : {}) };
}

/**
 * The CSS background-image for a name's gradient, or null for a solid colour. A moving one repeats
 * its first stop at the end so the 200%-wide loop in globals.css joins up seamlessly.
 */
export function supporterGradientCss(ink: SupporterInk): string | null {
  if (!ink.grad || ink.grad.length < 2) return null;
  const stops = ink.move ? [...ink.grad, ink.grad[0]] : ink.grad;
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

export type StyleCheck = { ok: true; style: SupporterStyle | null } | { ok: false; error: string };

/**
 * A style sent from the picker, checked strictly against the tier in force (the server's answer, not
 * the browser's). `null` / `{}` resets to the default. Returns what will be stored.
 */
export function validateSupporterStyle(input: unknown, tier: SupporterTierId | null | undefined): StyleCheck {
  if (input == null) return { ok: true, style: null };
  if (typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Send a style object.' };
  const o = input as Record<string, unknown>;
  if (!tier) return { ok: false, error: 'Name colours come with Anvil Supporter.' };
  const hasPreset = o.preset != null && o.preset !== '';
  const hasStops = o.stops != null;
  if (!hasPreset && !hasStops) return { ok: true, style: null };
  if (tier === 'supporter') return { ok: false, error: 'Supporter names are gold. Gradients start at Champion.' };

  if (hasStops) {
    if (!canCustomise(tier)) return { ok: false, error: 'Your own colours are a Patron perk.' };
    if (!Array.isArray(o.stops) || o.stops.length < MIN_STOPS || o.stops.length > MAX_STOPS) {
      return { ok: false, error: `Pick ${MIN_STOPS} to ${MAX_STOPS} colours.` };
    }
    const stops: Hex[] = [];
    for (const s of o.stops) {
      const h = normalizeHex(s);
      if (!h) return { ok: false, error: 'Colours must look like #ff9a5a.' };
      if (tooDark(h)) return { ok: false, error: `${h} is too dark to read on Anvil's background.` };
      stops.push(h);
    }
    return { ok: true, style: { stops } };
  }

  const preset = typeof o.preset === 'string' ? presetById(o.preset) : null;
  if (!preset) return { ok: false, error: 'Unknown preset.' };
  if (rank(preset.minTier) > rank(tier)) return { ok: false, error: `${preset.name} is a ${TIER_NAME[preset.minTier]} preset.` };
  return { ok: true, style: preset.id === DEFAULT_PRESET[tier] ? null : { preset: preset.id } };
}
