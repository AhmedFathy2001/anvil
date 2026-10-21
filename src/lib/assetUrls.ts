// Our own addresses for the game art we used to hotlink.
//
// PURE — no `@/db`, no Node APIs — so a client component, a server module and a test can all import
// it. Browsers (and Discord, and the link cards) never load an image straight from the OSRS wiki or
// RuneLite's static host any more: they load `/img/wiki/<file>` and `/img/item/<id>`, which the
// read-through cache in lib/assetCache serves from our bucket. One flaky wiki file used to blank an
// icon everywhere at once, and every visitor was a request to someone else's server.
//
// Exactly two upstreams, and no generic `?url=` proxy: the routes can only ever name a wiki
// `/images/` file or a numeric RuneLite item id, which is what the validation below enforces.

export const WIKI_IMAGES_ORIGIN = 'https://oldschool.runescape.wiki/images/';
export const RUNELITE_ITEM_ICON_ORIGIN = 'https://static.runelite.net/cache/item/icon/';

export const WIKI_ASSET_PREFIX = '/img/wiki/';
export const ITEM_ASSET_PREFIX = '/img/item/';

/** Raster formats only. SVG is deliberately absent: served from OUR origin it could carry script. */
export const WIKI_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'] as const;

const MAX_SEGMENT = 200;
const MAX_FILE = 400;
const MAX_ITEM_ID = 999_999;

function decodeSegment(seg: string): string | null {
  try {
    return decodeURIComponent(seg);
  } catch {
    return null;
  }
}

/**
 * A wiki `/images/` path, normalised and checked. Accepts the decoded or percent-encoded form, with
 * spaces or underscores, and drops a `?cachebuster`. Two shapes only — `File.png` and the thumbnail
 * `thumb/File.png/320px-File.png` — each segment free of traversal, separators and control
 * characters, ending in a raster extension. Returns the DECODED path (`Skull_(status)_icon.png`), or
 * null for anything else.
 */
