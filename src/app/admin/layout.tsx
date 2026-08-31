import { headers } from 'next/headers';
import { redirectFor } from '@/lib/adminAccess';
import { atLeast, isStaffRole } from '@/lib/clanRoles';
import { requireClan } from '@/lib/clanContext';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { clanRoster, users } from '@/db/schema';
import { and, count, eq, isNull } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { avatarUrl } from '@/lib/discord-oauth';
import AdminSidebar, { type SidebarGroup } from './_components/AdminSidebar';
import { getSetupStatus } from '@/lib/setupStatus';

// Admin shell — wraps every page under /admin (including the login page).
// On the login page there's no session yet, so the sidebar is skipped and the
// child renders centered as before. Authenticated admin/mod pages get the
// two-column layout with a contextual sidebar.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyUser();

  // THE GATE. It used to be ninety lines of middleware deciding from the role baked into the session
  // cookie; it runs here because only this layer can ask the database whose clan this host is and
  // what this person holds in it. Middleware still refuses an unsigned or stale session at the edge,
  // which is the most it can honestly judge.
  //
  // A REDIRECT, NOT plain children. Falling through to render the page was safe only while
  // middleware blocked the request first — every admin page would otherwise render for anyone with
  // a session, and most of them carry no guard of their own.
  const pathname = (await headers()).get('x-anvil-pathname') ?? '';
  if (!session) redirect('/login?return=' + encodeURIComponent(pathname || '/admin'));

  const access = { role: session.role, canEditTiles: session.canEditTiles, editorScope: session.editorScope };
  const target = redirectFor(pathname || '/admin/dashboard', access);
  if (target && target !== pathname) redirect(target);

  // Moderator-or-better, or the authoring capability: anything less was turned away above.
  const isStaffHere = isStaffRole(session.role) || session.canEditTiles;
  if (!isStaffHere) redirect('/');

  const userRow = session.userId > 0
    ? await db.query.users.findFirst({
        where: eq(users.id, session.userId),
        columns: { displayName: true, discordId: true, discordAvatar: true },
      })
    : null;

  const clan = await requireClan();
  const provisionalCount = await db
    .select({ c: count() })
    .from(clanRoster)
    .where(and(eq(clanRoster.clanId, clan.id), eq(clanRoster.provisional, 1), isNull(clanRoster.leftAt)))
    .then((r) => r[0]?.c ?? 0);

  const isAdmin = atLeast(session.role, 'admin');
  // An authoring grant without a tier: their whole world is the boards they hold. Give them ONLY
  // "My boards"; no dashboard, weekly, clan or schedule. The path gate above already enforced it.
  const isScopedEditor = !isStaffRole(session.role) && session.canEditTiles;
  if (isScopedEditor) {
    const scopedGroups: SidebarGroup[] = [
      {
        label: 'Events',
        items: [{ href: '/admin/events', label: 'My boards', icon: '🎯', matchPrefix: true }],
      },
    ];
    const scopedUser = {
      displayName: userRow?.displayName ?? session.username ?? 'Editor',
      role: 'board editor',
      avatarUrl: userRow?.discordId ? avatarUrl(userRow.discordId, userRow.discordAvatar) : null,
    };
    return (
      <div className="lg:flex lg:gap-6">
        <AdminSidebar groups={scopedGroups} user={scopedUser} />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    );
  }

  // Who can open the event pages (/admin/events) — admins manage everything, editors open a
  // board's Tiles tab. Mirrors the middleware gate; mods/treasurers are blocked there, so we don't
  // show them an "All events" item that would just bounce back to the dashboard.
  const canManageEvents = isAdmin || session.canEditTiles;

  // Only to decide whether the sidebar still needs to nag about setup. Cheap, and the dashboard
  // reads the same helper for its checklist, so the two never disagree about what is left.
  const setup = isAdmin ? await getSetupStatus(clan.id) : null;

  const groups: SidebarGroup[] = [];

  // Overview is everyone's landing tile.
  //
  // Feedback is NOT here any more. It is reports about Anvil, and on one site there is one product
  // and one operator, who reads them at /staff — so every clan admin was being shown a triage queue
  // for somebody else's job. See app/staff/feedback.
  groups.push({
    label: 'Overview',
    items: [{ href: '/admin/dashboard', label: 'Dashboard', icon: '⌂' }],
  });

  // Bingo events + schedule. Schedule is open to every staff role; the event list is admin/editor
  // only (see canManageEvents), so mods/treasurers see just Schedule here.
  groups.push({
    label: 'Events',
    items: [
      ...(canManageEvents
        ? [{ href: '/admin/events', label: 'All events', icon: '🎯', matchPrefix: true }]
        : []),
      { href: '/admin/schedule', label: 'Schedule', icon: '📅' },
      // The task catalogue boards are generated from — same authority as tile authoring, so every
      // editor (scoped ones included) gets it.
      ...(canManageEvents ? [{ href: '/admin/tile-library', label: 'Task library', icon: '📚' }] : []),
    ],
  });

  // Weekly is shared
  groups.push({
    label: 'Weekly',
    items: [{ href: '/admin/weekly', label: 'Competitions', icon: '🏆', matchPrefix: true }],
  });

  // TWO NOUNS, TWO ENTRIES. This was one item called "Members & staff" holding six tabs that spanned
  // the people (roster, review queue, staff seats) AND the clan itself (public face, access, wiring,
  // history). A name can only describe one of those, and it described the half that kept growing.
  groups.push({
    label: 'People',
    items: [
      { href: '/admin/people', label: 'Roster', icon: '🛡️', badge: provisionalCount, matchPrefix: true },
    ],
  });

  // Fees now live on each event's Sign-ups tab (no standalone queue), so there's no Money
  // group. Treasurers/mods reach them via Events → an event → Sign-ups.

  // The clan as a thing. "System" used to sit below this holding Advanced settings — which was clan
  // configuration all along, and said so itself in a line pointing readers at a different menu for
  // the clan's own name. Dissolved into here, where the noun already was.
  if (isAdmin) {
    groups.push({
      label: 'Clan',
      items: [
        { href: '/admin/clan', label: 'Profile', icon: '🏰', matchPrefix: true },
        { href: '/admin/integrations', label: 'Settings', icon: '🔌' },
        // A broadcast to the clan is an ACT, not a place — but it is the clan's act, so it lives with
        // the clan rather than in a drawer of unrelated machinery.
        { href: '/admin/announce', label: 'Announce', icon: '📣' },
        // SETUP IS A STATE, NOT A PLACE. A permanent menu item for a wizard you finish once is a
        // permanent invitation to redo it; while it is unfinished the dashboard checklist is already
        // asking, and this makes the ask reachable. Once done it stops taking up a line forever.
        ...(!setup || setup.allDone || setup.dismissed
          ? []
          : [{ href: '/admin/setup', label: 'Finish setup', icon: '🧭' }]),
      ],
    });
  }

  const user = {
    displayName: userRow?.displayName ?? session.username ?? 'Admin',
    role: session.role,
    avatarUrl: userRow?.discordId ? avatarUrl(userRow.discordId, userRow.discordAvatar) : null,
  };

  return (
    <div className="lg:flex lg:gap-6">
      <AdminSidebar groups={groups} user={user} />
      <div className="flex-1 min-w-0">
        {session.actingAs && (
          // Borrowed authority, said out loud. An operator working inside someone else's clan should
          // never be able to forget that is what they are doing — and the clan's own audit log
          // already carries the same fact, so this is the half the operator sees.
          <div className="mb-4 rounded-xl border border-amber-700 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            You are acting as staff of <span className="font-semibold">{clan.name}</span> on a
            temporary platform grant, not a role in this clan. It expires{' '}
            {session.actingAs.expiresAt.replace('T', ' ').slice(0, 16)} UTC and this clan can see it
            in their history.
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
