import { db } from '@/db';
import { requireEventForPage } from '@/lib/eventScope';
import { requireClan } from '@/lib/clanContext';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { verifyAdminOrModerator, verifyEventTreasurer } from '@/lib/auth';
import { getRequiredConfirmations } from '@/lib/feeConfirmations';
import SignupsClient from './SignupsClient';
import { clanHref } from '@/lib/clanPath';
import AccountChangeCard from '@/components/AccountChangeCard';
import SignupFieldsCard from '../SignupFieldsCard';
import SurveyClient from '../survey/SurveyClient';
import { surveyQuestions } from '@/db/schema';
import { and } from 'drizzle-orm';
import { toQuestionView } from '@/lib/survey';

export const dynamic = 'force-dynamic';

export default async function EventSignupsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  // Clan staff, or whoever runs THIS board's money — the fees they were granted live on this tab.
  const session = (await verifyAdminOrModerator()) ?? (await verifyEventTreasurer(id));
  if (!session) redirect(await clanHref('/admin'));

  // Settings are per clan, so the clan has to be resolved before anything reads one.
  const clan = await requireClan();

  const [event, confirmationsRequired, signupQuestions] = await Promise.all([
    // Scoped, not fetched by bare id — see the layout for what that let through.
    requireEventForPage(id),
    getRequiredConfirmations(clan.id),
    // This board's own sign-up questions. Scoped to the stage, or the post-event survey would show
    // up in the sign-up builder and a save here would delete it.
    db
      .select()
      .from(surveyQuestions)
      .where(and(eq(surveyQuestions.eventId, id), eq(surveyQuestions.stage, 'signup')))
      .then((rows) => rows.sort((a, b) => a.position - b.position).map(toQuestionView)),
  ]);

  return (
    <>
      {/* WAITING ON YOU COMES FIRST, and nothing else does. A request to switch character is a
          person blocked until somebody answers; the card is absent entirely when none are waiting.
          `decide` because an admin's Sign-ups tab is not where somebody asks about their own
          character — that is the team page, where they are a player. */}
      <div className="mb-4">
        <AccountChangeCard eventId={id} mode="decide" />
      </div>

      {/* CONFIGURATION IS SHUT BY DEFAULT. This tab exists to read sign-ups, and three config cards
          stacked above the list pushed 27 of them below the fold — you had to scroll past the form
          builder to reach the thing the page is named after. It is set once and then rarely touched,
          so it folds away and the list leads. */}
      {session.role !== 'moderator' && (
        <details className="group mb-4 rounded-xl border border-card-border bg-card-bg">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold">
            <span className="h-5 w-1 rounded-full bg-gold" />
            The sign-up form
            <span className="ml-auto font-normal text-[13px] text-text-muted">
              {signupQuestions.length > 0
                ? `${signupQuestions.length} of your own question${signupQuestions.length === 1 ? '' : 's'}`
                : 'What it asks, and your own questions'}
            </span>
            <span className="text-text-dim transition-transform group-open:rotate-180" aria-hidden>
              ▾
            </span>
          </summary>

          <div className="space-y-6 border-t border-card-border px-4 py-4">
            <SignupFieldsCard eventId={id} />
            <SurveyClient
              eventId={id}
              stage="signup"
              ended={false}
              initialQuestions={signupQuestions}
              responseCount={0}
              templates={[]}
            />
          </div>
        </details>
      )}

      <SignupsClient
        event={event}
        viewerRole={session.role}
        viewerId={session.userId}
        confirmationsRequired={confirmationsRequired}
        signupQuestions={signupQuestions}
      />
    </>
  );
}
