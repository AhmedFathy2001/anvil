// Anvil Supporter name colours, per person: the pure half (no database), so the profile picker, the
// plugin panel, Discord and the tests all agree on what a name looks like.
//
// A Champion picks a preset or one static colour; a Patron a preset or their own 1–4 colours.
// Supporter stays solid gold. What is stored is only a WISH (users.supporter_style); every read
// checks it against the tier in force right now, so a lapsed Patron's custom colours fall back to the
// default on their own, with nothing to clean up.

// Type-only import: supporterTiers re-exports SUPPORTER_INK from here, so no runtime cycle.
import type { SupporterTierId, TenureStepId } from './supporterTiers.ts';

export type Hex = `#${string}`;

/** One look: a preset, or 1 stop (static) / 2–4 stops (a gradient, which wins over a preset). */
export interface SupporterLookStyle {
  preset?: string;
  stops?: Hex[];
}

/** The two kinds of background a name is drawn on. The site, the plugin panel and Discord are dark. */
export type NameSurface = 'dark' | 'light';
export const NAME_SURFACES: readonly NameSurface[] = ['dark', 'light'];

/**
 * What a character wears: the main look, plus an optional look per surface. An override is worn
 * AS-IS on its surface; without one, the main look is adapted for contrast there.
 */
export interface SupporterStyle extends SupporterLookStyle {
  dark?: SupporterLookStyle;
  light?: SupporterLookStyle;
}

/** Everything a page needs to draw one person's flair: their tier and their (gated) colours. */
export interface SupporterLook {
  tier: SupporterTierId;
  style: SupporterStyle | null;
  /** Unbroken paid time and the tenure step it makes (the star's shape). */
  tenure?: { id: TenureStepId; months: number };
}

/** A surface's own look, raw: worn as-is on that surface (animation follows the main look). */
export interface SurfaceInk {
  color: Hex;
  grad?: Hex[];
}

