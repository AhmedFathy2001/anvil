// The clans that turned up and never got going.
//
// PURE — takes rows and a clock, returns an embed or null — so what the digest SAYS is testable
// without a database or a webhook. The reading and posting live in the cron route, exactly like
// lib/errorDigest.
//
// WHAT A LEAD GOING COLD LOOKS LIKE. A clan is created in seconds and is unverified by definition
// for as long as nobody pushes a roster from in game — verification needs an owner-ranked account in
// the real clan, which is a thing the founder has to go and do in a game client. Most do it within a
// day. The ones who do not are not a slow queue; they are people who hit something and stopped, and
// nothing about the platform ever said so. The clan simply existed, empty, until it was forgotten.
//
// So this reports the ones that have HAD time and still have nothing, and it names the person to
// talk to rather than the clan — because the action is a message, not a database change.
//
// SILENT WHEN THERE IS NOTHING, for the same reason the error digest is: a daily "0 stalled" trains
// everybody to skip past the channel, which costs the one alarm it exists to raise.

import { EMBED_COLOR } from '@/lib/discordEmbeds';
import type { OpsEmbed } from '@/lib/opsWebhook';

/** How many clans one digest names before it stops being a message and becomes a report. */
export const LEADS_LIMIT = 10;

/**
 * How long a clan gets to sort itself out before anyone is asked to look.
 *
 * A day, because verification is a thing you do in a game client and somebody who signed up at
 * midnight should not be chased at 04:00. Anything younger is not stalled, it is new.
 */
export const GRACE_HOURS = 24;

/** Past this, a nudge is archaeology rather than a follow-up — it belongs in /staff/clans, not here. */
export const STALE_DAYS = 30;

export interface LeadRow {
  id: number;
  slug: string;
  name: string;
  inGameName: string | null;
  createdAt: string | null;
  verified: boolean;
  members: number;
  events: number;
  ownerName: string | null;
  ownerDiscordId: string | null;
  ownerEmail: string | null;
}

/** Why this clan is in the digest. The first true one wins — they are ordered by how stuck it is. */
export type LeadReason = 'unverified' | 'no-members' | 'no-events';

export function reasonFor(row: LeadRow): LeadReason | null {
  // UNVERIFIED FIRST, because it blocks the other two rather than sitting beside them: a clan that
  // cannot sync a roster cannot gain members, and a clan with no members has nobody to run an event
  // for. Reporting all three of a clan's problems would be reporting the same problem three times.
  if (!row.verified) return 'unverified';
  if (row.members === 0) return 'no-members';
  if (row.events === 0) return 'no-events';
  return null;
}

const REASON_LABEL: Record<LeadReason, string> = {
  unverified: 'never verified — cannot sync a roster',
  'no-members': 'verified, but nobody on the roster',
  'no-events': 'has members, has never run anything',
};

/**
 * When this clan was made, in millis. Null when the stamp is missing or unreadable.
 *
 * Two timestamp formats live in these columns (lib/dbTime): a JS ISO string, and Postgres's
 * space-separated UTC. Normalising the space is what makes both parse — and an unreadable stamp
 * returns null rather than `NaN`, so a clan with a broken one is left alone instead of being
 * reported as infinitely old every single day.
 */
export function createdMs(createdAt: string | null): number | null {
  if (!createdAt) return null;
  const ms = Date.parse(createdAt.includes('T') ? createdAt : `${createdAt.replace(' ', 'T')}Z`);
  return Number.isNaN(ms) ? null : ms;
}

/** Whole days between creation and now. Null when the stamp is unreadable. */
export function ageDays(createdAt: string | null, now: number): number | null {
  const ms = createdMs(createdAt);
  return ms == null ? null : Math.floor((now - ms) / 86_400_000);
}

/** In the window: old enough to have had a chance, young enough for a nudge to be welcome. */
export function isChaseable(row: LeadRow, now: number): boolean {
  const ms = createdMs(row.createdAt);
  if (ms == null) return false;
  const hours = (now - ms) / 3_600_000;
  return hours >= GRACE_HOURS && hours <= STALE_DAYS * 24 && reasonFor(row) != null;
}

/**
 * The message, or null when nothing needs chasing.
 *
 * Oldest first: a clan that has been stuck for three weeks is closer to lost than one stuck since
 * yesterday, and a list that leads with the newest buries exactly the ones running out of time.
 */
export function buildLeadsDigest(rows: LeadRow[], now: number): OpsEmbed | null {
  const chaseable = rows
    .filter((r) => isChaseable(r, now))
    .sort((a, b) => (ageDays(a.createdAt, now) ?? 0) - (ageDays(b.createdAt, now) ?? 0))
    .reverse();

  if (chaseable.length === 0) return null;

  const shown = chaseable.slice(0, LEADS_LIMIT);
  const fields = shown.map((r) => {
    const days = ageDays(r.createdAt, now) ?? 0;
    const who = r.ownerDiscordId
      ? `[${r.ownerName ?? 'owner'}](https://discord.com/users/${r.ownerDiscordId})`
      : (r.ownerName ?? '_no owner_');
    const mail = r.ownerEmail ? ` · \`${r.ownerEmail}\`` : '';
    return {
      name: `${r.name} — ${days}d`,
      value: `${REASON_LABEL[reasonFor(r)!]}\n${who}${mail}`,
      inline: false,
    };
  });

  const more = chaseable.length - shown.length;
  return {
    title: `${chaseable.length} clan${chaseable.length === 1 ? '' : 's'} stalled after signing up`,
    description:
      'Created more than a day ago and still not off the ground. Each one is somebody who tried ' +
      'and stopped — a message usually fixes it.' +
      (more > 0 ? `\n\n_…and ${more} more on /staff/clans._` : ''),
    color: EMBED_COLOR.amber,
    fields,
    footer: { text: 'Daily · silent when nothing is stalled' },
  };
}
