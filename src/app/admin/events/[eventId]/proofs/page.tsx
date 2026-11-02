import { redirect } from 'next/navigation';

import { verifyAdminOrModerator } from '@/lib/auth';
import { clanHref } from '@/lib/clanPath';
import { requireEventForPage } from '@/lib/eventScope';
import ProofFeedClient from './ProofFeedClient';

export const dynamic = 'force-dynamic';

/** Admin → event → Proofs: every proof on the board, flagged or not (see ProofFeedClient). */
export default async function EventProofsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const id = parseInt((await params).eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  await requireEventForPage(id);
  // Same tier as removing a proof; a board-only editor or treasurer goes back to the board.
  if (!(await verifyAdminOrModerator())) redirect(await clanHref(`/admin/events/${id}`));
  return <ProofFeedClient eventId={id} />;
}
