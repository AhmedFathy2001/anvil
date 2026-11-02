import { redirect } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import { verifyAdminOrModerator } from '@/lib/auth';
import { clanHref } from '@/lib/clanPath';
import { requireEventForPage } from '@/lib/eventScope';
import ProofFeedClient from '../../events/[eventId]/proofs/ProofFeedClient';

export const dynamic = 'force-dynamic';

/**
 * The same "All proofs" feed, at a moderator path. A moderator cannot open event pages
 * (lib/adminAccess), but checking proofs is their job — so /admin/proofs links each board here.
 */
export default async function BoardProofsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const id = parseInt((await params).eventId, 10);
  if (!(await verifyAdminOrModerator())) redirect(await clanHref('/admin'));
  // Whose event is this? Ids are global and this one came from the URL.
  const event = await requireEventForPage(id);
  return (
    <div>
      <ClanLink href="/admin/proofs" className="inline-flex items-center gap-1 text-text-muted text-sm hover:text-gold transition-colors mb-3">
        &larr; Proofs to check
      </ClanLink>
      <h1 className="text-2xl font-bold mb-5 flex items-center gap-2">
        <span className="w-1 h-6 bg-gold rounded-full" />
        {event.name}
      </h1>
      <ProofFeedClient eventId={id} />
    </div>
  );
}
