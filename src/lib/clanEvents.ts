import { and, eq, inArray, isNull, or, ne, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanEventRsvps, clanEvents, clans, users, type ClanEvent } from '@/db/schema';
import { type Occurrence, currentOccurrence, dueNotice, phaseOf } from '@/lib/clanEventTimes';
import { clanEventThumbnail, sendClanEventPost, siteBaseUrl, upsertClanEventPost } from '@/lib/discord';
import { type DiscordEmbed, EMBED_COLOR, LIMIT, clamp, field } from '@/lib/discordEmbeds';
import { log } from '@/lib/logger';
import { isValidTimeZone } from '@/lib/zonedTime';

// Clan events: what a clan hosts that nothing tracks — a weekly boss mass, a skilling hangout. Staff
// schedule one (one-off or weekly, in their own zone); it's announced in Discord and edited in place,
// reminded 15 minutes out and at the start (processClanEventReminders, every minute), listed on the
// site and in the plugin's Clan tab, and members say "I'm going" per occurrence.

export interface ClanEventView {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  world: number | null;
  icon: string | null;
  host: string | null;
  repeat: 'none' | 'weekly';
  timezone: string;
  durationMin: number;
  startsAt: string;
  repeatUntil: string | null;
  ping: boolean;
  occurrence: Occurrence;
  phase: 'upcoming' | 'soon' | 'live';
  going: number;
  /** Who's going (display names), up to 20. */
  goingNames: string[];
  /** Whether the asking person is going. */
  mine: boolean;
}

/** The clan's events with an occurrence still ahead (or on now), soonest first. */
export async function listClanEvents(clanId: number, opts: { userId?: number | null; now?: number; withinDays?: number } = {}): Promise<ClanEventView[]> {
  const now = opts.now ?? Date.now();
  const rows = await db.query.clanEvents.findMany({ where: and(eq(clanEvents.clanId, clanId), isNull(clanEvents.cancelledAt)) });
  const horizon = opts.withinDays != null ? now + opts.withinDays * 86_400_000 : Infinity;
  const live = rows
    .map((e) => ({ e, o: currentOccurrence(e, now) }))
    .filter((x): x is { e: ClanEvent; o: Occurrence } => x.o != null && Date.parse(x.o.start) <= horizon)
    .sort((a, b) => Date.parse(a.o.start) - Date.parse(b.o.start));
  return withGoing(live, opts.userId ?? null, now);
}

/** One event as the site and the plugin show it, with its occurrence on now or next; null when over or cancelled. */
export async function getClanEvent(clanId: number, id: number, userId: number | null = null, now = Date.now()): Promise<ClanEventView | null> {
  const e = await db.query.clanEvents.findFirst({ where: and(eq(clanEvents.id, id), eq(clanEvents.clanId, clanId)) });
  const o = e ? currentOccurrence(e, now) : null;
  if (!e || !o) return null;
  return (await withGoing([{ e, o }], userId, now))[0];
}

async function withGoing(list: { e: ClanEvent; o: Occurrence }[], userId: number | null, now: number): Promise<ClanEventView[]> {
  if (!list.length) return [];
  const rsvps = await db
    .select({ eventId: clanEventRsvps.clanEventId, occurrence: clanEventRsvps.occurrence, userId: clanEventRsvps.userId, name: users.displayName })
    .from(clanEventRsvps)
    .innerJoin(users, eq(users.id, clanEventRsvps.userId))
    .where(inArray(clanEventRsvps.clanEventId, list.map((x) => x.e.id)))
    .orderBy(clanEventRsvps.createdAt);
  return list.map(({ e, o }) => {
    const mine = rsvps.filter((r) => r.eventId === e.id && r.occurrence === o.start);
    return {
      id: e.id,
      title: e.title,
      description: e.description,
      location: e.location,
      world: e.world,
      icon: e.icon,
      host: e.host,
      repeat: e.repeat === 'weekly' ? 'weekly' : 'none',
      timezone: e.timezone,
      durationMin: e.durationMin,
      startsAt: e.startsAt,
      repeatUntil: e.repeatUntil,
      ping: e.ping === 1,
      occurrence: o,
      phase: phaseOf(o, now),
      going: mine.length,
      goingNames: mine.slice(0, 20).map((r) => r.name),
      mine: userId != null && mine.some((r) => r.userId === userId),
    };
  });
}

// ── Writing ──────────────────────────────────────────────────────────────────────────────────────

export interface ClanEventInput {
  title: string;
  description?: string | null;
  location?: string | null;
  world?: number | null;
  icon?: string | null;
  host?: string | null;
  startsAt: string;
  durationMin: number;
  repeat: 'none' | 'weekly';
  repeatUntil?: string | null;
  timezone: string;
  ping: boolean;
}

const text = (v: unknown, max: number): string | null => {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return s || null;
};

