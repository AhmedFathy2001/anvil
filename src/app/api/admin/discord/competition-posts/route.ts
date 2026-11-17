import { NextResponse } from 'next/server';

import { verifyAdmin } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { COMPETITION_POST_TYPES, clanCompetitionDefault, sampleCompetitionEmbed } from '@/lib/competitionPosts';
import { loadClanCompetitionPosts, saveClanCompetitionPosts } from '@/lib/competitionPostsRun';
import { refuseForCreatorSpace } from '@/lib/creatorGuard';

/**
 * Which competition posts this clan's Discord gets (lib/competitionPosts): the start, the daily
 * recap, the halfway report, "ending soon" and the results, each on or off. A competition can
 * change any of them on its own Settings tab. Admins only, like the rest of the clan's Discord page.
 *
 *   GET            the switches as they stand, and a sample of each new post for the preview
 *   PUT { posts }  save them
 */

async function view(clanId: number) {
  const stored = await loadClanCompetitionPosts(clanId);
  return { posts: Object.fromEntries(COMPETITION_POST_TYPES.map((t) => [t.key, clanCompetitionDefault(t.key, stored)])) };
}

export async function GET() {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const clan = await requireClan();
  return NextResponse.json({
    ...(await view(clan.id)),
    // Made-up players, built by the same code that builds the real posts. Nothing is sent anywhere.
    samples: { daily: sampleCompetitionEmbed('daily'), halfway: sampleCompetitionEmbed('halfway'), endingSoon: sampleCompetitionEmbed('endingSoon') },
  });
}

export async function PUT(request: Request) {
  const notForCreators = await refuseForCreatorSpace();
  if (notForCreators) return notForCreators;
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const clan = await requireClan();
  const body = (await request.json().catch(() => ({}))) as { posts?: unknown };
  if (!body.posts || typeof body.posts !== 'object') return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });
  await saveClanCompetitionPosts(clan.id, { ...(await loadClanCompetitionPosts(clan.id)), ...(body.posts as object) });
  return NextResponse.json(await view(clan.id));
}
