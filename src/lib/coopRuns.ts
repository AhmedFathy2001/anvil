// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Shared kills: turning N members' reports of the SAME kill into one run.
//
// Every participant's client sees the kill, so a 2-man Yama gives the team 2 KC and a 20-man raid
// gives it 20 — for one kill. Two tile settings ride on top of the runs this builds:
//
//   coopCredit 'per-kill'  — a shared kill credits ONCE however many members reported it.
//   coopMinMembers N       — a kill only counts when at least N of the team were in it, which is
//                            the "complete raids with 3+ teammates" tile.
//
// Correlation, not guesswork. Each submission carries what its client could see at kill time:
//   coopGroup      — roster teammates it saw in the instance (lowercased RSNs). Reliable for a
//                    single-arena boss; unreliable inside raids, where the party splits across rooms.
//   coopPartySize  — how many were in the instance/raid party. Reliable exactly where names aren't
//                    (the raid party varbits), so between them one of the two always says something.
//
// A submission that reports neither is a SOLO kill and never merges with anything, so two members
// grinding the same boss in separate instances still count twice. Two co-op submissions merge when
// they land close together AND their groups overlap — or when neither could see names (the raid
// case), where closeness is all we have.
//
// Under-reporting is self-correcting: if only one of two partners runs the plugin there is one
// report and nothing to collapse, which is already the right answer.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** How long after the first report of a kill another report can still be the same kill. */
export const COOP_WINDOW_MS = 10 * 60 * 1000;

export type CoopCredit = 'per-member' | 'per-kill';

export interface CoopSubmission {
  id: number;
  /** Who this submission counts for — creditPlayerId ?? playerId (lib/countProgress's key). */
  playerId: number | null;
  amount: number;
  createdAt: string;
  /** The submitter's own lowercased RSN, so "A named B" can be matched against B's own report. */
  rsn?: string | null;
  /** Lowercased RSNs of roster teammates the client saw. Null/empty = saw none (or couldn't look). */
  coopGroup?: string[] | null;
  /** Players in the instance/raid party, as the client counted them. 0/1/null = not a group. */
  coopPartySize?: number | null;
}

export interface CoopRun {
  submissions: CoopSubmission[];
  /** True when this run is a shared kill rather than one member's solo kill. */
  shared: boolean;
  /** Distinct team members known to be in it — reporters plus anyone they named. */
  memberCount: number;
  /** What this run contributes toward the tile under the tile's settings. */
  credit: number;
}

export function parseCoopCredit(raw: string | null | undefined): CoopCredit {
  return raw === 'per-kill' ? 'per-kill' : 'per-member';
}

/** A submission is co-op if its client saw ANY sign of company. */
export function isCoop(s: CoopSubmission): boolean {
  return (s.coopGroup?.length ?? 0) > 0 || (s.coopPartySize ?? 0) > 1;
}

function overlaps(a: CoopSubmission, b: CoopSubmission): boolean {
  const ga = a.coopGroup ?? [];
  const gb = b.coopGroup ?? [];
  // Neither client could name anyone (raids — the party splits across rooms, so the scene headcount
  // reads as solo). Party size says they were in company, and the window is what we have left.
  if (ga.length === 0 || gb.length === 0) return true;
  return ga.some((n) => gb.includes(n)) ||
    // A named B without B naming A (or vice versa) still identifies the same kill.
    (!!b.rsn && ga.includes(b.rsn)) ||
    (!!a.rsn && gb.includes(a.rsn));
}

/**
 * Group a team's submissions on ONE tile into runs, newest last. Solo submissions each become their
 * own run; co-op submissions merge with an open run they overlap with inside the window.
 */
export function buildRuns(
  subs: CoopSubmission[],
  opts: { minMembers?: number | null; credit?: CoopCredit; namedMemberIds?: (group: string[]) => number[] } = {},
): CoopRun[] {
  const credit = opts.credit ?? 'per-member';
  const minMembers = opts.minMembers ?? 0;
  const ordered = [...subs].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const runs: { subs: CoopSubmission[]; startedAt: number }[] = [];

  for (const s of ordered) {
    const at = Date.parse(s.createdAt);
    if (!isCoop(s)) {
      runs.push({ subs: [s], startedAt: at });
      continue;
    }
    // Newest first: a member reporting late joins the run still open, not an older finished one.
    const open = [...runs].reverse().find(
      (r) => r.subs.every(isCoop) && at - r.startedAt <= COOP_WINDOW_MS && r.subs.some((x) => overlaps(x, s)),
    );
    if (open) {
      open.subs.push(s);
    } else {
      runs.push({ subs: [s], startedAt: at });
    }
  }

  return runs.map((r) => {
    const shared = r.subs.length > 1 || r.subs.some(isCoop);
    // Who was in it: everyone who reported, plus anyone they named who is on the team. The named
    // half is what lets a run of three count when only one of the three runs the plugin.
    const ids = new Set<number>();
    for (const s of r.subs) {
      if (s.playerId != null) ids.add(s.playerId);
      if (opts.namedMemberIds && s.coopGroup?.length) {
        for (const id of opts.namedMemberIds(s.coopGroup)) ids.add(id);
      }
    }
    // Deliberately NOT the reported party size: 20 people in a CoX raid is not 20 teammates, and a
    // minimum-teammates gate must never be satisfied by strangers. Only reporters and named roster
    // members count, so the gate errs toward not crediting.
    const memberCount = Math.max(1, ids.size);

    let value: number;
    if (minMembers > 0 && memberCount < minMembers) {
      value = 0; // the kill happened, but not with enough of the team in it
    } else if (shared && credit === 'per-kill') {
      value = 1; // one kill, one credit, however many reported it
    } else {
      value = r.subs.reduce((sum, s) => sum + Math.max(0, s.amount), 0);
    }
    return { submissions: r.subs, shared, memberCount, credit: value };
  });
}

/** Total credited toward a tile once shared kills are collapsed and the minimum is applied. */
export function coopProgress(
  subs: CoopSubmission[],
  opts: { minMembers?: number | null; credit?: CoopCredit; namedMemberIds?: (group: string[]) => number[] } = {},
): { current: number; runs: CoopRun[] } {
  const runs = buildRuns(subs, opts);
  return { current: runs.reduce((sum, r) => sum + r.credit, 0), runs };
}
