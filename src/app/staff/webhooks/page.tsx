import { hasPlatformRole } from '@/lib/clanRoles';
import { requirePlatformPage } from '@/lib/platformAccess';
import SharedWebhooksClient from './SharedWebhooksClient';

export const dynamic = 'force-dynamic';

/**
 * The same Discord webhook set up by more than one clan (lib/sharedWebhooks). Either a joint setup two
 * clans agreed on, or one clan posting into another's channel. Block stops it posting for everyone.
 */
export default async function StaffSharedWebhooksPage() {
  const actor = await requirePlatformPage('support');
  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-gold">
        <span className="h-6 w-1 rounded-full bg-gold" />
        Shared webhooks
      </h1>
      <p className="mb-6 text-sm text-text-muted">
        One Discord webhook set up by more than one clan. That can be a joint setup, or one clan posting into another clan&apos;s channel.
        Blocking it stops Anvil posting through it for every clan and refuses it if anyone saves it again; the clans&apos; admins are told
        to add a new one. Leave it if it&apos;s a legitimate shared setup.
      </p>
      <SharedWebhooksClient canWrite={hasPlatformRole(actor?.role, 'staff')} />
    </div>
  );
}
