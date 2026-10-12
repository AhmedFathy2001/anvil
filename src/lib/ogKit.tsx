// The parts every link card is built from: the brand fonts, the forge backdrop, the mark, a clan's
// crest, and the game sprites the art is made of.
//
// ImageResponse has no stylesheet and no font of its own beyond a fallback sans, so everything that
// makes a card look like Anvil has to be handed to it here. The cards themselves live in lib/ogCard.

import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ImageResponse } from 'next/og';
import type { ReactElement, ReactNode } from 'react';


/** The palette, lifted from globals.css. */
export const C = {
  bg: '#141010',
  card: '#1c1714',
  cell: '#221b17',
  border: '#332a22',
  borderHi: '#4a3b2c',
  gold: '#e0aa1e',
  goldLight: '#ffd35c',
  ember: '#ff7a1a',
  text: '#f5efe6',
  muted: '#a89b86',
  live: '#ff4d3d',
  silver: '#cfd6dc',
  bronze: '#d08a52',
};

export const PLACE_COLOR = [C.goldLight, C.silver, C.bronze];

/**
 * Cache headers for a card.
 *
 * Long, because Discord and every other unfurler caches aggressively anyway and a stale member count
 * on a social card is not a bug worth a database round trip per paste. `stale-while-revalidate` keeps
 * a renamed clan from serving the old name for a day.
 */
export const OG_CACHE_CONTROL = 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

// ── Fonts ──────────────────────────────────────────────────────────────────────────────────────
//
// Read from public/og/fonts, which the image ships (the Dockerfile copies public/ next to the
// standalone server, and the server runs from that directory). Read once per process. A missing file
// degrades to the fallback face rather than failing the card: a card in the wrong font is still a
// card, and a 500 is a grey URL in Discord.

type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 500 | 600 | 700; style: 'normal' };

const FONT_FILES: { file: string; name: string; weight: OgFont['weight'] }[] = [
  { file: 'Fraunces-600.woff', name: 'Fraunces', weight: 600 },
  { file: 'Fraunces-700.woff', name: 'Fraunces', weight: 700 },
  { file: 'Geist-400.woff', name: 'Geist', weight: 400 },
  { file: 'Geist-500.woff', name: 'Geist', weight: 500 },
  { file: 'Geist-700.woff', name: 'Geist', weight: 700 },
  { file: 'GeistMono-500.woff', name: 'GeistMono', weight: 500 },
];

let fontsPromise: Promise<OgFont[]> | null = null;

function ogFonts(): Promise<OgFont[]> {
  if (!fontsPromise) {
    fontsPromise = Promise.all(
      FONT_FILES.map(async (f): Promise<OgFont | null> => {
        try {
          const buf = await readFile(path.join(process.cwd(), 'public', 'og', 'fonts', f.file));
          const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
          return { name: f.name, data, weight: f.weight, style: 'normal' };
        } catch {
          return null;
        }
      }),
    ).then((all) => all.filter((f): f is OgFont => f !== null));
  }
  return fontsPromise;
}

export const DISPLAY = 'Fraunces';
export const BODY = 'Geist';
export const MONO = 'GeistMono';

// ── Rendering ──
//
// A render is ~350ms of CPU, so it is the thing to protect:
//
//   cached     the finished card is kept for ten minutes, keyed by a hash of EVERYTHING drawn on
//              it (the data, the pictures). Same data → same bytes, no render; data changes → new
//              key, so a cached card is never stale.
//   shared     two requests for the same card at once share one render.
//   limited    at most two renders run at a time, and if a burst queues more than a couple of
//              dozen behind them, the overflow gets the site card at once rather than waiting —
//              a scrape of every event id can't take the server's CPU with it.
//   JPEG       re-encoded from the renderer's PNG: about a third of the bytes over the wire, which
//              is most of what a first-time unfurl waits for.

const RENDER_TTL = 10 * 60_000;
const RENDER_CAP = 150;
const MAX_RENDERING = 2;
const MAX_QUEUED = 24;

const rendered = new Map<string, { at: number; body: Buffer }>();
const rendering = new Map<string, Promise<Buffer>>();
let active = 0;
const renderQueue: (() => void)[] = [];

