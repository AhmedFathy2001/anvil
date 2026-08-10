import { NextResponse } from 'next/server';
import {
  decodeJwt,
  decodeProtectedHeader,
  errors as joseErrors,
  type JWTPayload,
} from 'jose';
import { db } from '@/db';
import { users, clanMembers, federationBans, clanAuditLog } from '@/db/schema';
import { and, asc, desc, eq, isNull, ne } from 'drizzle-orm';
import { normalizeRsn } from '@/lib/auth';
import { rateLimitByKey, rateLimitHeaders } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/federationSecurity';
import { getBrokerBaseUrl, getBrokerTrust, getExchangePolicy, getFederationEnabled } from '@/lib/pluginConfig';
import { createGuardedRemoteJWKSet, verifyBrokerAssertion } from '@/lib/federationJwks';
import {
  anchorRenamable,
  classifySharedRsnClaim,
  exchangeRateLimitKey,
  guestRateLimitKey,
  planGuestConflict,
  guestConflictExhausted,
  gateReplayThenBudget,
} from '@/lib/federationDecisions';
import {
  EXCHANGE_TOKEN_LABEL,
  ensureBrokerTrusted,
  getInstanceId,
  mintFederationToken,
  pruneExchangeTokens,
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
// class, see classifySharedRsnClaim): a shared RSN may only ever land on a FEDERATION GUEST row of
// this same discordId — it never binds to, renames, or reactivates anyone ELSE's row; such a
// collision is audit-logged and skipped. A row the SAME identity already holds through a stronger
// path (account-token link, claimed roster row) satisfies the claim as-is — nothing to do, and no
// scary conflict audit for a member colliding with themselves. The set is authoritative per
// exchange: federation guests whose RSN is no longer shared are pruned (soft-left) and a
// placeholder anchor reverts to its placeholder name — revocation at home propagates here on the
// next relay. An ADOPTED anchor (a real row, see ensureFederationGuest) is never renamed/reverted.
// Runs on BOTH exchange paths — member and auto-guest. The rules below are keyed on the ROW the
// claim lands on, never on which path called, so a member sharing an alt gets the same treatment.

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
  ownerUserId: number | null,
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

  // Who holds this normalized RSN, and what is the shared-RSN claim allowed to do about it?
  // (classifySharedRsnClaim: free / own-guest / satisfied / conflict.)
  const claimOn = async (
    norm: string,
  ): Promise<{ claim: ReturnType<typeof classifySharedRsnClaim>; row: { id: number; leftAt: string | null } | null }> => {
    const row = await db.query.clanMembers.findFirst({
      where: eq(clanMembers.rsnNormalized, norm),
      columns: { id: true, leftAt: true, isGuest: true, discordId: true, userId: true, source: true },
    });
    return { claim: classifySharedRsnClaim(row, discordId, ownerUserId), row: row ?? null };
  };

  // 1. A PLACEHOLDER anchor (the disposable federation row the token is bound to) carries the
  //    primary RSN — or reverts to the placeholder name when nothing is shared any more. An ADOPTED
  //    anchor is the member's real row here and is never renamed or reverted by a federated claim.
  //    (anchorRenamable — placeholder only; a real or promoted row is never renamed.)
  const anchor = await db.query.clanMembers.findFirst({
    where: eq(clanMembers.id, anchorGuestId),
    columns: { id: true, rsnNormalized: true, source: true, isGuest: true },
  });
  if (!anchor) return;
  const primary = shared.find((a) => a.primary) ?? shared[0] ?? null;
  const desiredRsn = primary ? primary.rsn : placeholderRsn;
  const desiredNorm = primary ? normalizeRsn(primary.rsn) : placeholderNorm;
  // The name the anchor ends up holding — step 2 skips creating a sibling row for it.
  let anchorNorm = anchor.rsnNormalized;
  if (anchorRenamable(anchor) && anchor.rsnNormalized !== desiredNorm) {
    const { claim, row } = await claimOn(desiredNorm);
    if (claim === 'conflict') {
      conflictAudit(desiredRsn);
    } else if (claim !== 'satisfied') {
      // 'free' or 'own-guest'. A stale sibling guest already holding the name must vacate first
      // (unique rsn_normalized).
      if (row && row.id !== anchor.id) {
        await db
          .update(clanMembers)
          .set({ leftAt: nowIso })
          .where(eq(clanMembers.id, row.id));
      }
      await db
        .update(clanMembers)
        .set({
          rsn: desiredRsn,
          rsnNormalized: desiredNorm,
          verificationMethod: primary ? 'federation' : null,
        })
        .where(eq(clanMembers.id, anchor.id));
      anchorNorm = desiredNorm;
    }
  }

  // 2. Other shared accounts each get their own federation-guest row (same discord identity).
  for (const account of shared) {
    const norm = normalizeRsn(account.rsn);
    if (norm === anchorNorm) continue; // the anchor already carries it
    const { claim, row } = await claimOn(norm);
    if (claim === 'conflict') {
      conflictAudit(account.rsn);
      continue;
    }
    if (claim === 'satisfied') continue; // already theirs here via a stronger row — nothing to do
    if (claim === 'own-guest' && row) {
      if (row.leftAt) {
        await db.update(clanMembers).set({ leftAt: null }).where(eq(clanMembers.id, row.id));
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

// Find-or-create the anchor row a guest exchange binds its token to (decision 4 / FEDERATION.md
// guardrail 1). ADOPTION FIRST: an identity that already has a real, active row here — linked via
// account token, a claimed roster row — anchors to THAT row instead of getting a `guest:<discordId>`
// placeholder manufactured next to it (which sat in the roster and the member's profile as a
// confusing stranger). Only an identity with no rows at all gets the synthetic placeholder. Any
// leftover placeholder from before an adoptable row existed is retired (soft-left) on the way.
// INERTNESS GUARANTEE: this only ever writes clan_members rows — it NEVER touches `players`, teams,
// or the draft, so an exchange-anchored guest is structurally unable to be on a team, credit a tile,
// or submit (and the guest token stays board:read-scoped regardless of which row anchors it).
// Idempotent: a repeat exchange resolves to the same row.
async function ensureFederationGuest(
  discordId: string,
  ownerUserId: number | null,
): Promise<{ id: number; created: boolean }> {
  const rsn = guestRsnFor(discordId);
  const rsnNormalized = normalizeRsn(rsn);

  // Adoption: a row is adoptable when it's owned by this identity's site user, or — for an identity
  // with no site user here — carries this discord_id and is unowned (never someone else's row).
  const adoptable = await db.query.clanMembers.findFirst({
    where: and(
      ownerUserId != null
        ? eq(clanMembers.userId, ownerUserId)
        : and(eq(clanMembers.discordId, discordId), isNull(clanMembers.userId)),
      isNull(clanMembers.leftAt),
      ne(clanMembers.rsnNormalized, rsnNormalized),
    ),
    orderBy: [desc(clanMembers.isPrimary), asc(clanMembers.id)],
    columns: { id: true },
  });
  if (adoptable) {
    // Retire a lingering placeholder (idempotent — matches nothing once it's gone).
    await db
      .update(clanMembers)
      .set({ leftAt: new Date().toISOString() })
      .where(and(eq(clanMembers.rsnNormalized, rsnNormalized), isNull(clanMembers.leftAt)));
    return { id: adoptable.id, created: false };
  }

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
  let trust = await getBrokerTrust();
  // Self-heal an EMPTY trust list. Trust is normally seeded when the admin joins the network, but a
  // register call that failed then (broker down / no FEDERATION_BROKER_URL yet) left federation "on"
  // with nothing trusted — and this exact 403 is how that presents: no other clan can ever connect,
  // and nothing on the receiving side ever retried. Re-assert the CONFIGURED broker before deciding.
  //
  // This cannot be steered: the value added comes from server config (env / admin setting) and is
  // never taken from the request, so an assertion from an untrusted issuer still fails below. Only
  // fires when the list is empty, so a clan that deliberately curates its trust set is untouched.
  if (trust.length === 0) {
    const configuredBroker = await getBrokerBaseUrl();
    if (configuredBroker) {
      await ensureBrokerTrusted(configuredBroker).catch(() => {});
      trust = await getBrokerTrust();
      log.info('federation.exchange.trust-repaired', { iss: configuredBroker });
    }
  }
  const broker = trust.find((b) => b.iss === iss);
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

    // Shares apply to MEMBERS too. This path used to return before applySharedAccounts ever ran, so
    // "Share my RSN" was a silent no-op in the most common case of all — a member of both clans
    // sharing an alt with the clan they're already in. Safe here because the claim rules are
    // row-driven, not path-driven: step 1 no-ops on a non-guest anchor (their real row is never
    // renamed), their own accounts classify 'satisfied', anyone else's 'conflict', and only genuinely
    // new RSNs become inert federation-guest rows. Step 3's prune is what makes un-sharing revoke.
    if (body.accounts !== undefined) {
      await applySharedAccounts(sub, primary.id, body.accounts, existingUser!.id).catch((e) =>
        log.warn('federation.exchange.shared-accounts-fail', { memberId: primary.id }, e),
      );
    }

    const scopes: FederationScope[] = ['board:read', 'events:write'];
    const { token, tokenId } = await mintFederationToken({
      userId: existingUser!.id,
      discordId: sub,
      memberId: primary.id,
      scopes,
      label: EXCHANGE_TOKEN_LABEL,
    });
    // Every re-mint supersedes this home's previous relay token — sweep the backlog (keep newest few
    // for multi-homing). Fire-and-forget: pruning must never delay or fail the exchange.
    void pruneExchangeTokens(sub)
      .then((n) => {
        if (n > 0) log.info('federation.exchange.token-prune', { sub, pruned: n });
      })
      .catch(() => {});

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

  // Apply/prune the member's per-clan shared RSNs (see applySharedAccounts — federation rows only,
  // hard no-takeover rules). `accounts` present-but-empty still runs: that's how revocation propagates.
  if (body.accounts !== undefined) {
    await applySharedAccounts(sub, guest.id, body.accounts, existingUser?.id ?? null).catch((e) =>
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
    label: EXCHANGE_TOKEN_LABEL,
  });
  // Sweep this identity's superseded relay tokens (see the member path above for why).
  void pruneExchangeTokens(sub)
    .then((n) => {
      if (n > 0) log.info('federation.exchange.token-prune', { sub, pruned: n });
    })
    .catch(() => {});

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
