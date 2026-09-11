// The operator's own channel.
//
// SEPARATE FROM EVERY CLAN WEBHOOK, and deliberately env-only rather than a setting. Clan webhooks
// are configured by clan admins in the admin UI and point at clan channels; this one points wherever
// the person who runs the deployment wants to be woken up, and no clan admin should be able to
// discover it, change it, or send to it.
//
// Env also makes it correct for a self-hoster by default: unset means no ops channel, which means
// the digest quietly does nothing rather than failing. Nobody is required to wire this up, and the
// errors are still recorded and still visible on /staff/errors without it.

import { isDiscordWebhookUrl } from '@/lib/discordWebhookUrl';
import { log } from '@/lib/logger';

export interface OpsEmbed {
  title: string;
  description: string;
  color: number;
  fields: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
}

/**
 * Configured, and a real Discord webhook. A misconfigured value is treated as unset, loudly once.
 *
 * FALLS BACK TO THE DEPLOY CHANNEL, because a box that announces its own deploys to Discord has
 * already answered "where does the person who runs this want to be woken up?" — and asking the same
 * question twice is how one of the two answers ends up blank. It was blank: this box has announced
 * every deploy for months from DEPLOY_DISCORD_WEBHOOK while ANVIL_OPS_WEBHOOK_URL was never set, so
 * the hourly error digest had nowhere to post and had therefore never posted. Nothing was broken and
 * nothing said so, which is the failure mode a fallback exists to remove.
 *
 * Order matters and is the obvious way round: a deployment explicitly configuring an ops channel
 * means to separate the two, and must not have that overridden by the deploy one merely existing.
 */
export function opsWebhookUrl(): string | null {
  const raw = (process.env.ANVIL_OPS_WEBHOOK_URL || process.env.DEPLOY_DISCORD_WEBHOOK)?.trim();
  if (!raw) return null;
  // The same SSRF guard the user-supplied webhooks get. This one is set by the operator rather than
  // by a stranger, so it is a typo check more than a defence — but a URL the server POSTs to should
  // never be exempt from the rule just because of who typed it.
  if (!isDiscordWebhookUrl(raw)) {
    log.warn('ops-webhook.invalid', { reason: 'not a Discord webhook URL' });
    return null;
  }
  return raw;
}

/**
 * Post to the ops channel. Returns false when unset or the post failed — never throws, because every
 * caller is a cron job whose real work must not be undone by a Discord hiccup.
 */
export async function sendOpsWebhook(embed: OpsEmbed): Promise<boolean> {
  const url = opsWebhookUrl();
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
    if (!res.ok) {
      log.warn('ops-webhook.failed', { status: res.status });
      return false;
    }
    return true;
  } catch (err) {
    log.warn('ops-webhook.error', {}, err);
    return false;
  }
}
