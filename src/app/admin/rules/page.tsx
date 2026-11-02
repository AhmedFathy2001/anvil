import { redirect } from 'next/navigation';

import { verifyAdmin } from '@/lib/auth';
import { clanHref } from '@/lib/clanPath';
import RulesSettings from './RulesSettings';
import ClanSettingsHeader from '../clan/ClanSettingsHeader';

export const dynamic = 'force-dynamic';

/**
 * Admin → Rules & scoring: the clan-wide settings that shape events and feeds but aren't Discord —
 * house rules, how fees are signed off, difficulty tiers, balance rates, the Lately feed and luck.
 * They used to be two tabs of "Advanced settings" next to the bot token.
 */
export default async function RulesPage() {
  if (!(await verifyAdmin())) redirect(await clanHref('/admin/dashboard'));
  return (
    <div>
      <ClanSettingsHeader isAdmin />
      <div className="max-w-3xl">
        <RulesSettings />
      </div>
    </div>
  );
}
