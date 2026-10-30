import { notFound } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import { verifyAdminOrModerator } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { parseModules, recentKeys } from '@/lib/clanEventModules';
import { loadQuestions } from '@/lib/clanEventQuestions';
import { liveClanEvent } from '@/lib/clanEventSignups';
import { getRequiredConfirmations } from '@/lib/feeConfirmations';
import { idParam } from '@/lib/routeIds';
import { SIGNUP_TEMPLATES, SURVEY_TEMPLATES } from '@/lib/surveyTemplates';

import ClanEventManageClient from './ClanEventManageClient';

export const dynamic = 'force-dynamic';

/**
 * One clan event's extras (lib/clanEventModules): sign-ups with the host's questions, an entry fee,
 * payouts and a survey — each off until switched on here, each set up for this event alone.
 */
export default async function ClanEventManagePage({ params }: { params: Promise<{ id: string }> }) {
  const id = idParam((await params).id);
  const [clan, user] = await Promise.all([requireClan(), verifyAdminOrModerator()]);
  if (!user) notFound();
  const e = await liveClanEvent(clan.id, id);
  if (!e) notFound();
  const modules = parseModules(e.modules);
  // A server render runs once per request; "now" is the request's time.
  // eslint-disable-next-line react-hooks/purity
  const keys = recentKeys(modules, e, Date.now());
  const [signupQuestions, surveyQuestions, confirmationsRequired] = await Promise.all([
    loadQuestions(clan.id, e.id, 'signup'),
    loadQuestions(clan.id, e.id, 'post'),
    getRequiredConfirmations(clan.id),
  ]);

  return (
    <div>
      <ClanLink href="/admin/clan-events" className="mb-3 inline-flex text-sm text-text-muted hover:text-gold">
        &larr; Clan events
      </ClanLink>
      <header className="mb-6">
        <h1 className="mb-1 text-2xl font-bold text-gold sm:text-3xl">{e.title}</h1>
        <p className="text-sm text-text-muted">
          Switch on what this event needs — sign-ups, an entry fee, payouts, a survey. Each is set up for this event only.
        </p>
      </header>
      <ClanEventManageClient
        id={e.id}
        weekly={e.repeat === 'weekly'}
        initialModules={modules}
        keys={keys}
        signupQuestions={signupQuestions}
        surveyQuestions={surveyQuestions}
        templates={SURVEY_TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description, questionCount: t.questions.length }))}
        signupTemplates={SIGNUP_TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description, questionCount: t.questions.length }))}
        viewerRole={user.role}
        viewerId={user.userId}
        confirmationsRequired={confirmationsRequired}
      />
    </div>
  );
}