/**
 * The plain site card, kept OUTSIDE the evicting cache so it is always there to answer an overflow
 * with once it has been drawn. Until then an overflow gets a fast 503 — never a place in a queue.
 */
let overflowCard: { body: Buffer; etag: string } | null = null;

/** What a request turned away by the limits gets: the site card if drawn, else a quick 503. */
export function overflowResponse(): Response {
  if (overflowCard) return cardResponse(overflowCard.body, overflowCard.etag, 'no-store', true);
  return new Response('Busy', { status: 503, headers: { 'Retry-After': '5', 'Cache-Control': 'no-store', [OVERFLOW_HEADER]: '1' } });
}

/** Marks an answer the limits gave instead of the real card, so no cache keeps it as the card. */
const OVERFLOW_HEADER = 'X-Anvil-Overflow';

function cardResponse(body: Buffer, etag: string, cacheControl: string, overflow = false): Response {
  const headers: Record<string, string> = { 'Content-Type': 'image/jpeg', 'Cache-Control': cacheControl, ETag: `"${etag}"` };
  if (overflow) headers[OVERFLOW_HEADER] = '1';
  return new Response(new Uint8Array(body), { headers });
}

async function draw(build: () => Promise<ReactElement> | ReactElement): Promise<Buffer> {
  if (active >= MAX_RENDERING) await new Promise<void>((resolve) => renderQueue.push(resolve));
  active++;
  try {
    const image = new ImageResponse(await build(), { width: OG_WIDTH, height: OG_HEIGHT, fonts: await ogFonts() });
    const png = Buffer.from(await image.arrayBuffer());
    const { default: sharp } = await import('sharp');
    return await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  } finally {
    active--;
    renderQueue.shift()?.();
  }
}

/**
 * Draw a card at 1200×630 with the brand fonts, through the cache above.
 *
 * `key` must describe everything the card shows — pass the card's kind and its full data. `build`
 * makes the element and runs only on a miss.
 */
export async function renderCard(
  key: unknown,
  build: () => Promise<ReactElement> | ReactElement,
  opts: { cacheControl?: string; isOverflowCard?: boolean } = {},
): Promise<Response> {
  const cacheControl = opts.cacheControl ?? OG_CACHE_CONTROL;
  const hash = createHash('sha256').update(JSON.stringify(key)).digest('hex').slice(0, 32);

  const hit = rendered.get(hash);
  if (hit && Date.now() - hit.at < RENDER_TTL) return cardResponse(hit.body, hash, cacheControl);

  let pending = rendering.get(hash);
  if (!pending) {
    // Over the queue limit: turn it away now rather than queue more CPU behind it.
    if (renderQueue.length >= MAX_QUEUED) return overflowResponse();
    pending = draw(build)
      .then((body) => {
        if (rendered.size >= RENDER_CAP) {
          const oldest = rendered.keys().next().value;
          if (oldest !== undefined) rendered.delete(oldest);
        }
        rendered.set(hash, { at: Date.now(), body });
        if (opts.isOverflowCard) overflowCard = { body, etag: hash };
        return body;
      })
      .finally(() => rendering.delete(hash));
    rendering.set(hash, pending);
  }
  return cardResponse(await pending, hash, cacheControl);
}

// ── The mark ───────────────────────────────────────────────────────────────────────────────────

/**
 * The favicon's anvil, as vector: dark tile, gold rim, gold anvil with its shaded right half. The
 * same drawing as /icon-192.png, so the card and the tab icon are one mark at any size.
 */
