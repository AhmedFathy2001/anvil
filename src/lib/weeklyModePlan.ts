import { firstTable, HARDCORE_TABLE } from '@/lib/competitionGame';
import { parseStamp } from '@/lib/dbTime';
import type { HiscoresSnapshot } from '@/lib/hiscores';
import type { ModeFetchMode } from '@/lib/modeHiscores';

// The pure half of lib/weeklyModeScores: what a finished mode-table read means for one competition
// entrant, and which read it wants next. No database, so it is tested directly
// (tests/weekly-mode-scores.test.ts).

export const MODE_READ_EVERY_MS = 60 * 60 * 1000;
export const HCW_PROBE_EVERY_MS = 6 * 60 * 60 * 1000;

export interface WeeklyModeRow {
  participantId: number;
  competitionId: number;
  countsOn: string;
  type: string;
  metric: string;
  startDate: string;
  rsn: string;
  hiscoresTable: string | null;
  baselineValue: number | null;
  currentValue: number | null;
  lastUpdated: string | null;
  /** An item hunt's rules, for its per-row stats; null on every other competition. */
  hunt?: string | null;
}

export interface ModeRead {
  at: string;
  /** Null = the table doesn't have this character. */
  snapshot: HiscoresSnapshot | null;
}

export type ModeReadPlan =
  | { action: 'none' }
  | { action: 'apply'; table: string; snapshot: HiscoresSnapshot; pin: boolean }
  | { action: 'stop' };

/** What a finished read means for one entrant. `reads` is keyed `<rsnKey>|<table>`; `key` is its name's (lib/auth normalizeRsn). */
export function planModeRead(row: WeeklyModeRow, reads: ReadonlyMap<string, ModeRead>, key: string): ModeReadPlan {
  if (!key) return { action: 'none' };
  const pinned = row.hiscoresTable ?? firstTable(row.countsOn);
  if (pinned) {
    const read = reads.get(`${key}|${pinned}`);
    if (!read) return { action: 'none' };
    if (read.snapshot) return { action: 'apply', table: pinned, snapshot: read.snapshot, pin: row.hiscoresTable == null };
    // Gone from Hardcore Worlds after it had a starting line there: a death (reset or converted).
    return pinned === HARDCORE_TABLE && row.baselineValue != null ? { action: 'stop' } : { action: 'none' };
  }
  // Mixed and not pinned: only an entrant the main read never found is a Hardcore Worlds candidate.
  if (row.baselineValue != null) return { action: 'none' };
  const read = reads.get(`${key}|${HARDCORE_TABLE}`);
  return read?.snapshot ? { action: 'apply', table: HARDCORE_TABLE, snapshot: read.snapshot, pin: true } : { action: 'none' };
}

/** The read this entrant wants queued now, if any. `probedAt`: when its Hardcore Worlds table was last asked for. */
export function modeReadWanted(row: WeeklyModeRow, nowMs: number, probedAt: number | null): { table: ModeFetchMode; priority: number } | null {
  const pinned = (row.hiscoresTable ?? firstTable(row.countsOn)) as ModeFetchMode | null;
  if (pinned) {
    // The starting line straight away, in the competition lane; after that hourly, as filler.
    if (row.baselineValue == null) return { table: pinned, priority: 0 };
    const last = parseStamp(row.lastUpdated);
    return last == null || nowMs - last >= MODE_READ_EVERY_MS ? { table: pinned, priority: 1 } : null;
  }
  if (row.baselineValue != null) return null;
  if (probedAt != null && nowMs - probedAt < HCW_PROBE_EVERY_MS) return null;
  return { table: HARDCORE_TABLE, priority: 0 };
}

