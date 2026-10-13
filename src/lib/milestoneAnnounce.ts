// Server-side milestone posts to a clan's levels channel (and the member's own webhooks).
//
// The plugin announces what it sees happen in the client (level-ups, total-level steps, maxing). XP
// steps are announced from HERE instead, off lib/statHistory's detection, so they fire for every
// tracked member — the sweep sees mobile play and members without the plugin too — and need no
// plugin release. Only total-XP ('totalxp') and per-skill XP ('xp') rows post, and only where the
// destination's rules ask for them (lib/levelRules): the clan's `totalXpStepM` / `skillXpM` after
// the member's own choice, and the member's personal rules for their own webhooks. Every other
// milestone stays a site-only record.

import { forwardPluginNotification } from '@/lib/discord';
import { EMBED_COLOR, type DiscordEmbed } from '@/lib/discordEmbeds';
import { clanTagsGuestEmissions, markGuestPost, personalWebhookTargets, socialEmissionClans } from '@/lib/emissionRouting';
import { effectiveClanRules, xpPostsFor, type XpMilestoneRow, type XpRules } from '@/lib/levelRules';
import { getClanMilestoneRules, levelPrefsForAccount } from '@/lib/levelRulesStore';
import { getNotificationWebhooks } from '@/lib/pluginConfig';
import { skillIconUrl } from '@/lib/tileIcons';
import { totalXpLabel } from '@/lib/totalXpMilestones';

/** The embed for a total-XP step. Exported for tests. */
export function totalXpEmbed(rsn: string, millions: number): DiscordEmbed {
  return {
    title: '📈 Total XP milestone',
    description: `**${rsn}** has reached **${totalXpLabel(millions)}** total XP!`,
    color: EMBED_COLOR.green,
    author: { name: rsn },
  };
}

/** The embed for a per-skill XP step (`xp` is RAW xp, as the 'xp' milestone rows store it). Exported for tests. */
export function skillXpEmbed(rsn: string, skill: string, xp: number): DiscordEmbed {
  const name = skill.charAt(0).toUpperCase() + skill.slice(1);
  const e: DiscordEmbed = {
    title: `📈 ${name} XP milestone`,
    description: `**${rsn}** has reached **${totalXpLabel(Math.round(xp / 1_000_000))}** ${name} XP!`,
    color: EMBED_COLOR.green,
    author: { name: rsn },
  };
  const icon = skillIconUrl(skill);
  if (icon) e.thumbnail = { url: icon };
  return e;
}

function embedsFor(rsn: string, rules: XpRules | null, rows: XpMilestoneRow[]): DiscordEmbed[] {
  const { totalXpM, skills } = xpPostsFor(rules, rows);
  const out: DiscordEmbed[] = [];
  if (totalXpM != null) out.push(totalXpEmbed(rsn, totalXpM));
  for (const s of skills) out.push(skillXpEmbed(rsn, s.skill, s.xp));
  return out;
}

/**
 * Post the newly inserted milestones that are worth a Discord post. Several steps crossed at once
 * (a member back after months, a first poll in a while) post only the highest per destination —
 * the rest are still recorded on the profile, but a channel doesn't need four posts about one login.
 */
export async function announceMilestones(accountId: number, milestones: XpMilestoneRow[]): Promise<void> {
  const rows = milestones.filter((m) => m.kind === 'totalxp' || m.kind === 'xp');
  if (rows.length === 0) return;

  const { userId, rsn, prefs } = await levelPrefsForAccount(accountId);
  if (!rsn) return;

  // Same routing as the plugin's own posts (api/plugin/notify): the member's clans plus shared guest
  // seats, behind the same privacy gate, each to its levels channel under that clan's rules.
  const sent = new Set<string>();
  for (const ec of await socialEmissionClans(accountId)) {
    const url = (await getNotificationWebhooks(ec.clanId)).levels;
    if (!url || sent.has(url)) continue;
    const rules = effectiveClanRules(await getClanMilestoneRules(ec.clanId), prefs.clanChoice);
    const embeds = embedsFor(rsn, rules, rows);
    if (embeds.length === 0) continue;
    sent.add(url);
    const guest = ec.kind === 'guest' && (await clanTagsGuestEmissions(ec.clanId));
    for (const embed of embeds) {
      const raw = embed as unknown as Record<string, unknown>;
      const post = guest ? markGuestPost(raw, null) : { embed: raw, content: null };
      await forwardPluginNotification(url, { embed: post.embed ?? null, content: post.content ?? undefined, clanId: ec.clanId });
    }
  }

  // The person's own webhooks that take level posts, under their own rules.
  if (userId == null) return;
  const personal = embedsFor(rsn, prefs.personal, rows);
  if (personal.length === 0) return;
  for (const t of await personalWebhookTargets(userId, 'levels')) {
    if (sent.has(t.url)) continue;
    sent.add(t.url);
    for (const embed of personal) {
      await forwardPluginNotification(t.url, { embed: embed as unknown as Record<string, unknown>, clanId: undefined });
    }
  }
}
