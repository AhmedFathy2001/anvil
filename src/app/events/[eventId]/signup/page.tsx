import { db } from '@/db';
import { requireEventForPage } from '@/lib/eventScope';
import { clanRoster, eventSignups, events, signupFees, teamInvites, teams } from '@/db/schema';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { verifyUser } from '@/lib/auth';
import { parseProfile, signupWindowState, signupEditState } from '@/lib/signup';
import { checkInvite, isWellFormedToken } from '@/lib/teamInvites';
import { countApprovedSignups, computePrizePool } from '@/lib/prizePool';
import PrizePoolHero from '@/components/PrizePoolHero';
import SignupForm from './SignupForm';

export const dynamic = 'force-dynamic';

export default async function EventSignupPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const { eventId } = await params;
  const { invite: inviteToken } = await searchParams;
  const id = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  await requireEventForPage(id);
  if (!Number.isFinite(id)) notFound();

  const session = await verifyUser();
  if (!session) {
    redirect(`/login?return=/events/${eventId}/signup`);
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) notFound();

  // Arrived through a team's invite link (lib/teamInvites). The token is re-checked when the form
  // posts — this only decides whether to SAY where they're heading, so a stale link can't promise
  // a seat it no longer has.
  let invite: { token: string; teamName: string } | null = null;
  if (isWellFormedToken(inviteToken)) {
    const row = await db.query.teamInvites.findFirst({ where: eq(teamInvites.token, inviteToken!) });
    const window = signupWindowState({
      signupOpensAt: event.signupOpensAt,
      signupDeadline: event.signupDeadline,
      startDate: event.startDate,
    });
    if (checkInvite(row, { now: new Date().getTime(), eventId: id, signupsOpen: window.open }).ok && row) {
      const team = await db.query.teams.findFirst({ where: eq(teams.id, row.teamId) });
      if (team) invite = { token: row.token, teamName: team.name };
    }
  }

  const myAccounts = await db
    .select({
      id: clanRoster.id,
      rsn: clanRoster.rsn,
      isPrimary: clanRoster.isPrimary,
      verifiedAt: clanRoster.verifiedAt,
      verificationMethod: clanRoster.verificationMethod,
      provisional: clanRoster.provisional,
    })
    .from(clanRoster)
    .where(
      and(
        eq(clanRoster.playerId, session.playerId),
        isNull(clanRoster.leftAt),
      ),
    )
    .orderBy(desc(clanRoster.isPrimary), desc(clanRoster.verifiedAt));

  const maxAccounts = event.maxAccountsPerPerson ?? 1;

  // All of this user's sign-up rows for the event (multi-account: possibly several). The profile lives
  // on ONE row (the primary account's); siblings carry '{}'. Pick that row as the representative for
  // prefill + status/withdraw banners, falling back to any active row (or any row when fully withdrawn).
  const allSignups = await db.query.eventSignups.findMany({
    where: and(eq(eventSignups.eventId, id), eq(eventSignups.userId, session.userId)),
  });
  const activeSignups = allSignups.filter((s) => s.status !== 'withdrawn');
  const signup =
    activeSignups.find((s) => s.profileData && s.profileData !== '{}') ??
    activeSignups[0] ??
    allSignups[0] ??
    null;
  const signedUpMemberIds = activeSignups.map((s) => s.clanMemberId);

  const fee = signup
    ? await db.query.signupFees.findFirst({ where: eq(signupFees.signupId, signup.id) })
    : null;

  // Multi-account per-account fee mode: a person owes a fee per entered account. Load them all (with
  // the account RSN) so the form can show each one's amount + status. Per-person mode has a single fee
  // (already `fee` above), so this list stays length ≤ 1 and the form hides it.
  const accountFees = activeSignups.length
    ? (
        await db
          .select({ amount: signupFees.amount, status: signupFees.status, rsn: clanRoster.rsn })
          .from(signupFees)
          .innerJoin(eventSignups, eq(signupFees.signupId, eventSignups.id))
          .leftJoin(clanRoster, eq(eventSignups.clanMemberId, clanRoster.id))
          .where(inArray(signupFees.signupId, activeSignups.map((s) => s.id)))
      ).map((f) => ({ rsn: f.rsn ?? 'Account', amount: f.amount, status: f.status }))
    : [];

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
        {maxAccounts > 1
          ? `Pick up to ${maxAccounts} of your linked accounts — they all play on the same team, and every one is tracked for this event.`
          : "One sign-up per Discord account. Pick the RSN you'll play with — that's the only account that'll be tracked for this event."}
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
        maxAccounts={maxAccounts}
        signedUpMemberIds={signedUpMemberIds}
        accountFees={accountFees}
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
        invite={invite}
        prefillClanMemberId={prefillClanMemberId}
        prefillProfile={prefillProfile}
        windowOpen={window.open}
        windowReason={window.reason}
      />
    </div>
  );
}
