import { and, eq, inArray, isNull, or, ne, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanEventRsvps, clanEvents, clans, users, type ClanEvent } from '@/db/schema';
import { type ClanEventModules, anyModule, keyFor, parseModules, signupWindow, surveyKey } from '@/lib/clanEventModules';
import { loadQuestions } from '@/lib/clanEventQuestions';
import { activeCount, activeNames, mySignup, signUp, withdraw } from '@/lib/clanEventSignups';
import { type Occurrence, currentOccurrence, dueNotice, pastOccurrences, phaseOf } from '@/lib/clanEventTimes';
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
  /** 'ended' only when a module still has something to do after it (the survey, payouts). */
  phase: 'upcoming' | 'soon' | 'live' | 'ended';
  /** Going — or, with sign-ups on, signed up (pending and approved). */
  going: number;
  /** Who's going (display names, or the RSNs signed up), up to 20. */
  goingNames: string[];
  /** Whether the asking person is going (or signed up). */
  mine: boolean;
  modules: ClanEventModules;
  /** With sign-ups on: whether they're open, the cap, whether there's a form to fill, and the asker's own. */
  signup: { open: boolean; reason: string | null; cap: number | null; hasForm: boolean; myStatus: string | null; myFee: string | null } | null;
  /** The survey is open to answer now. */
  surveyOpen: boolean;
}

/**
 * The clan's events with an occurrence still ahead (or on now), soonest first. `recentDays` (staff)
 * also keeps ones with a module that ended within that many days — there are winners to pay and a
 * survey to read after the last week.
 */
export async function listClanEvents(clanId: number, opts: { userId?: number | null; now?: number; withinDays?: number; recentDays?: number } = {}): Promise<ClanEventView[]> {
  const now = opts.now ?? Date.now();
  const rows = await db.query.clanEvents.findMany({ where: and(eq(clanEvents.clanId, clanId), isNull(clanEvents.cancelledAt)) });
  const horizon = opts.withinDays != null ? now + opts.withinDays * 86_400_000 : Infinity;
  const recent = (e: ClanEvent): Occurrence | null => {
    if (!opts.recentDays || !anyModule(parseModules(e.modules))) return null;
    const last = pastOccurrences(e, now, 1)[0];
    return last && Date.parse(last.end) >= now - opts.recentDays * 86_400_000 ? last : null;
  };
  const live = rows
    .map((e) => ({ e, o: currentOccurrence(e, now) ?? recent(e) }))
    .filter((x): x is { e: ClanEvent; o: Occurrence } => x.o != null && Date.parse(x.o.start) <= horizon)
    .sort((a, b) => Date.parse(a.o.start) - Date.parse(b.o.start));
  return withGoing(live, opts.userId ?? null, now);
}

/**
 * One event as the site and the plugin show it, with its occurrence on now or next; null when over
 * or cancelled — unless a module still has work after it (a survey to answer, winners to pay), when
 * it's the one that last ended.
 */
