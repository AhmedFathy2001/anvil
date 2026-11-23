import { notFound } from 'next/navigation';

import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { requireClan } from '@/lib/clanContext';
import { personOnPracticeBoard, practiceBoardInClan, practiceView } from '@/lib/practice';
import { maskedHook, PRACTICE_MAX_TILES } from '@/lib/practiceRules';
import { idParam } from '@/lib/routeIds';
import PracticeBoardClient from './PracticeBoardClient';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Practice board', robots: { index: false, follow: false } };

/**
 * A practice board (lib/practice). The clan's admins manage it; the people on it may look while it
 * runs. Everyone else — and every other clan — gets the not-found page, the same as a wrong id.
 */
export default async function PracticeBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ note?: string }>;
}) {
  const clan = await requireClan();
  const session = await verifyUser();
  if (!session) notFound();
  const found = await practiceBoardInClan(clan.id, idParam((await params).eventId));
  if (!found) notFound();
  const manage = atLeast(session.role, 'admin');
  const view = await practiceView(found.event, found.board);
  if (!manage && (!view.running || !(await personOnPracticeBoard(found.event.id, session.playerId)))) notFound();
  const note = (await searchParams).note;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <PracticeBoardClient
        view={{ ...view, hook: maskedHook(view.hook) }}
        manage={manage}
        maxTiles={PRACTICE_MAX_TILES}
        note={typeof note === 'string' ? note.slice(0, 300) : null}
      />
    </div>
  );
}
