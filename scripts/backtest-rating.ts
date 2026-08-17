/**
 * Phase-1 backtest for the balance-engine plan (~/.claude/plans/tile-pricing-player-profiles.md):
 * can a player rating computed from strictly PRE-event data predict how lopsided the teams of a
 * finished event actually were?
 *
 *   DATABASE_URL=file:/path/to/snapshot.db node --experimental-strip-types scripts/backtest-rating.ts --event 8
 *
 * Read-only, and the LAST thing here that still speaks SQLite: it analyses standalone snapshot
 * FILES taken before the Postgres port, never the live database. Uses raw SQL on purpose — a
 * snapshot may lag the local drizzle schema, so it only touches columns that have existed for a
 * long time. @libsql/client is a devDependency for exactly this.
 *
 * What it prints:
 *   1. ACTUAL   — final team totals and each person's share (the ground truth), plus the
 *                 carries-vs-no-shows decomposition of the spread.
 *   2. RATING   — a pre-event rating per person: capability + grind volume (both from the
 *                 enrollment hiscores snapshot) + prior-event contribution (recency-decayed,
 *                 shrinkage-blended). Multi-account people merge via clan_members.user_id.
 *   3. VERDICT  — predicted team shares vs actual, rank agreement, biggest per-person misses.
 *
 * v1 findings baked in from the July Bingo run:
 *   - volume axis added: grinders (1.5k Vardorvis / 400 ToA) out-scored low-KC elites — points
 *     are hours × rate, and snapshot KC volume is the pre-event proxy for hours.
 *   - subbed-out rows (frozen_at set, zero contribution) are excluded from predicted team sums —
 *     e.g. a player who never logged in and was replaced mid-event shouldn't count twice.
 *   - reliability remains UNMODELED on purpose (no attendance history exists yet — that's what
 *     the Phase-2 player_event_facts table is for). The verdict section names the casualties.
 */

import { createClient, type Client } from '@libsql/client';

// ── constants (v1 — tune here) ─────────────────────────────────────────────────────────────────

/** Shrinkage: evidence weight = n/(n+K) where n = prior events with any contribution. */
const SHRINK_K = 2;
/** Recency decay half-life for prior-event evidence, in days. */
const DECAY_HALF_LIFE_DAYS = 180;
/** Capability markers read from the enrollment hiscores snapshot: boss key → weight. */
const CAPABILITY_MARKERS: Record<string, number> = {
  tzKalZuk: 40, // Inferno
  solHeredit: 40, // Colosseum / quiver
  theCorruptedGauntlet: 12,
  chambersOfXericChallengeMode: 25,
  theatreOfBloodHardMode: 25,
  tombsOfAmascutExpert: 20,
  chambersOfXeric: 8,
  theatreOfBlood: 10,
  tombsOfAmascut: 6,
  doomOfMokhaiotl: 15,
  vardorvis: 4,
  dukeSucellus: 4,
  theLeviathan: 4,
  theWhisperer: 4,
  zulrah: 2,
  vorkath: 2,
  nex: 6,
  phosanisNightmare: 10,
};
/** KC at which a capability marker pays out fully (log-scaled below it). */
const MARKER_FULL_KC = 50;
/**
 * Blend weights. Activity and evidence only earn their share when the person has the underlying
 * data (a prior snapshot / prior contribution); unearned weight is handed back to
 * capability+volume pro-rata, so the blend always sums to 1 per person.
 *
 * v2: volume demoted and CUBED (breadth alone over-rated casuals — the July v1 run compressed
 * the pool and predicted WORSE than capability alone); activity (KC-volume gained between the
 * previous event's snapshot and this one's = measured recent hours) takes the big share.
 */
const CAP_WEIGHT = 0.35;
const VOLUME_WEIGHT = 0.15;
const ACTIVITY_WEIGHT = 0.3;
const EVIDENCE_WEIGHT = 0.2;
/** Exponent that restores the power-law shape when summing ratings into team strength. */
const SHARPEN = 1.5;

