import { NextResponse } from 'next/server';
import {
  decodeJwt,
  decodeProtectedHeader,
  errors as joseErrors,
  type JWTPayload,
} from 'jose';
import { db } from '@/db';
import { users, clanMembers, federationBans, clanAuditLog } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { normalizeRsn } from '@/lib/auth';
import { rateLimitByKey, rateLimitHeaders } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/federationSecurity';
import { getBrokerTrust, getExchangePolicy, getFederationEnabled } from '@/lib/pluginConfig';
import { createGuardedRemoteJWKSet, verifyBrokerAssertion } from '@/lib/federationJwks';
import {
  exchangeRateLimitKey,
  guestRateLimitKey,
  planGuestConflict,
  guestConflictExhausted,
  gateReplayThenBudget,
} from '@/lib/federationDecisions';
import {
  getInstanceId,
  mintFederationToken,
  pushAssociation,
  recordFederationJti,
  type FederationScope,
} from '@/lib/federation';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// POST /api/federation/v1/exchange — the L2 identity-federation door (WIRE §2, FEDERATION.md L2).
//
// A plugin presents a short-lived, single-use broker assertion (an EdDSA JWT the broker minted at
// /assert, pinned to THIS instanceId). We validate it strictly against the trusted broker's JWKS,
// then map the asserted `discord_id` (`sub`) onto local membership and mint the SAME opaque, hashed,
// revocable federation token /token issues. A broker — even a compromised one — can only *assert
// identity*; this instance still enforces its own membership + policy, so it can never grant a
// non-member more than the exchangePolicy allows.
//
// Body: { assertion: "<jwt>" }.

// Synthetic, clearly-non-game display name for an exchange-created guest. rsn is NOT NULL and
// rsn_normalized is UNIQUE, and an assertion carries only the discord_id (no RSN), so we key the
// guest on the discord_id. `guest:` prefix keeps it out of the RSN namespace (colons never appear
// in an OSRS name) and makes it obvious in the roster that this is a federated placeholder.
function guestRsnFor(discordId: string): string {
  return `guest:${discordId}`;
}

// ── Shared-RSN application ("Share my RSN with this clan", per-account) ─────────────────────────
// The exchange body may carry `accounts` — RSNs the member EXPLICITLY shared with this clan from
// their home (each account shared individually, while logged into it). Attested by the member's
// home, so treated as a labeled claim, never as local verification. HARD RULES (identity-takeover
// class): a shared RSN may only ever name a FEDERATION GUEST row of this same discordId — it never
// binds to, renames, or reactivates any other row; a collision is audit-logged and skipped. The set
// is authoritative per exchange: guests whose RSN is no longer shared are pruned (soft-left) and
// the anchor reverts to its placeholder — revocation at home propagates here on the next relay.

const MAX_SHARED_ACCOUNTS = 5;
const RSN_SHAPE = /^[A-Za-z0-9 _-]{1,12}$/;

function sanitizeSharedAccounts(raw: unknown): { rsn: string; primary: boolean }[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: { rsn: string; primary: boolean }[] = [];
  for (const entry of raw) {
    if (out.length >= MAX_SHARED_ACCOUNTS) break;
    const rsn = typeof (entry as { rsn?: unknown })?.rsn === 'string' ? (entry as { rsn: string }).rsn.trim() : '';
    if (!RSN_SHAPE.test(rsn)) continue;
    const norm = normalizeRsn(rsn);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push({ rsn, primary: (entry as { primary?: unknown }).primary === true });
  }
  return out;
}