const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200">
<rect x="3" y="3" width="94" height="94" rx="18" fill="#d9a93e"/>
<rect x="11" y="11" width="78" height="78" rx="11" fill="#3b2a17"/>
<path d="M20 26 h60 l4 6 v8 h-68 v-8 z" fill="#f7c51a"/>
<path d="M40 40 h20 v22 h-20 z" fill="#f7c51a"/><path d="M50 40 h10 v22 h-10 z" fill="#b58716"/>
<path d="M27 62 h46 l5 6 v8 h-56 v-8 z" fill="#f7c51a"/><path d="M50 62 h23 l5 6 v8 h-28 z" fill="#b58716"/>
</svg>`;

export const MARK_DATA_URL = `data:image/svg+xml;base64,${Buffer.from(MARK_SVG).toString('base64')}`;

export function Mark({ size }: { size: number }) {
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img src={MARK_DATA_URL} width={size} height={size} style={{ width: size, height: size }} />;
}

/** The mark and the wordmark, for a corner of the card that doesn't compete with the subject. */
export function Brand({ size = 40 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Mark size={size} />
      <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 700, fontSize: Math.round(size * 0.75), color: C.gold }}>
        Anvil
      </div>
    </div>
  );
}

// ── Type ───────────────────────────────────────────────────────────────────────────────────────

/** What kind of thing this card is, in small gold capitals, with an optional status dot. */
export function Eyebrow({ children, dot }: { children: ReactNode; dot?: string | null }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 22,
        fontWeight: 500,
        letterSpacing: 4,
        textTransform: 'uppercase',
        color: C.gold,
      }}
    >
      {dot ? <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 14, background: dot,}} /> : null}
      {children}
    </div>
  );
}

/**
 * A title size for the space it has. Steps rather than a continuous scale, because a continuous
 * shrink makes every card a slightly different size and none of them look deliberate.
 */
export function titleSize(text: string, steps: [number, number][], fallback: number): number {
  for (const [maxLen, size] of steps) if (text.length <= maxLen) return size;
  return fallback;
}

export function Title({ children, size, maxLines = 2 }: { children: string; size: number; maxLines?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        fontFamily: DISPLAY,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1.04,
        letterSpacing: -1.5,
        color: C.text,
        maxHeight: Math.ceil(size * 1.04 * maxLines) + 4,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

/** Trim to `max` characters at a word, with an ellipsis. Cards have no `text-overflow`. */
export function clip(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, '')}…`;
}

// ── The backdrop ───────────────────────────────────────────────────────────────────────────────

/** A string's seed, so each clan or event gets its own scatter of sparks. */
export function seedOf(text: string): number {
  let h = 7;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 233280;
  return h || 7;
}

export interface BackdropOpts {
  /** Where the ember glow sits, as "x% y%". */
  glow?: string;
  seed?: number;
  sparkCount?: number;
  sparkArea?: { x: number; y: number; w: number; h: number };
  /** Drawn over an uploaded banner: a left-to-right shade instead of the glow, transparent elsewhere. */
  overBanner?: boolean;
}

/**
 * The forge backdrop as ONE pre-rendered image: the ember glow, the bottom shade and the sparks.
 *
 * Drawn as layers in the card it cost most of the render: every spark's soft glow is a blurred box
 * shadow, and the renderer blurs each one over the whole canvas — a dozen sparks were ~850ms of a
 * ~1.2s card. Rasterised here once (sharp/librsvg does the blur in a few ms) and cached per style, the
 * card just pastes a picture. Deterministic, so the same seed is always the same sparks.
 */
const backdropCache = new Map<string, Promise<string>>();

