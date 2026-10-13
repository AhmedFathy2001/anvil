// Server-side milestone posts to a clan's levels channel.
//
// The plugin announces what it sees happen in the client (99s, total-level steps, maxing). Total-XP
// steps are announced from HERE instead, off lib/statHistory's detection, so they fire for every
// tracked member — the sweep sees mobile play and members without the plugin too — and need no
// plugin release. Only kinds listed below post; every other milestone stays a site-only record.

import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts } from '@/db/schema';
import { forwardPluginNotification } from '@/lib/discord';
import { EMBED_COLOR, type DiscordEmbed } from '@/lib/discordEmbeds';
import { clanTagsGuestEmissions, markGuestPost, socialEmissionClans } from '@/lib/emissionRouting';
import { getNotificationWebhooks } from '@/lib/pluginConfig';
import { totalXpLabel } from '@/lib/totalXpMilestones';

interface NewMilestone {
  kind: string;
  metric: string | null;
  threshold: number;
}

/** The embed for a total-XP step. Exported for tests. */
export function totalXpEmbed(rsn: string, millions: number): DiscordEmbed {
  return {
    title: '📈 Total XP milestone',
    description: `**${rsn}** has reached **${totalXpLabel(millions)}** total XP!`,
    color: EMBED_COLOR.green,
    author: { name: rsn },
  };
}

/**
 * Post the newly inserted milestones that are worth a Discord post. Several steps crossed at once
 * (a member back after months, a first poll in a while) post only the highest — the rest are still
 * recorded on the profile, but a channel doesn't need four posts about one login.
 */
export async function announceMilestones(accountId: number, milestones: NewMilestone[]): Promise<void> {
  const top = milestones
    .filter((m) => m.kind === 'totalxp')
    .reduce<number | null>((best, m) => (best == null || m.threshold > best ? m.threshold : best), null);
  if (top == null) return;

  const [account] = await db.select({ rsn: accounts.rsn }).from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!account) return;

  // Same routing as the plugin's own posts (api/plugin/notify): the member's clans plus shared guest
  // seats, behind the same privacy gate, each to its levels channel.
  const embed = totalXpEmbed(account.rsn, top) as unknown as Record<string, unknown>;
  const sent = new Set<string>();
  for (const ec of await socialEmissionClans(accountId)) {
    const url = (await getNotificationWebhooks(ec.clanId)).levels;
    if (!url || sent.has(url)) continue;
    sent.add(url);
    const guest = ec.kind === 'guest' && (await clanTagsGuestEmissions(ec.clanId));
    const post = guest ? markGuestPost(embed, null) : { embed, content: null };
    await forwardPluginNotification(url, { embed: post.embed ?? null, content: post.content ?? undefined, clanId: ec.clanId });
  }
}
