// Anvil Supporter profile perks: the pure half (no database, no sharp), so tests and client
// components can import it.
//
// TWO PERKS, both checked on READ against the tier in force — never written into the data — so a
// lapse needs no clean-up job and a renewal brings everything straight back:
//
//   - Your own avatar and banner. Uploading is a Champion+ perk, and so is the animation. A lapsed
//     Champion keeps the still (first) frame of what they uploaded; nothing is deleted.
//   - A display case of your best drops: Supporter 4 slots, Champion 8, Patron 12. A lapse keeps the
//     first N the tier now allows (free = 0, so hidden), and the rows stay for when they return.

import { SUPPORTER_TIERS, type SupporterTierId } from './supporterTiers.ts';

export type ProfileMediaKind = 'avatar' | 'banner';

export interface MediaLimits {
  /** Largest upload accepted, and the largest file we will store after re-encoding. */
  maxBytes: number;
  /** Smallest frame that still looks like a picture rather than a stretched blur. */
  minWidth: number;
  minHeight: number;
  /** Largest frame side we will decode at all. */
  maxSide: number;
  /** Most frames in an animation. */
  maxFrames: number;
  /**
   * The decompression-bomb budget: frames × width × height. A 2 MB GIF can claim thousands of large
   * frames that each decode to megabytes of raw pixels; this is checked from the header, before
   * anything is decoded, and again by sharp's own pixel limit while decoding.
   */
  maxTotalPixels: number;
  /** What it is stored as. Avatars are cropped square; banners fit inside the box. */
  out: { width: number; height: number; fit: 'cover' | 'inside' };
}

export const MEDIA_LIMITS: Record<ProfileMediaKind, MediaLimits> = {
  avatar: {
    maxBytes: 2 * 1024 * 1024,
    minWidth: 64,
    minHeight: 64,
    maxSide: 2048,
    maxFrames: 300,
    maxTotalPixels: 60_000_000,
    out: { width: 256, height: 256, fit: 'cover' },
  },
  banner: {
    maxBytes: 6 * 1024 * 1024,
    minWidth: 600,
    minHeight: 150,
    maxSide: 4096,
    maxFrames: 300,
    maxTotalPixels: 160_000_000,
    out: { width: 1500, height: 750, fit: 'inside' },
  },
};

export type SniffedImage = 'png' | 'jpeg' | 'gif' | 'webp';

/**
 * What the bytes actually are, from their magic numbers — never the file name or the declared MIME,
 * which the browser (or an attacker) chooses. Anything else, SVG included (it is text, and a script
 * host), is null.
 */
export function sniffImageType(buf: Uint8Array): SniffedImage | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) {
    return 'png';
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  const ascii = (from: number, to: number) => String.fromCharCode(...buf.subarray(from, to));
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return 'gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  return null;
}

export interface MediaHeader {
  format: string | undefined;
  width: number | undefined;
  /** Height of ONE frame (sharp's pageHeight), else the image height. */
  frameHeight: number | undefined;
  frames: number;
}

/** The header checks, before a single pixel is decoded. Null = fine; else what to tell them. */
export function checkMediaHeader(kind: ProfileMediaKind, sniffed: SniffedImage, h: MediaHeader): string | null {
  const lim = MEDIA_LIMITS[kind];
  // The decoder must agree with the magic bytes; a disagreement is a polyglot or a broken file.
  if (h.format !== sniffed) return 'That file is not the image it says it is.';
  const w = h.width ?? 0;
  const fh = h.frameHeight ?? 0;
  if (!(w > 0 && fh > 0)) return 'That image has no size we can read.';
  if (w > lim.maxSide || fh > lim.maxSide) return `That image is too large — at most ${lim.maxSide}×${lim.maxSide} pixels.`;
  if (w < lim.minWidth || fh < lim.minHeight) return `That image is too small — at least ${lim.minWidth}×${lim.minHeight} pixels.`;
  const frames = Math.max(1, Math.floor(h.frames || 1));
  if (frames > lim.maxFrames) return `That animation has too many frames — at most ${lim.maxFrames}.`;
  if (frames * w * fh > lim.maxTotalPixels) return 'That animation is too big to process — use fewer frames or a smaller size.';
  return null;
}

function rank(tier: SupporterTierId | null | undefined): number {
  return tier ? SUPPORTER_TIERS[tier]?.rank ?? 0 : 0;
}

