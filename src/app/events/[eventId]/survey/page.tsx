import { db } from '@/db';
import { requireEventForPage } from '@/lib/eventScope';
import { events, eventSignups, surveyQuestions, surveyResponses } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { verifyUser } from '@/lib/auth';
import { isEventEnded, toQuestionView, type SurveyAnswerMap } from '@/lib/survey';
import SurveyResponseClient from './SurveyResponseClient';
import { atLeast } from '@/lib/clanRoles';
import ClanLink from '@/components/ClanLink';
import { clanHref } from '@/lib/clanPath';

export const dynamic = 'force-dynamic';

// A centered notice card for the states where the survey can't be filled out.
function Notice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="max-w-xl mx-auto mt-10 border border-dashed border-card-border rounded-xl p-8 text-center">
      <p className="text-lg font-semibold mb-1">{title}</p>
      {children && <div className="text-sm text-text-muted">{children}</div>}
    </div>
  );
}

export default async function EventSurveyPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  // Come back INSIDE the clan after logging in, not to the apex — the return is clan-prefixed.
  const surveyReturn = await clanHref(`/events/${eventId}/survey`);

  // Whose event is this? Ids are global and this one came from the URL.
  await requireEventForPage(id);
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) notFound();

  const qRows = await db.select().from(surveyQuestions).where(eq(surveyQuestions.eventId, id));
  const questions = qRows.sort((a, b) => a.position - b.position).map(toQuestionView);

  const header = (
    <div className="mb-6">
      <ClanLink href={`/events/${id}`} className="text-sm text-text-muted hover:text-gold transition-colors">← {event.name}</ClanLink>
      <h1 className="text-2xl font-bold text-gold mt-1">Event feedback</h1>
    </div>
  );

  if (questions.length === 0) {
    return <div>{header}<Notice title="No survey for this event">The host hasn’t set up a feedback survey.</Notice></div>;
  }

  const session = await verifyUser();
  const isStaff = atLeast(session?.role, 'admin') || session?.role === 'treasurer' || session?.role === 'moderator';
  const ended = isEventEnded(event);

  // Is this viewer an approved participant who can actually submit?
  const signup = session
    ? await db.query.eventSignups.findFirst({
        where: and(eq(eventSignups.eventId, id), eq(eventSignups.userId, session.userId)),
      })
    : null;
  const approved = signup?.status === 'approved';
  const canRespond = ended && approved;
  // Staff can preview the live participant form early (or when they aren't a participant themselves),
  // so they can see exactly what players get before the event closes. Preview can't submit.
  const canPreview = isStaff && !canRespond;

  if (!canRespond && !canPreview) {
    if (!session) {
      return (
        <div>{header}
          <Notice title={ended ? 'Log in to share your feedback' : 'The survey isn’t open yet'}>
            {ended ? (
              <>
                <ClanLink
                  href={`/login?return=${encodeURIComponent(surveyReturn)}`}
                  className="text-gold hover:underline"
                >
                  Log in
                </ClanLink>{' '}
                to fill out this survey.
              </>
            ) : (
              'It opens once the event has ended. Check back then.'
            )}
          </Notice>
        </div>
      );
    }
    if (!ended) {
      return <div>{header}<Notice title="The survey isn’t open yet">It opens once the event has ended. Check back then.</Notice></div>;
    }
    return <div>{header}<Notice title="This survey is for event participants">Only players with an approved sign-up for this event can fill it out.</Notice></div>;
  }

  // Prefill from an existing response so a participant can review/update it (skip for staff preview).
  const existing = canRespond
    ? await db.query.surveyResponses.findFirst({
        where: and(eq(surveyResponses.eventId, id), eq(surveyResponses.userId, session!.userId)),
      })
    : null;
  let prefill: SurveyAnswerMap = {};
  if (existing) {
    try {
      prefill = JSON.parse(existing.answers) as SurveyAnswerMap;
    } catch { /* ignore a malformed prior blob */ }
  }

  return (
    <div>
      {header}
      <SurveyResponseClient
        eventId={id}
        eventName={event.name}
        questions={questions}
        initialAnswers={prefill}
        alreadySubmitted={!!existing}
        preview={canPreview}
        previewNotEnded={canPreview && !ended}
      />
    </div>
  );
}
