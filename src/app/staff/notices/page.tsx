import { hasPlatformRole } from '@/lib/clanRoles';
import { staffNoticeList } from '@/lib/notices';
import { requirePlatformPage } from '@/lib/platformAccess';
import NoticesClient from './NoticesClient';

export const dynamic = 'force-dynamic';

/**
 * Notices from Anvil (lib/notices): write once, show in the site inbox and wherever else is ticked —
 * the plugin panel, the login brief, a DM to people who said yes. Replies come on Discord.
 */
export default async function StaffNoticesPage() {
  const actor = await requirePlatformPage('support');
  const notices = await staffNoticeList();
  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-gold">
        <span className="h-6 w-1 rounded-full bg-gold" />
        Notices
      </h1>
      <p className="mb-6 text-sm text-text-muted">
        Tell clan admins, supporters or one person something. It always lands in their inbox on the site (the bell), and wherever
        else you tick. Every notice ends with &ldquo;Reply on Discord&rdquo;, so answers come to you there.
      </p>
      <NoticesClient
        canWrite={!!actor && hasPlatformRole(actor.role, 'staff')}
        initial={notices.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          audience: n.audience,
          level: n.level,
          inPlugin: n.inPlugin,
          inBrief: n.inBrief,
          byDm: n.byDm,
          createdAt: n.createdAt.toISOString(),
          expiresAt: n.expiresAt?.toISOString() ?? null,
          withdrawnAt: n.withdrawnAt?.toISOString() ?? null,
          dmSentCount: n.dmSentCount,
          reads: n.reads,
        }))}
      />
    </div>
  );
}
