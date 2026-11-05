import SectionHeader from '@/components/SectionHeader';

/**
 * The heading + tabs for the clan's settings hub: Clan profile, Features, Rules & scoring and the
 * Activity log. Things an admin sets once and rarely touches, so the sidebar carries ONE "Clan
 * settings" item for all of them instead of daily-looking entries — with these tabs named under it
 * (app/admin/layout `children`), because nobody found Rules & scoring behind that one word.
 *
 * Features and Rules & scoring live outside /admin/clan (their paths are bookmarked and linked from
 * guides), so this is rendered by the clan layout AND by those two pages. SectionHeader tabs every
 * page listed here that the viewer may open, wherever they are — keep this list the one place the
 * hub's pages are named, or a page drops out of reach from its siblings.
 */
export default function ClanSettingsHeader({ isAdmin }: { isAdmin: boolean }) {
  return (
    <SectionHeader
      pages={[
        { href: '/admin/clan', exact: true, title: 'Clan profile', tab: 'Profile', blurb: 'How the clan looks to everyone else.', show: isAdmin },
        {
          href: '/admin/features',
          title: 'Features',
          blurb: 'Switch on only what your clan uses. Anything switched off is hidden for everyone, staff and members alike. Nothing is deleted, so switching it back on brings it all back.',
          show: isAdmin,
        },
        {
          href: '/admin/rules',
          title: 'Rules & scoring',
          blurb: 'Clan-wide rules every event uses. Each event can still change its own on its Settings page.',
          show: isAdmin,
        },
        {
          href: '/admin/clan/boosts',
          title: 'Boosts',
          blurb: 'What your members’ boosts unlock: the clan’s level, its recruiting line and its monthly post in the Anvil Discord. Looks only.',
          show: isAdmin,
        },
        { href: '/admin/clan/audit', title: 'Activity log', blurb: 'Who joined, left, changed what, and when.' },
      ]}
    />
  );
}
