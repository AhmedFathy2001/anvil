import type { Metadata } from 'next';
import { requireClan } from '@/lib/clanContext';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { clanSectionMetadata } from '@/lib/seoPages';
import { notFound } from 'next/navigation';
import { getMemberProfile } from '@/lib/memberProfile';
import { profileLinkState } from '@/lib/profileLink';
import { verifyUser } from '@/lib/auth';
import { memberLinkDescription } from '@/lib/linkText';
import { clanVisibilityOf } from '@/lib/clanVisibility';
import ClanLink from '@/components/ClanLink';
import CharacterProfile from '@/components/character/CharacterProfile';

export const dynamic = 'force-dynamic';

/**
 * A member's page inside a clan, named for both.
 *
 * "Zezima — Anvil" said the product's name and not the clan's, which is the wrong half: this page is
 * one character AS SEEN BY ONE CLAN, and the same RSN has a different page in every clan it plays
 * for. The clan is what tells those apart.
 */
export async function generateMetadata({ params }: { params: Promise<{ rsn: string }> }): Promise<Metadata> {
  const { rsn } = await params;
  const name = decodeURIComponent(rsn);
  const clan = await requireClan();
  const clanName = (await getClanDisplayName(clan.id, clan.name)) || clan.name;
  // Live numbers only for a public clan. A private clan's page shows strangers the "this clan is
  // private" card, and its link preview must say no more than that card does.
  const profile = clanVisibilityOf(clan.visibility) === 'public' ? await getMemberProfile(clan.id, name) : null;
  return clanSectionMetadata({
    title: `${profile?.rsn ?? name} — ${clanName}`,
    description: profile ? memberLinkDescription(profile, clanName) : `Skills, bosses, efficient hours and competition history for ${name} of ${clanName}.`,
    image: `/api/og/member/${clan.slug}/${encodeURIComponent(profile?.rsn ?? name)}`,
  });
}

export default async function MemberProfilePage({
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
  const { rsn } = await params;
  const clan = await requireClan();
  const profile = await getMemberProfile(clan.id, decodeURIComponent(rsn));
  if (!profile) notFound();
  // Public page: the viewer only unlocks the persona and the owner's editing (components/character).
  const viewer = await verifyUser();

  // The one character profile (components/character), in its clan context — shared with /p/ and /profile.
  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <ClanLink href="/members" className="text-sm text-text-muted hover:text-gold">
        ← All members
      </ClanLink>
      <CharacterProfile context={{ kind: 'clan', clanId: clan.id, seat: profile }} viewer={viewer} link={link} progressTab={progressTab} />
    </main>
  );
}
