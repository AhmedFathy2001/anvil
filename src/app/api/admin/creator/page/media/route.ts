import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clans } from '@/db/schema';
import { refreshBotIdentityIfClan } from '@/lib/discordIdentity';
import { processProfileMedia } from '@/lib/profileMediaProcess';
import { rateLimitByKey, rateLimitHeaders } from '@/lib/rate-limit';
import { auditSpacePage, spacePageGuard } from '@/lib/spacePage/guard';
import { isSpaceMediaUrl, SPACE_MEDIA_ANIMATED, SPACE_MEDIA_LIMITS, type SpaceMediaKind } from '@/lib/spacePage/rules';
import { clanMediaKey, del, put } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// A creator space's logo, banner and panel images.
//
// The strict pipeline the Supporter avatar and banner use (lib/profileMediaProcess), not the loose
// /api/upload: the type sniffed from the magic bytes, a size cap per kind, dimensions and the frame
// budget read from the header before anything is decoded, then a decode and re-encode to WebP with
// all metadata gone. The logo and banner may move, as a clan's may; a panel image keeps its first
// frame. The URL is minted here — under the space's own prefix — so nothing a client types is ever
// rendered.

const KINDS: readonly SpaceMediaKind[] = ['logo', 'banner', 'panel'];

function kindOf(v: unknown): SpaceMediaKind | null {
  return typeof v === 'string' && (KINDS as readonly string[]).includes(v) ? (v as SpaceMediaKind) : null;
}

export async function POST(request: Request) {
  const g = await spacePageGuard();
  if ('error' in g) return g.error;

  // Decoding is the expensive part; a host sets up their page a handful of times.
  const rl = await rateLimitByKey('space-media', String(g.clan.id), { limit: 20, windowMs: 10 * 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many uploads — try again in a few minutes.' }, { status: 429, headers: rateLimitHeaders(rl) });

  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > SPACE_MEDIA_LIMITS.banner.maxBytes + 64 * 1024) return NextResponse.json({ error: 'That file is too large.' }, { status: 413 });

  const form = await request.formData().catch(() => null);
  const kind = kindOf(form?.get('kind'));
  const file = form?.get('file');
  if (!kind || !(file instanceof File)) return NextResponse.json({ error: 'Choose an image.' }, { status: 400 });
  const lim = SPACE_MEDIA_LIMITS[kind];
  if (file.size > lim.maxBytes) return NextResponse.json({ error: `That file is too large — at most ${lim.maxBytes / (1024 * 1024)} MB.` }, { status: 413 });

  const processed = await processProfileMedia(Buffer.from(await file.arrayBuffer()), lim, SPACE_MEDIA_ANIMATED[kind]);
  if (!processed.ok) return NextResponse.json({ error: processed.error }, { status: 400 });

  const key = clanMediaKey(g.clan.slug, `space/${crypto.randomUUID()}.webp`);
  const { url } = await put(key, processed.animated ?? processed.still, 'image/webp');

  if (kind === 'panel') return NextResponse.json({ url });

  // clan-scope: this space's own row.
  const before = await db.query.clans.findFirst({ where: eq(clans.id, g.clan.id), columns: { logoUrl: true, bannerUrl: true } });
  if (kind === 'logo') {
    await db.update(clans).set({ logoUrl: url }).where(eq(clans.id, g.clan.id));
    void refreshBotIdentityIfClan(g.clan.id);
  } else {
    // A new picture starts centred; the old one's focus meant nothing to it.
    await db.update(clans).set({ bannerUrl: url, bannerPosition: null }).where(eq(clans.id, g.clan.id));
  }
  // The picture this replaced, only if it was one of this page's own uploads. Best effort.
  const old = kind === 'logo' ? before?.logoUrl : before?.bannerUrl;
  if (isSpaceMediaUrl(old, g.clan.slug)) void del(old).catch(() => {});
  auditSpacePage(g.clan.id, g.actorUserId, `${kind} uploaded`);
  return NextResponse.json({ url, animated: !!processed.animated });
}

/** Take the logo or banner down (?kind=logo|banner). The page falls back to the generated crest / no banner. */
export async function DELETE(request: Request) {
  const g = await spacePageGuard();
  if ('error' in g) return g.error;
  const kind = kindOf(new URL(request.url).searchParams.get('kind'));
  if (kind !== 'logo' && kind !== 'banner') return NextResponse.json({ error: 'kind must be logo or banner' }, { status: 400 });
  // clan-scope: this space's own row.
  const before = await db.query.clans.findFirst({ where: eq(clans.id, g.clan.id), columns: { logoUrl: true, bannerUrl: true } });
  if (kind === 'logo') {
    await db.update(clans).set({ logoUrl: null }).where(eq(clans.id, g.clan.id));
    void refreshBotIdentityIfClan(g.clan.id);
  } else {
    await db.update(clans).set({ bannerUrl: null, bannerPosition: null }).where(eq(clans.id, g.clan.id));
  }
  const old = kind === 'logo' ? before?.logoUrl : before?.bannerUrl;
  if (isSpaceMediaUrl(old, g.clan.slug)) void del(old).catch(() => {});
  auditSpacePage(g.clan.id, g.actorUserId, `${kind} removed`);
  return NextResponse.json({ success: true });
}
