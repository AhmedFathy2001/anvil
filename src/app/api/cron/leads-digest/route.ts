import { NextResponse } from 'next/server';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import { db } from '@/db';
import { accounts, clanMemberships, clanStaff, clans, events as eventsTable, users } from '@/db/schema';
import { timingSafeStrEqual } from '@/lib/auth';
import { dayKey } from '@/lib/dbTime';
import { buildLeadsDigest, type DayCounts, type LeadRow, type StalledPerson } from '@/lib/leadsDigest';
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

  // YESTERDAY IN NUMBERS, which is what replaced a Discord post per sign-in. A first sign-in has
  // nothing to act on — no character, no clan, nothing to say — so interrupting for one was noise
  // that would have buried the clan posts under any kind of launch. The count is the part worth
  // seeing, and it belongs on the message somebody already reads.
  //
  // COMPARED ON THE DATE PREFIX, not on the whole stamp. These columns hold two formats — a column
  // default writes "2026-09-10 18:00:00" and JS writes "2026-09-10T18:00:00.000Z" — and space
  // (0x20) sorts below T (0x54), so `created_at >= <an ISO cutoff>` excludes every row the database
  // wrote itself. Which is all of them: every one of these three tables gets its stamp from the
  // column default, so the whole headline would have read 0 forever. lib/dbTime says exactly this
  // and says to use dayKey, which only ever compares the ten characters both formats share.
  //
  // A calendar day rather than a rolling 24 hours, because the message says "Yesterday": the digest
  // runs once a day, so a whole finished day neither double-counts nor leaves a gap.
  const yesterday = dayKey(Date.now(), 1);
  const onDay = (col: AnyPgColumn) => sql`substr(${col}, 1, 10) = ${yesterday}`;
  const [signUps, clansCreated, charactersLinked] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(users).where(onDay(users.createdAt)).then((r) => Number(r[0]?.n ?? 0)),
    db.select({ n: sql<number>`count(*)` }).from(clans).where(onDay(clans.createdAt)).then((r) => Number(r[0]?.n ?? 0)),
    db.select({ n: sql<number>`count(*)` }).from(accounts).where(onDay(accounts.createdAt)).then((r) => Number(r[0]?.n ?? 0)),
  ]);
  const counts: DayCounts = { signUps, clansCreated, charactersLinked };

  // The person equivalent of a stalled clan: signed up over a day ago, and still holds no seat
  // anywhere and has linked no character. Bounded hard — this is a count with examples, not a list.
  const stalledPeople = await db
    .select({
      displayName: users.displayName,
      discordId: users.discordId,
      email: users.email,
      seats: sql<number>`(
        select count(*) from ${clanMemberships} m
        join ${accounts} a on a.id = m.account_id
        where a.player_id = users.player_id and m.left_at is null
      )`,
      characters: sql<number>`(select count(*) from ${accounts} a where a.player_id = users.player_id)`,
    })
    .from(users)
    // Same prefix comparison, same reason: "signed up before yesterday" is at least a day old.
    .where(and(sql`substr(${users.createdAt}, 1, 10) < ${yesterday}`, isNull(users.bannedAt)))
    .orderBy(sql`${users.createdAt} desc`)
    .limit(200);

  const people: StalledPerson[] = stalledPeople
    .filter((p) => Number(p.seats ?? 0) === 0 && Number(p.characters ?? 0) === 0)
    .map((p) => ({ displayName: p.displayName, discordId: p.discordId, email: p.email }));

  const embed = buildLeadsDigest({ clans: leads, counts, people }, Date.now());
  if (!embed) {
    log.info('leads-digest.quiet', { clans: leads.length });
    return NextResponse.json({ posted: false, clans: leads.length });
  }

  const posted = await sendOpsWebhook(embed);
  log.info('leads-digest.sent', { posted, ...counts, people: people.length });
  return NextResponse.json({ posted, ...counts, people: people.length });
}
