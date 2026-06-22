import { db } from '@/db';
import { events, tiles, teams, completions, eventSignups, clanMembers } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ScoreboardClient from './ScoreboardClient';
import { verifyUser } from '@/lib/auth';
import { signupWindowState } from '@/lib/signup';
import { getTierBands } from '@/lib/pluginConfig';

export const dynamic = 'force-dynamic';

export default async function EventScoreboardPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  const event = await db.query.events.findFirst({
    where: eq(events.id, id),
  });
  if (!event) notFound();

  const eventTiles = await db.select().from(tiles).where(eq(tiles.eventId, id));
  const eventTeams = await db.select().from(teams).where(eq(teams.eventId, id));
  const tierBands = await getTierBands();

  const tileIds = eventTiles.map((t) => t.id);
  let eventCompletions: { id: number; teamId: number; tileId: number; completedAt: string }[] = [];
  if (tileIds.length > 0) {
    const allCompletions = await db.select().from(completions);
    eventCompletions = allCompletions.filter((c) => tileIds.includes(c.tileId));
  }

  const safeTeams = eventTeams.map(({ captainPassword: _, ...rest }) => rest);

  // Sign-up CTA — server-side so the right banner shows on first paint without a client
  // round-trip. We need the viewer's session, their existing signup (if any), and whether
  // they have any verified RSNs at all (controls the banner's primary action).
  const session = await verifyUser();
  const window = signupWindowState({
    signupOpensAt: event.signupOpensAt,
    signupDeadline: event.signupDeadline,
    startDate: event.startDate,
  });

  let mySignup: { status: string } | null = null;
  let hasVerifiedAccount = false;
  if (session) {
    const sig = await db.query.eventSignups.findFirst({
      where: and(eq(eventSignups.eventId, id), eq(eventSignups.userId, session.userId)),
    });
    mySignup = sig ? { status: sig.status } : null;

    const verifiedCount = await db
      .select({ id: clanMembers.id })
      .from(clanMembers)
      .where(
        and(
          eq(clanMembers.userId, session.userId),
          isNull(clanMembers.leftAt),
        ),
      )
      .limit(1);
    hasVerifiedAccount = verifiedCount.length > 0;
  }

  // Hide the board from non-staff viewers until sign-ups open. Staff (admin /
  // treasurer / moderator) always see it so they can finish configuring tiles
  // ahead of the public launch. Once sign-ups are open everyone sees the board,
  // including the period between sign-ups closing and the event starting.
  const isStaff = session?.role === 'admin' || session?.role === 'treasurer' || session?.role === 'moderator';
  const hideBoardFromPlayer = !isStaff && window.reason === 'not_open_yet';

  return (
    <>
      <SignupBanner
        eventId={event.id}
        loggedIn={!!session}
        mySignup={mySignup}
        hasVerifiedAccount={hasVerifiedAccount}
        windowOpen={window.open}
        windowReason={window.reason}
        signupFee={event.signupFee}
      />
      {hideBoardFromPlayer ? (
        <div className="border border-dashed border-card-border rounded-xl p-10 text-center text-text-muted">
          <p className="text-lg font-semibold mb-1">The board is hidden until sign-ups open</p>
          {event.signupOpensAt && (
            <p className="text-sm">Opens {new Date(event.signupOpensAt).toLocaleString()}.</p>
          )}
        </div>
      ) : (
        <ScoreboardClient
          event={event}
          tiles={eventTiles}
          teams={safeTeams}
          completions={eventCompletions}
          tierBands={tierBands}
        />
      )}
    </>
  );
}

function SignupBanner({
  eventId,
  loggedIn,
  mySignup,
  hasVerifiedAccount,
  windowOpen,
  windowReason,
  signupFee,
}: {
  eventId: number;
  loggedIn: boolean;
  mySignup: { status: string } | null;
  hasVerifiedAccount: boolean;
  windowOpen: boolean;
  windowReason: string | null;
  signupFee: number | null;
}) {
  // Don't show anything once the event is underway and the viewer isn't already signed up —
  // the banner is just noise at that point.
  if (windowReason === 'event_started' && !mySignup) return null;

  const isActiveSignup = mySignup && mySignup.status !== 'withdrawn';

  let title: string;
  let body: string;
  let ctaLabel: string | null = '/events/' + eventId + '/signup';
  let ctaText: string;
  let tone: 'info' | 'success' | 'muted' = 'info';

  if (isActiveSignup) {
    title = "You're signed up";
    body = 'Edit your details before the deadline.';
    ctaText = 'Manage sign-up';
    tone = 'success';
  } else if (!windowOpen) {
    title = windowReason === 'closed' ? 'Sign-ups closed' : 'Sign-ups not open yet';
    body =
      windowReason === 'closed'
        ? 'The deadline has passed.'
        : 'Check back when the window opens.';
    ctaLabel = null;
    ctaText = '';
    tone = 'muted';
  } else if (!loggedIn) {
    title = 'Sign-ups are open';
    body = signupFee ? `Sign-up fee: ${signupFee.toLocaleString()} gp.` : 'Free to enter.';
    ctaText = 'Log in to sign up';
    ctaLabel = `/login?return=/events/${eventId}/signup`;
  } else if (!hasVerifiedAccount) {
    title = 'Verify an RSN to sign up';
    body = 'You need at least one verified RuneScape account before you can join.';
    ctaText = 'Go to profile';
    ctaLabel = '/profile';
  } else {
    title = 'Sign-ups are open';
    body = signupFee ? `Sign-up fee: ${signupFee.toLocaleString()} gp.` : 'Free to enter.';
    ctaText = 'Sign up';
  }

  const toneCls =
    tone === 'success'
      ? 'border-accent-green/30 bg-accent-green/10'
      : tone === 'muted'
        ? 'border-card-border bg-brown-dark'
        : 'border-gold/30 bg-gold/10';

  return (
    <div className={`mb-6 rounded-xl border p-4 flex items-center justify-between gap-4 ${toneCls}`}>
      <div className="min-w-0">
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-text-muted">{body}</div>
      </div>
      {ctaLabel && (
        <Link
          href={ctaLabel}
          className="text-sm font-medium px-4 py-2 rounded-lg border border-gold/30 text-gold bg-gold/10 hover:bg-gold/20 transition-colors shrink-0"
        >
          {ctaText}
        </Link>
      )}
    </div>
  );
}
