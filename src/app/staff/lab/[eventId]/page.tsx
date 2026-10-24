import ClanLink from '@/components/ClanLink';
import { notFound } from 'next/navigation';

import { ensureLabClan, labEvent } from '@/lib/lab';
import { hasPlatformRole } from '@/lib/clanRoles';
import { CAN_WRITE, requirePlatformPage } from '@/lib/platformAccess';

import LabSessionClient from './LabSessionClient';

export const dynamic = 'force-dynamic';

/** One lab session: its board, what got credited, and what its characters pushed (lib/lab). */
export default async function StaffLabSessionPage({ params }: { params: Promise<{ eventId: string }> }) {
  const actor = await requirePlatformPage('support');
  if (!actor) notFound();
  const event = await labEvent(Number((await params).eventId));
  if (!event) notFound();
  // "Edit tiles" opens the lab clan's ordinary admin pages, which need a seat on its staff. Writers
  // get one on the way in; read-only support does not.
  if (hasPlatformRole(actor.role, CAN_WRITE)) await ensureLabClan(actor.user.userId);
  return (
    <div>
      <p className="mb-2 text-sm">
        <ClanLink href="/staff/lab" className="text-text-muted hover:text-gold">← Tile lab</ClanLink>
      </p>
      <LabSessionClient eventId={event.id} />
    </div>
  );
}
