// Tiles that can never credit themselves, found before a player finds them.
//
// A misconfigured tile doesn't announce itself: nothing errors, nothing logs, the tile simply
// never completes — and you learn about it on day nine when someone asks why their drop didn't
// count. Every check here is "this tile's kind needs a thing it hasn't got", read off the same
// columns lib/tileKinds and the tracking pipeline read.
//
// Pure and dependency-free so tests/board-misconfig.test.ts can run it with Node type-stripping.

export interface MisconfigTile {
  id: number;
  position: number;
  label: string;
  tileType?: string | null;
  requiredAmount?: number | null;
  trackedStat?: string | null;
  statGoal?: number | null;
  trackedItemIds?: string | null;
  itemRequirements?: string | null;
  targetNpcs?: string | null;
  sourceNpcs?: string | null;
  points?: number | null;
  optional?: number | null;
  autoTrackDisabled?: number | null;
  timeThresholdSeconds?: number | null;
}

export type MisconfigSeverity = 'broken' | 'check';

export interface BoardProblem {
  tileId: number;
  position: number;
  label: string;
  severity: MisconfigSeverity;
  /** What's wrong, in the words an admin would use. */
  problem: string;
  /** What to do about it. */
  fix: string;
}

function isEmptyList(raw: string | null | undefined): boolean {
  if (!raw) return true;
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '[]' || trimmed === '{}') return true;
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.length === 0;
    if (parsed && typeof parsed === 'object') return Object.keys(parsed).length === 0;
  } catch {
    // A non-JSON string is a value, not an empty list.
  }
  return false;
}

/**
 * Everything wrong with a board, worst first.
 *
 * 'broken' = this tile cannot complete as configured; a player working on it is wasting their time.
 * 'check'  = it will complete, but probably not the way you meant.
 *
 * A tile with automatic crediting switched off is never 'broken' — that's a deliberate
 * complete-it-by-hand tile, which is the escape hatch for exactly this situation.
 */
export function findBoardProblems(tiles: MisconfigTile[], opts: { pointsMode: boolean }): BoardProblem[] {
  const problems: BoardProblem[] = [];

  for (const tile of tiles) {
    const manual = tile.autoTrackDisabled === 1;
    const push = (severity: MisconfigSeverity, problem: string, fix: string) =>
      problems.push({ tileId: tile.id, position: tile.position, label: tile.label, severity, problem, fix });

    switch (tile.tileType) {
      case 'drop':
      case 'gain':
        if (!manual && isEmptyList(tile.trackedItemIds) && isEmptyList(tile.itemRequirements)) {
          push('broken', 'No item is being watched for', 'Pick the item (or items) that should credit this tile.');
        }
        break;
      case 'kill':
      case 'lap':
        if (!manual && isEmptyList(tile.targetNpcs)) {
          push(
            'broken',
            tile.tileType === 'kill' ? 'No boss or NPC is being counted' : 'No course is being counted',
            'Choose what should be counted, or complete this tile by hand.',
          );
        }
        break;
      case 'timed':
        if (!manual && !tile.timeThresholdSeconds) {
          push('broken', 'No time to beat is set', 'Set the time that counts as a clear.');
        }
        break;
      case 'standard':
      case null:
      case undefined:
        // A "standard" tile with a tracked stat is a hiscores tile; without a goal it can't finish.
        if (tile.trackedStat && !tile.statGoal) {
          push('broken', 'A stat is tracked but no goal is set', 'Set the XP or kill count that finishes it.');
        }
        break;
      default:
        break;
    }

    // Count-based kinds with a zero/negative requirement complete on the first credit, which is
    // almost never what "collect 100 swamp tar" was supposed to mean.
    if (
      tile.requiredAmount != null &&
      tile.requiredAmount <= 0 &&
      ['drop', 'kill', 'lap', 'pvp', 'gain'].includes(tile.tileType ?? '')
    ) {
      push('check', 'Completes on the first one', 'Set how many are needed, if more than one.');
    }

    if (opts.pointsMode && !tile.optional && (tile.points ?? 0) <= 0) {
      push('check', 'Worth nothing on a points board', 'Give it a point value, or mark it optional.');
    }
  }

  const rank: Record<MisconfigSeverity, number> = { broken: 0, check: 1 };
  return problems.sort((a, b) => rank[a.severity] - rank[b.severity] || a.position - b.position);
}

/** One-line summary for a banner — null when there's nothing to say. */
export function summariseProblems(problems: BoardProblem[]): string | null {
  if (problems.length === 0) return null;
  const broken = problems.filter((p) => p.severity === 'broken').length;
  const checks = problems.length - broken;
  if (broken > 0 && checks > 0) {
    return `${broken} tile${broken === 1 ? '' : 's'} can't credit, ${checks} worth a look`;
  }
  if (broken > 0) return `${broken} tile${broken === 1 ? '' : 's'} can't credit as set up`;
  return `${checks} tile${checks === 1 ? '' : 's'} worth a look`;
}
