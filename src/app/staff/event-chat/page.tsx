import { hasPlatformRole } from '@/lib/clanRoles';
import { platformChatOn } from '@/lib/eventChat';
import { requirePlatformPage } from '@/lib/platformAccess';
import EventChatSwitch from './EventChatSwitch';

export const dynamic = 'force-dynamic';

/** The platform's off switch for every board's event chat (lib/eventChat). */
export default async function StaffEventChatPage() {
  const actor = await requirePlatformPage('support');
  const enabled = await platformChatOn(true);
  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-gold">
        <span className="h-6 w-1 rounded-full bg-gold" />
        Event chat
      </h1>
      <p className="mb-6 text-sm text-text-muted">
        Each event&rsquo;s private chat in the plugin&rsquo;s Feed tab. Hosts turn it on per event; this switch turns
        it off everywhere at once, whatever the hosts chose, and hides the host&rsquo;s switch. Off until you turn it
        on: it needs the plugin&rsquo;s Feed tab, so turn it on once that plugin version is live on the hub.
      </p>
      <EventChatSwitch initial={enabled} canWrite={!!actor && hasPlatformRole(actor.role, 'staff')} />
    </div>
  );
}
