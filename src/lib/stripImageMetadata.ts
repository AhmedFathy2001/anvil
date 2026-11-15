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
  ext: 'webp' | 'png';
  contentType: 'image/webp' | 'image/png';
}

export async function stripImageMetadata(
  input: Buffer,
  opts: { maxDimension?: number; quality?: number } = {},
): Promise<CleanImage | null> {
  try {
    if (isAnimatedPng(input)) {
      const bytes = stripPngChunks(input);
      return bytes ? { bytes, ext: 'png', contentType: 'image/png' } : null;
    }
    const animated = ((await sharp(input).metadata()).pages ?? 1) > 1;
    const max = opts.maxDimension ?? 1600;
    const bytes = await sharp(input, { animated })
      .rotate()
      .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: opts.quality ?? 80 })
      .toBuffer();
    return { bytes, ext: 'webp', contentType: 'image/webp' };
  } catch {
    return null;
  }
}

export const UNREADABLE_IMAGE = 'We could not read that image. Use a JPG, PNG, GIF or WebP file.';
