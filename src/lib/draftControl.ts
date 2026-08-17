import { db } from '@/db';
import { events, players, teams } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getTeamForPick } from '@/lib/draft';
import {
  bestBalancingSwap,
  buildDraftBalance,
  spreadCapBlockReason,
  tierPickBlockReason,
  type DraftBalance,
  type Tier,
} from '@/lib/draftBalance';
import { rotateOrderSoNextIs, spreadPct, strengthOf } from '@/lib/draftMath';
import { parseEventRules } from '@/lib/eventRules';
import { parseStamp } from '@/lib/dbTime';

/**
 * What an admin needs to steer a draft while it's running.
 *
 * The balance panel already computed strengths and tiers, but its only action was gated to
 * `draftStatus === 'none'` — so the moment a draft started, staff got bars and no levers, and the
 * swap the server could already describe was never shown. This is the running-draft half: the same
 * numbers kept live, plus what to do about them.
 *
 * Everything here is advisory arithmetic over ratings. Nothing in it blocks a pick or a start; the
 * enforcement that exists (tiered-snake) lives in the pick route and is only *previewed* here.
 */

// Re-exported so the route and the panel import one draft-control surface, not two.
export { rotateOrderSoNextIs, spreadPct, strengthOf };

export interface ControlTeam {
  teamId: number;
  name: string;
  color: string;
  size: number;
  strength: number;
  /** Distance from the average roster, as a signed pct. The imbalance, not the rank. */
  deviationPct: number;
  tiers: Record<Tier, number>;
  domains: string[];
  /** People this team may not take right now under tiered-snake, and why. */
  lockedCount: number;
  lockedReason: string | null;
  roster: { personKey: string; rsn: string; tier: Tier | null; playerIds: number[]; pickNumber: number | null }[];
}

export interface ControlPick {
  pickNumber: number;
  rsn: string;
  teamId: number | null;
  teamName: string | null;
  teamColor: string | null;
  tier: Tier | null;
  /** What this pick did to the spread, in points. Positive = made it worse. */
  swing: number;
  spreadAfter: number;
}

export interface DraftControl {
  eventId: number;
  draftStatus: string;
  balanceMode: string;
  /** 'spread-cap' mode: the configured ceiling above the average roster, in pct. */
  balanceSpreadCapPct: number;
  /** Seconds a captain gets per pick. 0 = no clock. */
  pickSeconds: number;
  /** When the current pick is due, or null with no clock (or before the first pick lands). */
  pickDueAt: string | null;
  /** True once the current pick is past due — the host may take it. Never auto-picks. */
  pickOverdue: boolean;
  teamOrder: number[];
  currentTeamId: number | null;
  currentPickNumber: number;
  round: number;
  poolRemaining: number;
  spreadPct: number;
  meanStrength: number;
  teams: ControlTeam[];
  picks: ControlPick[];
  /** The single two-person move that most shrinks the spread. Null when nothing helps much. */
  suggestedSwap:
    | { give: string; giveTeamId: number; take: string; takeTeamId: number; spreadBeforePct: number; spreadAfterPct: number }
    | null;
  /** True when the pool has no usable ratings — every number below is then meaningless. */
  unrated: boolean;
}

const EMPTY_TIERS: Record<Tier, number> = { S: 0, A: 0, B: 0, C: 0 };