async function applySharedAccounts(
  discordId: string,
  anchorGuestId: number,
  rawAccounts: unknown,
): Promise<void> {
  const shared = sanitizeSharedAccounts(rawAccounts);
  const sharedNorms = new Set(shared.map((a) => normalizeRsn(a.rsn)));
  const placeholderRsn = guestRsnFor(discordId);
  const placeholderNorm = normalizeRsn(placeholderRsn);
  const nowIso = new Date().toISOString();

  const conflictAudit = (rsn: string) =>
    db
      .insert(clanAuditLog)
      .values({
        clanMemberId: anchorGuestId,
        eventType: 'federation_rsn_conflict',
        newValue: JSON.stringify({ discordId, claimedRsn: rsn }),
        notes:
          'A federated home attested this RSN for its member, but the name already belongs to a different row here — claim ignored. Review if unexpected.',
      })
      .catch(() => {});

  // Is this normalized RSN free to be held by a federation guest of THIS discord identity?
  // Returns the owning row when it's our own (reusable), null when free, 'conflict' otherwise.
  const ownerOf = async (norm: string): Promise<{ id: number; leftAt: string | null } | null | 'conflict'> => {
    const row = await db.query.clanMembers.findFirst({
      where: eq(clanMembers.rsnNormalized, norm),
      columns: { id: true, leftAt: true, isGuest: true, discordId: true, source: true },
    });
    if (!row) return null;
    if (row.isGuest === 1 && row.source === 'federation' && row.discordId === discordId) {
      return { id: row.id, leftAt: row.leftAt };
    }
    return 'conflict';
  };

  // 1. The ANCHOR row (the placeholder the federation token is bound to) carries the primary RSN —
  //    or reverts to the placeholder name when nothing is shared any more.
  const anchor = await db.query.clanMembers.findFirst({
    where: eq(clanMembers.id, anchorGuestId),
    columns: { id: true, rsnNormalized: true },
  });
  if (!anchor) return;
  const primary = shared.find((a) => a.primary) ?? shared[0] ?? null;
  const desiredRsn = primary ? primary.rsn : placeholderRsn;
  const desiredNorm = primary ? normalizeRsn(primary.rsn) : placeholderNorm;
  if (anchor.rsnNormalized !== desiredNorm) {
    const owner = await ownerOf(desiredNorm);
    if (owner === 'conflict') {
      conflictAudit(desiredRsn);
    } else {
      // A stale sibling guest already holding the name must vacate first (unique rsn_normalized).
      if (owner && owner.id !== anchor.id) {
        await db
          .update(clanMembers)
          .set({ leftAt: nowIso })
          .where(eq(clanMembers.id, owner.id));
      }
      await db
        .update(clanMembers)
        .set({
          rsn: desiredRsn,
          rsnNormalized: desiredNorm,
          verificationMethod: primary ? 'federation' : null,
        })
        .where(eq(clanMembers.id, anchor.id));
    }
  }

  // 2. Extra shared accounts each get their own federation-guest row (same discord identity).
  for (const account of shared) {
    const norm = normalizeRsn(account.rsn);
    if (norm === desiredNorm) continue; // the anchor already carries it
    const owner = await ownerOf(norm);
    if (owner === 'conflict') {
      conflictAudit(account.rsn);
      continue;
    }
    if (owner) {
      if (owner.leftAt) {
        await db.update(clanMembers).set({ leftAt: null }).where(eq(clanMembers.id, owner.id));
      }
      continue;
    }
    await db
      .insert(clanMembers)
      .values({
        rsn: account.rsn,
        rsnNormalized: norm,
        discordId,
        isGuest: 1,
        source: 'federation',
        verificationMethod: 'federation',
        notes: 'RSN shared via federation by its owner (home-attested).',
        lastSeenInClan: nowIso,
      })
      .onConflictDoNothing();
  }

  // 3. PRUNE: federation guests of this identity holding an RSN that is no longer shared (and isn't
  //    the anchor) leave softly — un-sharing at home actually revokes here.
  const mine = await db
    .select({ id: clanMembers.id, rsnNormalized: clanMembers.rsnNormalized })
    .from(clanMembers)
    .where(
      and(
        eq(clanMembers.discordId, discordId),
        eq(clanMembers.isGuest, 1),
        eq(clanMembers.source, 'federation'),
        isNull(clanMembers.leftAt),
      ),
    );
  for (const row of mine) {
    if (row.id === anchorGuestId) continue;
    if (row.rsnNormalized === placeholderNorm || sharedNorms.has(row.rsnNormalized)) continue;
    await db.update(clanMembers).set({ leftAt: nowIso }).where(eq(clanMembers.id, row.id));
  }
}