/** How a name is drawn: a solid colour every renderer understands, and the gradient a newer one draws. */
export interface SupporterInk {
  color: Hex;
  grad?: Hex[];
  move?: boolean;
  /** The person's own look for dark / light backgrounds, when they set one. See inkForSurface. */
  dark?: SurfaceInk;
  light?: SurfaceInk;
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

export const MIN_STOPS = 1;
export const MAX_STOPS = 4;
/** The dark card every name sits on. */
export const FLAIR_BACKGROUND: Hex = '#1c1714';
export const TRANSPARENT_CHAT_BACKGROUND: Hex = '#262626';
export const OPAQUE_CHAT_BACKGROUND: Hex = '#c4b48c';
/** A custom stop must read at least this well against FLAIR_BACKGROUND (WCAG large-text contrast). */
export const MIN_STOP_CONTRAST = 3;
/** The reference background of each surface: the card, and RuneScape's opaque parchment chat. */
export const SURFACE_BACKGROUND: Record<NameSurface, Hex> = { dark: FLAIR_BACKGROUND, light: OPAQUE_CHAT_BACKGROUND };
/** Which way an adapted colour is pushed on each surface. */
const SURFACE_TOWARD: Record<NameSurface, Hex> = { dark: '#ffffff', light: '#000000' };
/** The contrast an adapted name is lifted to (WCAG normal text). */
export const SURFACE_MIN_CONTRAST = 4.5;

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

/** Champion gets one custom solid; Patron gets one solid or a custom gradient. */
export function canCustomise(tier: SupporterTierId | null | undefined): boolean {
  return tier === 'champion' || tier === 'patron';
}

export function maxCustomStops(tier: SupporterTierId | null | undefined): number {
  return tier === 'patron' ? MAX_STOPS : tier === 'champion' ? 1 : 0;
}

/** Distinct custom static colours worn by Champion characters; presets do not consume this allowance. */
export function distinctStaticColours(styles: readonly (SupporterStyle | null | undefined)[]): Set<Hex> {
  const colours = new Set<Hex>();
  for (const style of styles) {
    if (style?.stops?.length === 1) colours.add(style.stops[0]);
  }
  return colours;
}

/** A Champion may wear at most this many distinct custom static colours across their characters. */
export const CHAMPION_STATIC_COLOURS = 2;

/**
 * Every character's look as `tier` wears it, Champion's cross-character limit included, so the limit
 * holds on READ whatever was stored (a look saved while trying Patron, a lapse from Patron, a row
 * written before the limit). `characters` is ALL of the person's characters in a fixed order
 * (primary first, then by id): the first two distinct static colours in that order are worn, a later
 * third falls back to the tier's default. `fallback` is the Anvil name's look, worn where a
 * character has none of its own (null = follows it).
 */
export function wornCharacterStyles(
  tier: SupporterTierId | null | undefined,
  fallback: SupporterStyle | null | undefined,
  characters: readonly (SupporterStyle | null | undefined)[],
): (SupporterStyle | null)[] {
  const allowed = new Set<Hex>();
  return characters.map((raw) => {
    const worn = effectiveSupporterStyle(tier, raw ?? fallback);
    if (tier !== 'champion' || worn?.stops?.length !== 1) return worn;
    const c = worn.stops[0];
    if (allowed.has(c) || allowed.size < CHAMPION_STATIC_COLOURS) {
      allowed.add(c);
      return worn;
    }
    const { stops: _drop, ...rest } = worn;
    void _drop;
    return hasAny(rest) ? rest : null;
  });
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

/** Contrast ratio of two colours (1–21). */
export function contrastRatio(a: Hex, b: Hex): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Contrast ratio of a colour against the card background (1–21). */
export function contrastOnCard(hex: Hex): number {
  return contrastRatio(hex, FLAIR_BACKGROUND);
}

/** The worst-reading stop of an ink on a background: what a "hard to read" hint checks. */
export function weakestContrast(ink: { color: Hex; grad?: Hex[] }, background: Hex): number {
  const stops = ink.grad && ink.grad.length >= 2 ? ink.grad : [ink.color];
  return Math.min(...stops.map((h) => contrastRatio(h, background)));
}

/** Would this stop vanish into the card? */
export function tooDark(hex: Hex): boolean {
  return contrastOnCard(hex) < MIN_STOP_CONTRAST;
}

/** One static colour or a 2–4 stop gradient. Source colours are unrestricted. */
function cleanStops(v: unknown): Hex[] | null {
  if (!Array.isArray(v) || v.length < MIN_STOPS || v.length > MAX_STOPS) return null;
  const out: Hex[] = [];
  for (const s of v) {
    const h = normalizeHex(s);
    if (!h) return null;
    out.push(h);
  }
  return out;
}

/** One look read leniently (bad fields dropped). */
function parseLook(v: unknown): SupporterLookStyle | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const look: SupporterLookStyle = {};
  if (typeof o.preset === 'string' && presetById(o.preset)) look.preset = o.preset;
  const stops = cleanStops(o.stops);
  if (stops) look.stops = stops;
  return look.preset || look.stops ? look : null;
}

/** True when a style says anything at all (main look or a surface override). */
function hasAny(s: SupporterStyle): boolean {
  return !!(s.preset || s.stops || s.dark || s.light);
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
  const style: SupporterStyle = { ...parseLook(o) };
  for (const surface of NAME_SURFACES) {
    const look = parseLook(o[surface]);
    if (look) style[surface] = look;
  }
  return hasAny(style) ? style : null;
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
  const out: SupporterStyle = { ...gateLook(tier, style, false) };
  for (const surface of NAME_SURFACES) {
    const look = style[surface] ? gateLook(tier, style[surface], true) : null;
    if (look) out[surface] = look;
  }
  return hasAny(out) ? out : null;
}

/**
 * One look as a tier may wear it. A surface override keeps the tier's default preset (choosing it
 * for a surface means "this, as-is"); the main look drops it, since it is the default anyway.
 */
function gateLook(tier: SupporterTierId, look: SupporterLookStyle, keepDefault: boolean): SupporterLookStyle | null {
  if (look.stops && canCustomise(tier) && look.stops.length <= maxCustomStops(tier)) {
    const stops = cleanStops(look.stops);
    if (stops) return { stops };
  }
  const preset = presetById(look.preset);
  if (preset && rank(preset.minTier) <= rank(tier) && (keepDefault || preset.id !== DEFAULT_PRESET[tier])) return { preset: preset.id };
  return null;
}

/** A look's stops as drawn: the solid colour every renderer understands, and the gradient if any. */
function inkOfStops(stops: Hex[]): SurfaceInk {
  // The solid colour (Discord, chat lines, old plugins) is the brightest-reading stop of the middle
  // ones: the first stop alone is often the pale end of a gradient.
  const color = stops.length > 2 ? stops[1] : stops[0];
  return stops.length === 1 ? { color } : { color, grad: [...stops] };
}

/** The one answer to "what colour is this name": tier plus their (gated) choice. */
export function supporterInk(tier: SupporterTierId, style?: SupporterStyle | null): SupporterInk {
  const base = SUPPORTER_INK[tier];
  const eff = effectiveSupporterStyle(tier, style);
  const stops = eff?.stops ?? presetById(eff?.preset)?.stops;
  const ink: SupporterInk = !stops
    ? { color: base.color, ...(base.grad ? { grad: [...base.grad] } : {}), ...(base.move ? { move: true } : {}) }
    : { ...inkOfStops(stops), ...(stops.length > 1 && base.move ? { move: true } : {}) };
  for (const surface of NAME_SURFACES) {
    const look = eff?.[surface];
    const own = look?.stops ?? presetById(look?.preset)?.stops;
    if (own) ink[surface] = inkOfStops(own);
  }
  return ink;
}

/** Stored/source colour adjusted only for display on one known background. */
export function readableHexOn(hex: Hex, background: Hex, toward: Hex, minimum = MIN_STOP_CONTRAST): Hex {
  const ratio = (a: Hex, b: Hex) => {
    const x = luminance(a);
    const y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  if (ratio(hex, background) >= minimum) return hex;
  const rgb = (v: Hex) => [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16));
  const source = rgb(hex);
  const target = rgb(toward);
  const mix = (t: number): Hex => (`#${source.map((c, i) => Math.round(c * (1 - t) + target[i] * t).toString(16).padStart(2, '0')).join('')}` as Hex);
  let lo = 0;
  let hi = 1;
  let readable = toward;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const candidate = mix(mid);
    if (ratio(candidate, background) >= minimum) {
      hi = mid;
      readable = candidate;
    } else {
      lo = mid;
    }
  }
  return readable;
}

