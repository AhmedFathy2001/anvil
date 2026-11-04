// A space's (or clan's) own colours, from its own art. Pure — no database, no image decoder — so the
// colour picking and the contrast rules are unit-tested on plain pixel arrays (tests/art-palette).
// lib/artPaletteImage decodes the logo and banner and hands the pixels here.
//
//   paletteFromPixels  the few colours that best describe an image: frequent AND vivid, never two
//                      near-identical ones, transparent pixels ignored
//   accentTokens       one picked colour as everything a page needs to use it safely on Anvil's dark
//                      ground: the colour itself, a version readable as TEXT, the text colour to put
//                      ON it (buttons), and a soft tint for fills
//
// The accent is only ever a #rrggbb string here: anything else is refused before it reaches CSS.

/** The ground every page draws accents on (globals.css --background); contrast is measured against it. */
export const PAGE_BG = '#141010';
/** Text that sits on an accent-coloured button when the accent is light enough for dark text. */
export const DARK_INK = '#140f1f';
export const LIGHT_INK = '#ffffff';
/** WCAG AA for normal-size text. */
export const MIN_TEXT_CONTRAST = 4.5;
/** How many swatches a palette offers. */
export const PALETTE_SIZE = 6;

export function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
}

/** `#ABC`, `abcdef`, `#AbCdEf` → `#abcdef`; anything else → null. */
export function normalizeHex(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  let s = v.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(s)) s = s.split('').map((c) => c + c).join('');
  return /^[0-9a-f]{6}$/.test(s) ? `#${s}` : null;
}

type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')}`;
}

/** WCAG relative luminance, 0 (black) – 1 (white). */
export function luminance(hex: string): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio, 1 – 21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Mix toward another colour: t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/** The accent, lightened just enough to read as text on the page ground. Unchanged if it already does. */
export function readableOn(hex: string, bg: string = PAGE_BG): string {
  if (contrast(hex, bg) >= MIN_TEXT_CONTRAST) return hex;
  for (let t = 0.05; t <= 1; t += 0.05) {
    const c = mix(hex, '#ffffff', t);
    if (contrast(c, bg) >= MIN_TEXT_CONTRAST) return c;
  }
  return '#ffffff';
}

/** Dark or white ink for text ON the accent (a button), whichever reads better. */
export function inkOn(hex: string): string {
  return contrast(hex, DARK_INK) >= contrast(hex, LIGHT_INK) ? DARK_INK : LIGHT_INK;
}

export interface AccentTokens {
  /** The colour as picked: fills, borders, buttons. */
  accent: string;
  /** Readable as text on the page (equal to accent unless that was too dark). */
  text: string;
  /** Text on an accent fill. */
  ink: string;
  /** A low-alpha fill, `rgba(...)`. */
  soft: string;
  /** The accent sunk most of the way into the page ground: banners and big panels. */
  deep: string;
  /** True when `text` had to be lightened: the settings say so. */
  adjusted: boolean;
}

export function accentTokens(hex: string): AccentTokens {
  const accent = normalizeHex(hex) ?? '#e0aa1e';
  const text = readableOn(accent);
  const [r, g, b] = hexToRgb(accent);
  return {
    accent,
    text,
    ink: inkOn(accent),
    soft: `rgba(${r}, ${g}, ${b}, 0.16)`,
    deep: mix(PAGE_BG, accent, 0.3),
    adjusted: text !== accent,
  };
}

// ── Picking colours out of an image ──────────────────────────────────────────────────────────────