// Find-or-create the INERT federation guest for a discord_id (decision 4 / FEDERATION.md guardrail 1).
// INERTNESS GUARANTEE: this only ever writes a clan_members row (isGuest=1) — it NEVER touches
// `players`, teams, or the draft, so an exchange-created guest is structurally unable to be on a team,
// credit a tile, or submit. It stays read-only (board:read-scoped token, board preview only) until an
// admin explicitly drafts/promotes it. Idempotent: a repeat exchange reuses the existing guest row.
async function ensureFederationGuest(
  discordId: string,
  ownerUserId: number | null,
): Promise<{ id: number; created: boolean }> {
  const rsn = guestRsnFor(discordId);
  const rsnNormalized = normalizeRsn(rsn);

  // finding #12: BOUNDED retry loop (was an unbounded recursion). A `missing` conflict — the row
  // vanished between our failed insert and the re-read — retries the find-or-create, but at most
  // MAX_GUEST_CONFLICT_RETRIES times, so a pathological churn can never recurse forever / blow the stack.
  for (let attempt = 0; ; attempt++) {
    const existing = await db.query.clanMembers.findFirst({
      where: and(eq(clanMembers.rsnNormalized, rsnNormalized), isNull(clanMembers.leftAt)),
      columns: { id: true },
    });
    if (existing) return { id: existing.id, created: false };

    // onConflictDoNothing guards the concurrent-first-exchange race on the unique rsn_normalized index;
    // if another request won, re-read the winner's row so we return a stable id.
    const inserted = await db
      .insert(clanMembers)
      .values({
        rsn,
        rsnNormalized,
        discordId,
        userId: ownerUserId,
        isGuest: 1,
        source: 'federation',
        notes: 'Auto-created via federation /exchange (inert guest — not on any team).',
        lastSeenInClan: new Date().toISOString(),
      })
      .onConflictDoNothing()
      .returning({ id: clanMembers.id });

    if (inserted[0]) return { id: inserted[0].id, created: true };

    // The insert lost the unique-index race. The conflicting row is on `rsn_normalized`, which is unique
    // REGARDLESS of `leftAt` — so it may be a SOFT-REMOVED (departed) guest. finding #11: don't return a
    // `leftAt` row and mint a token for a departed member. Re-read WITHOUT the leftAt filter to find that
    // row, then decide (planGuestConflict): reuse an active guest, or REACTIVATE a departed one (clear
    // leftAt → it becomes an inert guest again).
    const conflict = await db.query.clanMembers.findFirst({
      where: eq(clanMembers.rsnNormalized, rsnNormalized),
      columns: { id: true, leftAt: true },
    });
    const plan = planGuestConflict(conflict);
    if (plan === 'reuse') return { id: conflict!.id, created: false };
    if (plan === 'reactivate') {
      await db
        .update(clanMembers)
        .set({
          leftAt: null,
          isGuest: 1,
          userId: ownerUserId,
          source: 'federation',
          notes: 'Re-activated via federation /exchange (inert guest — not on any team).',
          lastSeenInClan: new Date().toISOString(),
        })
        .where(eq(clanMembers.id, conflict!.id));
      return { id: conflict!.id, created: false };
    }
    // plan === 'missing' (row gone) → retry the whole find-or-create, but only within the bounded budget.
    if (guestConflictExhausted(attempt)) {
      throw new Error('federation: guest find-or-create did not converge');
    }
  }
}