// ── plumbing ───────────────────────────────────────────────────────────────────────────────────

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  if (fallback !== undefined) return fallback;
  console.error(`Missing --${name}`);
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL (e.g. file:/tmp/snapshot.db) — read-only backtest input.');
  process.exit(1);
}
const db: Client = createClient({ url });
const q = async (sql: string, args: (string | number)[] = []) => (await db.execute({ sql, args })).rows;

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// ── per-person actual contribution for ONE event ───────────────────────────────────────────────
// Mirrors the app's attribution in spirit: a completion's points follow the frozen
// statContributions split when present, else the tile's submission amounts per credited player,
// else the completion's credited player alone. Uncreditable points fall to a team bucket.

interface Contribution {
  byPlayer: Map<number, number>; // playerId → points
  teamTotals: Map<number, number>; // teamId → points (incl. unattributable)
  completions: number;
  attributable: number;
}

async function actualContributions(eventId: number): Promise<Contribution> {
  // Optional tiles never score (mirrors lifecycle standings + memberBreakdown) — completing one
  // is activity, not points, so they're excluded from the points sums entirely.
  const comps = await q(
    `SELECT c.id, c.tile_id, c.team_id, c.credit_player_id, c.stat_contributions,
            COALESCE(c.awarded_points, t.points, 1) AS pts
     FROM completions c JOIN tiles t ON t.id = c.tile_id
     WHERE t.event_id = ? AND COALESCE(t.optional, 0) = 0`,
    [eventId],
  );
  const subs = await q(
    `SELECT s.tile_id, s.team_id, s.credit_player_id, s.amount
     FROM submissions s JOIN tiles t ON t.id = s.tile_id
     WHERE t.event_id = ? AND s.credit_player_id IS NOT NULL`,
    [eventId],
  );
  // (tileId:teamId) → playerId → summed amount
  const subSplit = new Map<string, Map<number, number>>();
  for (const s of subs) {
    const key = `${s.tile_id}:${s.team_id}`;
    let m = subSplit.get(key);
    if (!m) subSplit.set(key, (m = new Map()));
    const p = Number(s.credit_player_id);
    m.set(p, (m.get(p) ?? 0) + Math.max(0, Number(s.amount)));
  }

  const byPlayer = new Map<number, number>();
  const teamTotals = new Map<number, number>();
  const add = (m: Map<number, number>, k: number, v: number) => m.set(k, (m.get(k) ?? 0) + v);
  let attributable = 0;

  for (const c of comps) {
    const pts = Number(c.pts);
    const teamId = Number(c.team_id);
    add(teamTotals, teamId, pts);

    // 1) frozen stat split
    let split: Map<number, number> | null = null;
    if (c.stat_contributions) {
      try {
        const snap = JSON.parse(String(c.stat_contributions));
        const entries: [number, number][] = [];
        const list = Array.isArray(snap) ? snap : Array.isArray(snap?.players) ? snap.players : [];
        for (const e of list) {
          const pid = Number(e.playerId ?? e.player_id);
          const gained = Number(e.gained ?? e.amount ?? 0);
          if (Number.isFinite(pid) && gained > 0) entries.push([pid, gained]);
        }
        if (entries.length) split = new Map(entries);
      } catch {
        /* unparseable → fall through */
      }
    }
    // 2) submission split
    if (!split) split = subSplit.get(`${c.tile_id}:${teamId}`) ?? null;
    // 3) closer alone
    if (!split && c.credit_player_id != null) split = new Map([[Number(c.credit_player_id), 1]]);
    if (!split) continue; // team bucket only

    const total = [...split.values()].reduce((a, b) => a + b, 0);
    if (total <= 0) continue;
    attributable += pts;
    for (const [pid, share] of split) add(byPlayer, pid, (pts * share) / total);
  }
  return { byPlayer, teamTotals, completions: comps.length, attributable };
}

// ── snapshot parsing: capability + volume ──────────────────────────────────────────────────────

function parseBosses(statsSnapshotJson: string | null): Record<string, number> {
  if (!statsSnapshotJson) return {};
  let snap: Record<string, unknown>;
  try {
    snap = JSON.parse(statsSnapshotJson);
  } catch {
    return {};
  }
  // Snapshot shapes vary by era: {bosses:{key:{score}}}, {key:{score}}, or flat {key:number}.
  const bosses = (snap.bosses ?? snap) as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(bosses)) {
    const kc = typeof raw === 'number' ? raw : Number((raw as { score?: number })?.score ?? 0);
    if (Number.isFinite(kc) && kc > 0) out[key] = kc;
  }
  return out;
}