/** Uploading your own avatar and banner, and having them move: Champion and Patron. */
export function canUseProfileMedia(tier: SupporterTierId | null | undefined): boolean {
  return rank(tier) >= SUPPORTER_TIERS.champion.rank;
}

/** Slots in the display case at a tier; 0 hides it. */
export const DISPLAY_CASE_SLOTS: Record<SupporterTierId, number> = { supporter: 4, champion: 8, patron: 12 };
/** The most pins anybody may store, whatever their tier — a Patron's 12. */
export const DISPLAY_CASE_MAX = 12;

export function displayCaseSlots(tier: SupporterTierId | null | undefined): number {
  return tier ? DISPLAY_CASE_SLOTS[tier] ?? 0 : 0;
}

/** Keep the first N pins the tier allows, in their order. Lapsing hides the tail; nothing is lost. */
export function visiblePins<T extends { position: number; id: number }>(pins: T[], tier: SupporterTierId | null | undefined): T[] {
  return [...pins].sort((a, b) => a.position - b.position || a.id - b.id).slice(0, displayCaseSlots(tier));
}

/**
 * Is this one of OUR profile-media objects? Only these are ever rendered: a row holding anything
 * else (a hand-edited database, an older format) renders as no picture rather than as somebody
 * else's server in every visitor's browser. Our uploads are `…/profiles/<userId>/<uuid>.webp` on the
 * configured media host (or a Vercel Blob host, the previous driver).
 */
export function isProfileMediaUrl(raw: string | null | undefined, publicBase = process.env.S3_PUBLIC_BASE_URL ?? ''): raw is string {
  if (!raw) return false;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'))) return false;
  if (u.search || u.hash || u.username || u.password) return false;
  let hostOk = u.hostname.endsWith('.blob.vercel-storage.com');
  const base = publicBase.trim().replace(/\/+$/, '');
  if (!hostOk && base) {
    try {
      const b = new URL(base);
      hostOk = u.host === b.host && u.protocol === b.protocol && u.pathname.startsWith(`${b.pathname.replace(/\/+$/, '')}/`);
    } catch {
      hostOk = false;
    }
  }
  if (!hostOk) return false;
  // Vercel Blob may append its own random suffix to the name.
  return /\/profiles\/\d+\/[0-9a-f-]{36}(-[A-Za-z0-9]+)?\.webp$/.test(u.pathname);
}

/** A stored profile picture, as one place renders it. */
export interface ShownMedia {
  /** What to show when motion is allowed (animated for Champion+, else the still). */
  src: string;
  /** Always a single frame. */
  still: string;
  /** src moves. Tells the renderer to offer the still to reduced-motion viewers. */
  animated: boolean;
}

export interface ShownProfileMedia {
  avatar: ShownMedia | null;
  banner: (ShownMedia & { position: number }) | null;
}

export interface ProfileMediaRowLike {
  avatarUrl: string | null;
  avatarStillUrl: string | null;
  bannerUrl: string | null;
  bannerStillUrl: string | null;
  bannerPosition: number | null;
}

/**
 * What a page shows from a person's stored media, at their tier NOW. `still` forces the first frame
 * (a list, a card among many). A lapsed tier sees the still: what they uploaded, without the motion.
 */
export function shownProfileMedia(
  row: ProfileMediaRowLike | null | undefined,
  tier: SupporterTierId | null | undefined,
  opts: { still?: boolean; publicBase?: string } = {},
): ShownProfileMedia {
  const out: ShownProfileMedia = { avatar: null, banner: null };
  if (!row) return out;
  const motion = canUseProfileMedia(tier) && !opts.still;
  const pick = (full: string | null, still: string | null): ShownMedia | null => {
    const s = isProfileMediaUrl(still, opts.publicBase) ? still : null;
    if (!s) return null;
    const f = motion && isProfileMediaUrl(full, opts.publicBase) ? full : s;
    return { src: f, still: s, animated: f !== s };
  };
  out.avatar = pick(row.avatarUrl, row.avatarStillUrl);
  const b = pick(row.bannerUrl, row.bannerStillUrl);
  if (b) {
    const p = row.bannerPosition;
    out.banner = { ...b, position: typeof p === 'number' && p >= 0 && p <= 100 ? Math.round(p) : 50 };
  }
  return out;
}
