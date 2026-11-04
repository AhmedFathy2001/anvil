import { requirePlatformPage } from '@/lib/platformAccess';
import { hasPlatformRole } from '@/lib/clanRoles';

import PromotionsClient from './PromotionsClient';

export const dynamic = 'force-dynamic';

/**
 * Creator pages' promotional content (lib/spacePage): what viewers reported, what staff hid, and the
 * domains no page may link to. Anvil never promotes what Jagex's rules forbid — gold and account
 * selling, paid account services, bots and unapproved clients, private servers, gambling.
 */
export default async function StaffPromotionsPage() {
  const actor = await requirePlatformPage('support');
  const canWrite = !!actor && hasPlatformRole(actor.role, 'staff');
  return (
    <div className="max-w-5xl">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-gold">
        <span className="h-6 w-1 rounded-full bg-gold" />
        Creator pages
      </h1>
      <p className="mb-6 text-sm text-text-muted">
        Panels, bios and featured clips on creator spaces that viewers reported, and the link blocklist every page is checked
        against. Promotions must follow Jagex&rsquo;s rules — no gold/account selling, gambling, bots or private servers.
        Hidden content never renders.
      </p>
      <PromotionsClient canWrite={canWrite} />
    </div>
  );
}
