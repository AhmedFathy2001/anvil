import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanMemberships, clanStaff, clans, events as eventsTable, users } from '@/db/schema';
import { timingSafeStrEqual } from '@/lib/auth';
import { buildLeadsDigest, type LeadRow } from '@/lib/leadsDigest';
import { sendOpsWebhook } from '@/lib/opsWebhook';
import { log } from '@/lib/logger';

// The clans that signed up and never got going.
//
// Daily. `notifyClanCreated` covers the moment one is made; this covers the moment nobody did
// anything about it. Those are different alarms: the first is news, the second is a to-do list that
// gets longer while you are not looking, and only the second is what "we are losing leads" means.
//
// SILENT WHEN THERE IS NOTHING TO SAY, like the error digest — a daily "0 stalled" is how a channel
// becomes wallpaper.
//
// NOT A STATE MACHINE. Nothing is written: no "nudged_at", no queue, no suppression. A clan leaves
// the digest by getting verified, gaining a member, or running something — by being fixed, in other
// words — and until then it keeps appearing, which is the correct behaviour for a list of people
// waiting on you. The cost of that is seeing the same clan twice; the cost of the alternative is
// forgetting one after the first mention, which is the bug this whole thing is about.

export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production' && !CRON_SECRET) {
    return NextResponse.json(
      { error: 'Server misconfigured: CRON_SECRET is required in production' },
      { status: 500 },
    );
  }
  const authHeader = request.headers.get('authorization');
  const hasValidSecret = !!CRON_SECRET && timingSafeStrEqual(authHeader ?? '', `Bearer ${CRON_SECRET}`);
  const devBypass = !CRON_SECRET && request.headers.get('x-vercel-cron') === '1';
  if (!hasValidSecret && !devBypass) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // clan-scope: global -- the operator's digest spans every clan by definition; a clan that has not
  // got going is invisible from inside itself.
  const rows = await db
    .select({
      id: clans.id,
      slug: clans.slug,
      name: clans.name,
      inGameName: clans.inGameName,
      createdAt: clans.createdAt,
      verifiedAt: clans.ingameNameVerifiedAt,
      // Written out rather than interpolated: drizzle renders an interpolated column unqualified
      // inside a raw fragment, and each subquery has an `id` of its own — see lib/platformView.
      members: sql<number>`(
        select count(*) from ${clanMemberships} m
        where m.clan_id = clans.id and m.left_at is null and m.kind = 'member'
      )`,
      events: sql<number>`(select count(*) from ${eventsTable} e where e.clan_id = clans.id)`,
      ownerName: sql<string | null>`(
        select u.display_name from ${clanStaff} cs
        join ${users} u on u.id = cs.user_id
        where cs.clan_id = clans.id and cs.role = 'owner' limit 1
      )`,
      ownerDiscordId: sql<string | null>`(
        select u.discord_id from ${clanStaff} cs
        join ${users} u on u.id = cs.user_id
        where cs.clan_id = clans.id and cs.role = 'owner' limit 1
      )`,
      ownerEmail: sql<string | null>`(
        select u.email from ${clanStaff} cs
        join ${users} u on u.id = cs.user_id
        where cs.clan_id = clans.id and cs.role = 'owner' limit 1
      )`,
    })
    .from(clans)
    .where(eq(clans.status, 'active'));

  const leads: LeadRow[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    inGameName: r.inGameName,
    createdAt: r.createdAt,
    verified: r.verifiedAt != null,
    members: Number(r.members ?? 0),
    events: Number(r.events ?? 0),
    ownerName: r.ownerName,
    ownerDiscordId: r.ownerDiscordId,
    ownerEmail: r.ownerEmail,
  }));

  const embed = buildLeadsDigest(leads, Date.now());
  if (!embed) {
    log.info('leads-digest.quiet', { clans: leads.length });
    return NextResponse.json({ posted: false, clans: leads.length });
  }

  const posted = await sendOpsWebhook(embed);
  log.info('leads-digest.sent', { posted, stalled: embed.fields.length });
  return NextResponse.json({ posted, stalled: embed.fields.length });
}
