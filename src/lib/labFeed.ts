import type { MomentRow } from '@/lib/momentsStore';
import { settleDeathSource } from '@/lib/deathSource';

// A lab board's Feed (lib/lab). Every moments push during a lab session is written to `lab_log`, and
// none is ever stored as a moment ON the lab board: a replayed scenario's is held back from
// everything real, and real play is stored on the character's real board and clan (the moments route
// leaves lab boards out of its pick). So the board's Feed reads the log instead — this turns those
// logged pushes into feed rows for that board alone, read-only, never written anywhere — and the
// Feed can be tested in the lab like everything else.
//
// Pure (no db): lib/lab reads the log, this shapes it.

/** One logged moments push: the lab_log row and who pushed it. */
export interface LabMomentsPush {
  logId: number;
  rsn: string;
  teamId: number | null;
  payload: unknown;
}

/** The plugin's kind → the stored kind a board's feed shows. Log slots, diaries and quests are the clan's, not a board's. */
const KIND: Record<string, string> = { drop: 'loot', pet: 'pet', death: 'death', ca: 'ca', level: 'level' };

/** Most moments one push carries (the moments route's own cap). */
const PER_PUSH = 25;

const str = (v: unknown, max = 80): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null);

/** "2026-11-04T11:25:59.642Z" → the stored stamp form "2026-11-04 11:25:59"; null when it isn't a date. */
function stamp(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 19).replace('T', ' ') : null;
}

/**
 * Logged pushes → feed rows, newest first. Ids are negative (from the log row and the position in
 * it) so they can never collide with a real moment's.
 */
export function labMomentRows(pushes: LabMomentsPush[], eventId: number): MomentRow[] {
  const out: MomentRow[] = [];
  for (const push of pushes) {
    const list = (push.payload as { moments?: unknown } | null)?.moments;
    if (!Array.isArray(list)) continue;
    list.slice(0, PER_PUSH).forEach((item, i) => {
      if (!item || typeof item !== 'object') return;
      const raw = { ...(item as Record<string, unknown>) };
      const kind = typeof raw.kind === 'string' ? KIND[raw.kind] : undefined;
      const occurredAt = stamp(raw.at);
      if (!kind || !occurredAt) return;
      settleDeathSource(raw);
      out.push({
        id: -(push.logId * PER_PUSH + i + 1),
        rsn: push.rsn,
        kind,
        itemId: int(raw.itemId),
        itemName: str(raw.itemName),
        quantity: int(raw.quantity) ?? 1,
        valueGp: int(raw.valueGp),
        source: str(raw.source),
        kc: int(raw.kc),
        rarityDenominator: null,
        tier: str(raw.tier, 16),
        sourceKind: str(raw.sourceKind, 16),
        teamId: push.teamId,
        eventId,
        occurredAt,
      });
    });
  }
  return out.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0));
}
