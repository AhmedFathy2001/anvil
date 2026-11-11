import ClanLink from '@/components/ClanLink';
import { cohostsForEvent } from '@/lib/coHost';
import { settlementForEvent } from '@/lib/coHostSettlement';
import AccessPanel from '../../teams/AccessPanel';
import CoHostPanel from '../../teams/CoHostPanel';
import AccountsPanel from '../AccountsPanel';
import { eventHasStarted } from '@/lib/completionGate';
import EntryGatePanel from '../EntryGatePanel';
import { loadSettings } from '../load';

export const dynamic = 'force-dynamic';

/**
 * Settings › Viewers (a creator space) or Entry & co-hosts (a clan): who sees and enters it, a
 * streamed event's "who can join" gate, and — between in-game clans only — the co-hosts and their pot.
 */
export default async function AccessSettingsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { id, event, kind } = await loadSettings((await params).eventId);
  // Co-hosting is between in-game clans; a creator space has none (lib/coHost coHostKindRefusal).
  const [cohosts, settlement] = kind.creator ? [null, null] : await Promise.all([cohostsForEvent(id), settlementForEvent(id)]);
  return (
    <>
      <div id="access" className="scroll-mt-28 rounded-xl">
        <AccessPanel eventId={id} creator={kind.creator} />
      </div>
      {/* Not for weekly competitions: they enter the roster as it stands. */}
      {!['sotw', 'botw', 'eff'].includes(event.format ?? '') && (
        <div id="accounts" className="scroll-mt-28 rounded-xl">
          <AccountsPanel
            eventId={id}
            initialMax={event.maxAccountsPerPerson}
            initialSlot={event.accountSlotMode === 'per-account' ? 'per-account' : 'per-person'}
            started={eventHasStarted(event)}
            solo={event.teamPlacement === 'solo' || event.format === 'individual'}
          />
        </div>
      )}
      {kind.streams && (
        <div id="gate" className="scroll-mt-28 rounded-xl">
          <EntryGatePanel eventId={id} />
        </div>
      )}
      {!kind.creator && cohosts && (
        <div id="cohosts" className="scroll-mt-28 rounded-xl">
          <CoHostPanel eventId={id} initial={cohosts} cashPolicy={event.cashPolicy} settlement={settlement} />
        </div>
      )}
      <p className="text-sm text-text-muted">
        Where this event posts, who it pings, its team channels and extra webhooks are on the{' '}
        <ClanLink href={`/admin/events/${id}/discord`} className="text-gold hover:underline">
          Discord tab
        </ClanLink>
        .
      </p>
    </>
  );
}
