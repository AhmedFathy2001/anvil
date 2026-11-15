// One place that makes an uploaded image safe to store: no EXIF (GPS, camera, timestamps), no text
// chunks, no embedded thumbnails. Every upload path that keeps an image goes through this.
//
// Re-encoding is the strip: sharp writes no metadata unless asked to, and it is never asked to.
// Orientation is applied first (`rotate`) so the picture still looks right once EXIF is gone. An
// APNG cannot be re-encoded without losing its animation, so its metadata chunks are dropped in
// place instead (lib/imageAnimation stripPngChunks).

import sharp from 'sharp';

import { isAnimatedPng, stripPngChunks } from '@/lib/imageAnimation';

export interface CleanImage {
  bytes: Buffer;
  ext: string;
  contentType: string;
  /** False only when the image could not be read and `onUnreadable: 'keep'` stored it as it came. */
  stripped: boolean;
}

const KEPT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
};

export async function stripImageMetadata(
  input: Buffer,
  opts: {
    maxDimension?: number;
    quality?: number;
    /**
     * What to do with bytes the server cannot decode. 'refuse' (default) returns null so the caller
     * can reject the upload. 'keep' hands back the original bytes, for proofs, where a submission must
     * never silently drop; `keepExt` names the extension to store them under.
     */
    onUnreadable?: 'keep' | 'refuse';
    keepExt?: string;
  } = {},
): Promise<CleanImage | null> {
  const unreadable = (): CleanImage | null => {
    if (opts.onUnreadable !== 'keep') return null;
    const ext = opts.keepExt && KEPT_TYPES[opts.keepExt] ? opts.keepExt : 'jpg';
    return { bytes: input, ext, contentType: KEPT_TYPES[ext], stripped: false };
  };
  try {
    if (isAnimatedPng(input)) {
      const bytes = stripPngChunks(input);
      return bytes ? { bytes, ext: 'png', contentType: 'image/png', stripped: true } : unreadable();
    }
    const animated = ((await sharp(input).metadata()).pages ?? 1) > 1;
    const max = opts.maxDimension ?? 1600;
    const bytes = await sharp(input, { animated })
      .rotate()
      .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: opts.quality ?? 80 })
      .toBuffer();
    return { bytes, ext: 'webp', contentType: 'image/webp', stripped: true };
  } catch {
    return unreadable();
  }
}

export const UNREADABLE_IMAGE = 'We could not read that image. Use a JPG, PNG, GIF or WebP file.';