/** Derive a whole style once for a surface; never mutate the stored source colours. */
export function supporterInkOn<T extends SupporterInk>(ink: T, background: Hex, toward: Hex, minimum = MIN_STOP_CONTRAST): T {
  const main: SupporterInk = { ...ink };
  delete main.dark;
  delete main.light;
  const color = readableHexOn(main.color, background, toward, minimum);
  const grad = main.grad?.map((stop) => readableHexOn(stop, background, toward, minimum));
  return {
    ...main,
    color,
    ...(grad && grad.length >= 2 ? { grad } : {}),
    ...(main.move && grad && grad.length >= 2 ? { move: true } : {}),
  } as T;
}

/**
 * The ink a name wears on one kind of surface. The person's own look for that surface is worn as-is
 * (no contrast adaption); without one the main look is adapted to `background` (null: left raw, for
 * callers whose renderer adapts on its own). Animation follows the main look. The answer carries no
 * `dark` / `light`, so it can go on the wire as it is.
 */
export function inkForSurface<T extends SupporterInk>(
  ink: T,
  surface: NameSurface,
  background: Hex | null = SURFACE_BACKGROUND[surface],
): Omit<T, 'dark' | 'light'> {
  const { dark, light, ...main } = ink;
  const own = surface === 'dark' ? dark : light;
  if (own) {
    const rest: Partial<SupporterInk> = { ...main };
    delete rest.grad;
    delete rest.move;
    const grad = own.grad && own.grad.length >= 2 ? [...own.grad] : null;
    return { ...rest, color: own.color, ...(grad ? { grad } : {}), ...(grad && main.move ? { move: true } : {}) } as Omit<T, 'dark' | 'light'>;
  }
  if (!background) return main;
  return supporterInkOn(main as T, background, SURFACE_TOWARD[surface], SURFACE_MIN_CONTRAST);
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
type LookCheck = { ok: true; look: SupporterLookStyle | null } | { ok: false; error: string };

const SURFACE_LABEL: Record<NameSurface, string> = { dark: 'Dark backgrounds', light: 'Light backgrounds' };

/**
 * A style sent from the picker, checked strictly against the tier in force (the server's answer, not
 * the browser's). `null` / `{}` resets to the default. Each surface override (`dark`, `light`) is a
 * whole look under the same rules; `null` / `{}` clears it. Returns what will be stored.
 */
export function validateSupporterStyle(
  input: unknown,
  tier: SupporterTierId | null | undefined,
  opts: { keepDefault?: boolean } = {},
): StyleCheck {
  if (input == null) return { ok: true, style: null };
  if (typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Send a style object.' };
  const o = input as Record<string, unknown>;
  // Trying a tier you don't have: keep its default preset by name, so the choice (and the tier it
  // needs) survives a reload instead of collapsing to "nothing chosen".
  const main = validateLook(o, tier, !!opts.keepDefault);
  if (!main.ok) return main;
  const style: SupporterStyle = { ...main.look };
  for (const surface of NAME_SURFACES) {
    const v = o[surface];
    if (v == null) continue;
    if (typeof v !== 'object' || Array.isArray(v)) return { ok: false, error: `${SURFACE_LABEL[surface]}: send a style object.` };
    const check = validateLook(v as Record<string, unknown>, tier, true);
    if (!check.ok) return { ok: false, error: `${SURFACE_LABEL[surface]}: ${check.error}` };
    if (check.look) style[surface] = check.look;
  }
  return { ok: true, style: hasAny(style) ? style : null };
}

/** One look checked against the tier. `keepDefault`: a surface override may name the default preset. */
function validateLook(o: Record<string, unknown>, tier: SupporterTierId | null | undefined, keepDefault: boolean): LookCheck {
  const hasPreset = o.preset != null && o.preset !== '';
  const hasStops = o.stops != null;
  if (!hasPreset && !hasStops) return { ok: true, look: null };
  if (!tier) return { ok: false, error: 'Name colours come with Anvil Supporter.' };
  if (tier === 'supporter') return { ok: false, error: 'Supporter names are gold. Gradients start at Champion.' };

  if (hasStops) {
    if (!canCustomise(tier)) return { ok: false, error: 'Custom name colours start at Champion.' };
    const max = maxCustomStops(tier);
    if (!Array.isArray(o.stops) || o.stops.length < MIN_STOPS || o.stops.length > max) {
      return { ok: false, error: tier === 'champion' ? 'Champions may pick one static colour.' : `Pick ${MIN_STOPS} to ${max} colours.` };
    }
    const stops: Hex[] = [];
    for (const s of o.stops) {
      const h = normalizeHex(s);
      if (!h) return { ok: false, error: 'Colours must look like #ff9a5a.' };
      stops.push(h);
    }
    return { ok: true, look: { stops } };
  }

  const preset = typeof o.preset === 'string' ? presetById(o.preset) : null;
  if (!preset) return { ok: false, error: 'Unknown preset.' };
  if (rank(preset.minTier) > rank(tier)) return { ok: false, error: `${preset.name} is a ${TIER_NAME[preset.minTier]} preset.` };
  return { ok: true, look: !keepDefault && preset.id === DEFAULT_PRESET[tier] ? null : { preset: preset.id } };
}

// ── Try before you subscribe ────────────────────────────────────────────────────────────────────
//
// Anyone may pick and save any look, at any tier, to see it on Settings → Profile & look. What is
// WORN anywhere else is still effectiveSupporterStyle(tier in force, stored): a free person wears no
// flair at all, and a lower tier falls back to its own default. These two say which tier a choice
// needs, so the page can name it.

/** The lowest tier that wears this look exactly as chosen. Nothing chosen is plain Supporter gold. */
export function tierForStyle(style: SupporterStyle | null | undefined): SupporterTierId {
  let need = 1;
  const look = (l: SupporterLookStyle | undefined) => {
    if (!l) return;
    if (l.stops?.length) need = Math.max(need, l.stops.length > 1 ? RANK.patron : RANK.champion);
    else {
      const p = presetById(l.preset);
      if (p) need = Math.max(need, rank(p.minTier));
    }
  };
  look(style ?? undefined);
  look(style?.dark);
  look(style?.light);
  return need >= RANK.patron ? 'patron' : need >= RANK.champion ? 'champion' : 'supporter';
}

/** The tier a look is checked (and previewed) against: the one asked to try, never below the one held. */
export function tryTier(held: SupporterTierId | null | undefined, asked: SupporterTierId | null | undefined): SupporterTierId | null {
  const a = asked && RANK[asked] ? asked : null;
  if (!held) return a;
  if (!a) return held;
  return RANK[a] > RANK[held] ? a : held;
}

/** Does holding `held` cover something that needs `need`? */
export function tierCovers(held: SupporterTierId | null | undefined, need: SupporterTierId): boolean {
  return !!held && (RANK[held] ?? 0) >= RANK[need];
}
