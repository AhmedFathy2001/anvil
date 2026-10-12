// The parts every link card is built from: the brand fonts, the forge backdrop, the mark, a clan's
// crest, and the game sprites the art is made of.
//
// ImageResponse has no stylesheet and no font of its own beyond a fallback sans, so everything that
// makes a card look like Anvil has to be handed to it here. The cards themselves live in lib/ogCard.

import { readFile } from 'node:fs/promises';
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

/** Draw a card at the standard 1200×630 with the brand fonts and the card cache headers. */
export async function renderCard(node: ReactElement, cacheControl = OG_CACHE_CONTROL): Promise<ImageResponse> {
  return new ImageResponse(node, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: await ogFonts(),
    headers: { 'Cache-Control': cacheControl },
  });
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
      {dot ? <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 14, background: dot, boxShadow: `0 0 14px ${dot}` }} /> : null}
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

/** Deterministic sparks: the same card always has the same embers, so a re-render isn't a change. */
function sparks(seed: number, n: number, area: { x: number; y: number; w: number; h: number }) {
  let s = seed;
  const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: n }, (_, i) => {
    const size = 2 + Math.floor(r() * 4);
    const left = area.x + r() * area.w;
    const top = area.y + r() * area.h;
    const color = r() > 0.5 ? C.goldLight : C.ember;
    const opacity = 0.25 + r() * 0.6;
    return (
      <div
        key={i}
        style={{
          display: 'flex',
          position: 'absolute',
          left,
          top,
          width: size,
          height: size,
          borderRadius: size,
          background: color,
          opacity,
          boxShadow: `0 0 ${size * 3}px ${C.ember}`,
        }}
      />
    );
  });
}

/** A string's seed, so each clan or event gets its own scatter of sparks. */
export function seedOf(text: string): number {
  let h = 7;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 233280;
  return h || 7;
}

/**
 * The forge: near-black with an ember glow, a scatter of sparks and a gold rule along the top.
 *
 * `background` is a picture the card's owner chose (an event banner). It goes full-bleed and the
 * glow gives way to a heavy left-to-right shade, so the words stay legible on whatever was uploaded.
 */
export function Frame({
  children,
  glow = '80% 100%',
  seed = 7,
  sparkCount = 16,
  sparkArea = { x: 620, y: 0, w: 580, h: 630 },
  background,
}: {
  children: ReactNode;
  glow?: string;
  seed?: number;
  sparkCount?: number;
  sparkArea?: { x: number; y: number; w: number; h: number };
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
      <div
        style={{
          ...full,
          backgroundImage: background
            ? 'linear-gradient(90deg, rgba(20,16,16,0.96) 0%, rgba(20,16,16,0.86) 45%, rgba(20,16,16,0.55) 100%)'
            : `radial-gradient(circle at ${glow}, rgba(255,122,26,0.30), rgba(224,170,30,0.10) 35%, rgba(20,16,16,0) 65%)`,
        }}
      />
      <div style={{ ...full, backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.35) 100%)' }} />
      {sparks(seed, sparkCount, sparkArea)}
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
 * plugin draws) and the wiki (skill icons, boss pictures). The URLs are always ones lib/tileIcons
 * derived, never a caller's; the allowlist is so a bad derivation can't turn the server into a fetcher.
 */
const SPRITE_HOSTS = new Set(['static.runelite.net', 'oldschool.runescape.wiki']);

const REMOTE_CAP = 400;
const remoteCache = new Map<string, Promise<string | null>>();

/**
 * A game sprite fetched and fitted into a `box`-pixel square, as a PNG data URL. Null on any failure;
 * a card just leaves that cell empty.
 *
 * Item sprites are ~32px pixel art, so a small source is enlarged with nearest-neighbour: smoothing
 * it to 3× turns a crisp Twisted bow into a smear. Big pictures (a boss render) are shrunk normally.
 *
 * Cached per process with a small cap: a board's 25 icons are the same 25 on every paste of it.
 */
export function remoteSprite(url: string | null | undefined, box: number): Promise<string | null> {
  if (!url) return Promise.resolve(null);
  const key = `${box}|${url}`;
  const hit = remoteCache.get(key);
  if (hit) return hit;

  const p = (async () => {
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return null;
    }
    if (target.protocol !== 'https:' || !SPRITE_HOSTS.has(target.hostname)) return null;
    try {
      const res = await fetch(target, {
        signal: AbortSignal.timeout(4_000),
        redirect: 'follow',
        headers: { 'User-Agent': 'AnvilLinkCards/1.0 (+https://anvilosrs.com)' },
      });
      if (!res.ok) return null;
      const { default: sharp } = await import('sharp');
      const src = sharp(Buffer.from(await res.arrayBuffer()));
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

  // A failure is not cached: the wiki having a bad second shouldn't blank a sprite for the process.
  p.then((v) => {
    if (v === null) remoteCache.delete(key);
  });
  if (remoteCache.size >= REMOTE_CAP) {
    const oldest = remoteCache.keys().next().value;
    if (oldest !== undefined) remoteCache.delete(oldest);
  }
  remoteCache.set(key, p);
  return p;
}