export function normalizeWikiFile(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.split(/[?#]/)[0].replace(/^\/+/, '');
  if (!s || s.length > MAX_FILE * 3) return null;
  const parts: string[] = [];
  for (const enc of s.split('/')) {
    const seg = decodeSegment(enc);
    if (seg == null) return null;
    const clean = seg.replace(/ /g, '_');
    if (!clean || clean === '.' || clean === '..' || clean.length > MAX_SEGMENT) return null;
    if (/[\\/?#%\u0000-\u001f\u007f]/.test(clean)) return null;
    parts.push(clean);
  }
  const shapeOk = parts.length === 1 || (parts.length === 3 && parts[0] === 'thumb');
  if (!shapeOk) return null;
  const last = parts[parts.length - 1];
  const ext = last.includes('.') ? last.split('.').pop()!.toLowerCase() : '';
  if (!(WIKI_IMAGE_EXTENSIONS as readonly string[]).includes(ext)) return null;
  s = parts.join('/');
  return s.length > MAX_FILE ? null : s;
}

/** The decoded wiki path, percent-encoded per segment — how it goes into a URL. `strict` also
 *  encodes `( ) ' ! *`, the form the wiki's API hands out (see upstreamUrl). */
export function encodeWikiFile(file: string, strict = false): string {
  const enc = (seg: string) => {
    const e = encodeURIComponent(seg);
    return strict ? e.replace(/[()'!*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`) : e;
  };
  return file.split('/').map(enc).join('/');
}

/**
 * The wiki's cache-buster — the `?0db8f` its API appends to image URLs (data/bossImages.json carries
 * them). Short lowercase hex only; anything else is dropped rather than forwarded upstream.
 */
export function wikiVersion(raw: string | null | undefined): string | null {
  // Next re-serialises a bare `?0db8f` as `?0db8f=` before a route sees it, so allow the `=`.
  const m = /^([0-9a-f]{1,12})=?$/.exec(raw?.split('#')[0].split('?')[1] ?? '');
  return m ? m[1] : null;
}

/**
 * Our address for a wiki `/images/` file: `wikiImageUrl('Stats_icon.png')` → `/img/wiki/Stats_icon.png`.
 * Relative (same origin) — wrap in `absoluteAssetUrl` (lib/seo) for Discord, the plugin, link cards.
 * An unservable name still gets a URL (it answers with the placeholder) so a caller never breaks.
 */
export function wikiImageUrl(file: string): string {
  const norm = normalizeWikiFile(file);
  const v = wikiVersion(file);
  const path = norm ? encodeWikiFile(norm) : encodeURIComponent(file.split(/[?#]/)[0].replace(/ /g, '_'));
  return `${WIKI_ASSET_PREFIX}${path}${v ? `?${v}` : ''}`;
}

/**
 * A stored wiki URL (`https://oldschool.runescape.wiki/images/…`, e.g. from data/bossImages.json or a
 * scrape) mapped onto our cache. Anything else passes through untouched.
 */
export function proxyWikiUrl(url: string): string;
export function proxyWikiUrl(url: string | null | undefined): string | null;
export function proxyWikiUrl(url: string | null | undefined): string | null {
  if (!url) return url ?? null;
  if (url.startsWith(WIKI_IMAGES_ORIGIN)) return wikiImageUrl(url.slice(WIKI_IMAGES_ORIGIN.length));
  if (url.startsWith(RUNELITE_ITEM_ICON_ORIGIN)) {
    const id = parseItemId(url.slice(RUNELITE_ITEM_ICON_ORIGIN.length).replace(/\.png$/i, ''));
    if (id != null) return itemAssetUrl(id);
  }
  return url;
}

/** A RuneLite item id from a route segment: plain digits (optionally `.png`), 0 < id ≤ 999999. */
export function parseItemId(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = /^(\d{1,6})(?:\.png)?$/i.exec(raw);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isSafeInteger(id) && id > 0 && id <= MAX_ITEM_ID ? id : null;
}

/** Our address for a RuneLite item sprite: `/img/item/4151`. */
export function itemAssetUrl(itemId: number): string {
  return `${ITEM_ASSET_PREFIX}${Math.trunc(itemId)}`;
}

/** Is this one of our cached-asset paths (relative)? */
export function isAssetPath(url: string | null | undefined): url is string {
  return !!url && (url.startsWith(WIKI_ASSET_PREFIX) || url.startsWith(ITEM_ASSET_PREFIX));
}

/** A wiki file (plus the wiki's cache-buster, when the URL came with one) or a RuneLite item id. */
export type AssetRef = { kind: 'wiki'; file: string; v?: string } | { kind: 'item'; id: number };

/** Parse a `/img/wiki/…[?v]` or `/img/item/…` path back into what it names, or null. */
export function parseAssetPath(path: string): AssetRef | null {
  const p = path.split(/[?#]/)[0];
  if (p.startsWith(WIKI_ASSET_PREFIX)) {
    const file = normalizeWikiFile(p.slice(WIKI_ASSET_PREFIX.length));
    const v = wikiVersion(path);
    return file ? (v ? { kind: 'wiki', file, v } : { kind: 'wiki', file }) : null;
  }
  if (p.startsWith(ITEM_ASSET_PREFIX)) {
    const id = parseItemId(p.slice(ITEM_ASSET_PREFIX.length));
    return id != null ? { kind: 'item', id } : null;
  }
  return null;
}

/**
 * Where the bytes really come from — spelled exactly as the URL we used to hotlink, because the
 * wiki's edge cache keys on the literal string (an uncached spelling falls through to an origin that
 * is not always up). A versioned ref came from the wiki's API, which encodes `( ) '` and appends the
 * buster; a bare one is a hand-written name, which never did.
 */
export function upstreamUrl(ref: AssetRef): string {
  if (ref.kind === 'item') return `${RUNELITE_ITEM_ICON_ORIGIN}${ref.id}.png`;
  return ref.v
    ? `${WIKI_IMAGES_ORIGIN}${encodeWikiFile(ref.file, true)}?${ref.v}`
    : `${WIKI_IMAGES_ORIGIN}${encodeWikiFile(ref.file)}`;
}

/** The hosts an upstream fetch (and any redirect it follows) may touch. */
export const UPSTREAM_HOSTS: ReadonlySet<string> = new Set(['oldschool.runescape.wiki', 'static.runelite.net']);

/** One path segment in a bucket/disk-safe alphabet: anything outside [A-Za-z0-9._-] becomes `~HH`
 *  per UTF-8 byte (`~` itself included, so the mapping is one-to-one). */
function safeSegment(seg: string): string {
  let out = '';
  for (const ch of seg) {
    if (/[A-Za-z0-9._-]/.test(ch)) out += ch;
    else for (const b of new TextEncoder().encode(ch)) out += `~${b.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return out;
}

/** The storage key a cached asset lives under: `asset-cache/wiki/…` or `asset-cache/item/<id>.png`. */
export function assetCacheKey(ref: AssetRef): string {
  if (ref.kind === 'item') return `asset-cache/item/${ref.id}.png`;
  // A new cache-buster (the wiki file changed and the dataset was regenerated) is a new object.
  return `asset-cache/wiki/${ref.v ? `v-${ref.v}/` : ''}${ref.file.split('/').map(safeSegment).join('/')}`;
}
