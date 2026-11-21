import { modeHiscoresTable, type ModeFetchMode } from '@/lib/modeHiscores';
import { isModeKey, modeTag, worldModeDef } from '@/lib/worldModes';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Which game a competition counts (weekly_competitions.counts_on), and what its prizes are paid in.
// Pure: tested directly (tests/competition-game.test.ts).
//
//   'main'           the main game only. The default, and every competition made before this.
//   'main+hardcore'  the main game and Hardcore Worlds together. Same rates, so they can race. A
//                    Hardcore Worlds character is its own account, so it enters as its own player,
//                    scored from the Hardcore Worlds hiscores; nothing is ever added across saves.
//   '<mode key>'     one mode on its own (lib/worldModes: 'hardcore', 'leagues', 'deadman', …). Only
//                    that mode's worlds and hiscores count. Leagues and Deadman run on the main
//                    account at their own rates, so they never mix with anything.
//
// Prizes: 'gp' is the main game coffer; 'hcw' is the clan's Hardcore Worlds coffer (a pot staff keep
// by hand: Hardcore Worlds has no in-game clan coffer). 'hcw' only where the competition counts
// Hardcore Worlds and the clan keeps that coffer.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export const MAIN = 'main';
export const MAIN_AND_HARDCORE = 'main+hardcore';
/** lib/worldModes key of Hardcore Worlds. */
export const HARDCORE_WORLDS = 'hardcore';
/** Its hiscores table (lib/modeHiscores). */
export const HARDCORE_TABLE: ModeFetchMode = 'hardcore_mains';

export type PrizeCurrency = 'gp' | 'hcw';

/** Clan setting: the clan keeps a Hardcore Worlds coffer ('1'), else every prize is main game gp. */
export const HCW_COFFER_SETTING_KEY = 'hcw_coffer';

/** A stored or submitted value as one we know; anything else is the main game. */
export function parseCountsOn(raw: unknown): string {
  if (raw === MAIN_AND_HARDCORE) return MAIN_AND_HARDCORE;
  if (raw === MAIN || raw == null || raw === '') return MAIN;
  return isModeKey(raw) ? raw : MAIN;
}

/**
 * A value the setup form may store for this kind of competition, or the reason it may not. A skill or
 * boss competition is scored from hiscores, so a mode without a table (beta worlds, a mode we have no
 * table for) can only run an item hunt.
 */
export function checkCountsOn(raw: unknown, type: string): { ok: true; value: string } | { ok: false; error: string } {
  if (raw == null || raw === '' || raw === MAIN) return { ok: true, value: MAIN };
  if (raw === MAIN_AND_HARDCORE) return { ok: true, value: MAIN_AND_HARDCORE };
  if (!isModeKey(raw)) return { ok: false, error: 'Pick which game counts.' };
  if (type !== 'hunt' && !modeHiscoresTable(raw)) return { ok: false, error: `${modeTag(raw)} has no hiscores to score a ${type === 'boss' ? 'boss' : 'skill'} competition from.` };
  return { ok: true, value: raw };
}

/** Whether play on this world counts (modeKey null = the main game). */
export function countsWorld(countsOn: string, modeKey: string | null | undefined): boolean {
  const c = parseCountsOn(countsOn);
  if (!modeKey) return c === MAIN || c === MAIN_AND_HARDCORE;
  if (modeKey === HARDCORE_WORLDS && c === MAIN_AND_HARDCORE) return true;
  return c === modeKey;
}

/** Whether Hardcore Worlds counts at all (on its own or with the main game). */
export function countsHardcore(countsOn: string): boolean {
  return countsWorld(countsOn, HARDCORE_WORLDS);
}

/**
 * The hiscores table a character is read from first: null = the main game's. A mixed competition
 * starts on the main table; a character that isn't on it but is on Hardcore Worlds' is moved there
 * (fallbackTable).
 */
export function firstTable(countsOn: string): ModeFetchMode | null {
  const c = parseCountsOn(countsOn);
  if (c === MAIN || c === MAIN_AND_HARDCORE) return null;
  return modeHiscoresTable(c);
}

/** Where to look next for a character the first table doesn't have, or null when there's nowhere. */
export function fallbackTable(countsOn: string, table: string | null): ModeFetchMode | null {
  return parseCountsOn(countsOn) === MAIN_AND_HARDCORE && table == null ? HARDCORE_TABLE : null;
}

/** The words for the setting: "Main game", "Main game + Hardcore Worlds", "Leagues only". */
export function countsOnLabel(countsOn: string): string {
  const c = parseCountsOn(countsOn);
  if (c === MAIN) return 'Main game';
  if (c === MAIN_AND_HARDCORE) return 'Main game + Hardcore Worlds';
  return `${modeTag(c)} only`;
}

/** A short tag for a character scored off the main game's hiscores ("HCW"), or null for the main game. */
export function tableTag(table: string | null | undefined): string | null {
  if (!table) return null;
  if (table === HARDCORE_TABLE) return 'HCW';
  return null;
}

/** The game's icon for a mode, when it has one (lib/worldModes). */
export function countsOnIcon(countsOn: string): string | null {
  const c = parseCountsOn(countsOn);
  if (c === MAIN) return null;
  return worldModeDef(c === MAIN_AND_HARDCORE ? HARDCORE_WORLDS : c)?.icon ?? null;
}

/**
 * The prize currency to store. HCW gp only where this competition counts Hardcore Worlds and the clan
 * keeps a Hardcore Worlds coffer; anything else is main game gp. A Hardcore-Worlds-only competition
 * starts on HCW gp when the clan keeps that coffer.
 */
export function prizeCurrencyFor(raw: unknown, countsOn: string, hcwCoffer: boolean): PrizeCurrency {
  if (!hcwCoffer || !countsHardcore(countsOn)) return 'gp';
  if (raw === 'hcw') return 'hcw';
  if (raw === 'gp') return 'gp';
  return parseCountsOn(countsOn) === HARDCORE_WORLDS ? 'hcw' : 'gp';
}

export function parsePrizeCurrency(raw: unknown): PrizeCurrency {
  return raw === 'hcw' ? 'hcw' : 'gp';
}

/** "Hardcore Worlds gp" / "gp": the words for an amount in that pot. */
export function currencyWords(c: PrizeCurrency): string {
  return c === 'hcw' ? 'HCW gp' : 'gp';
}

/** The tooltip on the Hardcore Worlds icon beside a prize. */
export const HCW_PRIZE_TITLE = 'Paid in Hardcore Worlds gp';

/**
 * Whether an entrant is a Hardcore Worlds character: the table it was pinned to, else the one the
 * competition reads first (so every entrant of a Hardcore-Worlds-only competition is one).
 */
export function isHardcoreEntrant(table: string | null | undefined, countsOn: string): boolean {
  return (table ?? firstTable(countsOn)) === HARDCORE_TABLE;
}

/** The tooltip on an entrant's HCW tag. */
export const HCW_ENTRANT_TITLE = 'Hardcore Worlds character, scored from the Hardcore Worlds hiscores';
/** The tooltip on a Hardcore Worlds character that died mid-competition. */
export const FELL_TITLE = 'Died on Hardcore Worlds: keeps what it gained, scores nothing more';
