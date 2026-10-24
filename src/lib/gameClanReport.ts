// What a plugin says about its character's in-game clan, cleaned. Pure — no database import, so the
// rules are testable without one (tests/game-clans.test.ts). The writes live in lib/gameClans.

/** The one identity for an in-game clan name: Jagex treats case, `_` and nbsp as the same. */
export function gameClanKey(name: string): string {
  return name.replace(/[ _]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

export type GameClanReport = {
  name: string;
  rank: number | null;
  title: string | null;
  joinedOn: string | null;
};

/** Printable, single-spaced, capped. A clan name is 12 characters in game; the cap is slack, not a rule. */
function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/[ \s]+/g, ' ').trim();
  return s && s.length <= max ? s : null;
}

/**
 * `{ clan: {...} }` → a report, `{ clan: null }` → null (the plugin looked and they are in no clan),
 * anything malformed → undefined (ignore the push; never treat garbage as "left their clan").
 */
export function parseGameClanReport(body: unknown): GameClanReport | null | undefined {
  if (!body || typeof body !== 'object' || !('clan' in body)) return undefined;
  const raw = (body as { clan: unknown }).clan;
  if (raw === null) return null;
  if (!raw || typeof raw !== 'object') return undefined;
  const c = raw as Record<string, unknown>;

  const name = cleanText(c.name, 20);
  if (!name || !gameClanKey(name)) return undefined;

  // ClanRank: -1 guest … 126 owner, 127 Jagex moderator.
  const rank = typeof c.rank === 'number' && Number.isInteger(c.rank) && c.rank >= -1 && c.rank <= 127 ? c.rank : null;
  const title = cleanText(c.title, 30);
  const joinedOn =
    typeof c.joinedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.joinedOn) && !Number.isNaN(Date.parse(c.joinedOn))
      ? c.joinedOn
      : null;

  return { name, rank, title, joinedOn };
}

/** How long a sighting stands without a fresh one. Past it a profile stops naming the clan. */
export const GAME_CLAN_STALE_DAYS = 60;

/** Re-stamp `observedAt` at most this often when nothing changed — a login is not worth a write. */
export const GAME_CLAN_RESTAMP_MS = 24 * 60 * 60 * 1000;
