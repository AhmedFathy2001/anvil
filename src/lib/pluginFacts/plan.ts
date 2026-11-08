/**
 * Turns matched credits into the submission bodies the plugin used to POST itself, one per proof or
 * ping, so the submissions route (validation, caps, completions, live push) stays the only writer.
 * Pure — the facts route sends what this returns.
 */
import { killWantsProof, MAX_PING_AMOUNT, planPings, type Credit, type FactBoard } from '@/lib/pluginFacts/match';
import { parseTrialRankTile } from '@/lib/barracudaTrials';

export interface Coop {
  teammates?: string[];
  partySize?: number;
}

export interface PlannedSubmission {
  board: FactBoard;
  body: Record<string, unknown>;
  credit: Credit;
}

const BANNER: Record<Exclude<Credit['kind'], 'tile'>, string> = { drop: 'BINGO DROP', value: 'BINGO VALUE', kill: 'BINGO KILL' };

export function formatGp(gp: number): string {
  if (gp >= 1_000_000) return `${(gp / 1_000_000).toFixed(1)}M gp`;
  if (gp >= 1_000) return `${Math.round(gp / 1_000)}k gp`;
  return `${gp} gp`;
}

/** m:ss, as the game prints a clear time. */
export function clock(sec: number): string {
  const s = sec % 60;
  return `${Math.floor(sec / 60)}:${s < 10 ? '0' : ''}${s}`;
}

function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

/**
 * A `tile` fact's proof banner and submission note: the text the plugin used to write itself for
 * each kind (a gain ping without a screenshot is "counted", its proof "detected").
 */
export function tileText(c: Credit, withImage: boolean): { title: string; detail: string; note: string } {
  const f = c.fact!;
  const row = c.row ?? { tileId: c.tileId, label: c.label };
  const what = f.what ?? '';
  const auto = (s: string) => `[Auto] ${s} — detected by RuneLite plugin`;
  const lvl = f.lvl ? `  level ${f.lvl}` : '';
  const activity = row.activity ?? c.label;
  switch (c.tileKind) {
    case 'gain':
      return {
        title: 'BINGO GAIN',
        detail: `${c.label}  ×${c.amount}  (${c.have}/${c.of})`,
        note: `[Auto] ${c.label} gain(s) ${withImage ? 'detected' : 'counted'} by RuneLite plugin`,
      };
    case 'timed': {
      const t = clock(f.sec ?? 0);
      const trial = f.tr || parseTrialRankTile(row.activity);
      return {
        title: 'BINGO TIMED',
        detail: trial ? `${activity}  ${t}` : `${activity}  ${t}  (cap ${clock(row.thresholdSeconds ?? 0)})${lvl}`,
        note: `[Auto] ${activity} cleared in ${t} by RuneLite plugin`,
      };
    }
    case 'deathless':
      return {
        title: 'BINGO DEATHLESS',
        detail: `${activity}  deathless${(row.partySize ?? 0) > 0 ? `  party ${f.party ?? 0}` : ''}${lvl}  (${c.have}/${c.of})`,
        note: `[Auto] ${activity} deathless run detected by RuneLite plugin`,
      };
    case 'lms': {
      const place = ordinal(f.place ?? 1);
      const kills = `${f.kills ?? 0} ${f.kills === 1 ? 'kill' : 'kills'}`;
      return {
        title: 'BINGO LMS',
        detail: `Placed ${place} — ${kills}  (needs top ${Math.max(1, row.placementCap ?? 1)})`,
        note: auto(`LMS ${place} place, ${kills}`),
      };
    }
    case 'pvp':
      return { title: 'BINGO PVP KILL', detail: `Killed ${what}  (${c.have}/${c.of})`, note: auto(`PvP kill on ${what}`) };
    case 'diary':
      return { title: 'DIARY COMPLETE', detail: `${what} Diary`, note: auto(`${what} diary completed`) };
    case 'ca':
      return { title: 'COMBAT TASK', detail: `${f.tier}: ${what}`, note: auto(`${f.tier} combat task "${what}" completed`) };
    default:
      return f.pg
        ? { title: 'COLLECTION LOG PAGE', detail: what, note: `[Auto] Finished collection log page: ${what}` }
        : { title: 'COLLECTION LOG', detail: what, note: auto(`New collection log slot: ${what}`) };
  }
}

/** The submission body for a `tile` credit — what the plugin's own POST carried for that kind. */
function tileBody(c: Credit, board: FactBoard, img: string | null, proof: Record<string, unknown> | null, coop: Coop | null): Record<string, unknown> {
  const f = c.fact!;
  const legacy = f.note != null;
  const text = legacy ? null : tileText(c, !!img);
  const row = c.row;
  const coopNeeded = legacy || (c.tileKind === 'deathless' && ((row?.coopCredit ?? '').toLowerCase() === 'per-kill' || (row?.coopMinMembers ?? 0) > 0));
  return {
    tileId: c.tileId,
    teamId: board.teamId,
    creditPlayerId: board.playerId,
    amount: c.amount,
    note: legacy ? f.note : text!.note,
    imageUrl: img,
    ...(f.sec != null ? { durationSeconds: f.sec } : {}),
    ...(f.item != null ? { itemId: f.item } : {}),
    ...(f.inf ? { inferred: f.inf } : {}),
    ...(coopNeeded && coop
      ? {
          ...(coop.teammates?.length ? { coopGroup: coop.teammates } : {}),
          ...((coop.partySize ?? 0) > 1 ? { coopPartySize: coop.partySize } : {}),
        }
      : {}),
    ...(img && proof ? { proof: text ? { ...proof, title: text.title, detail: text.detail } : proof } : {}),
  };
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
    if (c.kind === 'tile') {
      out.push({ board, credit: c, body: tileBody(c, board, img, proof, coop) });
      continue;
    }
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
      ...(proof ? { proof: { ...proof, title: BANNER[c.kind as keyof typeof BANNER], detail } } : {}),
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
