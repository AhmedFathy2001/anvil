import { sql } from 'drizzle-orm';
import { tiles } from '@/db/schema';

/**
 * A tile somebody actually wrote, as a WHERE condition.
 *
 * Creating an event without labels seeds the whole board with placeholders — "Tile 1".."Tile N",
 * standard kind, no tracking — so a plain count says a brand-new 5×5 is fully authored. That told
 * every first-time admin to "Open sign-ups" on an empty board, and ticked the setup checklist's
 * "Add tiles" the moment the event existed. Same test as the tile editor's blank-row check and the
 * balance auditor's BLANK_LABEL.
 */
export const writtenTile = sql`NOT (${tiles.label} ~ '^Tile [0-9]+$' AND ${tiles.tileType} = 'standard' AND ${tiles.trackedStat} IS NULL)`;
