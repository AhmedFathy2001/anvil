import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, pluginLinkCodes, pluginLinks, users } from '@/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { generateAdminPluginToken, normalizeRsn } from '@/lib/auth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

// Plugin exchanges {code, rsn} for a long-lived adminPluginToken.
// The RSN comes from Client.getLocalPlayer().getName() inside RuneLite — we trust that value
// because the plugin is our client. The code acts as proof that the admin initiated this.
export async function POST(request: Request) {
  // Only rate-limited endpoint. Legit use is ~once ever per admin; a burst of
  // wrong codes almost certainly means someone is trying to brute-force the
  // 6-char space. 20 per 5 min per IP is generous for humans, cheap for us.
  const rl = await rateLimit(request, 'plugin-link', { limit: 20, windowMs: 5 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  let body: { code?: string; rsn?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const code = (body.code || '').trim().toUpperCase();
  const rsn = (body.rsn || '').trim();
  if (!code || code.length !== 6 || !rsn) {
    return NextResponse.json({ error: 'A 6-character code and rsn are required' }, { status: 400 });
  }

  const nowIso = new Date().toISOString();

  // Atomic consume: only one request can flip consumedAt from null → now.
  // LibSQL/SQLite doesn't return affected rows from UPDATE directly, so we use RETURNING.
  const consumed = await db
    .update(pluginLinkCodes)
    .set({ consumedAt: nowIso })
    .where(
      and(
        eq(pluginLinkCodes.code, code),
        isNull(pluginLinkCodes.consumedAt),
        sql`${pluginLinkCodes.expiresAt} > ${nowIso}`,
      ),
    )
    .returning();

  const codeRow = consumed[0];
  if (!codeRow) {
    return NextResponse.json(
      { error: 'Invalid, already-used, or expired code' },
      { status: 400 },
    );
  }

  const adminUser = await db.query.users.findFirst({ where: eq(users.id, codeRow.userId) });
  if (!adminUser || adminUser.role !== 'admin') {
    return NextResponse.json({ error: 'Issuer no longer has admin role' }, { status: 403 });
  }

  const rsnNormalized = normalizeRsn(rsn);

  // Conflict: the same admin is already linked to a different RSN (and hasn't revoked it).
  // Revoking previous links to a different RSN is a deliberate choice the admin must make
  // on the site, so we refuse the swap here with 409 instead of silently stacking tokens.
  const existingLinks = await db.query.pluginLinks.findMany({
    where: and(eq(pluginLinks.userId, codeRow.userId), isNull(pluginLinks.revokedAt)),
  });
  const conflictingLink = existingLinks.find((l) => l.rsnNormalized !== rsnNormalized);
  if (conflictingLink) {
    return NextResponse.json(
      {
        error: `Admin is already linked to ${conflictingLink.rsn}. Revoke that link on the site before linking a new RSN.`,
        linkedRsn: conflictingLink.rsn,
      },
      { status: 409 },
    );
  }

  // If same admin + same RSN already has a live link, reuse it instead of issuing a duplicate.
  const sameRsnLink = existingLinks.find((l) => l.rsnNormalized === rsnNormalized);
  const token = sameRsnLink?.token ?? generateAdminPluginToken();

  if (!sameRsnLink) {
    await db.insert(pluginLinks).values({
      userId: codeRow.userId,
      rsn,
      rsnNormalized,
      token,
    });
  }

  // Opportunistically register the admin's own RSN in the clan roster as a verified member.
  // Safe: an admin has vouched for the RSN by linking it.
  const existing = await db.query.clanMembers.findFirst({
    where: eq(clanMembers.rsnNormalized, rsnNormalized),
  });
  if (!existing) {
    await db.insert(clanMembers).values({
      rsn,
      rsnNormalized,
      source: 'plugin-self',
      isGuest: 0,
      lastSeenInClan: nowIso,
    });
  } else if (existing.leftAt && existing.source !== 'manual') {
    await db
      .update(clanMembers)
      .set({ leftAt: null, lastSeenInClan: nowIso })
      .where(eq(clanMembers.id, existing.id));
  }

  return NextResponse.json({
    token,
    userId: codeRow.userId,
    username: adminUser.username,
    rsn,
  });
}