export async function POST(request: Request) {
  // Master switch (WIRE §10.1): federation OFF must mean OFF for the INBOUND surface too — a
  // clan that left the network stops serving exchanges/reads/relays, so other homes' refreshes
  // drop it within one cycle instead of keeping a ghost connection alive.
  if (!(await getFederationEnabled())) {
    return NextResponse.json({ error: 'federation_disabled' }, { status: 403 });
  }

  // findings #6 + #2: a COARSE per-IP throttle FIRST — before JSON.parse, the JWT decodes, and the
  // (uncached) getBrokerTrust() DB read — so an unauthenticated flood of forged assertions is capped
  // before any of that work runs. Keyed on the PROXY-APPENDED client IP (getClientIp: x-real-ip / last
  // XFF), NEVER the spoofable leftmost XFF entry. Generous: legit callers are relaying home sites
  // (server-to-server, one IP per clan), so the per-member limit below is the real fairness control.
  const iprl = await rateLimitByKey('federation-exchange-ip', `ip:${getClientIp(request)}`, {
    limit: 300,
    windowMs: 60 * 1000,
  });
  if (!iprl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(iprl) });
  }

  // The exchange door is also rate-limited PER MEMBER (`sub` from the VERIFIED assertion) below — the
  // caller is the relaying HOME site, so all its members share one IP and an IP-only budget would let
  // one member starve the whole clan's exchanges. The member-keyed limit (and the tighter guest-CREATION
  // budget) are applied once `sub` is cryptographically established.
  let body: { assertion?: unknown; accounts?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const assertion = typeof body.assertion === 'string' ? body.assertion.trim() : '';
  if (!assertion) {
    return NextResponse.json({ error: 'assertion (broker JWT) required' }, { status: 422 });
  }

  // ── WIRE §2 step 1: pin alg === "EdDSA". Reject a header-derived alg / alg:none up front so an
  // alg-confusion or unsigned token never reaches key resolution. (jose re-enforces via `algorithms`
  // below; this is the explicit first gate the spec mandates.) ──────────────────────────────────
  let alg: string | undefined;
  try {
    ({ alg } = decodeProtectedHeader(assertion));
  } catch {
    return NextResponse.json({ error: 'Malformed assertion header' }, { status: 422 });
  }
  if (alg !== 'EdDSA') {
    return NextResponse.json({ error: 'Assertion alg must be EdDSA' }, { status: 422 });
  }

  // Decode (UNVERIFIED) only to read `iss` — we need it to select which broker's JWKS validates the
  // signature. The value is re-bound cryptographically by jwtVerify(issuer) below, so trusting it for
  // key selection is safe; if `iss` isn't trusted we 403 before touching any crypto or the network.
  let unverified: ReturnType<typeof decodeJwt>;
  try {
    unverified = decodeJwt(assertion);
  } catch {
    return NextResponse.json({ error: 'Malformed assertion' }, { status: 422 });
  }
  const iss = typeof unverified.iss === 'string' ? unverified.iss : '';

  // ── WIRE §2 step 4 (also the key-selection gate): iss ∈ brokerTrust[]. ──────────────────────────
  const broker = (await getBrokerTrust()).find((b) => b.iss === iss);
  if (!broker) {
    return NextResponse.json({ error: 'Assertion issuer is not a trusted broker' }, { status: 403 });
  }

  const instanceId = await getInstanceId();

  // ── WIRE §2 steps 2,3,5,6: resolve kid against the broker JWKS (fetched through the §1 SSRF guard —
  // the jwksUrl is admin-editable, finding #6), verify the signature (alg pinned to EdDSA), then jose
  // validates claims — iss (4, re-checked), aud (5), and exp/iat (6): `requiredClaims` rejects a token
  // missing any mandatory claim and `maxTokenAge:'90s'` bounds a held / far-future-`exp` assertion to
  // ≤90s from issuance, with ≤30s skew (finding #7). A tampered/forged/expired/too-old token, an
  // unknown kid, a missing claim, or a wrong audience all fail here. ────────────────────────────────
  let payload: JWTPayload;
  try {
    ({ payload } = await verifyBrokerAssertion(assertion, createGuardedRemoteJWKSet(broker.jwksUrl), {
      issuer: iss,
      audience: instanceId,
    }));
  } catch (err) {
    // aud mismatch → 403 (WIRE §8); everything else (bad signature, unknown kid, expired, wrong alg,
    // other malformed claims) → 422. iss can't mismatch here (we passed the trusted value).
    if (err instanceof joseErrors.JWTClaimValidationFailed && err.claim === 'aud') {
      return NextResponse.json({ error: 'Assertion audience is not this instance' }, { status: 403 });
    }
    if (err instanceof joseErrors.JWTClaimValidationFailed && err.claim === 'iss') {
      return NextResponse.json({ error: 'Assertion issuer is not a trusted broker' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Assertion failed validation' }, { status: 422 });
  }

  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  const jti = typeof payload.jti === 'string' ? payload.jti.trim() : '';
  if (!sub || !jti) {
    return NextResponse.json({ error: 'Assertion missing sub or jti' }, { status: 422 });
  }

  // ── WIRE §2 step 7 + finding #5: the single-use jti check runs BEFORE the per-member budget, so a
  // replay is a 409 that does NOT drain the victim member's rate-limit bucket (replaying one captured
  // assertion 30× would otherwise exhaust `sub`'s exchange budget before ever reaching the replay
  // check). gateReplayThenBudget consumes the member budget ONLY on a fresh assertion. finding #7
  // follow-up: the jti only needs to outlive the token's replay window — maxTokenAge already caps
  // usefulness to ≤90s from iat (+30s skew), so cap the row at now+120s regardless of a
  // (compromised-broker) far-future exp, preventing long-lived federation_jti bloat. ────────────────
  const rawExpMs = typeof payload.exp === 'number' ? payload.exp * 1000 : Date.now() + 90_000;
  const gate = await gateReplayThenBudget({
    recordJti: () => recordFederationJti(jti, new Date(Math.min(rawExpMs, Date.now() + 120_000))),
    consumeBudget: () =>
      rateLimitByKey('federation-exchange', exchangeRateLimitKey(sub), { limit: 30, windowMs: 5 * 60 * 1000 }),
    budgetOk: (r) => r.ok,
  });
  if (gate.outcome === 'replay') {
    return NextResponse.json({ error: 'Assertion has already been used' }, { status: 409 });
  }
  if (gate.outcome === 'rate-limited') {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(gate.budget) });
  }
  const rl = gate.budget; // the successful per-member budget result — its headers ride on the response.

  // ── WIRE §2 step 8 begins: sticky federation ban (decision 4), keyed on discord_id. Blocks
  // re-exchange even after an admin Removed the guest row. ────────────────────────────────────────
  const ban = await db.query.federationBans.findFirst({ where: eq(federationBans.discordId, sub) });
  if (ban) {
    log.info('federation.exchange.banned', { instanceId, iss, sub });
    return NextResponse.json({ error: 'This identity is banned from federating here' }, { status: 403 });
  }

  // Map sub → local identity. A pre-existing site user for this discord_id anchors ownership; a
  // site-banned user is refused (mirrors /token and the OAuth door), independent of the federation ban.
  const existingUser = await db.query.users.findFirst({
    where: eq(users.discordId, sub),
    columns: { id: true, banned: true },
  });
  if (existingUser?.banned) {
    return NextResponse.json({ error: 'Account is banned' }, { status: 403 });
  }

  // Membership = an active, non-guest clan_member owned by that user (roster is the source of truth).
  const memberRows = existingUser
    ? await db
        .select({ id: clanMembers.id, isPrimary: clanMembers.isPrimary })
        .from(clanMembers)
        .where(
          and(
            eq(clanMembers.userId, existingUser.id),
            eq(clanMembers.isGuest, 0),
            isNull(clanMembers.leftAt),
          ),
        )
    : [];

  if (memberRows.length > 0) {
    // Existing member → full plugin token (board:read + events:write). Pin to their primary member.
    const primary = memberRows.find((m) => m.isPrimary === 1) ?? memberRows[0];
    const scopes: FederationScope[] = ['board:read', 'events:write'];
    const { token, tokenId } = await mintFederationToken({
      userId: existingUser!.id,
      discordId: sub,
      memberId: primary.id,
      scopes,
    });

    // Association push (decision 2): confirm "member here" to the asserting broker. Fire-and-forget.
    void pushAssociation(sub, broker.iss);

    db.insert(clanAuditLog)
      .values({
        clanMemberId: primary.id,
        eventType: 'federation_exchange',
        actorUserId: existingUser!.id,
        newValue: JSON.stringify({ via: 'exchange', iss, tokenId, guest: false }),
        notes: 'Broker assertion exchanged for a federation token',
      })
      .catch(() => {});

    log.info('federation.exchange.member', { instanceId, iss, memberId: primary.id, tokenId });
    return NextResponse.json(
      { token, tokenId, scopes, instanceId, guest: false, memberId: primary.id },
      { headers: rateLimitHeaders(rl) },
    );
  }

  // ── Non-member: apply exchangePolicy (decision 4, default auto-guest). ──────────────────────────
  const policy = await getExchangePolicy();

  if (policy === 'reject') {
    return NextResponse.json({ error: 'Not a member of this clan' }, { status: 403 });
  }

  if (policy === 'request-to-join') {
    // No token, no guest row: the identity is held pending an admin decision. The approval mechanism
    // (surfacing pending requests, promoting to member) is a later admin track; we intentionally
    // create no orphan state here. The plugin should treat this as "pending, retry later".
    log.info('federation.exchange.request-to-join', { instanceId, iss, sub });
    return NextResponse.json(
      { status: 'request-to-join', guest: false, instanceId },
      { headers: rateLimitHeaders(rl) },
    );
  }

  // policy === 'auto-guest'. Separately rate-limit guest CREATION (WIRE §8) — also PER MEMBER (finding
  // #14), so one member spamming a home relay can't exhaust guest creation for the whole clan. A
  // spammed clan can still flip exchangePolicy off on its own site; this caps the blast radius meanwhile.
  const grl = await rateLimitByKey('federation-guest', guestRateLimitKey(sub), { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!grl.ok) {
    return NextResponse.json({ error: 'Too many guest creations' }, { status: 429, headers: rateLimitHeaders(grl) });
  }

  const guest = await ensureFederationGuest(sub, existingUser?.id ?? null);

  // Apply/prune the member's per-clan shared RSNs (see applySharedAccounts — guest rows only, hard
  // no-takeover rules). `accounts` present-but-empty still runs: that's how revocation propagates.
  if (body.accounts !== undefined) {
    await applySharedAccounts(sub, guest.id, body.accounts).catch((e) =>
      log.warn('federation.exchange.shared-accounts-fail', { memberId: guest.id }, e),
    );
  }

  // Inert = read-only. A guest token is board:read ONLY — never events:write — so even a bug that
  // put it on a team couldn't credit a tile. Belt to the "never on a team" structural guarantee.
  const scopes: FederationScope[] = ['board:read'];
  const { token, tokenId } = await mintFederationToken({
    userId: existingUser?.id ?? null,
    discordId: sub,
    memberId: guest.id,
    scopes,
  });

  void pushAssociation(sub, broker.iss);

  if (guest.created) {
    db.insert(clanAuditLog)
      .values({
        clanMemberId: guest.id,
        eventType: 'federation_guest_created',
        newValue: JSON.stringify({ via: 'exchange', iss, discordId: sub, tokenId }),
        notes: 'Auto-guest created from broker assertion (inert — not on any team)',
      })
      .catch(() => {});
  }

  log.info('federation.exchange.guest', { instanceId, iss, memberId: guest.id, created: guest.created, tokenId });
  return NextResponse.json(
    { token, tokenId, scopes, instanceId, guest: true, memberId: guest.id },
    { headers: rateLimitHeaders(rl) },
  );
}
