import { db } from '@/db';
import { clanMembers, eventSignups, events, signupFees } from '@/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { verifyUser } from '@/lib/auth';
import { parseProfile, signupWindowState, signupEditState } from '@/lib/signup';
import { countApprovedSignups, computePrizePool } from '@/lib/prizePool';
import PrizePoolHero from '@/components/PrizePoolHero';
import SignupForm from './SignupForm';

export const dynamic = 'force-dynamic';

export default async function EventSignupPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  if (!Number.isFinite(id)) notFound();

  const session = await verifyUser();
  if (!session) {
    redirect(`/login?return=/events/${eventId}/signup`);
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) notFound();

  const myAccounts = await db
    .select({
      id: clanMembers.id,
      rsn: clanMembers.rsn,
      isPrimary: clanMembers.isPrimary,
      verifiedAt: clanMembers.verifiedAt,
      verificationMethod: clanMembers.verificationMethod,
      provisional: clanMembers.provisional,
    })
    .from(clanMembers)
    .where(
      and(
        eq(clanMembers.userId, session.userId),
        isNull(clanMembers.leftAt),
      ),
    )
    .orderBy(desc(clanMembers.isPrimary), desc(clanMembers.verifiedAt));

  const signup = await db.query.eventSignups.findFirst({
    where: and(eq(eventSignups.eventId, id), eq(eventSignups.userId, session.userId)),
  });

  const fee = signup
    ? await db.query.signupFees.findFirst({ where: eq(signupFees.signupId, signup.id) })
    : null;

  let prefillProfile = signup ? parseProfile(signup.profileData) : {};
  let prefillClanMemberId = signup?.clanMemberId ?? null;
  if (!signup) {
    const prior = await db.query.eventSignups.findFirst({
      where: eq(eventSignups.userId, session.userId),
      orderBy: (s, { desc }) => [desc(s.signedUpAt)],
    });
    if (prior) {
      prefillProfile = parseProfile(prior.profileData);
      prefillClanMemberId = prior.clanMemberId;
    }
  }

  // An existing, non-withdrawn sign-up is in "edit" mode, so it gets the payment-deadline
  // grace window; everyone else (new sign-up, or re-joining after withdrawal) uses the
  // normal sign-up window.
  const isEditingActive = !!signup && signup.status !== 'withdrawn';
  const window = isEditingActive
    ? signupEditState({
        signupOpensAt: event.signupOpensAt,
        signupDeadline: event.signupDeadline,
        startDate: event.startDate,
        paymentDeadline: event.paymentDeadline,
      })
    : signupWindowState({
        signupOpensAt: event.signupOpensAt,
        signupDeadline: event.signupDeadline,
        startDate: event.startDate,
      });

  const approvedCount = await countApprovedSignups(id);
  const prizePool = computePrizePool({
    addedPrizePool: event.addedPrizePool,
    signupFee: event.signupFee,
    approvedCount,
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1 h-7 bg-gold rounded-full" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gold break-words min-w-0">Sign up: {event.name}</h1>
      </div>
      <p className="text-sm text-text-muted mb-6">
        One sign-up per Discord account. Pick the RSN you&apos;ll play with — that&apos;s the
        only account that&apos;ll be tracked for this event.
      </p>

      <PrizePoolHero
        prizePool={prizePool}
        signupFee={event.signupFee}
        addedPrizePool={event.addedPrizePool}
        approvedCount={approvedCount}
      />

      <SignupForm
        eventId={event.id}
        event={{
          signupFee: event.signupFee,
          signupOpensAt: event.signupOpensAt,
          signupDeadline: event.signupDeadline,
          captainSelectionDeadline: event.captainSelectionDeadline,
          startDate: event.startDate,
        }}
        myAccounts={myAccounts}
        existingSignup={
          signup
            ? {
                id: signup.id,
                clanMemberId: signup.clanMemberId,
                status: signup.status,
                profile: parseProfile(signup.profileData),
                signedUpAt: signup.signedUpAt,
                updatedAt: signup.updatedAt,
              }
            : null
        }
        fee={fee ?? null}
        prefillClanMemberId={prefillClanMemberId}
        prefillProfile={prefillProfile}
        windowOpen={window.open}
        windowReason={window.reason}
      />
    </div>
  );
}