export function backdrop(opts: BackdropOpts = {}): Promise<string> {
  const { glow = '80% 100%', seed = 7, sparkCount = 16, sparkArea = { x: 620, y: 0, w: 580, h: 630 }, overBanner = false } = opts;
  const key = JSON.stringify([glow, seed, sparkCount, sparkArea, overBanner]);
  let hit = backdropCache.get(key);
  if (hit) return hit;

  let s = seed;
  const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const dots = Array.from({ length: sparkCount }, () => {
    const size = 2 + Math.floor(r() * 4);
    const cx = (sparkArea.x + r() * sparkArea.w).toFixed(1);
    const cy = (sparkArea.y + r() * sparkArea.h).toFixed(1);
    const color = r() > 0.5 ? C.goldLight : C.ember;
    const opacity = (0.25 + r() * 0.6).toFixed(2);
    // The halo first (blurred, ember), the spark itself on top — what the box shadow used to draw.
    return `<g opacity="${opacity}"><circle cx="${cx}" cy="${cy}" r="${size * 1.5}" fill="${C.ember}" filter="url(#halo)"/><circle cx="${cx}" cy="${cy}" r="${size / 2}" fill="${color}"/></g>`;
  }).join('');

  const [gx, gy] = glow.split(' ').map((v) => parseFloat(v) / 100);
  const base = overBanner
    ? `<linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
         <stop offset="0" stop-color="${C.bg}" stop-opacity="0.96"/><stop offset="0.45" stop-color="${C.bg}" stop-opacity="0.86"/><stop offset="1" stop-color="${C.bg}" stop-opacity="0.55"/>
       </linearGradient>`
    : `<radialGradient id="glow" gradientUnits="userSpaceOnUse" cx="${gx * OG_WIDTH}" cy="${gy * OG_HEIGHT}" r="${Math.hypot(OG_WIDTH, OG_HEIGHT) * 0.65}">
         <stop offset="0" stop-color="#ff7a1a" stop-opacity="0.30"/><stop offset="0.54" stop-color="#e0aa1e" stop-opacity="0.10"/><stop offset="1" stop-color="${C.bg}" stop-opacity="0"/>
       </radialGradient>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}">
  <defs>${base}
    <linearGradient id="foot" x1="0" y1="0" x2="0" y2="1"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/></linearGradient>
    <filter id="halo" x="-300%" y="-300%" width="700%" height="700%"><feGaussianBlur stdDeviation="4"/></filter>
  </defs>
  ${overBanner ? '<rect width="100%" height="100%" fill="url(#shade)"/>' : `<rect width="100%" height="100%" fill="${C.bg}"/><rect width="100%" height="100%" fill="url(#glow)"/>`}
  <rect width="100%" height="100%" fill="url(#foot)"/>
  ${dots}
</svg>`;

  hit = (async () => {
    const { default: sharp } = await import('sharp');
    const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 6 }).toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  })();
  if (backdropCache.size > 200) backdropCache.clear();
  backdropCache.set(key, hit);
  return hit;
}

/**
 * The card's frame: the pre-rendered backdrop (lib/ogKit backdrop) and the gold rule along the top.
 *
 * `background` is a picture the card's owner chose (an event banner). It goes full-bleed under the
 * backdrop, which for a banner is a heavy left-to-right shade so the words stay legible on whatever
 * was uploaded.
 */
export function Frame({
  children,
  backdrop: layer,
  background,
}: {
  children: ReactNode;
  /** From `backdrop()`, with `overBanner` matching whether `background` is set. */
  backdrop: string;
  background?: string | null;
}) {
  const full = { display: 'flex', position: 'absolute' as const, left: 0, top: 0, width: OG_WIDTH, height: OG_HEIGHT };
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        background: C.bg,
        fontFamily: BODY,
        color: C.text,
        overflow: 'hidden',
      }}
    >
      {background ? (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img src={background} width={OG_WIDTH} height={OG_HEIGHT} style={{ ...full, objectFit: 'cover' }} />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={layer} width={OG_WIDTH} height={OG_HEIGHT} style={full} />
      {children}
      {/* Last, so no layer of the art can shade it. */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          left: 0,
          top: 0,
          width: OG_WIDTH,
          height: 6,
          backgroundImage: `linear-gradient(90deg, ${C.gold}, ${C.goldLight} 50%, ${C.gold})`,
        }}
      />
    </div>
  );
}

// ── Crests ─────────────────────────────────────────────────────────────────────────────────────

/** The same deterministic monogram as <ClanCrest> and lib/crestImage: initials, a name-derived hue. */
export function crestParts(name: string): { initials: string; hue: number } {
  const clean = (name ?? '').trim() || 'Anvil';
  const initials =
    clean
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'A';
  let hue = 0;
  for (const ch of clean) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  return { initials, hue };
}

/** A clan's face: its uploaded logo (already a data URL) when it has one, else the monogram. */
export function ClanFace({ name, logo, size }: { name: string; logo?: string | null; size: number }) {
  const radius = Math.round(size * 0.22);
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
      <img
        src={logo}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: radius, border: `3px solid ${C.borderHi}`, objectFit: 'cover' }}
      />
    );
  }
  const { initials, hue } = crestParts(name);
  return (
    <div
      style={{
        display: 'flex',
        width: size,
        height: size,
        borderRadius: radius,
        alignItems: 'center',
        justifyContent: 'center',
        background: `hsl(${hue} 34% 44%)`,
        border: `3px solid ${C.borderHi}`,
        color: '#1c1512',
        fontWeight: 700,
        fontSize: Math.round(size * (initials.length > 1 ? 0.4 : 0.52)),
        letterSpacing: -1,
      }}
    >
      {initials}
    </div>
  );
}