/** HSL saturation and lightness, 0 – 1. */
function satLight([r, g, b]: Rgb): { s: number; l: number } {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

function distance(a: Rgb, b: Rgb): number {
  // "Redmean" — a cheap perceptual distance, far better than plain RGB for telling swatches apart.
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

/** The least share of an image's visible pixels a colour must cover to be offered; less for a vivid one. */
const MIN_SHARE = 0.02;
const MIN_VIVID_SHARE = 0.006;
/** Bins this close are one colour that a 4-bit boundary split. */
const CLUSTER = 40;

/** Swatches closer than this are the same colour to a viewer. */
const SAME_COLOUR = 90;

/**
 * The colours that describe an image, best first.
 *
 * `pixels` is raw interleaved samples with `channels` per pixel (3 = RGB, 4 = RGBA; alpha under half
 * is skipped). Pixels are binned on a 4-bit-per-channel grid; each bin's score is how much of the
 * image it covers, boosted by how vivid it is, so a small bright logo mark beats a large grey
 * background — that is the colour people mean by "my colour". Near-black and near-white only make
 * the list when there is nothing better, because every image has them and no brand is "black".
 */
export function paletteFromPixels(pixels: Uint8Array, channels: 3 | 4, size: number = PALETTE_SIZE): string[] {
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + channels - 1 < pixels.length; i += channels) {
    if (channels === 4 && pixels[i + 3] < 128) continue;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key);
    if (bin) {
      bin.n++;
      bin.r += r;
      bin.g += g;
      bin.b += b;
    } else bins.set(key, { n: 1, r, g, b });
  }
  // 1. Neighbouring bins are one colour split across a 4-bit boundary (a resampled gold lands half
  //    in one bin, half in the next): cluster them first, biggest bins seeding, so its share is whole.
  const clusters: { n: number; r: number; g: number; b: number }[] = [];
  for (const bin of [...bins.values()].sort((a, b) => b.n - a.n)) {
    const rgb: Rgb = [bin.r / bin.n, bin.g / bin.n, bin.b / bin.n];
    const near = clusters.find((c) => distance([c.r / c.n, c.g / c.n, c.b / c.n], rgb) < CLUSTER);
    if (near) {
      near.n += bin.n;
      near.r += bin.r;
      near.g += bin.g;
      near.b += bin.b;
    } else clusters.push({ ...bin });
  }
  // 2. Anti-aliased edges and gradients leave small clusters of in-between colours; a colour must
  //    cover a real share of the image to be offered, or a logo's outline blend becomes "a colour".
  //    A vivid one needs less: a small bright mark is exactly the colour people mean.
  let total = 0;
  for (const c of clusters) total += c.n;
  const scored = clusters
    .map((c) => {
      const rgb: Rgb = [c.r / c.n, c.g / c.n, c.b / c.n];
      const { s, l } = satLight(rgb);
      const dull = l < 0.12 || l > 0.92;
      const share = c.n / Math.max(1, total);
      return { rgb, n: c.n, share, s, dull, score: c.n * (0.25 + s * s * 3) * (dull ? 0.15 : 1) };
    })
    .filter((c) => c.share >= (c.s > 0.55 && !c.dull ? MIN_VIVID_SHARE : MIN_SHARE));
  scored.sort((a, b) => b.score - a.score);

  const picked: { rgb: Rgb; dull: boolean }[] = [];
  for (const c of scored) {
    if (picked.length >= size) break;
    if (picked.some((p) => distance(p.rgb, c.rgb) < SAME_COLOUR)) continue;
    picked.push(c);
  }
  // Vivid first, the dull ones (if any made it) last.
  picked.sort((a, b) => Number(a.dull) - Number(b.dull));
  return picked.map((p) => rgbToHex(p.rgb));
}

/**
 * One palette from the logo and the banner. The logo leads (it is the mark people know), then the
 * banner's colours that the logo did not already cover, deduplicated across the two.
 */
export function mergePalettes(logo: string[], banner: string[], size: number = PALETTE_SIZE): string[] {
  const out: string[] = [];
  const take = (hex: string) => {
    if (out.length >= size) return;
    if (out.some((o) => distance(hexToRgb(o), hexToRgb(hex)) < SAME_COLOUR)) return;
    out.push(hex);
  };
  // Alternate so a vivid banner still gets a say when the logo has many colours.
  const max = Math.max(logo.length, banner.length);
  for (let i = 0; i < max; i++) {
    if (logo[i]) take(logo[i]);
    if (banner[i]) take(banner[i]);
  }
  return out;
}

/** What a stored palette was made from, so a new upload is noticed: the two urls, joined. */
export function paletteSource(logoUrl: string | null | undefined, bannerUrl: string | null | undefined): string {
  return `${logoUrl ?? ''}|${bannerUrl ?? ''}`;
}

export interface StoredPalette {
  from: string;
  colors: string[];
}

/** A stored `art_palette` value, checked: only #rrggbb strings survive. */
export function readStoredPalette(raw: unknown): StoredPalette | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { from?: unknown; colors?: unknown };
  if (typeof r.from !== 'string' || !Array.isArray(r.colors)) return null;
  return { from: r.from, colors: r.colors.filter(isHexColor).slice(0, PALETTE_SIZE) };
}
