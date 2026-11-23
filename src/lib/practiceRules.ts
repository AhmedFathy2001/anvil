// Practice boards — the pure half (no database, so tests run without one). See lib/practice.
//
// A practice board is a clan admin's short TEST board, inside their own clan, played on real
// characters with the real plugin. It exists so an admin can watch tiles, popups and Discord posts
// work before a real event — and it counts for NOTHING outside itself.

import { parseDiscordWebhook } from '@/lib/discordWebhookUrl';
import { nextTeamColour, soloTeamName } from '@/lib/teamPlacement';

/** Most board tiles one practice board may hold (a combo's parts ride along with it, uncounted). */
export const PRACTICE_MAX_TILES = 25;
/** Most people on one practice board, the creator included. */
export const PRACTICE_MAX_PLAYERS = 5;
/** The lengths offered, in hours. */
export const PRACTICE_HOURS = [1, 6, 24] as const;
export type PracticeHours = (typeof PRACTICE_HOURS)[number];
/** An ended practice board is deleted this many days after it ends (lib/practice sweepEndedPracticeBoards). */
export const PRACTICE_KEEP_DAYS = 7;

export type PracticeSides = 1 | 2;

/** What the one-screen setup sends. */
export interface PracticeInput {
  /** Copy tiles from one of this clan's boards (these tile ids of it), or start empty and add picked tiles. */
  tiles: { mode: 'copy'; eventId: number; tileIds: number[] } | { mode: 'pick'; count: number };
  /** Seats (clan_memberships ids) of the people who play, the creator's own included. */
  seats: number[];
  sides: PracticeSides;
  /** The test webhook, normalised; null = no posts at all. */
  webhookUrl: string | null;
  hours: PracticeHours;
}

/**
 * The ONE place to gate practice boards on a clan's plan. Free for every clan for now; when that
 * changes, change it here and every route and button follows.
 */
export function practiceAllowedForPlan(_plan: string | null | undefined): boolean {
  void _plan;
  return true;
}

/** A pasted test webhook, normalised — or an error. Empty means "no posts". Only a Discord webhook is accepted. */
export function parsePracticeHook(raw: unknown): { ok: true; url: string | null } | { ok: false; error: string } {
  if (raw == null) return { ok: true, url: null };
  if (typeof raw !== 'string') return { ok: false, error: 'The test webhook must be a Discord webhook URL.' };
  const text = raw.trim();
  if (!text) return { ok: true, url: null };
  const parsed = parseDiscordWebhook(text);
  if (!parsed) return { ok: false, error: 'That is not a Discord webhook URL (https://discord.com/api/webhooks/…).' };
  return { ok: true, url: parsed.url };
}

function intList(v: unknown, max: number): number[] | null {
  if (!Array.isArray(v)) return null;
  const out: number[] = [];
  for (const x of v) {
    const n = typeof x === 'number' ? x : typeof x === 'string' ? Number(x) : NaN;
    if (!Number.isInteger(n) || n <= 0) return null;
    if (!out.includes(n)) out.push(n);
  }
  return out.length > max ? null : out;
}