function capabilityScore(bosses: Record<string, number>): { score: number; markers: string[] } {
  let score = 0;
  const markers: string[] = [];
  for (const [key, weight] of Object.entries(CAPABILITY_MARKERS)) {
    const kc = bosses[key] ?? 0;
    if (kc > 0) {
      // log ramp: 1 KC proves capability (~30% of full), MARKER_FULL_KC proves comfort (100%).
      const ramp = Math.min(1, Math.log1p(kc) / Math.log1p(MARKER_FULL_KC));
      score += weight * (0.3 + 0.7 * ramp);
      markers.push(`${key}:${kc}`);
    }
  }
  return { score, markers };
}

/**
 * Grind volume — the pre-event proxy for hours invested in the game: Σ log1p(KC) across ALL
 * hiscores bosses. Log so one camped boss doesn't dominate; breadth × depth ≈ time played.
 * (July finding: 1.5k-Vardorvis / 400-ToA grinders out-scored low-KC elites — points are
 * hours × rate, and capability alone misses the hours.)
 */
function volumeScore(bosses: Record<string, number>): number {
  let v = 0;
  for (const kc of Object.values(bosses)) v += Math.log1p(kc);
  return v;
}

/**
 * Overall XP from the snapshot — the skilling half of volume/activity. Skilling is a feature,
 * not an afterthought: boards mix skill tiles heavily and XP gained is the best hours proxy in
 * the game, so a high-XP skiller must not be invisible next to a PvMer.
 */
function overallXp(statsSnapshotJson: string | null): number {
  if (!statsSnapshotJson) return 0;
  try {
    const snap = JSON.parse(statsSnapshotJson) as Record<string, unknown>;
    const skills = (snap.skills ?? snap) as Record<string, unknown>;
    const overall = skills?.overall as { xp?: number } | undefined;
    const xp = Number(overall?.xp ?? 0);
    return Number.isFinite(xp) && xp > 0 ? xp : 0;
  } catch {
    return 0;
  }
}

// ── main ───────────────────────────────────────────────────────────────────────────────────────

const eventId = Number(arg('event'));
const event = (await q(`SELECT id, name, start_date, end_date, scoring_mode FROM events WHERE id = ?`, [eventId]))[0];
if (!event) {
  console.error(`No event ${eventId} in this DB.`);
  process.exit(1);
}
const eventStart = String(event.start_date ?? '');
console.log(`\n════ Backtest: "${event.name}" (event ${eventId}, ${event.scoring_mode}) ════`);

const teams = await q(`SELECT id, name FROM teams WHERE event_id = ?`, [eventId]);
const teamName = new Map(teams.map((t) => [Number(t.id), String(t.name)]));
const roster = await q(
  `SELECT id, name, team_id, clan_member_id, stats_snapshot, frozen_at FROM players WHERE event_id = ?`,
  [eventId],
);

// Identity: clan_members.user_id merges a person's accounts; unlinked members stand alone.
// RSN aliases (current + previous) also map to the member's key so LEGACY player rows with no
// clan_member_id — the entire January event — still land on the right person (July's 0/44
// prior-linkage was exactly this: m-keys on one side, name-keys on the other).
const members = await q(`SELECT id, user_id, rsn, previous_rsns FROM clan_members`);
const ownerOfMember = new Map(members.map((m) => [Number(m.id), m.user_id == null ? null : Number(m.user_id)]));
const aliasToPerson = new Map<string, string>();
function memberKey(memberId: number): string {
  const owner = ownerOfMember.get(memberId);
  return owner != null ? `u${owner}` : `m${memberId}`;
}
for (const m of members) {
  const key = memberKey(Number(m.id));
  const aliases: string[] = [String(m.rsn ?? '')];
  try {
    const prev = JSON.parse(String(m.previous_rsns ?? '[]'));
    if (Array.isArray(prev)) aliases.push(...prev.map(String));
  } catch {
    /* ignore */
  }
  for (const a of aliases) {
    const norm = a.toLowerCase().replaceAll('-', ' ').replaceAll('_', ' ').trim();
    if (norm) aliasToPerson.set(norm, key);
  }
}
function personKeyOf(clanMemberId: number | null, name: string): string {
  if (clanMemberId != null) return memberKey(clanMemberId);
  const norm = name.toLowerCase().replaceAll('-', ' ').replaceAll('_', ' ').trim();
  return aliasToPerson.get(norm) ?? `n${norm}`;
}

