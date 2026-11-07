/**
 * Turns matched credits into the submission bodies the plugin used to POST itself, one per proof or
 * ping, so the submissions route (validation, caps, completions, live push) stays the only writer.
 * Pure — the facts route sends what this returns.
 */
import { killWantsProof, MAX_PING_AMOUNT, planPings, type Credit, type FactBoard } from '@/lib/pluginFacts/match';

export interface Coop {
  teammates?: string[];
  partySize?: number;
}

export interface PlannedSubmission {
  board: FactBoard;
  body: Record<string, unknown>;
  credit: Credit;
}

const BANNER: Record<Credit['kind'], string> = { drop: 'BINGO DROP', value: 'BINGO VALUE', kill: 'BINGO KILL' };

export function formatGp(gp: number): string {
  if (gp >= 1_000_000) return `${(gp / 1_000_000).toFixed(1)}M gp`;
  if (gp >= 1_000) return `${Math.round(gp / 1_000)}k gp`;
  return `${gp} gp`;
}

function note(c: Credit, unit: string): string {
  if (c.kind === 'value') return `[Auto] loot worth ${formatGp(c.amount)} (${c.label}) counted by RuneLite plugin`;
  if (c.kind === 'kill') return `[Auto] ${c.label} ${unit}(s) counted by RuneLite plugin`;
  return `[Auto] ${c.label} detected by RuneLite plugin`;
}

/**
 * @param img  the batch's screenshot (already uploaded), or null
 * @param proof the client's proof metadata (tz, capturedAt, tick, chat, split); title/detail are set per credit
 * @param units kill tile id → its noun ("kill", "lap")
 */
export function planSubmissions(
  credits: Credit[],
  boardOf: (c: Credit) => FactBoard | null,
  img: string | null,
  proof: Record<string, unknown> | null,
  coop: Coop | null,
  units: Map<number, string> = new Map(),
): PlannedSubmission[] {
  const out: PlannedSubmission[] = [];
  for (const c of credits) {
    const board = boardOf(c);
    if (!board) continue;
    const unit = units.get(c.tileId) ?? 'kill';
    const base: Record<string, unknown> = {
      tileId: c.tileId,
      teamId: board.teamId,
      creditPlayerId: board.playerId,
      note: note(c, unit),
      ...(c.itemId != null ? { itemId: c.itemId } : {}),
      ...(c.inferred ? { inferred: c.inferred } : {}),
      ...(c.kind === 'kill' && c.coop && coop
        ? {
            ...(coop.teammates?.length ? { coopGroup: coop.teammates } : {}),
            ...((coop.partySize ?? 0) > 1 ? { coopPartySize: coop.partySize } : {}),
          }
        : {}),
    };
    const detail =
      c.kind === 'value' ? `${c.label}  ${formatGp(c.amount)}` : `${c.label}  ×${c.amount}  (${c.have}/${c.of})`;
    const withProof = (amount: number) => ({
      ...base,
      amount,
      imageUrl: img,
      ...(proof ? { proof: { ...proof, title: BANNER[c.kind], detail } } : {}),
    });
    if (c.kind !== 'kill') {
      out.push({ board, credit: c, body: withProof(c.amount) });
      continue;
    }
    if (img && killWantsProof(c)) {
      out.push({ board, credit: c, body: withProof(c.amount) });
      continue;
    }
    // Count-only pings. Without the screenshot a proof would have wanted, split into ≤10s rather
    // than lose the count (the site flags an oversized ping; a refused one would be gone).
    const pings = planPings(c.parts ?? [c.amount], c.amount, c.pingMax) ?? chunk(c.amount, MAX_PING_AMOUNT);
    for (const amount of pings) out.push({ board, credit: c, body: { ...base, amount, imageUrl: null } });
  }
  return out;
}

function chunk(total: number, size: number): number[] {
  const out: number[] = [];
  for (let left = total; left > 0; left -= size) out.push(Math.min(size, left));
  return out;
}
