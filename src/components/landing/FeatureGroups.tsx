import ClanLink from '@/components/ClanLink';

/**
 * The landing's feature map: what you can do, grouped by where you do it. Every line here was
 * checked against the product (guide pages and code) — add to it only what exists on beta.
 * Server component, no client JS.
 */
type Item = { title: string; body: string };
type Group = {
  id: string;
  title: string;
  lede: string;
  items: Item[];
  guide: { href: string; label: string };
};

export const FEATURE_GROUPS: Group[] = [
  {
    id: 'events',
    title: 'Events your whole clan can play',
    lede: 'Pick a format, build the board once, and let the plugin do the counting.',
    items: [
      {
        title: 'Bingo that credits itself',
        body: 'The plugin sees the drop, the kill or the level, credits the right player and posts a screenshot as proof. Pets and Champion’s scrolls take one manual screenshot.',
      },
      {
        title: 'Eight formats',
        body: 'Classic bingo, Point Hunt, Tile race, Showdown, Lucky draw, Bounty hunt, Ladder and Solo (everyone for themselves). Team boards work on the board formats.',
      },
      {
        title: 'Tile races with branching roads',
        body: 'Race along a track that splits and merges, so a team picks its route and the leaders are never obvious.',
      },
      {
        title: 'Missions',
        body: 'Hold tiles back and spring them mid-event, by hand, on an interval or on a schedule, each with its own bonus and expiry.',
      },
      {
        title: 'Co-hosted and clan-vs-clan',
        body: 'Run an event with another clan, or put several clans on one board. Invited clans accept first, and players can opt out of a competition.',
      },
    ],
    guide: { href: '/guide/formats', label: 'Event formats guide' },
  },
  {
    id: 'competitions',
    title: 'Competitions every week',
    lede: 'Skill and boss weeks that run themselves, with the numbers to argue about afterwards.',
    items: [
      {
        title: 'Skill and Boss of the Week',
        body: 'Solo, in teams, or clan against clan, with as many clans as you like.',
      },
      {
        title: 'Efficient hours',
        body: 'An efficiency race scores efficient hours played and efficient hours bossed, so a maxed main and a fresh account can compete.',
      },
      {
        title: 'Records',
        body: 'Best day, week, month and year, kept for every player and every clan.',
      },
      {
        title: 'Rank movement',
        body: 'See who climbed, who slipped and by how many places since last time.',
      },
    ],
    guide: { href: '/guide/team-competitions', label: 'Team competitions guide' },
  },
  {
    id: 'plugin',
    title: 'The RuneLite side panel',
    lede: 'Your clan, in the game window you already have open.',
    items: [
      {
        title: 'Do this next',
        body: 'A card that tells you the next thing worth doing for your team, and the race track when the event is a race.',
      },
      {
        title: 'Feed and chat',
        body: 'Three channels: My team, All teams and Announcements.',
      },
      {
        title: 'Lookup',
        body: 'Pull up any player’s stats, bosses and collection log without leaving the game.',
      },
      {
        title: 'Display case and head-to-head',
        body: 'Show off your best items, and challenge a clanmate to first to an item, kills or XP for bragging rights.',
      },
    ],
    guide: { href: '/guide/side-panel', label: 'Side panel guide' },
  },
  {
    id: 'discord',
    title: 'Discord, tuned to your clan',
    lede: 'The bot posts what happened where your clan already talks, and you decide how loud it is.',
    items: [
      {
        title: 'Everything worth announcing',
        body: 'Drops, pets, collection log slots, levels, quests, diaries, combat tasks, deaths, player kills, slayer, clues, speedruns, kill count milestones and more.',
      },
      {
        title: 'Your settings, your voice',
        body: 'Settings for each kind of post, with clan defaults members inherit. Write your own message templates and filter each webhook.',
      },
      {
        title: 'Screenshot privacy',
        body: 'Private messages are hidden in the screenshots the plugin posts.',
      },
      {
        title: 'Built for busy events',
        body: 'Webhook pools spread a rush of posts across several webhooks, and the bot sets your channels up for you.',
      },
    ],
    guide: { href: '/guide/discord', label: 'Discord guide' },
  },
  {
    id: 'fair',
    title: 'Fair play and balanced boards',
    lede: 'A board is only fun if it is fair to build and fair to win.',
    items: [
      {
        title: 'Balance from real data',
        body: 'The balance check weighs tiles by real drop rates and kill speeds, so one lucky-or-miserable tile does not decide the event.',
      },
      {
        title: 'Odds and luck',
        body: 'See how likely a drop was and whether a player is spooned, on rate or dry.',
      },
      {
        title: 'Proof and moderation',
        body: 'Odd-looking submissions are flagged for a human to look at, chat slows itself down in a rush, and staff can ban from a clan.',
      },
    ],
    guide: { href: '/guide/moderator', label: 'Moderator guide' },
  },
  {
    id: 'clans',
    title: 'A home for the clan',
    lede: 'Everything the clan needs between events, not just during them.',
    items: [
      {
        title: 'Clan home and roster',
        body: 'A public clan page, with the roster kept in step with the in-game clan from the plugin.',
      },
      {
        title: 'Staff roles',
        body: 'Owner, admin, treasurer and moderator, each with their own job.',
      },
      {
        title: 'Coffer and prizes',
        body: 'Track the clan coffer and set prizes for each place.',
      },
      {
        title: 'Masses, trips and meetups',
        body: 'Post a clan event as plain information, a one-tap “I’m going”, or sign-ups with places, questions and a fee.',
      },
      {
        title: 'Guides library and boosts',
        body: 'Keep your own copies of in-game guides, and let members boost the clan to unlock its look.',
      },
    ],
    guide: { href: '/guide/clan', label: 'Clan guide' },
  },
  {
    id: 'players',
    title: 'For players, wherever you play',
    lede: 'One account follows you across every clan you join.',
    items: [
      {
        title: 'Profile',
        body: 'Your skills, bosses, clues, times and combat achievements in one place.',
      },
      {
        title: 'Collection log and personal bests',
        body: 'Sync your whole log and your personal bests with one button.',
      },
      {
        title: 'Supporter perks',
        body: 'Name colours and a display case for your best items.',
      },
    ],
    guide: { href: '/guide/profile', label: 'Profile guide' },
  },
];

