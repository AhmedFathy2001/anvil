// What an event's visibility and entry settings can be. Pure — no database import.
//
// The fourth module split this way, after clanRoles, clanNames and ingameRanks: a predicate over a
// string should not open a connection, and a test that only wants to know whether "everyone" is a
// visibility should not need a Postgres database to find out.

/** Who may SEE an event. */
export type EventVisibility = 'clan' | 'invited' | 'public';
/** Who may ENTER it, and whether the host has to say yes. */
export type EventEntry = 'open' | 'approval';

/**
 * Both parsers fall back to the CLOSED answer rather than the open one, at every call site.
 *
 * A row with a value nobody recognises — a typo, a half-finished migration, a feature rolled back —
 * is a row nobody has made a decision about, and the safe reading of no decision is "the clan's
 * alone". Defaulting the other way would publish a board because a string was misspelled.
 */
export function isVisibility(v: string | null | undefined): v is EventVisibility {
  return v === 'clan' || v === 'invited' || v === 'public';
}

export function isEntry(v: string | null | undefined): v is EventEntry {
  return v === 'open' || v === 'approval';
}

export function visibilityOf(v: string | null | undefined): EventVisibility {
  return isVisibility(v) ? v : 'clan';
}

export function entryOf(v: string | null | undefined): EventEntry {
  return isEntry(v) ? v : 'open';
}
