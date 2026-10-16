import { redirect } from 'next/navigation';

import { verifyAdmin } from '@/lib/auth';
import { clanHref } from '@/lib/clanPath';
import RulesSettings from './RulesSettings';

export const dynamic = 'force-dynamic';

/**
 * Admin → Rules & scoring: the clan-wide settings that shape events and feeds but aren't Discord —
 * house rules, how fees are signed off, difficulty tiers, balance rates, the Lately feed and luck.
 * They used to be two tabs of "Advanced settings" next to the bot token.
 */
export default async function RulesPage() {
  if (!(await verifyAdmin())) redirect(await clanHref('/admin/dashboard'));
  return (
    <div className="max-w-3xl">
      <header className="mb-8">
        <h1 className="display display-lg text-4xl sm:text-[44px] font-semibold leading-tight">Rules &amp; scoring</h1>
        <p className="text-text-muted mt-2 text-[15px]">
          Clan-wide rules every event uses. Each event can still change its own on its Settings page.
        </p>
      </header>
      <RulesSettings />
    </div>
  );
}
