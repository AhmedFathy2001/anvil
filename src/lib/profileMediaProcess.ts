// Turning an uploaded avatar or banner into what we store: the strict half of the upload route,
// with no database and no storage so the tests can feed it bytes directly.
//
// Every accepted file is DECODED AND RE-ENCODED to WebP, never stored as sent. That is what makes
// the checks mean something: whatever was hiding in the original (EXIF with a home's GPS, a script
// in a comment chunk, a polyglot tail) does not survive a decode to pixels and an encode from them.
// sharp writes no metadata unless asked to, and it is never asked to here.

import sharp from 'sharp';

import { isAnimatedPng } from './imageAnimation.ts';
import { checkMediaHeader, MEDIA_LIMITS, sniffImageType, type ProfileMediaKind } from './profileMediaRules.ts';

const WEBP_QUALITY = 80;
/** A decode that takes longer than this is a file we do not want. */
const TIMEOUT_SECONDS = 20;

export type ProcessedMedia =
  | { ok: true; still: Buffer; animated: Buffer | null; width: number; height: number; frames: number }
  | { ok: false; error: string };

/**
 * Validate and re-encode one upload. `animated` is null for a still image (or for a person whose
 * tier does not include motion — `allowAnimation` false keeps only the first frame).
 */
export async function processProfileMedia(
  input: Buffer,
  kind: ProfileMediaKind,
  allowAnimation: boolean,
): Promise<ProcessedMedia> {
  const lim = MEDIA_LIMITS[kind];
  if (input.length === 0) return { ok: false, error: 'That file is empty.' };
  if (input.length > lim.maxBytes) return { ok: false, error: `That file is too large — at most ${mb(lim.maxBytes)}.` };

  const sniffed = sniffImageType(input);
  if (!sniffed) return { ok: false, error: 'Use a PNG, JPEG, GIF or WebP image.' };

  // Header only: sharp reads dimensions and the frame count without decoding pixels.
  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: lim.maxSide * lim.maxSide, failOn: 'error' }).metadata();
  } catch {
    return { ok: false, error: 'That image could not be read.' };
  }
  // An APNG decodes to its default frame only, so it is a still here whatever it claims.
  const frames = sniffed === 'png' && isAnimatedPng(input) ? 1 : Math.max(1, meta.pages ?? 1);
  const headerError = checkMediaHeader(kind, sniffed, {
    format: meta.format === 'jpg' ? 'jpeg' : meta.format,
    width: meta.width,
    frameHeight: meta.pageHeight ?? meta.height,
    frames,
  });
  if (headerError) return { ok: false, error: headerError };

  const moving = allowAnimation && frames > 1 && (sniffed === 'gif' || sniffed === 'webp');
  const resize = { width: lim.out.width, height: lim.out.height, fit: lim.out.fit, withoutEnlargement: lim.out.fit === 'inside' } as const;

  try {
    // The first frame, always: lists, reduced motion, and what a lapsed tier falls back to.
    const still = await sharp(input, { pages: 1, limitInputPixels: lim.maxSide * lim.maxSide, failOn: 'error' })
      .timeout({ seconds: TIMEOUT_SECONDS })
      .rotate() // honour EXIF orientation, then drop it with the rest of the metadata
      .resize(resize)
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });

    let animated: Buffer | null = null;
    if (moving) {
      animated = await sharp(input, { animated: true, limitInputPixels: lim.maxTotalPixels, failOn: 'error' })
        .timeout({ seconds: TIMEOUT_SECONDS })
        .resize(resize)
        .webp({ quality: WEBP_QUALITY, effort: 4 })
        .toBuffer();
      // Re-encoding a GIF usually shrinks it 3-5×, but not always; what we keep obeys the same cap.
      if (animated.length > lim.maxBytes) {
        return { ok: false, error: `That animation is still over ${mb(lim.maxBytes)} after compressing — try a shorter or smaller one.` };
      }
    }
    return { ok: true, still: still.data, animated, width: still.info.width, height: still.info.height, frames: moving ? frames : 1 };
  } catch {
    return { ok: false, error: 'That image could not be processed.' };
  }
}

function mb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
