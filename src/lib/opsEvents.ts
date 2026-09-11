// The operator's alarm for the things that are not failures.
//
// `sendOpsWebhook` existed and had exactly one caller: the hourly error digest. So the operator
// channel answered "what broke?" and nothing else — which means the two moments that actually decide
// whether this is a business, somebody signing up and somebody standing up a clan, happened in
// total silence. A clan created on a Saturday night sat unverified until its owner gave up, and the
// first anyone knew was the absence of a clan.
//
// NOTIFICATION IS NOT THE SAME AS RECORDING. Every one of these facts was already in the database —
// `users.created_at`, `clan_audit_log.clan_created`, `clans.ingame_name_verified_at` — and could be
// read by anybody who thought to go and look. The point of a channel is that nobody has to think to.
//
// THREE RULES, and they are what stop an ops channel becoming noise nobody reads:
//
//   1. Fire-and-forget, always. A clan is created inside a transaction; a Discord outage must never
//      be able to fail it, or to slow it down while a webhook times out.
//   2. Every embed carries the way to ACT on it — the operator page, the owner's Discord profile,
//      their email. A notification that makes you go and find the person has moved the work rather
//      than done it.
//   3. Nothing fires when ANVIL_OPS_WEBHOOK_URL is unset, which is every self-hosted instance. A
//      self-hoster has no leads to lose and no channel to lose them in.

import { apexDomain } from '@/lib/apexHost';
import { EMBED_COLOR } from '@/lib/discordEmbeds';
import { log } from '@/lib/logger';
import { sendOpsWebhook, type OpsEmbed } from '@/lib/opsWebhook';

/** Whoever the notification is about, as much of them as we happen to know. */
export interface OpsPerson {
  displayName: string | null;
  discordId: string | null;
  discordUsername: string | null;
  email: string | null;
}

function apexUrl(path: string): string {
  return `https://${apexDomain()}${path}`;
}

/**
 * The person, written so the operator can reach them without a second lookup.
 *
 * The Discord PROFILE link is the useful half and the one that was nowhere: `discord.com/users/<id>`
 * opens a DM-able profile, and the id is the thing we always have (a username can be changed; the
 * snowflake cannot). The email rides alongside because the two channels fail differently — a DM from
 * a stranger can be closed off entirely by a privacy setting, an inbox cannot.
 */
function describePerson(p: OpsPerson): string {
  const lines: string[] = [];
  const name = p.displayName || p.discordUsername || 'Unknown';
  lines.push(p.discordId ? `[${name}](https://discord.com/users/${p.discordId})` : name);
  if (p.discordUsername && p.discordUsername !== name) lines.push(`\`@${p.discordUsername}\``);
  lines.push(p.email ? `\`${p.email}\`` : '_no email on their Discord account_');
  return lines.join('\n');
}

/** Post without making the caller wait, and without letting a webhook failure reach them. */
function fire(embed: OpsEmbed, what: string): void {
  void sendOpsWebhook(embed).catch((err) => log.warn('ops-events.failed', { what }, err));
}

/**
 * Somebody made a clan.
 *
 * THE LEAD, and the one worth interrupting for. A brand-new clan is unverified by definition —
 * verification needs an in-game roster push from an owner-ranked account, which cannot have happened
 * in the seconds since — so this says so plainly rather than reporting it as a problem. What it is
 * for is the clock: the operator now knows to look, and the daily digest will keep asking until
 * somebody does.
 */
export function notifyClanCreated(input: {
  clanId: number;
  slug: string;
  name: string;
  inGameName: string | null;
  owner: OpsPerson;
}): void {
  fire(
    {
      title: `New clan: ${input.name}`,
      description: `[Operator page](${apexUrl(`/staff/clans/${input.clanId}`)}) · [Their site](${apexUrl(`/c/${input.slug}`)})`,
      color: EMBED_COLOR.green,
      fields: [
        { name: 'Owner', value: describePerson(input.owner), inline: false },
        { name: 'In game', value: input.inGameName ? `\`${input.inGameName}\`` : '_not given_', inline: true },
        { name: 'Address', value: `\`/c/${input.slug}\``, inline: true },
      ],
      footer: { text: 'Unverified until somebody pushes a roster from in game' },
    },
    'clan-created',
  );
}

/**
 * Somebody signed in for the first time.
 *
 * Quieter than a clan on purpose — one line, no footer — because this fires far more often and its
 * value is the count as much as any single row. It is still worth having: a signup that never
 * becomes a clan or a seat is the shape of somebody who got stuck, and the only place that was
 * visible before was a `created_at` nobody queries.
 */
export function notifyPersonSignedUp(person: OpsPerson): void {
  fire(
    {
      title: 'New sign-up',
      description: describePerson(person),
      color: EMBED_COLOR.blue,
      fields: [],
    },
    'person-signed-up',
  );
}
