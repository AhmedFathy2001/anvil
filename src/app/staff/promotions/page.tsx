import { requirePlatformPage } from '@/lib/platformAccess';
import { hasPlatformRole } from '@/lib/clanRoles';

import PromotionsClient from './PromotionsClient';

export const dynamic = 'force-dynamic';

/**
 * The platform's reports inbox (lib/platformReports): creator pages and panels, clans, events, player
 * profiles and stream highlights viewers reported to Anvil — plus the creator-page tools (lib/spacePage):
 * what staff hid and the domains no page may link to. Anvil never promotes what Jagex's rules forbid —
 * gold and account selling, paid account services, bots and unapproved clients, private servers,
 * gambling.
 */
export default async function StaffPromotionsPage() {
  const actor = await requirePlatformPage('support');
  const canWrite = !!actor && hasPlatformRole(actor.role, 'staff');
  return (
    <div className="max-w-5xl">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-gold">
        <span className="h-6 w-1 rounded-full bg-gold" />
        Reports
      </h1>
      <p className="mb-6 text-sm text-text-muted">
        What signed-in viewers reported to Anvil: creator pages, clans, events, player profiles and stream highlights. The
        reported party never learns who reported them. Promotions must follow Jagex&rsquo;s rules — no gold/account selling,
        gambling, bots or private servers. Hidden content never renders.
      </p>
      <PromotionsClient canWrite={canWrite} />
    </div>
  );
}