export async function getClanEvent(clanId: number, id: number, userId: number | null = null, now = Date.now()): Promise<ClanEventView | null> {
  const e = await db.query.clanEvents.findFirst({ where: and(eq(clanEvents.id, id), eq(clanEvents.clanId, clanId)) });
  if (!e) return null;
  const o = currentOccurrence(e, now) ?? (!e.cancelledAt && anyModule(parseModules(e.modules)) ? pastOccurrences(e, now, 1)[0] ?? null : null);
  if (!o) return null;
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
  const signupEvents = list.filter(({ e }) => parseModules(e.modules).signups.on);
  const signed = await activeNames(signupEvents[0]?.e.clanId ?? 0, signupEvents.map(({ e }) => e.id));
  const views: ClanEventView[] = [];
  for (const { e, o } of list) {
    const m = parseModules(e.modules);
    const key = keyFor(m, e, o);
    const mine = m.signups.on
      ? signed.filter((r) => r.eventId === e.id && r.occurrence === key).map((r) => ({ userId: r.userId, name: r.rsn }))
      : rsvps.filter((r) => r.eventId === e.id && r.occurrence === o.start);
    let signup: ClanEventView['signup'] = null;
    if (m.signups.on) {
      const w = signupWindow(m, e, now);
      const own = userId != null ? await mySignup(e.clanId, e.id, key, userId) : null;
      signup = {
        open: w.open,
        reason: w.open ? null : w.reason,
        cap: m.signups.cap,
        hasForm: (await loadQuestions(e.clanId, e.id, 'signup')).length > 0,
        myStatus: own?.status ?? null,
        myFee: own?.feeStatus ?? null,
      };
    }
    views.push({
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
      phase: Date.parse(o.end) <= now ? 'ended' : phaseOf(o, now),
      going: mine.length,
      goingNames: mine.slice(0, 20).map((r) => r.name),
      mine: userId != null && mine.some((r) => r.userId === userId),
      modules: m,
      signup,
      surveyOpen: surveyKey(m, e, now) != null,
    });
  }
  return views;
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

/**
 * "I'm going" (or not) for the occurrence on now or next. With sign-ups on it's a sign-up with no
 * answers — refused when the host's form has a required question, which only the site can ask.
 */
export async function setGoing(
  clanId: number,
  id: number,
  who: { userId: number; playerId: number | null; displayName: string | null },
  going: boolean,
): Promise<{ ok: true; view: ClanEventView } | { ok: false; error: string; status: number }> {
  const userId = who.userId;
  const view = await getClanEvent(clanId, id, userId);
  if (!view || view.phase === 'ended') return { ok: false, error: 'That event is over.', status: 404 };
  if (view.modules.signups.on) {
    const r = going ? await signUp(clanId, id, who, {}) : await withdraw(clanId, id, userId);
    if (!r.ok) return r;
  } else if (going) {
    await db.insert(clanEventRsvps).values({ clanEventId: id, occurrence: view.occurrence.start, userId }).onConflictDoNothing();
  } else {
    await db.delete(clanEventRsvps).where(and(eq(clanEventRsvps.clanEventId, id), eq(clanEventRsvps.occurrence, view.occurrence.start), eq(clanEventRsvps.userId, userId)));
  }
  const after = await getClanEvent(clanId, id, userId);
  const row = await db.query.clanEvents.findFirst({ where: and(eq(clanEvents.id, id), eq(clanEvents.clanId, clanId)) });
  if (row) void announce(row).catch((e) => log.warn('clan-events.announce-failed', { id }, e)); // the going count
  return after ? { ok: true, view: after } : { ok: false, error: 'That event is over.', status: 404 };
}

/** Bring the Discord announcement up to date after the list changed elsewhere (a sign-up on the site, staff approving one). */
export async function refreshClanEventPost(clanId: number, id: number): Promise<void> {
  const row = await db.query.clanEvents.findFirst({ where: and(eq(clanEvents.id, id), eq(clanEvents.clanId, clanId)) });
  if (row) void announce(row).catch((e) => log.warn('clan-events.announce-failed', { id }, e));
}

/** The host's module settings (lib/clanEventModules); the announcement follows (a sign-up link, a cap). */
export async function setClanEventModules(clanId: number, id: number, raw: unknown): Promise<ClanEventModules | null> {
  const modules = parseModules(raw);
  const [row] = await db
    .update(clanEvents)
    .set({ modules, updatedAt: new Date().toISOString() })
    .where(and(eq(clanEvents.id, id), eq(clanEvents.clanId, clanId)))
    .returning();
  if (!row) return null;
  void announce(row).catch((e) => log.warn('clan-events.announce-failed', { id }, e));
  return modules;
}

// ── Discord ──────────────────────────────────────────────────────────────────────────────────────

async function eventLink(clanId: number, id: number): Promise<string | null> {
  const base = siteBaseUrl();
  const clan = await db.query.clans.findFirst({ columns: { slug: true }, where: eq(clans.id, clanId) });
  return base && clan?.slug ? `${base}/c/${clan.slug}/clan-events/${id}` : null;
}

const when = (iso: string, style: 'F' | 'R') => `<t:${Math.floor(Date.parse(iso) / 1000)}:${style}>`;

/** The embed for an occurrence: the announcement, the reminder and the start share it. */
export function clanEventEmbed(e: Pick<ClanEvent, 'title' | 'description' | 'location' | 'world' | 'icon' | 'host' | 'repeat' | 'modules'>, o: Occurrence | null, going: number, link: string | null, kind: 'announce' | 'reminder' | 'start' | 'cancelled'): DiscordEmbed {
  const m = parseModules(e.modules);
  const count = m.signups.on ? `${going}${m.signups.cap != null ? `/${m.signups.cap}` : ''}` : String(going);
  const fee = m.fee.on ? ` · ${m.fee.amount.toLocaleString('en-US')} gp entry` : '';
  const head = { announce: e.repeat === 'weekly' ? 'Clan event · every week' : 'Clan event', reminder: 'Starting in 15 minutes', start: 'Starting now', cancelled: 'Cancelled' }[kind];
  const where = [e.location, e.world ? `World ${e.world}` : null].filter(Boolean).join(' · ');
  const fields = [
    ...(o && kind !== 'cancelled' ? [field(kind === 'start' ? 'Until' : 'When', kind === 'start' ? when(o.end, 'F') : `${when(o.start, 'F')}\n${when(o.start, 'R')}`)] : []),
    ...(where ? [field('Where', where)] : []),
    ...(e.host ? [field('Host', e.host)] : []),
    ...(kind !== 'cancelled'
      ? [field(m.signups.on ? 'Signed up' : 'Going', link ? `${count}${fee} · [${m.signups.on ? 'Sign up' : "I'm going"} →](${link})` : `${count}${fee}`)]
      : []),
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
  const going = o ? await goingCount(e, o) : 0;
  const embed = clanEventEmbed(e, o, going, await eventLink(e.clanId, e.id), e.cancelledAt || !o ? 'cancelled' : 'announce');
  const result = await upsertClanEventPost(e.clanId, embed, prior);
  if (result.status !== 'sent' || !result.messageId) return;
  const next = { [MESSAGE]: result.messageId, [ANNOUNCED_FOR]: o?.start ?? '' };
  await db.update(clanEvents).set({ discordMessageIds: next }).where(eq(clanEvents.id, e.id));
}

/** Going, or signed up when the event takes sign-ups. */
async function goingCount(e: ClanEvent, o: Occurrence): Promise<number> {
  const m = parseModules(e.modules);
  if (m.signups.on) return activeCount(e.clanId, e.id, keyFor(m, e, o));
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(clanEventRsvps)
    .where(and(eq(clanEventRsvps.clanEventId, e.id), eq(clanEventRsvps.occurrence, o.start)));
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
      const embed = clanEventEmbed(e, o, await goingCount(e, o), await eventLink(e.clanId, e.id), due);
      await sendClanEventPost(e.clanId, embed, e.ping === 1);
    } catch (err) {
      log.warn('clan-events.reminder-failed', { id: e.id }, err);
    }
  }
}