/** A form's fields as an input, or the first thing wrong with them. */
export function parseClanEventInput(body: Record<string, unknown>): { ok: true; input: ClanEventInput } | { ok: false; error: string } {
  const title = text(body.title, 80);
  if (!title) return { ok: false, error: 'Give it a name.' };
  const start = Date.parse(String(body.startsAt ?? ''));
  if (!Number.isFinite(start)) return { ok: false, error: 'Pick when it starts.' };
  const durationMin = Math.round(Number(body.durationMin));
  if (!Number.isFinite(durationMin) || durationMin < 5 || durationMin > 24 * 60) return { ok: false, error: 'It runs between 5 minutes and 24 hours.' };
  const repeat = body.repeat === 'weekly' ? 'weekly' : 'none';
  const until = body.repeatUntil ? Date.parse(String(body.repeatUntil)) : NaN;
  const world = body.world == null || body.world === '' ? null : Math.round(Number(body.world));
  if (world != null && (!Number.isFinite(world) || world < 300 || world > 700)) return { ok: false, error: 'That isn’t a world number.' };
  const timezone = typeof body.timezone === 'string' && isValidTimeZone(body.timezone) ? body.timezone : 'UTC';
  const icon = text(body.icon, 40);
  return {
    ok: true,
    input: {
      title,
      description: text(body.description, 1000),
      location: text(body.location, 80),
      world,
      icon: icon && /^[a-z0-9_]+$/i.test(icon) ? icon : null,
      host: text(body.host, 40),
      startsAt: new Date(start).toISOString(),
      durationMin,
      repeat,
      repeatUntil: repeat === 'weekly' && Number.isFinite(until) ? new Date(until).toISOString() : null,
      timezone,
      ping: body.ping !== false,
    },
  };
}

const columns = (input: ClanEventInput) => ({
  title: input.title,
  description: input.description ?? null,
  location: input.location ?? null,
  world: input.world ?? null,
  icon: input.icon ?? null,
  host: input.host ?? null,
  startsAt: input.startsAt,
  durationMin: input.durationMin,
  repeat: input.repeat,
  repeatUntil: input.repeatUntil ?? null,
  timezone: input.timezone,
  ping: input.ping ? 1 : 0,
});

export async function createClanEvent(clanId: number, input: ClanEventInput, userId: number | null): Promise<ClanEvent> {
  const [row] = await db.insert(clanEvents).values({ clanId, ...columns(input), createdById: userId }).returning();
  void announce(row).catch((e) => log.warn('clan-events.announce-failed', { id: row.id }, e));
  return row;
}

/** Edit it; a new time resets the reminders, so the changed occurrence is reminded again. */
export async function updateClanEvent(clanId: number, id: number, input: ClanEventInput): Promise<ClanEvent | null> {
  const prior = await db.query.clanEvents.findFirst({ where: and(eq(clanEvents.id, id), eq(clanEvents.clanId, clanId)) });
  if (!prior) return null;
  const moved = prior.startsAt !== input.startsAt || prior.repeat !== input.repeat || prior.timezone !== input.timezone;
  const [row] = await db
    .update(clanEvents)
    .set({ ...columns(input), updatedAt: new Date().toISOString(), ...(moved ? { remindedFor: null, startedFor: null } : {}) })
    .where(eq(clanEvents.id, id))
    .returning();
  void announce(row).catch((e) => log.warn('clan-events.announce-failed', { id }, e));
  return row;
}

/** Called off: the announcement says so, nothing more is posted, and it leaves every list. */
export async function cancelClanEvent(clanId: number, id: number): Promise<boolean> {
  const [row] = await db
    .update(clanEvents)
    .set({ cancelledAt: new Date().toISOString() })
    .where(and(eq(clanEvents.id, id), eq(clanEvents.clanId, clanId), isNull(clanEvents.cancelledAt)))
    .returning();
  if (!row) return false;
  void announce(row).catch((e) => log.warn('clan-events.announce-failed', { id }, e));
  return true;
}

/** "I'm going" (or not) for the occurrence on now or next. Returns the view after, or null when it's over. */
export async function setGoing(clanId: number, id: number, userId: number, going: boolean): Promise<ClanEventView | null> {
  const view = await getClanEvent(clanId, id, userId);
  if (!view) return null;
  if (going) {
    await db.insert(clanEventRsvps).values({ clanEventId: id, occurrence: view.occurrence.start, userId }).onConflictDoNothing();
  } else {
    await db.delete(clanEventRsvps).where(and(eq(clanEventRsvps.clanEventId, id), eq(clanEventRsvps.occurrence, view.occurrence.start), eq(clanEventRsvps.userId, userId)));
  }
  const after = await getClanEvent(clanId, id, userId);
  const row = await db.query.clanEvents.findFirst({ where: eq(clanEvents.id, id) });
  if (row) void announce(row).catch((e) => log.warn('clan-events.announce-failed', { id }, e)); // the going count
  return after;
}

// ── Discord ──────────────────────────────────────────────────────────────────────────────────────

