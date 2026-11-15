import { redirect } from 'next/navigation';
import { requireClan } from '@/lib/clanContext';
import { track } from '@/lib/analytics';
import { verifyUser } from '@/lib/auth';
import { getSetupStatus } from '@/lib/setupStatus';
import { listBotChannels } from '@/lib/discord-broadcast';
import SetupWizardClient from './SetupWizardClient';
import { atLeast } from '@/lib/clanRoles';
import { clanHref } from '@/lib/clanPath';
import { isCreatorSpace } from '@/lib/creatorSpaces';

export const dynamic = 'force-dynamic';

// First-run guided setup. Admin-only — it writes clan-wide settings, and the settings API
// itself is admin-gated, so mods/editors are bounced to their dashboard.
export default async function SetupPage({ searchParams }: { searchParams: Promise<{ step?: string | string[] }> }) {
  const clan = await requireClan();
  const session = await verifyUser();
  if (!session) redirect(await clanHref('/admin'));
  if (!atLeast(session.role, 'admin')) redirect(await clanHref('/admin/dashboard'));
  // The wizard is in-game clan setup (in-game name, roster, plugin). A creator space has none of it;
  // its checklist lives on the dashboard and its first step is the event wizard.
  if (isCreatorSpace(clan)) redirect(await clanHref('/admin/dashboard'));

  track('flow.setup.opened', { clanId: clan.id, userId: session.userId });
  // Channels feed the in-wizard webhook creation flow (steps 2–3); empty/off when no bot is connected.
  const [status, bot] = await Promise.all([getSetupStatus(clan.id), listBotChannels(clan.id)]);
  // The guide strip's buttons name the part of the wizard they mean (?step=clan, ?step=game), since
  // the wizard on its own opens at the first part with anything left, which is often Discord.
  const stepParam = (await searchParams).step;
  const guide = status.guide;
  // No strip on this page: the wizard IS the guide here, and the two side by side showed two
  // counters naming two different tasks. The wizard opens at its own first unfinished part (for a
  // new clan that is Discord, part 2, which can be skipped); an explicit ?step= from the dashboard
  // strip's button still opens the part that button names.
  const openAt = stepParam === 'clan' ? 0 : stepParam === 'game' ? 2 : undefined;
  return (
    <>
      <SetupWizardClient
        // A different part asked for by the address is a different wizard, opened there.
        key={openAt ?? 'auto'}
        initial={status.values}
        channels={bot.channels}
        botEnabled={bot.enabled}
        provisioned={status.provisioned}
        openAt={openAt}
        checklist={
          guide
            ? { completedCount: guide.doneCount, totalCount: guide.total }
            : { completedCount: status.completedCount, totalCount: status.totalCount }
        }
      />
    </>
  );
}