export default function FeatureGroups() {
  return (
    <>
      {FEATURE_GROUPS.map((g) => (
        <section key={g.id} id={g.id} className="pt-14 sm:pt-16">
          <div className="mb-2.5 flex items-center gap-3">
            <span className="molten h-[22px] w-1 shrink-0 rounded-sm" />
            <h2 className="display text-[clamp(1.35rem,2.6vw,1.7rem)] font-semibold leading-tight [text-wrap:balance]">
              {g.title}
            </h2>
          </div>
          <p className="mb-5 ml-4 max-w-[62ch] text-[14.5px] leading-relaxed text-text-muted">{g.lede}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {g.items.map((i) => (
              <div key={i.title} className="rounded-xl border border-card-border bg-card-bg p-4 sm:p-5">
                <b className="mb-1.5 block text-[14.5px] font-semibold">{i.title}</b>
                <span className="block text-[13.5px] leading-relaxed text-text-muted">{i.body}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 ml-1 text-[13.5px]">
            <ClanLink href={g.guide.href} className="font-medium text-gold hover:text-gold-light">
              {g.guide.label} →
            </ClanLink>
          </p>
        </section>
      ))}
      <section className="pt-14 sm:pt-16">
        <div className="mb-2.5 flex items-center gap-3">
          <span className="molten h-[22px] w-1 shrink-0 rounded-sm" />
          <h2 className="display text-[clamp(1.35rem,2.6vw,1.7rem)] font-semibold leading-tight">
            Guides in 16 languages
          </h2>
        </div>
        <p className="mb-3 ml-4 max-w-[62ch] text-[14.5px] leading-relaxed text-text-muted">
          Every setup guide is available in 16 languages, so your whole clan can read how it works.
        </p>
        <p className="ml-4 text-[13.5px]">
          <ClanLink href="/guide" className="font-medium text-gold hover:text-gold-light">
            Browse all guides →
          </ClanLink>
        </p>
      </section>
    </>
  );
}