// ── 1. ACTUAL ──────────────────────────────────────────────────────────────────────────────────

const actual = await actualContributions(eventId);
console.log(`\n── 1. Actual outcome ──`);
const teamOrder = [...actual.teamTotals.entries()].sort((a, b) => b[1] - a[1]);
for (const [tid, pts] of teamOrder) console.log(`  ${teamName.get(tid) ?? tid}: ${fmt(pts)} pts`);
const spread = teamOrder.length >= 2 ? teamOrder[0][1] / Math.max(1, teamOrder[teamOrder.length - 1][1]) : 1;
console.log(`  → spread: top is ${spread.toFixed(1)}× bottom`);

// Drop-off timeline: last day (1-based, from event start) each player fed a submission — the
// give-up date made visible. Stat-tile-only grinders have no submissions; their rows say 'stat'.
const lastActive = new Map<number, number>();
if (eventStart) {
  const subTimes = await q(
    `SELECT s.credit_player_id AS pid, MAX(s.created_at) AS last
     FROM submissions s JOIN tiles t ON t.id = s.tile_id
     WHERE t.event_id = ? AND s.credit_player_id IS NOT NULL GROUP BY s.credit_player_id`,
    [eventId],
  );
  for (const r of subTimes) {
    const day = Math.floor((Date.parse(String(r.last)) - Date.parse(eventStart)) / 86_400_000) + 1;
    if (Number.isFinite(day)) lastActive.set(Number(r.pid), Math.max(1, day));
  }
}
const eventDays = event.end_date
  ? Math.max(1, Math.round((Date.parse(String(event.end_date)) - Date.parse(eventStart)) / 86_400_000))
  : null;

console.log(`\n  Per-person (attributable points), and the no-show decomposition:`);
const byTeamPeople = new Map<number, { name: string; pts: number; frozen: boolean; lastDay: number | null }[]>();
for (const p of roster) {
  const tid = p.team_id == null ? -1 : Number(p.team_id);
  let list = byTeamPeople.get(tid);
  if (!list) byTeamPeople.set(tid, (list = []));
  list.push({
    name: String(p.name),
    pts: actual.byPlayer.get(Number(p.id)) ?? 0,
    frozen: p.frozen_at != null,
    lastDay: lastActive.get(Number(p.id)) ?? null,
  });
}
for (const [tid] of teamOrder) {
  const people = (byTeamPeople.get(tid) ?? []).sort((a, b) => b.pts - a.pts);
  const zero = people.filter((x) => x.pts <= 0).length;
  const attributed = people.reduce((a, x) => a + x.pts, 0);
  const top = people[0];
  console.log(
    `  ${teamName.get(tid)}: ${people.length} rostered, ${zero} contributed nothing;` +
      ` top carry ${top ? `${top.name} = ${pct(top.pts / Math.max(1, attributed))} of attributed pts` : '—'}`,
  );
  for (const x of people) {
    const last = x.lastDay == null ? (x.pts > 0 ? 'stat-only' : '—') : `d${x.lastDay}${eventDays ? `/${eventDays}` : ''}`;
    console.log(
      `      ${x.pts > 0 ? fmt(x.pts).padStart(7) : '      0'}  ${x.name.padEnd(16)} last active ${last}` +
        `${x.frozen ? '  (subbed out)' : ''}`,
    );
  }
}

// ── 2. RATING (pre-event only) ─────────────────────────────────────────────────────────────────

// Prior events: started before this event started (strictly pre-event evidence), with linkage
// diagnostics — July run matched 0/40 against the January event, so SAY why a prior is useless.
const priors = await q(
  `SELECT id, name, start_date FROM events
   WHERE id != ? AND start_date IS NOT NULL AND start_date < ? ORDER BY start_date`,
  [eventId, eventStart || '9999'],
);
const allPlayers = await q(`SELECT id, event_id, name, clan_member_id FROM players`);
const personOfPlayer = new Map<number, string>();
for (const p of allPlayers) {
  personOfPlayer.set(
    Number(p.id),
    personKeyOf(p.clan_member_id == null ? null : Number(p.clan_member_id), String(p.name)),
  );
}