// ── Sprites ────────────────────────────────────────────────────────────────────────────────────

const localCache = new Map<string, Promise<string | null>>();

/** One of the bundled sprites in public/og/sprites, as a data URL. */
export function localSprite(name: string): Promise<string | null> {
  let hit = localCache.get(name);
  if (!hit) {
    hit = readFile(path.join(process.cwd(), 'public', 'og', 'sprites', `${name}.png`))
      .then((b) => `data:image/png;base64,${b.toString('base64')}`)
      .catch(() => null);
    localCache.set(name, hit);
  }
  return hit;
}

/**
 * The hosts game art comes from: RuneLite's static cache export (item sprites, the same ones the
 * plugin draws) and the wiki (skill icons, boss pictures). The URLs are ones lib/tileIcons derived,
 * but a tile's legacy `icon` column is passed through as typed, so this allowlist (checked on every
 * redirect hop too) is what keeps a card render from becoming a fetch of anywhere.
 */
const SPRITE_HOSTS = new Set(['static.runelite.net', 'oldschool.runescape.wiki']);

/** An https URL on one of the sprite hosts, or null. */
function allowedSpriteUrl(raw: string, base?: URL): URL | null {
  try {
    const u = base ? new URL(raw, base) : new URL(raw);
    return u.protocol === 'https:' && SPRITE_HOSTS.has(u.hostname) ? u : null;
  } catch {
    return null;
  }
}

/**
 * GET a sprite, following at most two redirects BY HAND so every hop is checked against the
 * allowlist. The wiki does redirect image URLs (renamed files), but a redirect followed
 * automatically could land anywhere — an internal address included — with only the first URL ever
 * checked.
 */
async function fetchAllowed(raw: string): Promise<Response | null> {
  let target = allowedSpriteUrl(raw);
  for (let hop = 0; target && hop <= 2; hop++) {
    const res = await fetch(target, {
      signal: AbortSignal.timeout(4_000),
      redirect: 'manual',
      headers: { 'User-Agent': 'AnvilLinkCards/1.0 (+https://anvilosrs.com)' },
    });
    if (res.status < 300 || res.status >= 400) return res;
    const next = res.headers.get('location');
    target = next ? allowedSpriteUrl(next, target) : null;
  }
  return null;
}

// ── The sprite cache ──
//
// RuneLite and the wiki are other people's servers, and a card render can want a hundred sprites.
// So a source image is fetched ONCE and kept:
//
//   memory  the fitted data URL, per (url, size) — the hot path, no disk or network at all
//   disk    the source bytes, per url, under /data/og-sprites (survives redeploys), so a fresh
//           process or a new deploy doesn't re-download a board's worth of icons
//   misses  a 404 is remembered for a day and any other failure for ten minutes, so a tile whose
//           icon doesn't exist isn't re-requested on every single render
//
// Item sprites essentially never change, so a cached source is good for 30 days; after that it is
// refetched, and if the refetch fails the old copy is still served. At most four fetches are in
// flight at once, and two renders wanting the same url share one fetch.

const DAY = 86_400_000;
const FRESH_FOR = 30 * DAY;
const MISS_NOT_FOUND = DAY;
const MISS_TRANSIENT = 10 * 60_000;
const MAX_IN_FLIGHT = 4;
const MEMORY_CAP = 400;

let cacheDirPromise: Promise<string | null> | null = null;

/**
 * Where source sprites live: OG_SPRITE_CACHE_DIR, else /data/og-sprites (the volume that survives
 * redeploys), else a fresh PRIVATE temp dir for this process, else nowhere (memory only).
 *
 * Never a fixed name under the shared temp dir: anyone else on the machine could create it first
 * and plant files the cards would then draw. mkdtemp makes a new 0700 dir with a random name, so
 * the fallback can't be pre-seeded — at the cost of not surviving a restart, which only the
 * dedicated dirs need to.
 */
