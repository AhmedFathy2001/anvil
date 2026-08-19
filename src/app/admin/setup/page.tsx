import { redirect } from 'next/navigation';
import { requireClan } from '@/lib/clanContext';
import { verifyUser } from '@/lib/auth';
import { getSetupStatus } from '@/lib/setupStatus';
import { listBotChannels } from '@/lib/discord-broadcast';
import SetupWizardClient from './SetupWizardClient';
import { atLeast } from '@/lib/clanRoles';

export const dynamic = 'force-dynamic';

// First-run guided setup. Admin-only — it writes clan-wide settings, and the settings API
// itself is admin-gated, so mods/editors are bounced to their dashboard.
export default async function SetupPage() {
  const clan = await requireClan();
  const session = await verifyUser();
  if (!session) redirect('/admin');
  if (!atLeast(session.role, 'admin')) redirect('/admin/dashboard');

  // Channels feed the in-wizard webhook creation flow (steps 2–3); empty/off when no bot is connected.
  const [status, bot] = await Promise.all([getSetupStatus(clan.id), listBotChannels(clan.id)]);
  return (
    <SetupWizardClient
      initial={status.values}
      channels={bot.channels}
      botEnabled={bot.enabled}
      provisioned={status.provisioned}
    />
  );
}
