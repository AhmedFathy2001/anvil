import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { provenPath } from '@/lib/requestHeaderProof';

import { requirePlatformPage } from '@/lib/platformAccess';
import { libraryActor } from '@/lib/guideAccess';
import { pendingCount as pendingProposals } from '@/lib/guideProposals';
import { pendingCount as pendingLibraryProposals } from '@/lib/libraryProposals';
import { staffBadges, staffPending } from '@/lib/staffPending';
import { hasPlatformRole } from '@/lib/clanRoles';
import { avatarUrl } from '@/lib/discord-oauth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import AdminSidebar, { type SidebarGroup } from '../admin/_components/AdminSidebar';
import StaffSectionTabs, { type StaffSection } from './_components/StaffSectionTabs';

/**
 * The platform shell — /staff, on the apex only.
 *
 * THE GATE IS HERE AND ALSO ON EVERY ROUTE. This layout keeps a non-operator from rendering any
 * page beneath it, but it protects pages only: middleware never covers /api/*, so each
 * /api/staff/* handler runs `requirePlatformApi` for itself. A guard that exists in one place and
 * is assumed everywhere else is how 18 admin pages ended up relying on a token claim.
 *
 * 404, not 403, and not a redirect to a login. Someone without the role has no business knowing
 * this surface exists, and there is no flow that lands a normal member here by accident.
 */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePlatformPage('support');
  if (!actor) {
    // A LIBRARY GUIDE EDITOR holds no platform role — the grant is lateral, and on purpose. They get
    // /staff/guides and nothing else: this shell is the only thing standing between them and every
    // other /staff page, most of which do not guard themselves, so anything else is still a 404.
    const guides = await libraryActor();
    // Only a path middleware signed: an unknown one is not the library, so it 404s.
    const pathname = (await provenPath(await headers()))?.pathname;
    if (pathname == null) notFound();
    // The task and board library is the same library with other content, under the same grant.
    const inLibrary = ['/staff/guides', '/staff/library'].some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (!guides?.canEdit || !inLibrary) notFound();
    const me = await db.query.users.findFirst({
      where: eq(users.id, guides.user.userId),
      columns: { displayName: true, discordId: true, discordAvatar: true },
    });
    return (
      <div className="lg:flex lg:gap-6">
        <AdminSidebar
          groups={[
            {
              label: 'Platform',
              items: [
                { href: '/staff/guides', label: 'Guide library', icon: '📖', badge: await pendingProposals(), matchPrefix: true },
                { href: '/staff/library', label: 'Task & board library', icon: '▦', badge: await pendingLibraryProposals(), matchPrefix: true },
              ],
            },
          ]}
          user={{
            displayName: me?.displayName ?? guides.user.username ?? 'Editor',
            role: 'library guide editor',
            avatarUrl: me?.discordId ? avatarUrl(me.discordId, me.discordAvatar) : null,
          }}
        />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    );
  }

  const row = await db.query.users.findFirst({
    where: eq(users.id, actor.user.userId),
    columns: { displayName: true, discordId: true, discordAvatar: true },
  });
  // Money and Analytics are platform root's alone (lib/ownerAccess); the links are only drawn for root.
  const isRoot = actor.role === 'root';

  const canWrite = hasPlatformRole(actor.role, 'staff');
  // The same counts the Platform link wears everywhere else, broken out by where each is cleared.
  const pending = await staffPending();

  // The badges by link (lib/staffPending staffBadges): the same map the rail's live read answers with.
  const badge = staffBadges(pending);

  // THREE GROUPS, BY HOW OFTEN: the places an operator goes every day, the queues that fill up by
  // themselves, and the tools. Pages that are two views of one thing share a rail line and get a tab
  // strip (the `sections` below) instead of a line each: it was twenty links in four groups.
  const groups: SidebarGroup[] = [
    {
      label: 'Platform',
      items: [
        { href: '/staff', label: 'Today', icon: '◎', badge: badge['/staff'], attn: true },
        // Billing that wants a look: overdue, cancelling, or a trial ending this week. Ghost clans
        // (in-game clans not on Anvil yet) are a tab of the same section.
        { href: '/staff/clans', label: 'Clans', icon: '🏰', badge: badge['/staff/clans'], attn: true, matchPrefix: true, alsoMatch: ['/staff/ghost-clans', '/staff/servers'] },
        { href: '/staff/people', label: 'People', icon: '👤', matchPrefix: true },
        // Money is platform root's alone (lib/ownerAccess); everyone paying, by tier, is its second tab.
        // Without root the subscriptions list stands by itself.
        isRoot
          ? { href: '/staff/money', label: 'Money', icon: '$', matchPrefix: true, alsoMatch: ['/staff/subscriptions'] }
          : { href: '/staff/subscriptions', label: 'Subscriptions', icon: '◈', matchPrefix: true },
        // Visits, where people come from and where onboarding stalls (lib/analytics). Root only.
        ...(isRoot ? [{ href: '/staff/analytics', label: 'Analytics', icon: '📈', matchPrefix: true }] : []),
      ],
    },
    {
      label: 'Inbox',
      items: [
        // Reports about the product, from every clan.
        { href: '/staff/feedback', label: 'Feedback', icon: '💬', badge: badge['/staff/feedback'], matchPrefix: true },
        // Characters clans raised (lib/characterReports) and what viewers reported to Anvil
        // (lib/platformReports): two tabs of one line.
        { href: '/staff/reports', label: 'Reports', icon: '⚑', badge: badge['/staff/reports'], matchPrefix: true, alsoMatch: ['/staff/promotions'] },
        // Things asked of the platform: a clan changing hands (lib/ownershipTransfers) and one Discord
        // webhook set up by several clans (lib/sharedWebhooks).
        { href: '/staff/ownership', label: 'Requests', icon: '♛', badge: badge['/staff/ownership'], matchPrefix: true, alsoMatch: ['/staff/webhooks'] },
        // What broke, across every clan: the surface the hourly digest links back to.
        { href: '/staff/errors', label: 'Errors', icon: '⚠', badge: badge['/staff/errors'], matchPrefix: true },
      ],
    },
    {
      label: 'Tools',
      items: [
        // The guide library and the task & board library: one library, two kinds of content.
        { href: '/staff/guides', label: 'Library', icon: '📖', badge: badge['/staff/guides'], matchPrefix: true, alsoMatch: ['/staff/library'] },
        { href: '/staff/releases', label: 'Releases', icon: '⇪', matchPrefix: true },
        { href: '/staff/notices', label: 'Notices', icon: '🔔', matchPrefix: true },
        // Anvil's own server (lib/anvilDiscord) and the plugin event-chat switch.
        { href: '/staff/discord', label: 'Discord & chat', icon: '✉', matchPrefix: true, alsoMatch: ['/staff/event-chat'] },
        // Test any tile kind on your own account without a real bingo (lib/lab).
        { href: '/staff/lab', label: 'Tile lab', icon: '⚗', matchPrefix: true },
        // The chat lines every plugin parses (lib/chatPatterns) and game-mode lines (lib/modeLines): tabs.
        { href: '/staff/chat-patterns', label: 'Chat lines', icon: '✎', matchPrefix: true, alsoMatch: ['/staff/mode-lines'] },
        // Clips of streamed events (lib/highlights), with the ones hosts let Anvil promote.
        { href: '/staff/highlights', label: 'Stream highlights', icon: '▶', matchPrefix: true },
        // Read-only, and shown to support too: seeing what was done is the least dangerous thing an
        // operator can do, and the one most often needed when somebody asks why.
        { href: '/staff/audit', label: 'Operator log', icon: '⧉', matchPrefix: true },
      ],
    },
  ];

  const sections: StaffSection[] = [
    { exact: true, tabs: [{ href: '/staff/clans', label: 'On Anvil' }, { href: '/staff/ghost-clans', label: 'Ghost clans' }, { href: '/staff/servers', label: 'Discord servers' }] },
    ...(isRoot ? [{ tabs: [{ href: '/staff/money', label: 'Money' }, { href: '/staff/subscriptions', label: 'Subscriptions' }] }] : []),
    {
      tabs: [
        { href: '/staff/reports', label: 'Character reports', badge: pending.reports },
        { href: '/staff/promotions', label: 'Viewer reports', badge: pending.promoReports },
      ],
    },
    {
      tabs: [
        { href: '/staff/ownership', label: 'Ownership transfers', badge: pending.ownershipTransfers },
        { href: '/staff/webhooks', label: 'Shared webhooks', badge: pending.sharedWebhooks },
      ],
    },
    {
      tabs: [
        { href: '/staff/guides', label: 'Guides', badge: pending.guideProposals },
        { href: '/staff/library', label: 'Tasks & boards', badge: pending.libraryProposals },
      ],
    },
    { tabs: [{ href: '/staff/discord', label: 'Anvil Discord' }, { href: '/staff/event-chat', label: 'Event chat' }] },
    { tabs: [{ href: '/staff/chat-patterns', label: 'Chat patterns' }, { href: '/staff/mode-lines', label: 'Game-mode lines' }] },
  ];

  return (
    <div className="lg:flex lg:gap-6">
      <AdminSidebar
        groups={groups}
        badgeFeed="/api/staff/pending"
        user={{
          displayName: row?.displayName ?? actor.user.username ?? 'Operator',
          // The PLATFORM role, deliberately — this shell must never display a clan role, or the two
          // axes start looking like one ladder.
          role: `platform ${actor.role}`,
          avatarUrl: row?.discordId ? avatarUrl(row.discordId, row.discordAvatar) : null,
        }}
      />
      <div className="flex-1 min-w-0">
        {!canWrite && (
          // Support is read-only. Saying so up front beats letting someone find out by having a
          // button do nothing.
          <div className="mb-4 rounded-xl border border-card-border bg-card-bg px-4 py-3 text-sm text-gray-300">
            You have <span className="text-gold">support</span> access: everything here is read-only.
          </div>
        )}
        <StaffSectionTabs sections={sections} />
        {children}
      </div>
    </div>
  );
}