async function eventLink(clanId: number, id: number): Promise<string | null> {
  const base = siteBaseUrl();
  const clan = await db.query.clans.findFirst({ columns: { slug: true }, where: eq(clans.id, clanId) });
  return base && clan?.slug ? `${base}/c/${clan.slug}/clan-events/${id}` : null;
}

const when = (iso: string, style: 'F' | 'R') => `<t:${Math.floor(Date.parse(iso) / 1000)}:${style}>`;

/** The embed for an occurrence: the announcement, the reminder and the start share it. */
export function clanEventEmbed(e: Pick<ClanEvent, 'title' | 'description' | 'location' | 'world' | 'icon' | 'host' | 'repeat'>, o: Occurrence | null, going: number, link: string | null, kind: 'announce' | 'reminder' | 'start' | 'cancelled'): DiscordEmbed {
  const head = { announce: e.repeat === 'weekly' ? 'Clan event · every week' : 'Clan event', reminder: 'Starting in 15 minutes', start: 'Starting now', cancelled: 'Cancelled' }[kind];
  const where = [e.location, e.world ? `World ${e.world}` : null].filter(Boolean).join(' · ');
  const fields = [
    ...(o && kind !== 'cancelled' ? [field(kind === 'start' ? 'Until' : 'When', kind === 'start' ? when(o.end, 'F') : `${when(o.start, 'F')}\n${when(o.start, 'R')}`)] : []),
    ...(where ? [field('Where', where)] : []),
    ...(e.host ? [field('Host', e.host)] : []),
    ...(kind !== 'cancelled' ? [field('Going', link ? `${going} · [I'm going →](${link})` : String(going))] : []),
  ];
  return {
    author: { name: head },
    ...clanEventThumbnail(e.icon),
    title: clamp(e.title, LIMIT.title),
    ...(e.description && kind !== 'cancelled' ? { description: clamp(e.description, LIMIT.description) } : {}),
    color: kind === 'cancelled' ? EMBED_COLOR.red : kind === 'start' ? EMBED_COLOR.green : EMBED_COLOR.gold,
    fields,
    ...(link && kind !== 'cancelled' ? { url: link } : {}),
  };
}

/** `discordMessageIds`: the announcement's message, and the occurrence it currently announces. */
const MESSAGE = 'message';
const ANNOUNCED_FOR = 'for';

/** Post the announcement, or edit the one already up (the going count, a new time, the next week). */
async function announce(e: ClanEvent): Promise<void> {
  const o = currentOccurrence(e, Date.now());
  const ids = e.discordMessageIds ?? {};
  const prior = ids[MESSAGE];
  if (!o && !prior) return; // over before anyone heard of it
  const going = o ? await goingCount(e.id, o.start) : 0;
  const embed = clanEventEmbed(e, o, going, await eventLink(e.clanId, e.id), e.cancelledAt || !o ? 'cancelled' : 'announce');
  const result = await upsertClanEventPost(e.clanId, embed, prior);
  if (result.status !== 'sent' || !result.messageId) return;
  const next = { [MESSAGE]: result.messageId, [ANNOUNCED_FOR]: o?.start ?? '' };
  await db.update(clanEvents).set({ discordMessageIds: next }).where(eq(clanEvents.id, e.id));
}

async function goingCount(id: number, occurrence: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(clanEventRsvps)
    .where(and(eq(clanEventRsvps.clanEventId, id), eq(clanEventRsvps.occurrence, occurrence)));
  return r?.n ?? 0;
}

/**
 * Every minute (cron flush-notifications): each live event's reminder 15 minutes out and its
 * "starting now", once per occurrence — claimed by a conditional update before posting, so two
 * overlapping ticks can't both post. A weekly's announcement moves on to the next week too.
 */
export async function processClanEventReminders(now = Date.now()): Promise<void> {
  // clan-scope: global -- the cron walks every clan's events; each post goes to its own clan.
  const rows = await db.query.clanEvents.findMany({ where: isNull(clanEvents.cancelledAt) });
  for (const e of rows) {
    const o = currentOccurrence(e, now);
    if (!o) continue;
    try {
      if ((e.discordMessageIds ?? {})[ANNOUNCED_FOR] !== o.start && e.repeat === 'weekly') await announce(e);
      const due = dueNotice(o, now, e.remindedFor, e.startedFor);
      if (!due) continue;
      const column = due === 'reminder' ? clanEvents.remindedFor : clanEvents.startedFor;
      const claimed = await db
        .update(clanEvents)
        .set(due === 'reminder' ? { remindedFor: o.start } : { startedFor: o.start, remindedFor: o.start })
        .where(and(eq(clanEvents.id, e.id), or(isNull(column), ne(column, o.start))))
        .returning({ id: clanEvents.id });
      if (!claimed.length) continue;
      const embed = clanEventEmbed(e, o, await goingCount(e.id, o.start), await eventLink(e.clanId, e.id), due);
      await sendClanEventPost(e.clanId, embed, e.ping === 1);
    } catch (err) {
      log.warn('clan-events.reminder-failed', { id: e.id }, err);
    }
  }
}