const priorContrib = new Map<number, Contribution>();
// Latest prior-event snapshot per person → the activity delta baselines (KC volume + XP).
const priorSnapshotVol = new Map<string, number>();
const priorSnapshotXp = new Map<string, number>();
for (const pe of priors) {
  const rows = await q(`SELECT id, name, clan_member_id, stats_snapshot FROM players WHERE event_id = ?`, [
    Number(pe.id),
  ]);
  for (const r of rows) {
    if (!r.stats_snapshot) continue;
    const key = personKeyOf(r.clan_member_id == null ? null : Number(r.clan_member_id), String(r.name));
    const vol = volumeScore(parseBosses(String(r.stats_snapshot)));
    const xp = overallXp(String(r.stats_snapshot));
    // priors are start-date ordered, so later events overwrite → latest baseline wins.
    if (vol > 0) priorSnapshotVol.set(key, vol);
    if (xp > 0) priorSnapshotXp.set(key, xp);
  }
}
console.log(`\n── 2. Pre-event ratings ──`);
for (const pe of priors) {
  const contrib = await actualContributions(Number(pe.id));
  priorContrib.set(Number(pe.id), contrib);
  const linked = allPlayers.filter(
    (p) => Number(p.event_id) === Number(pe.id) && p.clan_member_id != null,
  ).length;
  const total = allPlayers.filter((p) => Number(p.event_id) === Number(pe.id)).length;
  console.log(
    `  prior "${pe.name}" (${String(pe.start_date).slice(0, 10)}): ${contrib.completions} completions,` +
      ` ${fmt(contrib.attributable)} attributable pts, ${linked}/${total} player rows linked to clan members`,
  );
}

interface Person {
  key: string;
  names: Set<string>;
  teamId: number | null;
  playerIds: number[];
  subbedOut: boolean; // frozen with zero contribution → excluded from predicted team strength
  bosses: Record<string, number>; // best/merged snapshot across accounts (max per key)
  cap: number;
  capMarkers: string[];
  volume: number;
  xp: number;
  /** KC-volume gained since the person's previous-event snapshot; null = no prior snapshot. */
  activity: number | null;
  /** Overall XP gained since the previous-event snapshot; null = no prior snapshot. */
  activityXp: number | null;
  evidence: number;
  evidenceEvents: number;
  rating: number;
  actualPts: number;
}

const people = new Map<string, Person>();
for (const p of roster) {
  const key = personKeyOf(p.clan_member_id == null ? null : Number(p.clan_member_id), String(p.name));
  let person = people.get(key);
  if (!person) {
    people.set(
      key,
      (person = {
        key,
        names: new Set(),
        teamId: p.team_id == null ? null : Number(p.team_id),
        playerIds: [],
        subbedOut: false,
        bosses: {},
        cap: 0,
        capMarkers: [],
        volume: 0,
        xp: 0,
        activity: null,
        activityXp: null,
        evidence: 0,
        evidenceEvents: 0,
        rating: 0,
        actualPts: 0,
      }),
    );
  }
  person.names.add(String(p.name));
  person.playerIds.push(Number(p.id));
  person.actualPts += actual.byPlayer.get(Number(p.id)) ?? 0;
  // Alts merge: capability takes the max per boss key across a person's accounts (skill is the
  // person's), volume sums later from the merged map (hours are the person's too).
  const bosses = parseBosses(p.stats_snapshot ? String(p.stats_snapshot) : null);
  for (const [k, kc] of Object.entries(bosses)) person.bosses[k] = Math.max(person.bosses[k] ?? 0, kc);
  person.xp += overallXp(p.stats_snapshot ? String(p.stats_snapshot) : null); // alts sum: hours are the person's
  // A row frozen mid-event with nothing scored is a sub-out (never played) — the replacement's
  // row carries the team's real strength.
  if (p.frozen_at != null && (actual.byPlayer.get(Number(p.id)) ?? 0) <= 0) person.subbedOut = true;
}

