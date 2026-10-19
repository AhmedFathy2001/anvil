import { headers } from 'next/headers';
import { redirectFor } from '@/lib/adminAccess';
import { atLeast, isStaffRole } from '@/lib/clanRoles';
import { clanPrefix, requireClan } from '@/lib/clanContext';
import { clanHrefs } from '@/lib/clanPath';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { clanRoster, cofferEntries, users } from '@/db/schema';
import { and, count, eq, isNull } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { avatarUrl } from '@/lib/discord-oauth';
import AdminSidebar, { type SidebarGroup } from './_components/AdminSidebar';
import { getSetupStatus } from '@/lib/setupStatus';
import { pendingClaimRequests } from '@/lib/claimRequests';
import { pendingUpdateCount } from '@/lib/guides';
import { coHostedBoardLinks } from '@/lib/coHost';
import { getClanFeatures } from '@/lib/clanFeatures';
import { flaggedProofBoards } from '@/lib/flaggedProofs';

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
  //
  // EVERY REDIRECT OUT OF HERE CARRIES THE CLAN. `x-anvil-clan-slug` names the clan, but the
  // pathname arrives with `/c/<slug>` already stripped, so a bare `/admin/events` sends a
  // path-addressed clan's staff to the APEX — where they hold nothing, and the gate there turns
  // them away to the home page. The gate was right about them every time; it just answered at the
  // wrong address. Admins never saw it, because an admin is the one grant this function lets
  // through without redirecting at all. See lib/clanPath.
  const pathname = (await headers()).get('x-anvil-pathname') ?? '';
  const href = await clanHrefs();
  if (!session) redirect('/login?return=' + encodeURIComponent(href(pathname || '/admin')));

  const access = {
    role: session.role,
    canEditTiles: session.canEditTiles,
    editorScope: session.editorScope,
    canEditGuides: session.canEditGuides,
  };
  const target = redirectFor(pathname || '/admin/dashboard', access);
  if (target && target !== pathname) redirect(href(target));

  // Moderator-or-better, or the authoring capability: anything less was turned away above. Sent to
  // THIS clan's home rather than the apex: they were looking at this clan, and being told "not for
  // you" is not a reason to also lose your place.
  const isStaffHere = isStaffRole(session.role) || session.canEditTiles || session.canEditGuides;
  if (!isStaffHere) redirect((await clanPrefix()) || '/');

  const userRow = session.userId > 0
    ? await db.query.users.findFirst({
        where: eq(users.id, session.userId),
        columns: { displayName: true, discordId: true, discordAvatar: true },
      })
    : null;

  const clan = await requireClan();
  // Provisional members AND claim requests — the two things the Needs review tab holds. Counting
  // only the first left somebody stuck outside a clan whose roster already listed them, with no
  // badge anywhere to say a person was waiting. See app/admin/people/layout.
  const [provisionalRows, claimRequests] = await Promise.all([
    db
      .select({ c: count() })
      .from(clanRoster)
      .where(and(eq(clanRoster.clanId, clan.id), eq(clanRoster.provisional, 1), isNull(clanRoster.leftAt)))
      .then((r) => r[0]?.c ?? 0),
    pendingClaimRequests(clan.id).then((r) => r.length),
  ]);
  const provisionalCount = provisionalRows + claimRequests;

  // Flagged proofs across every board — the moderators' queue (/admin/proofs). Badged in the sidebar
  // for whoever may open it; computed only for them.
  const canCheckProofs = redirectFor('/admin/proofs', access) === null;
  const flaggedCount = canCheckProofs
    ? (await flaggedProofBoards(clan.id)).reduce((n, b) => n + b.count, 0)
    : 0;

  // Donations waiting to be believed, badged on the Money group so a treasurer sees them without
  // opening the page. Only counted for the people who can act on them.
  const canHandleMoney = atLeast(session.role, 'admin') || session.role === 'treasurer';
  const cofferPending = canHandleMoney
    ? await db
        .select({ c: count() })
        .from(cofferEntries)
        .where(
          and(
            eq(cofferEntries.clanId, clan.id),
            eq(cofferEntries.kind, 'donation'),
            eq(cofferEntries.status, 'pending'),
          ),
        )
        .then((r) => r[0]?.c ?? 0)
    : 0;

  const isAdmin = atLeast(session.role, 'admin');
  // An authoring grant without a tier: their whole world is the boards they hold. Give them ONLY
  // "My boards"; no dashboard, weekly, clan or schedule. The path gate above already enforced it.
  const isScopedEditor = !isStaffRole(session.role) && session.canEditTiles;
  // The same, for guides: a member who writes guides sees the guides and nothing else.
  const isGuideWriter = !isStaffRole(session.role) && session.canEditGuides;

  // Boards on other clans this one co-hosts. They live at the host's address, so nothing under this
  // clan's admin reached them — and a moderator, who cannot open the events list, had no way at all.
  // Linked straight across: to the host's Tiles tab when they may author it, else to the board.
  const cohosted = await coHostedBoardLinks(clan.id, session.userId, isScopedEditor);
  const cohostedGroup: SidebarGroup | null = cohosted.length
    ? {
        label: 'Co-hosted',
        items: cohosted.map((b) => ({ href: b.href, label: b.name, icon: '🤝', matchPrefix: true })),
      }
    : null;

  if (isScopedEditor || isGuideWriter) {
    const scopedGroups: SidebarGroup[] = [
      ...(isScopedEditor
        ? [
            {
              label: 'Events',
              items: [{ href: '/admin/events', label: 'My boards', icon: '🎯', matchPrefix: true }],
            },
          ]
        : []),
      ...(isGuideWriter
        ? [
            {
              label: 'Content',
              items: [
                { href: '/admin/guides', label: 'Guides', icon: '📖', badge: await pendingUpdateCount(clan.id), matchPrefix: true },
              ],
            },
          ]
        : []),
      ...(cohostedGroup && isScopedEditor ? [cohostedGroup] : []),
    ];
    const scopedUser = {
      displayName: userRow?.displayName ?? session.username ?? 'Editor',
      role: isScopedEditor && isGuideWriter ? 'board & guide editor' : isScopedEditor ? 'board editor' : 'guide editor',
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
  // Feature switches (Admin → Features): a module that is off is hidden for everyone, here included.
  const features = await getClanFeatures(clan.id);

  // Overview is everyone's landing tile.
  //
  // Feedback is NOT here any more. It is reports about Anvil, and on one site there is one product
  // and one operator, who reads them at /staff. See app/staff/feedback.
  groups.push({
    label: 'Overview',
    items: [{ href: '/admin/dashboard', label: 'Dashboard', icon: '⌂', sprite: 'hammer' }],
  });

  // ONE EVENTS GROUP, because there is one kind of thing here — boards and competitions alike. Making
  // something new is the "+ New event" action above the groups (see `primary` below), not an item.
  //
  // Schedule is open to every staff role; the event LIST is admin/editor only (see
  // canManageEvents), so mods and treasurers see the items that are theirs.
  groups.push({
    label: 'Events',
    items: [
      ...(canManageEvents
        ? [{ href: '/admin/events', label: 'All events', icon: '🎯', sprite: 'fireCape' as const, matchPrefix: true }]
        : []),
      { href: '/admin/schedule', label: 'Schedule', icon: '📅', sprite: 'stats' },
      ...(canCheckProofs
        ? [{ href: '/admin/proofs', label: 'Proofs to check', icon: '🔎', sprite: 'clue' as const, badge: flaggedCount }]
        : []),
      // The task catalogue boards are generated from — same authority as tile authoring.
      ...(canManageEvents
        ? [{ href: '/admin/tile-library', label: 'Task library', icon: '📚', sprite: 'casket' as const }]
        : []),
    ],
  });

  if (cohostedGroup) groups.push(cohostedGroup);

  // The people, and who helps run things. Staff & roles is the one place jobs are given.
  const guideUpdates = await pendingUpdateCount(clan.id);
  groups.push({
    label: 'Clan',
    items: [
      // One entry for the People hub — Roster, Needs review, Staff & roles and Who can join are its
      // tabs (app/admin/people/layout). Staff & roles used to be a second sidebar item for one tab.
      { href: '/admin/people', label: 'People', icon: '🛡️', sprite: 'bandos', badge: provisionalCount, matchPrefix: true },
      { href: '/admin/guides', label: 'Guides', icon: '📖', sprite: 'graceful', badge: guideUpdates, matchPrefix: true },
      // Every staff seat may read the clan's history. Admins reach it as a tab of Clan profile (Set
      // up, below), so it is listed here only for those who can't open that.
      ...(isAdmin ? [] : [{ href: '/admin/clan/audit', label: 'Activity log', icon: '📜', sprite: 'clue' as const }]),
    ],
  });

  // The clan's money — fees on events and the coffer — for the people who handle it, and only the
  // parts this clan has switched on.
  if (canHandleMoney && (features.on('coffer') || features.on('fees'))) {
    groups.push({
      label: 'Money',
      items: [
        ...(features.on('coffer')
          ? [{ href: '/admin/coffer', label: 'Coffer', icon: '💰', sprite: 'coins' as const, badge: cofferPending }]
          : []),
        ...(features.on('fees') ? [{ href: '/admin/fees', label: 'Fees', icon: '🪙', sprite: 'ring' as const }] : []),
      ],
    });
  }

  // Set once, rarely touched. Discord is everything Anvil does in the clan's server; Features is what
  // the clan uses at all; the Activity log is who changed what.
  if (isAdmin) {
    groups.push({
      label: 'Set up',
      items: [
        { href: '/admin/integrations', label: 'Discord', icon: '🔌', sprite: 'discord' },
        ...(features.on('announce')
          ? [{ href: '/admin/announce', label: 'Post to Discord', icon: '📣', sprite: 'tinderbox' as const }]
          : []),
        { href: '/admin/features', label: 'Features', icon: '🧩', sprite: 'petRock' },
        { href: '/admin/rules', label: 'Rules & scoring', icon: '📏', sprite: 'stats' },
        { href: '/admin/clan', label: 'Clan profile', icon: '🏰', sprite: 'zenyte', matchPrefix: true },
        // SETUP IS A STATE, NOT A PLACE: listed only while unfinished.
        ...(!setup || setup.allDone || setup.dismissed
          ? []
          : [{ href: '/admin/setup', label: 'Finish setup', icon: '🧭', sprite: 'hammer' as const }]),
      ],
    });
  }

  // The one "make something" action. Admins get the full picker; a moderator may only schedule a
  // competition (lib/adminAccess draws that line by path), so theirs goes straight there — and not at
  // all when the clan has competitions switched off.
  const primary = isAdmin
    ? { href: '/admin/events/new', label: '+ New event' }
    : features.on('weekly')
      ? { href: '/admin/weekly', label: '+ New competition' }
      : undefined;

  const user = {
    displayName: userRow?.displayName ?? session.username ?? 'Admin',
    role: session.role,
    avatarUrl: userRow?.discordId ? avatarUrl(userRow.discordId, userRow.discordAvatar) : null,
  };

  return (
    <div className="lg:flex lg:gap-6">
      <AdminSidebar groups={groups} user={user} primary={primary} guideHref="/guide/admin" />
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