function cacheDir(): Promise<string | null> {
  cacheDirPromise ??= (async () => {
    const dedicated = [process.env.OG_SPRITE_CACHE_DIR, path.join('/data', 'og-sprites')].filter((d): d is string => !!d);
    for (const dir of dedicated) {
      try {
        await mkdir(dir, { recursive: true, mode: 0o700 });
        await writeFile(path.join(dir, '.probe'), '');
        return dir;
      } catch {
        // Not writable here; try the next one.
      }
    }
    try {
      return await mkdtemp(path.join(os.tmpdir(), 'anvil-og-sprites-'));
    } catch {
      return null;
    }
  })();
  return cacheDirPromise;
}

const hashOf = (url: string) => createHash('sha256').update(url).digest('hex').slice(0, 32);

interface DiskEntry {
  /** Source bytes, or null for a remembered miss. */
  bytes: Buffer | null;
  /** When this entry stops being trusted (a fresh copy is wanted / the miss may be retried). */
  expires: number;
}

async function readDisk(url: string): Promise<DiskEntry | null> {
  const dir = await cacheDir();
  if (!dir) return null;
  const base = path.join(dir, hashOf(url));
  try {
    const meta = JSON.parse(await readFile(`${base}.json`, 'utf8')) as { expires: number; miss?: boolean; url?: string };
    // The entry must be for this exact url — anything else is not ours to serve.
    if (meta.url !== url || typeof meta.expires !== 'number') return null;
    if (meta.miss) return { bytes: null, expires: meta.expires };
    return { bytes: await readFile(`${base}.bin`), expires: meta.expires };
  } catch {
    return null;
  }
}

/** Written to a temp name and renamed, so a reader never sees half a file. */
async function writeDisk(url: string, entry: DiskEntry): Promise<void> {
  const dir = await cacheDir();
  if (!dir) return;
  const base = path.join(dir, hashOf(url));
  const tmp = `${base}.${process.pid}.${Date.now()}`;
  try {
    if (entry.bytes) {
      await writeFile(`${tmp}.bin`, entry.bytes);
      await rename(`${tmp}.bin`, `${base}.bin`);
    }
    await writeFile(`${tmp}.json`, JSON.stringify({ expires: entry.expires, miss: entry.bytes ? undefined : true, url }));
    await rename(`${tmp}.json`, `${base}.json`);
  } catch {
    // A cache that can't write is just a slower cache.
  }
}

let inFlight = 0;
const waiting: (() => void)[] = [];

async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_IN_FLIGHT) await new Promise<void>((resolve) => waiting.push(resolve));
  inFlight++;
  try {
    return await fn();
  } finally {
    inFlight--;
    waiting.shift()?.();
  }
}

/** Misses remembered in memory too, so a miss costs no disk read on the next render either. */
const memoryMiss = new Map<string, number>();
const sourceInFlight = new Map<string, Promise<Buffer | null>>();

/** The source image's bytes: memory-remembered miss → disk → network (limited), in that order. */
function sourceBytes(url: string): Promise<Buffer | null> {
  const missUntil = memoryMiss.get(url);
  if (missUntil && missUntil > Date.now()) return Promise.resolve(null);

  const pending = sourceInFlight.get(url);
  if (pending) return pending;

  const p = (async () => {
    const now = Date.now();
    const disk = await readDisk(url);
    if (disk && disk.expires > now) {
      if (!disk.bytes) memoryMiss.set(url, disk.expires);
      return disk.bytes;
    }
    const stale = disk?.bytes ?? null;

    let status = 0;
    try {
      const res = await limited(() => fetchAllowed(url));
      status = res?.status ?? 0;
      if (res?.ok) {
        const bytes = Buffer.from(await res.arrayBuffer());
        await writeDisk(url, { bytes, expires: now + FRESH_FOR });
        return bytes;
      }
    } catch {
      // Network trouble: treated as transient below.
    }
    // Couldn't refresh. An old copy beats an empty cell; otherwise remember the miss.
    if (stale) return stale;
    const expires = now + (status === 404 || status === 410 ? MISS_NOT_FOUND : MISS_TRANSIENT);
    if (memoryMiss.size >= MEMORY_CAP) memoryMiss.clear();
    memoryMiss.set(url, expires);
    await writeDisk(url, { bytes: null, expires });
    return null;
  })().finally(() => sourceInFlight.delete(url));

  sourceInFlight.set(url, p);
  return p;
}

const fitted = new Map<string, Promise<string | null>>();