for (const person of people.values()) {
  const { score, markers } = capabilityScore(person.bosses);
  person.cap = score;
  person.capMarkers = markers;
  person.volume = volumeScore(person.bosses);
  const baseline = priorSnapshotVol.get(person.key);
  person.activity = baseline == null ? null : Math.max(0, person.volume - baseline);
  const xpBaseline = priorSnapshotXp.get(person.key);
  person.activityXp = xpBaseline == null || person.xp <= 0 ? null : Math.max(0, person.xp - xpBaseline);

  let evidence = 0;
  let wsum = 0;
  for (const pe of priors) {
    const contrib = priorContrib.get(Number(pe.id));
    if (!contrib) continue;
    const rows = allPlayers.filter(
      (ap) => Number(ap.event_id) === Number(pe.id) && personOfPlayer.get(Number(ap.id)) === person.key,
    );
    if (!rows.length) continue;
    person.evidenceEvents += 1;
    const pts = rows.reduce((a, r) => a + (contrib.byPlayer.get(Number(r.id)) ?? 0), 0);
    const ageDays = Math.max(
      0,
      (Date.parse(eventStart || new Date().toISOString()) - Date.parse(String(pe.start_date))) / 86_400_000,
    );
    const w = Math.pow(0.5, ageDays / DECAY_HALF_LIFE_DAYS);
    evidence += w * pts;
    wsum += w;
  }
  person.evidence = wsum > 0 ? evidence / wsum : 0;
}

// Normalize each signal to the pool max, then blend with per-person earned weights: activity
// and evidence only count when the person has the underlying data; unearned weight flows back
// to capability+volume pro-rata.
const pool = [...people.values()].filter((r) => r.teamId != null); // unrostered/removed rows are out
const capMax = Math.max(1e-9, ...pool.map((r) => r.cap));
const volMax = Math.max(1e-9, ...pool.map((r) => r.volume));
const xpMax = Math.max(1e-9, ...pool.map((r) => r.xp));
const actMax = Math.max(1e-9, ...pool.map((r) => r.activity ?? 0));
const actXpMax = Math.max(1e-9, ...pool.map((r) => r.activityXp ?? 0));
const evMax = Math.max(1e-9, ...pool.map((r) => r.evidence));
// Measured activity blends (flow: KC-delta ⊕ XP-delta). Unknown activity is imputed at the POOL
// MEDIAN of measured players — "assume typical", never "assume their stock": redistributing the
// weight instead let unknown-activity players ride 85% capability while measured-but-modest
// players got judged on reality (the J K U > Drenvox inversion).
const actBlendOf = (r: Person): number | null =>
  r.activity == null && r.activityXp == null
    ? null
    : 0.5 * ((r.activity ?? 0) / actMax) + 0.5 * ((r.activityXp ?? 0) / actXpMax);
const measuredActs = pool.map(actBlendOf).filter((v): v is number => v != null).sort((a, b) => a - b);
const medianAct = measuredActs.length ? measuredActs[Math.floor(measuredActs.length / 2)] : 0;
for (const r of pool) {
  const evTrust = r.evidenceEvents / (r.evidenceEvents + SHRINK_K);
  const evW = EVIDENCE_WEIGHT * evTrust;
  // Unearned EVIDENCE weight flows to capability (the honest prior). Activity keeps its full
  // weight for everyone via the median imputation above.
  const capW = CAP_WEIGHT + (EVIDENCE_WEIGHT - evW);
  const volW = VOLUME_WEIGHT;
  // Volume = mostly boss-KC breadth×depth; lifetime XP is the weakest hours signal (stock, not
  // flow) so it gets the small share. XP GAINED is a great signal, XP OWNED is not.
  const volBlend = 0.75 * Math.pow(r.volume / volMax, 3) + 0.25 * Math.pow(r.xp / xpMax, 3);
  const actBlend = actBlendOf(r) ?? medianAct;
  r.rating = capW * (r.cap / capMax) + volW * volBlend + ACTIVITY_WEIGHT * actBlend + evW * (r.evidence / evMax);
}

