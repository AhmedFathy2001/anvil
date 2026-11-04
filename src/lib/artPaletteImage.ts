// Decoding a space's logo and banner into a palette (lib/artPalette has the picking rules).
//
// The images are read back from our own media bucket by key, never fetched from an arbitrary URL:
// the only urls a clan row holds are ones /api/upload wrote (isManagedMediaUrl), and anything else
// gives no colours rather than a request to somebody else's server.

import sharp from 'sharp';

import { log } from '@/lib/logger';
import { getObject, isManagedMediaUrl, s3Enabled } from '@/lib/storage';
import { mergePalettes, paletteFromPixels } from '@/lib/artPalette';

/**
 * Small on purpose: a palette needs the colours, not the detail. The whole image is shrunk to fit
 * (never cropped): a 3:1 banner cropped to a square loses its two outer thirds — and their colours.
 */
const SAMPLE = 96;
/** A logo or banner past this is not something we uploaded; don't decode it. */
const MAX_BYTES = 12 * 1024 * 1024;

/** The bucket key of one of our media urls (the path after the public base), or null. */
export function mediaKeyOf(url: string): string | null {
  const base = (process.env.S3_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!base || !isManagedMediaUrl(url)) return null;
  try {
    const u = new URL(url);
    const prefix = new URL(base).pathname.replace(/\/+$/, '');
    let path = decodeURIComponent(u.pathname);
    if (prefix && path.startsWith(`${prefix}/`)) path = path.slice(prefix.length);
    const key = path.replace(/^\/+/, '');
    if (!key || key.split('/').some((s) => s === '..' || s === '.')) return null;
    return key;
  } catch {
    return null;
  }
}

async function colorsOf(url: string | null | undefined): Promise<string[]> {
  if (!url || !s3Enabled()) return [];
  const key = mediaKeyOf(url);
  if (!key) return [];
  try {
    const obj = await getObject(key);
    if (!obj || obj.bytes.length > MAX_BYTES) return [];
    // First frame only (`pages: 1`): an animated logo's palette is its first frame's, which is what
    // every static surface (cards, the crest fallback) shows anyway.
    const { data, info } = await sharp(obj.bytes, { pages: 1, limitInputPixels: 40_000_000 })
      .resize(SAMPLE, SAMPLE, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return paletteFromPixels(new Uint8Array(data.buffer, data.byteOffset, data.length), info.channels === 4 ? 4 : 3);
  } catch (err) {
    log.warn('art-palette.decode-failed', { key, message: (err as Error).message });
    return [];
  }
}

/** The palette for a logo and banner, logo first. Empty when neither can be read. */
export async function paletteFromArt(logoUrl: string | null | undefined, bannerUrl: string | null | undefined): Promise<string[]> {
  const [logo, banner] = await Promise.all([colorsOf(logoUrl), colorsOf(bannerUrl)]);
  return mergePalettes(logo, banner);
}
