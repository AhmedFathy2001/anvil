import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { and, count, eq } from 'drizzle-orm';

import { db } from '@/db';
import { clanStaff, clans } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { isApexHost } from '@/lib/clanContext';
import { checkDomain, checkSlug, availabilityMessage, createClan } from '@/lib/clanCreate';
import { rateLimitByKey } from '@/lib/rate-limit';

/**
 * Creating a clan, and checking whether a name is free.
 *
 * ON THE APEX ONLY. Creating a clan is a platform act, not something you do from inside another
 * clan's site — and allowing it from a clan host would mean a clan's own subdomain could mint
 * others, which reads as that clan's doing.
 *
 * SIGNED IN, because a clan without an owner is a clan nobody can administer. The session is the
 * only thing that says who to make owner.
 */

/** GET /api/clans?slug=x&domain=y — availability, for typing into the form. */
export async function GET(request: Request) {
  if (!isApexHost((await headers()).get('host'))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const url = new URL(request.url);
  const slug = (url.searchParams.get('slug') ?? '').trim().toLowerCase();
  const domain = (url.searchParams.get('domain') ?? '').trim().toLowerCase();

  const out: Record<string, unknown> = {};
  if (slug) {
    const r = await checkSlug(slug);
    out.slug = { ok: r.ok, message: r.ok ? '' : availabilityMessage('Address', r) };
  }
  if (domain) {
    const r = await checkDomain(domain);
    out.domain = { ok: r.ok, message: r.ok ? '' : availabilityMessage('Domain', r) };
  }
  return NextResponse.json(out);
}

/** How many clans one person may own. A limit, not a business rule — see below. */
const MAX_OWNED = 5;

export async function POST(request: Request) {
  if (!isApexHost((await headers()).get('host'))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const session = await verifyUser();
  if (!session) {
    return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  }

  // Creating a clan is cheap for us and cheap to abuse: one signed-in account could mint subdomains
  // in a loop, and each one squats a name nobody else can have.
  // Keyed on the USER, not the request IP: the same person behind one address should share a
  // budget, and one person on many addresses should not get many budgets.
  const limited = await rateLimitByKey('clan-create', String(session.userId), {
    limit: 3,
    windowMs: 3600_000,
  });
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many clans created just now. Try again later.' }, { status: 429 });
  }

  // Not a paid-tier gate — free clans are the point. It is a squatting bound: someone with a
  // genuine sixth clan is a conversation, not a form submission.
  //
  // Both halves of the WHERE matter. Filtering on role alone counts every owner row on the
  // platform, so the sixth clan anyone created would lock the form for everyone.
  const ownedOwner = await db
    .select({ n: count() })
    .from(clanStaff)
    .where(and(eq(clanStaff.userId, session.userId), eq(clanStaff.role, 'owner')))
    .then((r) => r[0]?.n ?? 0);
  if (ownedOwner >= MAX_OWNED) {
    return NextResponse.json(
      { error: 'You already own the maximum number of clans. Get in touch if you need another.' },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  }

  const result = await createClan({
    slug: String(body.slug ?? ''),
    name: String(body.name ?? ''),
    inGameName: body.inGameName ? String(body.inGameName) : null,
    ownerUserId: session.userId,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const row = await db.query.clans.findFirst({ where: eq(clans.id, result.clanId) });
  return NextResponse.json({ ok: true, clan: row });
}
