import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { apexCharacter } from '@/lib/apexProfiles';
import { isApexHost } from '@/lib/clanContext';
import { verifyUser } from '@/lib/auth';
import { profileLinkState } from '@/lib/profileLink';
import { configuredOrigin } from '@/lib/request-origin';
import { getAccountProfile } from '@/lib/memberProfile';
import CharacterProfile from '@/components/character/CharacterProfile';
import ReportButton from '@/components/ReportButton';

export const dynamic = 'force-dynamic';

/**
 * One CHARACTER — an OSRS account, not the human behind it.
 *
 * The distinction is the identity model in the URL bar: /p/drenvox-mdps is a character, /u/<id> is
 * the person who plays it, and the old one-clan-per-database model had no way to tell them apart.
 *
 * THE SAME PROFILE THE CLAN GETS. This was a stub — four rows in a box — because everything worth
 * showing looked clan-shaped: the rich profile hung off a roster seat, and the apex has no seats. It
 * turned out nothing on it actually did. Every number here comes off the ACCOUNT, which is what
 * Jagex tracks, so /p/ and a clan's own member page now render the same component from the same
 * builder; the clan page adds only what a roster knows on top.
 *
 * WHAT IS DELIBERATELY ABSENT is anything a clan owns: standings ("#3 of 47" means nothing without
 * a clan to be third in), competition history, and the persona card. And nothing from Discord — this
 * page is public, and a character's owner is named only when they published the link themselves.
 *
 * Only shown when the account is shared. The apex holds no seat for anyone, so the visibility rule —
 * seat in the clan, or shared — leaves only the second half here. A page saying "this exists but you
 * may not see it" would disclose the very thing being withheld, so an unshared character is a 404,
 * indistinguishable from one that does not exist.
 */

/**
 * What this page looks like when somebody pastes the link.
 *
 * It was a title and nothing else, so a character profile dropped into a Discord channel unfurled as
 * a bare filename — which is most of why nobody shared one. A profile whose whole purpose is to be
 * handed to somebody has to survive the handing over: the card carries the numbers the page opens
 * with, so the link says something before anyone clicks it.
 *
 * A private page (visible only to its owner) is marked noindex. It already 404s for everyone else,
 * but a page that exists at a guessable URL should not also be inviting a crawler to remember it.
 */
export async function generateMetadata({ params }: { params: Promise<{ rsn: string }> }): Promise<Metadata> {
  const session = await verifyUser();
  const c = await apexCharacter(decodeURIComponent((await params).rsn), session?.playerId ?? null);
  if (!c) return { title: 'Not found — Anvil' };

  const profile = await getAccountProfile(c.accountId);
  const bits: string[] = [];
  if (profile && profile.totalLevel > 0) bits.push(`${profile.totalLevel.toLocaleString()} total level`);
  if (c.overallXp != null) bits.push(`${compact(c.overallXp)} XP`);
  if (profile?.combatLevel != null) bits.push(`combat ${profile.combatLevel}`);
  if (c.clan) bits.push(c.clan.name);
  const description = bits.length > 0
    ? `${c.rsn} — ${bits.join(' · ')}. Skills, bosses, collection log and milestones, tracked on Anvil.`
    : `${c.rsn} on Anvil — skills, bosses, collection log and milestones.`;

  const title = `${c.rsn} — Anvil`;
  const origin = configuredOrigin();
  const url = origin ? `${origin}/p/${encodeURIComponent(c.rsn)}` : undefined;
  // Drawn as a stranger sees it: an unshared character's card is the plain Anvil one.
  const image = `/api/og/player/${encodeURIComponent(c.rsn)}`;

  return {
    title,
    description,
    ...(c.privateToViewer ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title,
      description,
      type: 'profile',
      ...(url ? { url } : {}),
      siteName: 'Anvil',
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default async function CharacterPage({
  params,
  searchParams,
}: {
  params: Promise<{ rsn: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Deep links: ?tab=, ?stat=, ?page= (a log page) and ?progress= (quests / diaries / combat).
  const sp = await searchParams;
  const link = profileLinkState(sp);
  const progressTab = typeof sp.progress === 'string' ? sp.progress : undefined;
  if (!isApexHost((await headers()).get('host'))) notFound();

  const session = await verifyUser();
  const character = await apexCharacter(decodeURIComponent((await params).rsn), session?.playerId ?? null);
  if (!character) notFound();

  const profile = await getAccountProfile(character.accountId);
  if (!profile) notFound();

  // The one character profile (components/character) in its public context: no clan placings,
  // persona, competition history or moments — those are a clan's, and this page has no clan behind it.
  return (
    <div className="mx-auto w-full max-w-5xl">
      <CharacterProfile context={{ kind: 'public', character, profile }} viewer={session} link={link} progressTab={progressTab} />
      {/* To Anvil staff, never the player (lib/platformReports). Signed in, and not your own. */}
      {session?.userId && !character.viewerOwns && (
        <div className="mt-6 flex justify-end">
          <ReportButton type="character" id={character.accountId} label="Report this profile" />
        </div>
      )}
    </div>
  );
}

function compact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}