export async function buildDraftControl(eventId: number): Promise<DraftControl | null> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return null;

  const [eventTeams, eventPlayers, balance] = await Promise.all([
    db.select().from(teams).where(eq(teams.eventId, eventId)),
    db.select().from(players).where(eq(players.eventId, eventId)),
    buildDraftBalance(eventId),
  ]);

  const existing = new Set(eventTeams.map((t) => t.id));
  const savedOrder: number[] = (event.draftOrder ? JSON.parse(event.draftOrder) : []).filter((id: number) =>
    existing.has(id),
  );
  const ordered = new Set(savedOrder);
  const teamOrder = [...savedOrder, ...eventTeams.filter((t) => !ordered.has(t.id)).map((t) => t.id)];

  // Turns taken = distinct pick numbers (a multi-account person is one pick).
  const pickNumbers = new Set<number>();
  for (const p of eventPlayers) if (p.pickNumber != null) pickNumbers.add(p.pickNumber);
  const currentPickNumber = pickNumbers.size;
  const poolRemaining = eventPlayers.filter((p) => p.teamId == null).length;

  const teamById = new Map(eventTeams.map((t) => [t.id, t]));

  const strengthByTeam = new Map<number, number>();
  for (const t of eventTeams) {
    const mine = balance.profiles.filter((p) => p.teamId === t.id);
    strengthByTeam.set(t.id, strengthOf(mine.map((p) => p.rating)));
  }
  const strengths = eventTeams.map((t) => strengthByTeam.get(t.id) ?? 0);
  const mean = strengths.length > 0 ? strengths.reduce((a, b) => a + b, 0) / strengths.length : 0;

  const rules = parseEventRules(event.rules);
  const balanceMode = rules.balanceMode;
  const pool = balance.profiles.filter((p) => p.teamId == null);

  const controlTeams: ControlTeam[] = eventTeams.map((t) => {
    const mine = balance.profiles.filter((p) => p.teamId === t.id);
    const tiers = { ...EMPTY_TIERS };
    for (const p of mine) {
      const tier = balance.tierByPersonKey.get(p.personKey);
      if (tier) tiers[tier] += 1;
    }
    const strength = strengthByTeam.get(t.id) ?? 0;

    // What tiered-snake would refuse this team right now. Only computed when the mode is armed —
    // otherwise nothing is locked and the question doesn't arise.
    let lockedCount = 0;
    let lockedReason: string | null = null;
    if (balanceMode === 'tiered-snake' || balanceMode === 'spread-cap') {
      for (const p of pool) {
        const reason =
          balanceMode === 'tiered-snake'
            ? tierPickBlockReason(balance, p.playerIds[0], t.id, teamOrder)
            : spreadCapBlockReason(balance, p.playerIds[0], t.id, teamOrder, rules.balanceSpreadCapPct);
        if (reason) {
          lockedCount += 1;
          lockedReason ??= reason;
        }
      }
    }

    return {
      teamId: t.id,
      name: t.name,
      color: t.color,
      size: mine.length,
      strength,
      deviationPct: mean > 0 ? Math.round(((strength - mean) / mean) * 100) : 0,
      tiers,
      domains: [...new Set(mine.flatMap((p) => p.domains))],
      lockedCount,
      lockedReason,
      roster: mine
        .map((p) => ({
          personKey: p.personKey,
          rsn: p.rsn,
          tier: balance.tierByPersonKey.get(p.personKey) ?? null,
          playerIds: p.playerIds,
          pickNumber:
            eventPlayers.find((row) => p.playerIds.includes(row.id))?.pickNumber ?? null,
        }))
        .sort((a, b) => (a.pickNumber ?? 0) - (b.pickNumber ?? 0)),
    };
  });

  // ── The pick log, with what each pick did to the spread ──────────────────────────────────────
  // Replayed rather than recorded: ratings are static per person, so the rosters as of pick k are
  // just "everyone whose pickNumber ≤ k", and the spread at each step falls out of that.
  const pickedRows = eventPlayers
    .filter((p) => p.pickNumber != null && p.teamId != null)
    .sort((a, b) => (a.pickNumber ?? 0) - (b.pickNumber ?? 0));
  const personOf = (playerId: number) =>
    balance.profiles.find((p) => p.playerIds.includes(playerId)) ?? null;

  const running = new Map<number, number[]>(eventTeams.map((t) => [t.id, []]));
  const picks: ControlPick[] = [];
  let prevSpread = 0;
  const seenPickNumbers = new Set<number>();
  for (const row of pickedRows) {
    const pickNumber = row.pickNumber as number;
    if (seenPickNumbers.has(pickNumber)) continue; // a multi-account person is one pick
    seenPickNumbers.add(pickNumber);
    const person = personOf(row.id);
    const teamId = row.teamId as number;
    running.get(teamId)?.push(person?.rating ?? 0);
    const after = spreadPct(eventTeams.map((t) => strengthOf(running.get(t.id) ?? [])));
    const team = teamById.get(teamId) ?? null;
    picks.push({
      pickNumber,
      rsn: person?.rsn ?? row.name,
      teamId,
      teamName: team?.name ?? null,
      teamColor: team?.color ?? null,
      tier: person ? balance.tierByPersonKey.get(person.personKey) ?? null : null,
      swing: after - prevSpread,
      spreadAfter: after,
    });
    prevSpread = after;
  }
  picks.reverse(); // newest first — the end of the log is what an admin is watching

  const currentTeamId =
    event.draftStatus === 'active' && teamOrder.length > 0 && poolRemaining > 0
      ? getTeamForPick(teamOrder, currentPickNumber)
      : null;

  // The clock runs from the previous pick. Before the first one there's nothing to count from, so
  // the opening pick is untimed rather than counted from an invented start.
  const lastPickAt = pickedRows
    .map((r) => r.pickedAt)
    .filter((v): v is string => !!v)
    .sort()
    .at(-1) ?? null;
  const pickSeconds = rules.pickSeconds;
  // parseStamp, not Date.parse: this column holds both JS ISO and the zone-less
  // "YYYY-MM-DD HH:MM:SS", and V8 reads the latter as LOCAL time — a deadline hours out (lib/dbTime).
  const lastPickMs = parseStamp(lastPickAt);
  const pickDueAt =
    pickSeconds > 0 && lastPickMs != null && event.draftStatus === 'active'
      ? new Date(lastPickMs + pickSeconds * 1000).toISOString()
      : null;

  return {
    eventId,
    draftStatus: event.draftStatus,
    balanceMode,
    balanceSpreadCapPct: rules.balanceSpreadCapPct,
    pickSeconds,
    pickDueAt,
    pickOverdue: pickDueAt != null && Date.parse(pickDueAt) <= Date.now(),
    teamOrder,
    currentTeamId,
    currentPickNumber,
    round: teamOrder.length > 0 ? Math.floor(currentPickNumber / teamOrder.length) : 0,
    poolRemaining,
    spreadPct: spreadPct(strengths),
    meanStrength: mean,
    teams: controlTeams,
    picks,
    suggestedSwap: bestBalancingSwap(balance, eventTeams.map((t) => t.id)),
    // Pool-relative ratings collapse to identical values when nobody has an enrollment snapshot;
    // the bars would then show a confident-looking balance that means nothing.
    unrated: allEqual(balance),
  };
}

function allEqual(balance: DraftBalance): boolean {
  if (balance.profiles.length === 0) return true;
  const first = balance.profiles[0].rating;
  return balance.profiles.every((p) => p.rating === first);
}