/** Validate the setup body. Shape only: the routes check every id against the clan. */
export function parsePracticeInput(body: unknown): { ok: true; value: PracticeInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Bad request.' };
  const b = body as Record<string, unknown>;

  const t = b.tiles as Record<string, unknown> | undefined;
  let tiles: PracticeInput['tiles'];
  if (t?.mode === 'copy') {
    const eventId = Number(t.eventId);
    const tileIds = intList(t.tileIds, PRACTICE_MAX_TILES);
    if (!Number.isInteger(eventId) || eventId <= 0) return { ok: false, error: 'Pick a board to copy.' };
    if (!tileIds) return { ok: false, error: `Pick up to ${PRACTICE_MAX_TILES} tiles.` };
    if (tileIds.length === 0) return { ok: false, error: 'Pick at least one tile.' };
    tiles = { mode: 'copy', eventId, tileIds };
  } else if (t?.mode === 'pick') {
    const count = Number(t.count);
    if (!Number.isInteger(count) || count < 1) return { ok: false, error: 'Pick at least one tile.' };
    if (count > PRACTICE_MAX_TILES) return { ok: false, error: `A practice board holds up to ${PRACTICE_MAX_TILES} tiles.` };
    tiles = { mode: 'pick', count };
  } else {
    return { ok: false, error: 'Choose where the tiles come from.' };
  }

  const seats = intList(b.seats, PRACTICE_MAX_PLAYERS);
  if (!seats) return { ok: false, error: `Up to ${PRACTICE_MAX_PLAYERS} people can play a practice board.` };
  if (seats.length === 0) return { ok: false, error: 'Add at least one person.' };

  const sides = Number(b.sides);
  if (sides !== 1 && sides !== 2) return { ok: false, error: 'Choose solo or 2 teams.' };
  if (sides === 2 && seats.length < 2) return { ok: false, error: 'Two teams need at least two people.' };

  const hook = parsePracticeHook(b.webhookUrl);
  if (!hook.ok) return hook;

  const hours = Number(b.hours);
  if (!(PRACTICE_HOURS as readonly number[]).includes(hours)) return { ok: false, error: 'Choose 1, 6 or 24 hours.' };

  return { ok: true, value: { tiles, seats, sides, webhookUrl: hook.url, hours: hours as PracticeHours } };
}

/**
 * Who goes on which side. Solo, as on a real solo board: everyone their own team, named after their
 * character. Two teams: alternate, the creator first on Team Gold, so a 2-person board is one each.
 * `seats` keeps the order the admin added people in.
 */
export function practiceTeams(seats: { id: number; rsn: string }[], sides: PracticeSides): { name: string; color: string; seats: number[] }[] {
  if (sides === 1) {
    const out: { name: string; color: string; seats: number[] }[] = [];
    for (const s of seats) {
      out.push({ name: soloTeamName(s.rsn, out.map((t) => t.name)), color: nextTeamColour(out.map((t) => t.color)), seats: [s.id] });
    }
    return out;
  }
  const ids = seats.map((s) => s.id);
  const gold = ids.filter((_, i) => i % 2 === 0);
  const blue = ids.filter((_, i) => i % 2 === 1);
  return [
    { name: 'Team Gold', color: '#d4a84b', seats: gold },
    { name: 'Team Blue', color: '#5b8fd9', seats: blue },
  ];
}

/** When a practice board stopped: ended by hand, else its end time. Null while it has no end. */
export function practiceEndedAt(e: { endDate: string | null; forceEndedAt: string | null }): number | null {
  const t = Date.parse(e.forceEndedAt ?? e.endDate ?? '');
  return Number.isFinite(t) ? t : null;
}

/** Is a practice board running at `now`? (Started, not past its end, not ended by hand.) */
export function practiceRunning(e: { startDate: string | null; endDate: string | null; forceEndedAt: string | null }, now = Date.now()): boolean {
  if (e.forceEndedAt) return false;
  const start = Date.parse(e.startDate ?? '');
  const end = Date.parse(e.endDate ?? '');
  return Number.isFinite(start) && start <= now && (!Number.isFinite(end) || end > now);
}

/** Is an ended practice board due for deletion? */
export function practiceDue(e: { endDate: string | null; forceEndedAt: string | null }, now = Date.now()): boolean {
  const ended = practiceEndedAt(e);
  return ended != null && ended <= now - PRACTICE_KEEP_DAYS * 86_400_000;
}

/** A shown hook: "#…/abcd" style, so the page never prints a usable URL back. */
export function maskedHook(url: string | null | undefined): string | null {
  if (!url) return null;
  const parsed = parseDiscordWebhook(url);
  if (!parsed) return null;
  return `webhook …${parsed.id.slice(-4)}`;
}

/**
 * The new target for "Lower target": a number between 1 and the current goal (exclusive of the
 * current one unless it is already 1). Null when the tile has no number to lower.
 */
export function lowerTargetValue(current: number | null, wanted: unknown): number | null {
  if (current == null || current < 1) return null;
  const n = typeof wanted === 'number' ? wanted : Number(wanted);
  if (!Number.isInteger(n) || n < 1) return null;
  return Math.min(n, current);
}