const withHistory = pool.filter((r) => r.evidenceEvents > 0).length;
const withActivity = pool.filter((r) => r.activity != null).length;
const skipped = people.size - pool.length;
console.log(
  `  ${withHistory}/${pool.length} have prior-event contribution history; ${withActivity}/${pool.length}` +
    ` have a prior snapshot (activity delta)${skipped ? `; ${skipped} unrostered row(s) skipped` : ''}`,
);
for (const r of [...pool].sort((a, b) => b.rating - a.rating)) {
  const name = [...r.names].join(' + ');
  console.log(
    `  ${r.rating.toFixed(3)}  ${name.padEnd(16)} cap=${r.cap.toFixed(0).padStart(4)}` +
      ` vol=${r.volume.toFixed(0).padStart(4)} xp=${(r.xp / 1e6).toFixed(0).padStart(4)}m` +
      ` act=${r.activity == null ? '  ?' : r.activity.toFixed(0).padStart(3)}/${r.activityXp == null ? '  ?' : `${(r.activityXp / 1e6).toFixed(0)}m`}` +
      ` evid=${fmt(r.evidence).padStart(7)}/ev(${r.evidenceEvents})` +
      `${r.subbedOut ? '  [subbed out]' : ''}` +
      (r.capMarkers.length ? `  [${r.capMarkers.slice(0, 3).join(', ')}${r.capMarkers.length > 3 ? ', …' : ''}]` : ''),
  );
}

// ── 3. VERDICT ─────────────────────────────────────────────────────────────────────────────────

console.log(`\n── 3. Verdict: predicted vs actual team shares ──`);
const predTeam = new Map<number, number>();
for (const r of pool)
  if (r.teamId != null && !r.subbedOut)
    predTeam.set(r.teamId, (predTeam.get(r.teamId) ?? 0) + Math.pow(r.rating, SHARPEN));
const predSum = Math.max(1e-9, [...predTeam.values()].reduce((a, b) => a + b, 0));
const actSum = Math.max(1, [...actual.teamTotals.values()].reduce((a, b) => a + b, 0));

const rows = teamOrder.map(([tid, pts]) => ({
  name: teamName.get(tid) ?? String(tid),
  actualShare: pts / actSum,
  predShare: (predTeam.get(tid) ?? 0) / predSum,
}));
for (const row of rows) {
  console.log(
    `  ${row.name.padEnd(26)} actual ${pct(row.actualShare).padStart(6)}   predicted ${pct(row.predShare).padStart(6)}` +
      `   miss ${pct(Math.abs(row.actualShare - row.predShare))}`,
  );
}
const actRank = [...rows].sort((a, b) => b.actualShare - a.actualShare).map((r) => r.name);
const predRank = [...rows].sort((a, b) => b.predShare - a.predShare).map((r) => r.name);
const rankHits = actRank.filter((n, i) => predRank[i] === n).length;
console.log(`  Rank agreement: ${rankHits}/${rows.length} positions match (predicted order: ${predRank.join(' > ')})`);
const meanMiss = rows.reduce((a, r) => a + Math.abs(r.actualShare - r.predShare), 0) / Math.max(1, rows.length);
console.log(`  Mean share miss: ${pct(meanMiss)}  (uniform-split baseline would miss ${pct(
  rows.reduce((a, r) => a + Math.abs(r.actualShare - 1 / rows.length), 0) / Math.max(1, rows.length),
)})`);

// Biggest per-person misses: rating rank vs actual-points rank. These name the axes the rating
// can't see yet — unlinked alts (capability invisible) and reliability (top-rated no-shows).
const active = pool.filter((r) => !r.subbedOut);
const byRating = [...active].sort((a, b) => b.rating - a.rating);
const byActual = [...active].sort((a, b) => b.actualPts - a.actualPts);
const ratingRank = new Map(byRating.map((r, i) => [r.key, i]));
const actualRank = new Map(byActual.map((r, i) => [r.key, i]));
const misses = active
  .map((r) => ({ r, delta: (ratingRank.get(r.key) ?? 0) - (actualRank.get(r.key) ?? 0) }))
  .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  .slice(0, 6);
console.log(`\n  Biggest per-person misses (rating rank − actual rank; + = underrated, − = overrated):`);
for (const { r, delta } of misses) {
  console.log(
    `    ${delta > 0 ? '+' : ''}${delta}  ${[...r.names].join(' + ').padEnd(16)}` +
      ` rated #${(ratingRank.get(r.key) ?? 0) + 1}, finished #${(actualRank.get(r.key) ?? 0) + 1} (${fmt(r.actualPts)} pts)`,
  );
}
console.log('');
db.close();
