import ClanLink from '@/components/ClanLink';

/**
 * The landing's feature map, cut down to one line per area with the guide that goes deeper. The long
 * item-by-item version made the front page a wall of 33 cards; the detail lives in the guides and on
 * /features. Server component, no client JS.
 */
const AREAS: { id: string; title: string; lede: string; guide: { href: string; label: string } }[] = [
  { id: 'events', title: 'Events your whole clan can play', lede: 'Pick a format, build the board once, and let the plugin do the counting.', guide: { href: '/guide/formats', label: 'Event formats guide' } },
  { id: 'competitions', title: 'Competitions every week', lede: 'Skill and boss weeks that run themselves, with the numbers to argue about afterwards.', guide: { href: '/guide/team-competitions', label: 'Team competitions guide' } },
  { id: 'plugin', title: 'The RuneLite side panel', lede: 'Your clan, in the game window you already have open.', guide: { href: '/guide/side-panel', label: 'Side panel guide' } },
  { id: 'discord', title: 'Discord, tuned to your clan', lede: 'The bot posts what happened where your clan already talks, and you decide how loud it is.', guide: { href: '/guide/discord', label: 'Discord guide' } },
  { id: 'fair', title: 'Fair play and balanced boards', lede: 'A board is only fun if it is fair to build and fair to win.', guide: { href: '/guide/moderator', label: 'Moderator guide' } },
  { id: 'clans', title: 'A home for the clan', lede: 'Everything the clan needs between events, not just during them.', guide: { href: '/guide/clan', label: 'Clan guide' } },
  { id: 'players', title: 'For players, wherever you play', lede: 'One account follows you across every clan you join.', guide: { href: '/guide/profile', label: 'Profile guide' } },
];

export default function FeatureGroups() {
  return (
    <section className="pt-14 sm:pt-16">
      <div className="mb-2.5 flex items-center gap-3">
        <span className="molten h-[22px] w-1 shrink-0 rounded-sm" />
        <h2 className="display text-[clamp(1.35rem,2.6vw,1.7rem)] font-semibold leading-tight [text-wrap:balance]">
          And everything around the event
        </h2>
      </div>
      <p className="mb-5 ml-4 max-w-[62ch] text-[14.5px] leading-relaxed text-text-muted">
        Weekly competitions, the side panel, Discord, fair play, a home for the clan and a profile that follows you.
      </p>
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
        {AREAS.map((a) => (
          <li key={a.id} className="rounded-xl border border-card-border bg-card-bg p-4 sm:p-5">
            <b className="mb-1 block text-[14.5px] font-semibold">{a.title}</b>
            <span className="block text-[13.5px] leading-relaxed text-text-muted">{a.lede}</span>
            <ClanLink href={a.guide.href} className="mt-2 inline-block text-[13px] font-medium text-gold hover:text-gold-light">
              {a.guide.label} →
            </ClanLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
