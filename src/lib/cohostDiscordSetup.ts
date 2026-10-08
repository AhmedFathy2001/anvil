import { cohostsForEvent } from '@/lib/coHost';
import { sendCohostWebhook } from '@/lib/discord';
import { ANVIL_SITE_URL, EMBED_COLOR, clamp, LIMIT } from '@/lib/discordEmbeds';

export interface CohostDiscordSetupRequest {
  clanId: number;
  clanName: string;
  status: 'sent' | 'skipped' | 'failed';
}

/**
 * Ask each accepted co-host to perform its own Discord setup. This deliberately sends instructions,
 * not Discord mutations: the host never receives a co-host guild, role or channel id.
 */
export async function requestCohostDiscordSetup(
  eventId: number,
  eventName: string,
  hostClanName: string,
): Promise<CohostDiscordSetupRequest[]> {
  const cohosts = (await cohostsForEvent(eventId)).filter((cohost) => cohost.status === 'accepted');
  return Promise.all(
    cohosts.map(async (cohost) => {
      const eventSetupUrl = `${ANVIL_SITE_URL}/c/${cohost.clanSlug}/admin/events/${eventId}/teams?step=3`;
      const integrationUrl = `${ANVIL_SITE_URL}/c/${cohost.clanSlug}/admin/integrations`;
      const status = await sendCohostWebhook(cohost.clanId, {
        embeds: [
          {
            title: clamp(`🔧 ${hostClanName} requested Discord setup`, LIMIT.title),
            description: [
              `**${eventName}** is ready for ${cohost.clanName}'s Discord setup.`,
              '',
              `Only **${cohost.clanName}** admins can apply roles in their server. Review the event, give approved contestants your bingo role, and create any private channels your clan wants.`,
              '',
              `→ [Open this event's Discord setup](${eventSetupUrl})`,
              `→ [Review Discord integration settings](${integrationUrl})`,
            ].join('\n'),
            color: EMBED_COLOR.blue,
          },
        ],
      });
      return { clanId: cohost.clanId, clanName: cohost.clanName, status };
    }),
  );
}
