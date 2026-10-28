import { notFound } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import { verifyUser } from '@/lib/auth';
import { canSeeClan } from '@/lib/clanAccess';
import { requireClan } from '@/lib/clanContext';
import { liveClanEvent } from '@/lib/clanEventSignups';
import { surveyFor } from '@/lib/clanEventSurvey';
import { idParam } from '@/lib/routeIds';

import SurveyResponseClient from '../../../events/[eventId]/survey/SurveyResponseClient';

export const dynamic = 'force-dynamic';

/** A clan event's survey (lib/clanEventSurvey): about the occurrence that just ended, once per person. */
export default async function ClanEventSurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const id = idParam((await params).id);
  const [clan, user] = await Promise.all([requireClan(), verifyUser()]);
  if (!(await canSeeClan({ clanId: clan.id, visibility: clan.visibility, playerId: user?.playerId, userId: user?.userId }))) notFound();
  const e = await liveClanEvent(clan.id, id);
  if (!e) notFound();
  const back = `/clan-events/${e.id}`;
  const member = user != null && (await canSeeClan({ clanId: clan.id, visibility: 'private', playerId: user.playerId, userId: user.userId }));
  const s = member ? await surveyFor(clan.id, e.id, user!.userId) : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-gold">{e.title}</h1>
      <p className="mb-4 text-sm text-text-muted">How did it go?</p>
      {!member ? (
        <p className="text-sm text-text-muted">{user ? 'The survey is for members of this clan.' : 'Sign in to answer the survey.'}</p>
      ) : !s!.ok ? (
        <p className="text-sm text-text-muted">{s!.error}</p>
      ) : (
        <SurveyResponseClient
          eventId={e.id}
          eventName={e.title}
          questions={s!.value.questions}
          initialAnswers={{}}
          alreadySubmitted={s!.value.answered}
          submitUrl={`/api/clan-events/${e.id}/survey`}
          backHref={back}
        />
      )}
      <ClanLink href={back} className="mt-6 inline-block text-sm text-gold hover:underline">
        &larr; Back to the event
      </ClanLink>
    </main>
  );
}
