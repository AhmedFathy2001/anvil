import { count, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clans, errorEvents, feedback } from '@/db/schema';
import { billingStatus, subscriptionFacts } from '@/lib/clanBilling';
import { openCharacterReportCount } from '@/lib/characterReports';
import { pendingCount as pendingGuideProposals } from '@/lib/guideProposals';
import { pendingCount as pendingLibraryProposals } from '@/lib/libraryProposals';
import { nameCollisions } from '@/lib/platformView';

// What is waiting on a platform operator, counted — so the number can sit on the Platform link
// everywhere in the app instead of only inside /staff, where you had to already be to see it.
//
// Only things a person can clear count. A trial that ended and never paid is a fact, not a task —
// it would sit in the number forever and teach everyone to ignore it — so of the money states only
// the ones with a deadline or a fault are in: overdue, cancelling, and a trial ending this week.

export interface StaffPending {
  reports: number;
  guideProposals: number;
  libraryProposals: number;
  feedback: number;
  errors: number;
  billing: number;
  nameDisputes: number;
  total: number;
}

async function billingNeedingALook(now: number): Promise<number> {
  // clan-scope: global -- the platform's own view of every clan's billing.
  const rows = await db
    .select({
      plan: clans.plan,
      trialEndsAt: clans.trialEndsAt,
      currentPeriodEnd: clans.currentPeriodEnd,
      cancelAtPeriodEnd: clans.cancelAtPeriodEnd,
      gumroadSubscriptionId: clans.gumroadSubscriptionId,
    })
    .from(clans)
    .where(eq(clans.status, 'active'));
  return rows.filter((r) => {
    const b = billingStatus({ ...r, ...subscriptionFacts(r.gumroadSubscriptionId, r.plan) }, now);
    return b.state === 'lapsed' || b.state === 'cancelling' || (b.state === 'trialing' && b.attention);
  }).length;
}

async function compute(): Promise<StaffPending> {
  const now = Date.now();
  const [reports, guideProposals, libraryProposals, [fb], [errs], billing, disputes] = await Promise.all([
    openCharacterReportCount(),
    pendingGuideProposals(),
    pendingLibraryProposals(),
    // clan-scope: global -- feedback from every clan is triaged by the platform (/staff/feedback).
    db.select({ n: count() }).from(feedback).where(eq(feedback.status, 'open')),
    // clan-scope: global -- errors across every clan (/staff/errors).
    db.select({ n: count() }).from(errorEvents).where(isNull(errorEvents.resolvedAt)),
    billingNeedingALook(now),
    nameCollisions(),
  ]);
  const p = {
    reports,
    guideProposals,
    libraryProposals,
    feedback: Number(fb?.n ?? 0),
    errors: Number(errs?.n ?? 0),
    billing,
    nameDisputes: disputes.length,
  };
  return { ...p, total: Object.values(p).reduce((a, b) => a + b, 0) };
}

// Every page an operator opens asks for this, and none of it moves by the second. A minute's memo
// keeps it to one round of counts a minute however much they click around.
const TTL_MS = 60_000;
let memo: { at: number; value: Promise<StaffPending> } | null = null;

export function staffPending(): Promise<StaffPending> {
  if (memo && Date.now() - memo.at < TTL_MS) return memo.value;
  const value = compute();
  memo = { at: Date.now(), value };
  value.catch(() => {
    memo = null;
  });
  return value;
}

/** The breakdown in a line, for the badge's tooltip. */
export function pendingSummary(p: StaffPending): string {
  const parts: [number, string][] = [
    [p.billing, 'billing'],
    [p.reports, 'character reports'],
    [p.feedback, 'feedback'],
    [p.errors, 'errors'],
    [p.guideProposals, 'guide proposals'],
    [p.libraryProposals, 'library suggestions'],
    [p.nameDisputes, 'name disputes'],
  ];
  return parts.filter(([n]) => n > 0).map(([n, l]) => `${n} ${l}`).join(' · ') || 'Nothing waiting';
}
