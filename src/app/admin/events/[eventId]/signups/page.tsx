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
      {/* Waiting on the HOST: requests from players whose clan does not collect its own fees, and
          every request on a drafted board. The card renders nothing when none are — see
          lib/accountChangeRules for which of the two queues a request lands in. */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <AccountChangeCard eventId={id} />
        {/* What this board asks for is a sign-ups question, so it lives on the sign-ups tab. */}
        <SignupFieldsCard eventId={id} />
      </div>

      {/* The host's own questions — the same builder as the post-event survey, pointed at the other
          end of the event. Admin only, like the survey's. */}
      {session.role !== 'moderator' && (
        <div className="mb-4 rounded-xl border border-card-border bg-card-bg p-4">
          <SurveyClient
            eventId={id}
            stage="signup"
            ended={false}
            initialQuestions={signupQuestions}
            responseCount={0}
            templates={[]}
          />
        </div>
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
