import { hasPlatformRole } from '@/lib/clanRoles';
import { requirePlatformPage } from '@/lib/platformAccess';
import OwnershipTransfersClient from './OwnershipTransfersClient';

export const dynamic = 'force-dynamic';

/**
 * Clan ownership transfers waiting out their 3-day hold (lib/ownershipTransfers) — every one lands
 * here, like a support ticket. Staff can block one (with a reason both people see) or let it through;
 * letting it through only takes it off this queue, the hold still runs.
 */
export default async function StaffOwnershipPage() {
  const actor = await requirePlatformPage('support');
  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-gold">
        <span className="h-6 w-1 rounded-full bg-gold" />
        Ownership transfers
      </h1>
      <p className="mb-6 text-sm text-text-muted">
        A clan owner handing the clan to one of its admins. Nothing moves for 3 days: the owner can cancel, the new owner can decline, and
        you can block it here if it looks wrong — a hijacked owner login, a dispute in the clan. Letting it through just clears it from this
        queue; it still waits out the hold.
      </p>
      <OwnershipTransfersClient canWrite={hasPlatformRole(actor?.role, 'staff')} />
    </div>
  );
}
