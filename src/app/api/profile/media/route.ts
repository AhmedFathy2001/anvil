import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { profileMedia } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { del, put } from '@/lib/storage';
import { supporterForUser } from '@/lib/supporter';
import { canUseProfileMedia, isProfileMediaUrl, MEDIA_LIMITS, profileMediaRow, type ProfileMediaKind } from '@/lib/profileMedia';
import { processProfileMedia } from '@/lib/profileMediaProcess';

export const dynamic = 'force-dynamic';

// Your own avatar and banner (Anvil Supporter: Champion and Patron).
//
// Its own route rather than /api/upload, because the rules are stricter and different: a hard size
// cap per kind, the type sniffed from the bytes, dimension and frame budgets checked from the header
// before anything is decoded, and every file re-encoded to WebP (metadata gone) with a first-frame
// still beside it. The URL is written here too, so a client never sends one — there is nothing to
// point at somebody else's server.
//
// Uploading needs Champion+ NOW. Removing never does: a lapsed supporter can always take theirs down.

const KINDS: readonly ProfileMediaKind[] = ['avatar', 'banner'];

function kindOf(v: unknown): ProfileMediaKind | null {
  return typeof v === 'string' && (KINDS as readonly string[]).includes(v) ? (v as ProfileMediaKind) : null;
}

/** Object key for one of this person's pictures. Person-level, so no clan prefix. */
function mediaKey(userId: number): string {
  return `profiles/${userId}/${crypto.randomUUID()}.webp`;
}

/** Only ever delete objects that are this person's own profile media. */
function ownObjects(userId: number, urls: (string | null | undefined)[]): string[] {
  return [...new Set(urls.filter((u): u is string => isProfileMediaUrl(u) && u.includes(`/profiles/${userId}/`)))];
}

export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  // Decoding is the expensive part of any upload; a person changes their look a few times, not often.
  const rl = await rateLimit(request, 'profile-media', { limit: 10, windowMs: 10 * 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many uploads — try again in a few minutes.' }, { status: 429, headers: rateLimitHeaders(rl) });

  const supporter = await supporterForUser(session.userId);
  if (!canUseProfileMedia(supporter?.tier.id)) {
    return NextResponse.json({ error: 'Your own avatar and banner come with Anvil Champion and Patron.' }, { status: 403 });
  }

  // Refuse an oversized body before buffering it (the multipart envelope adds a little).
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MEDIA_LIMITS.banner.maxBytes + 64 * 1024) {
    return NextResponse.json({ error: 'That file is too large.' }, { status: 413 });
  }

  const form = await request.formData().catch(() => null);
  const kind = kindOf(form?.get('kind'));
  const file = form?.get('file');
  if (!kind || !(file instanceof File)) return NextResponse.json({ error: 'Choose an image.' }, { status: 400 });
  if (file.size > MEDIA_LIMITS[kind].maxBytes) {
    return NextResponse.json({ error: `That file is too large — at most ${MEDIA_LIMITS[kind].maxBytes / (1024 * 1024)} MB.` }, { status: 413 });
  }

  const processed = await processProfileMedia(Buffer.from(await file.arrayBuffer()), kind, true);
  if (!processed.ok) return NextResponse.json({ error: processed.error }, { status: 400 });

  const still = (await put(mediaKey(session.userId), processed.still, 'image/webp')).url;
  const full = processed.animated ? (await put(mediaKey(session.userId), processed.animated, 'image/webp')).url : still;

  const before = await profileMediaRow(session.userId);
  const patch =
    kind === 'avatar'
      ? { avatarUrl: full, avatarStillUrl: still, updatedAt: new Date() }
      : { bannerUrl: full, bannerStillUrl: still, updatedAt: new Date() };
  await db
    .insert(profileMedia)
    .values({ userId: session.userId, ...patch })
    .onConflictDoUpdate({ target: profileMedia.userId, set: patch });

  // The pictures this replaced. Best effort: an orphan in the bucket is harmless.
  const old = kind === 'avatar' ? [before?.avatarUrl, before?.avatarStillUrl] : [before?.bannerUrl, before?.bannerStillUrl];
  void del(ownObjects(session.userId, old)).catch(() => {});

  return NextResponse.json({ kind, url: full, still, animated: full !== still });
}

/** The banner's vertical focus, 0 (top) – 100 (bottom); null re-centres it. */
export async function PATCH(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { bannerPosition?: unknown } | null;
  const pos = body?.bannerPosition;
  if (!body || !('bannerPosition' in body) || (pos !== null && (typeof pos !== 'number' || !Number.isFinite(pos) || pos < 0 || pos > 100))) {
    return NextResponse.json({ error: 'bannerPosition must be a number from 0 to 100, or null' }, { status: 400 });
  }
  await db
    .update(profileMedia)
    .set({ bannerPosition: pos == null ? null : Math.round(pos as number), updatedAt: new Date() })
    .where(eq(profileMedia.userId, session.userId));
  return NextResponse.json({ success: true });
}

/** Take one down (?kind=avatar|banner). Allowed at any tier. */
export async function DELETE(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const kind = kindOf(new URL(request.url).searchParams.get('kind'));
  if (!kind) return NextResponse.json({ error: 'kind must be avatar or banner' }, { status: 400 });

  const before = await profileMediaRow(session.userId);
  if (!before) return NextResponse.json({ success: true });
  const patch =
    kind === 'avatar'
      ? { avatarUrl: null, avatarStillUrl: null, updatedAt: new Date() }
      : { bannerUrl: null, bannerStillUrl: null, bannerPosition: null, updatedAt: new Date() };
  await db.update(profileMedia).set(patch).where(eq(profileMedia.userId, session.userId));
  const old = kind === 'avatar' ? [before.avatarUrl, before.avatarStillUrl] : [before.bannerUrl, before.bannerStillUrl];
  void del(ownObjects(session.userId, old)).catch(() => {});
  return NextResponse.json({ success: true });
}
