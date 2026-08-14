import Link from 'next/link';
import { verifyUser } from '@/lib/auth';
import { buildHomeView } from '@/lib/homeView';
import { viewerMemberIds } from '@/lib/competitionView';
import { ClanWeek, EventGrid, Hero, LiveNow, WeeklyRail, YouStrip } from '@/components/home/HomeSections';

export const dynamic = 'force-dynamic';

/**
 * The clan home page.
 *
 * It used to be a name, four counters and a list of what was live — which meant a member who opened
 * it between events saw an empty page, and a member who opened it during one saw less than the
 * Discord post already told them. What it never showed was the clan: what anyone actually did this
 * week, who won anything, or that there were thirty competitions before this one.
 *
 * Everything here is assembled in lib/homeView from rows that already exist.
 */
export default async function HomePage() {
  const session = await verifyUser();
  const myMemberIds = await viewerMemberIds(session?.userId ?? null);
  const view = await buildHomeView(myMemberIds);

  return (
    <div>
      <Hero view={view} />
      <YouStrip you={view.you} discordInvite={view.discordInvite} />
      <LiveNow view={view} />
      <WeeklyRail weeklies={view.weeklies} />
      <EventGrid events={view.events} />
      <ClanWeek view={view} />

      <section className="mt-9 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        <QuickLink href="/weekly" emoji="🏆" label="Weekly" />
        <QuickLink href="/team" emoji="🎯" label="My Team" />
        <QuickLink href="/profile" emoji="👤" label="My Profile" />
        {view.discordInvite && <QuickLink href={view.discordInvite} emoji="💬" label="Discord" external />}
      </section>
    </div>
  );
}

function QuickLink({
  href,
  emoji,
  label,
  external,
}: {
  href: string;
  emoji: string;
  label: string;
  external?: boolean;
}) {
  const className =
    'flex items-center gap-2.5 rounded-xl border border-card-border bg-card-bg p-3.5 text-[13.5px] font-semibold transition-colors hover:border-gold/45 hover:bg-card-bg-hover';
  const body = (
    <>
      <span className="text-[17px]" aria-hidden>
        {emoji}
      </span>
      {label}
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {body}
    </a>
  ) : (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}
