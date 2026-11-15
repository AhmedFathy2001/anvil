import { redirect } from 'next/navigation';
import { requireClan } from '@/lib/clanContext';
import { track } from '@/lib/analytics';
import { verifyUser } from '@/lib/auth';
import { getSetupStatus } from '@/lib/setupStatus';
import { listBotChannels } from '@/lib/discord-broadcast';
import SetupWizardClient from './SetupWizardClient';
import GuidedFlow from '@/components/GuidedFlow';
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
  const openAt = stepParam === 'clan' ? 0 : stepParam === 'game' ? 2 : undefined;
  const guide = status.guide;
  return (
    <>
      {/* The same strip, steps and count as the dashboard (lib/guidedFlows/clanSetup). */}
      {guide && (
        <div className="max-w-xl mx-auto">
          <GuidedFlow view={guide} scope={clan.id} startDismissed={status.dismissed} />
        </div>
      )}
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
