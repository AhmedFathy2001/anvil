// Making a clan.
//
// This used to be provisioning: reserve a row, take a payment, build a container, mount a volume,
// generate secrets, register a Discord app, invite a bot, wait for it to come up, flip it live. It
// is now an INSERT and a grant, and that difference is most of the point of the conversion.
//
// WHAT DISAPPEARED, and why none of it is missed:
//   - the container, volume and per-clan secrets — there is one deployment
//   - the payment gate — a clan starts free, so there is nothing to wait for
//   - the per-clan Discord app and bot invite — one shared app, one shared bot
//   - the awaiting_payment / provisioning states — the clan is simply there
//
// What remains is the part that was always the real work: the name has to be free, and somebody has
// to own it. The naming RULES live in lib/clanNames, which has no database import; this file is the
// half that has to ask.

import { and, eq, ne } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clanStaff, clans } from '@/db/schema';
import { PLANS } from '@/lib/plans';
import { newCheckoutRef } from '@/lib/billing';
import {
  availabilityMessage,
  domainRuleFailure,
  normalizeSlug,
  slugRuleFailure,
  type AvailabilityResult,
} from '@/lib/clanNames';

export { availabilityMessage } from '@/lib/clanNames';
export type { AvailabilityResult } from '@/lib/clanNames';

/** Is this subdomain free? Format and reserved list first, then not already a clan. */
export async function checkSlug(slug: string, exceptClanId?: number): Promise<AvailabilityResult> {
  const s = normalizeSlug(slug);
  const ruleFailure = slugRuleFailure(s);
  if (ruleFailure) return ruleFailure;

  const existing = await db.query.clans.findFirst({
    where: exceptClanId ? and(eq(clans.slug, s), ne(clans.id, exceptClanId)) : eq(clans.slug, s),
  });
  // No "reclaimable reservation" case any more: there are no unpaid placeholder rows to reclaim,
  // because a clan is never created pending a payment. A slug that exists is taken.
  return existing ? { ok: false, reason: 'taken' } : { ok: true };
}

/** The same for a custom domain. */
export async function checkDomain(domain: string, exceptClanId?: number): Promise<AvailabilityResult> {
  const d = normalizeSlug(domain);
  if (!d) return { ok: true };
  const ruleFailure = domainRuleFailure(d);
  if (ruleFailure) return ruleFailure;

  const existing = await db.query.clans.findFirst({
    where: exceptClanId
      ? and(eq(clans.customDomain, d), ne(clans.id, exceptClanId))
      : eq(clans.customDomain, d),
  });
  return existing ? { ok: false, reason: 'taken' } : { ok: true };
}

export interface CreateClanInput {
  slug: string;
  name: string;
  inGameName?: string | null;
  /** The person creating it. They become its owner. */
  ownerUserId: number;
  contactEmail?: string | null;
}

export type CreateClanResult =
  | { ok: true; clanId: number; slug: string }
  | { ok: false; error: string };

/**
 * Create a clan and give it an owner, in one transaction.
 *
 * THE GRANT IS NOT OPTIONAL AND NOT DEFERRED. A clan whose creation succeeded but whose owner grant
 * failed is the ownerless deadlock — the transfer flow needs a current owner to move ownership, so
 * nobody inside the clan could ever fix it. theafkspot arrived in exactly that state by another
 * route, which is how we know it is not hypothetical. One transaction means the clan and its owner
 * exist together or not at all.
 */
export async function createClan(input: CreateClanInput): Promise<CreateClanResult> {
  const slug = normalizeSlug(input.slug);
  // The in-game clan name is now the required one — roster sync matches on it, so a clan without it
  // can never receive a roster. The display name is optional and reuses the in-game name when blank.
  const inGameName = input.inGameName?.trim() || null;
  if (!inGameName) {
    return { ok: false, error: 'Enter your in-game clan name — roster sync needs it to match your clan.' };
  }
  const name = input.name.trim() || inGameName;

  const avail = await checkSlug(slug);
  if (!avail.ok) return { ok: false, error: availabilityMessage('Address', avail) };

  try {
    return await db.transaction(async (tx) => {
      const [clan] = await tx
        .insert(clans)
        .values({
          slug,
          name,
          inGameName,
          contactEmail: input.contactEmail?.trim().toLowerCase() || null,
          // Free and active from the first moment. Nothing to pay for, nothing to wait for.
          plan: 'free',
          memberCap: PLANS.free.memberCap,
          status: 'active',
          // The stable token that ties this clan to any future Gumroad checkout (lib/billing).
          gumroadRef: newCheckoutRef(),
        })
        .returning();

      await tx.insert(clanStaff).values({
        clanId: clan.id,
        userId: input.ownerUserId,
        role: 'owner',
        canEditTiles: true,
      });

      await tx.insert(clanAuditLog).values({
        clanId: clan.id,
        eventType: 'clan_created',
        actorUserId: input.ownerUserId,
        newValue: JSON.stringify({ slug, name, plan: 'free' }),
      });

      return { ok: true as const, clanId: clan.id, slug };
    });
  } catch (e) {
    // The unique index on slug is the real arbiter: two people can pass checkSlug at the same moment
    // and only one insert can win. Reported as "taken" rather than a server error, because from the
    // loser's point of view that is exactly what happened.
    if ((e as { cause?: { code?: string } }).cause?.code === '23505') {
      return { ok: false, error: 'That subdomain was just taken — pick another.' };
    }
    throw e;
  }
}
