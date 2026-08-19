import { notFound } from 'next/navigation';

import { allClans } from '@/lib/platformView';
import { myLiveGrants } from '@/lib/actAs';
import { requirePlatformPage } from '@/lib/platformAccess';
import { hasPlatformRole } from '@/lib/clanRoles';
import ClansClient from './ClansClient';

export const dynamic = 'force-dynamic';

export default async function StaffClansPage() {
  // The layout gates this too; asked again here because this page decides what the operator may
  // DO, and that answer has to come from the same live read rather than from the shell's memory.
  const actor = await requirePlatformPage('support');
  if (!actor) notFound();

  const [clans, grants] = await Promise.all([allClans(), myLiveGrants(actor.user.userId)]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Clans</h1>
      <p className="mt-1 text-sm text-gray-400">
        Lifecycle and entitlement only. A clan&rsquo;s events, roster and settings are the clan&rsquo;s
        — reaching those needs a grant in that clan, which this page does not confer.
      </p>
      <div className="mt-6">
        <ClansClient clans={clans} canWrite={hasPlatformRole(actor.role, 'staff')} grants={grants} />
      </div>
    </div>
  );
}