/**
 * A game sprite fitted into a `box`-pixel square, as a PNG data URL. Null on any failure; a card
 * just leaves that cell empty.
 *
 * Item sprites are ~32px pixel art, so a small source is enlarged with nearest-neighbour: smoothing
 * it to 3× turns a crisp Twisted bow into a smear. Big pictures (a boss render) are shrunk normally.
 */
export function remoteSprite(url: string | null | undefined, box: number): Promise<string | null> {
  if (!url) return Promise.resolve(null);
  const key = `${box}|${url}`;
  const hit = fitted.get(key);
  if (hit) {
    // Most recently used goes to the back, so the cap evicts what boards stopped asking for.
    fitted.delete(key);
    fitted.set(key, hit);
    return hit;
  }

  const p = (async () => {
    const bytes = await sourceBytes(url);
    if (!bytes) return null;
    try {
      const { default: sharp } = await import('sharp');
      const src = sharp(bytes);
      const meta = await src.metadata();
      const small = Math.max(meta.width ?? 0, meta.height ?? 0) <= 64;
      const png = await src
        .resize(box, box, { fit: 'contain', kernel: small ? 'nearest' : 'lanczos3', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      return `data:image/png;base64,${png.toString('base64')}`;
    } catch {
      return null;
    }
  })();

  // A null is not kept here: the miss is already remembered (with its own expiry) in sourceBytes.
  p.then((v) => {
    if (v === null) fitted.delete(key);
  });
  if (fitted.size >= MEMORY_CAP) {
    const oldest = fitted.keys().next().value;
    if (oldest !== undefined) fitted.delete(oldest);
  }
  fitted.set(key, p);
  return p;
}

// ── Whole responses ──

const ROUTE_TTL = 2 * 60_000;
const ROUTE_CAP = 300;
const routeCache = new Map<string, { at: number; body: Buffer; headers: [string, string][] }>();
const routeInFlight = new Map<string, Promise<{ body: Buffer; headers: [string, string][] }>>();

/**
 * A miss reads the database before it ever reaches the render limit, so loads get their own: six at
 * once, and anything beyond that (a scrape walking made-up ids or names, each a distinct miss) is
 * turned away with the overflow answer instead of stacking queries.
 */
const MAX_LOADING = 6;
let loading = 0;

/**
 * A card route's whole answer, kept two minutes per path — so a link pasted into five channels, or
 * a scraper walking every id, costs the database once per card rather than once per request. The
 * render cache inside renderCard still covers anything older. Concurrent requests share one load.
 *
 * Only for the anonymous card routes: what they return depends on the path alone, never on who asks.
 */
export async function cachedCard(path: string, load: () => Promise<Response>): Promise<Response> {
  const hit = routeCache.get(path);
  const answer = (v: { body: Buffer; headers: [string, string][] }) =>
    new Response(new Uint8Array(v.body), { headers: v.headers });
  if (hit && Date.now() - hit.at < ROUTE_TTL) return answer(hit);

  // Turned away by the limits? This card's own last good answer beats the generic one: it has the
  // clan's logo and its real numbers, just a few minutes old. Expired entries are kept for exactly
  // this (they only leave the cache by eviction).
  const busy = () => (hit ? answer(hit) : overflowResponse());

  let pending = routeInFlight.get(path);
  if (!pending) {
    if (loading >= MAX_LOADING) return busy();
    loading++;
    pending = (async () => {
      const res = await load();
      const v = { body: Buffer.from(await res.arrayBuffer()), headers: [...res.headers.entries()] as [string, string][] };
      if (res.ok && !res.headers.has(OVERFLOW_HEADER)) {
        if (routeCache.size >= ROUTE_CAP) {
          const oldest = routeCache.keys().next().value;
          if (oldest !== undefined) routeCache.delete(oldest);
        }
        routeCache.set(path, { at: Date.now(), ...v });
      }
      return v;
    })().finally(() => {
      loading--;
      routeInFlight.delete(path);
    });
    routeInFlight.set(path, pending);
  }
  const v = await pending;
  // The render queue turned it away inside the load: same preference.
  if (hit && v.headers.some(([k]) => k.toLowerCase() === OVERFLOW_HEADER.toLowerCase())) return answer(hit);
  return answer(v);
}
