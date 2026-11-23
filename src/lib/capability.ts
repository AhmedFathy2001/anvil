// ─────────────────────────────────────────────────────────────────────────────────────────────────
// The ability table: for one ACCOUNT and one ACTIVITY (a boss, raid or mode), three numbers that
// tile pricing, team balancing and the sign-up form all read, so "can they / will they" is decided
// in exactly one place.
//
//   means    (the account)  — can THIS account do it: stats against the activity's realistic floor,
//                             account type, and for irons the gear their collection log proves.
//                             KC on this very account overrides everything: a pure with an Inferno
//                             cape can do the Inferno, whatever its defence says.
//   knowhow  (the person)   — do they know the fight: KC depth on ANY of their accounts, a PB
//                             against the CA speed target, hard CAs on that boss, a little spill-over
//                             from related content. The STRONGEST signal wins; the rest only add.
//                             Nothing ever counts against — a 2k-KC ToB player with no CAs is still
//                             top for ToB, and undated KC is never treated as stale (we cannot know).
//   likely   (the person)   — will they spend event time on it: what they ticked on the sign-up form,
//                             and recent activity above a real threshold (a stray slayer-task kill
//                             or lamp XP is not interest).
//
// ability = means × knowhow. "Able" (for coverage and pricing) is ability ≥ ABLE.
//
// PURE — no database import. lib/capabilityDb assembles the evidence; tests pin the rules here.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export const ABLE = 0.5;

/** One activity as the ability table sees it — built by lib/capabilityData from the curated files. */
export interface ActivitySpec {
  key: string; // BOSSES key (hiscores)
  label: string;
  /** Game-enforced skill gates. Below these, means is 0. */
  hard: Record<string, number>;
  /** The level under which a normal account can't realistically do it at a useful pace. */
  realistic: Record<string, number>;
  /** Low-defence builds commonly do it: a defence shortfall doesn't count. */
  pureFriendly: boolean;
  /** Ironmen: every group needs ANY one of its items in the collection log. Lowercased names. */
  ironGear: string[][];
  related: string[];
  /** KC where know-how from KC alone tops out. */
  fullKc: number;
  /** Recent kills that count as "they're doing this now". */
  recentKills: number;
  /** Fastest CA speed target in seconds, when the CA list has one. */
  speedTargetSeconds: number | null;
}

export type CaTier = 'Easy' | 'Medium' | 'Hard' | 'Elite' | 'Master' | 'Grandmaster';
export interface CaDone {
  activity: string; // BOSSES key
  tier: CaTier;
  type: string; // 'Perfection' | 'Speed' | 'Mechanical' | 'Restriction' | 'Stamina' | 'Kill Count'
}

/** What we know about one account. Every field may be missing — an account with no plugin is normal. */
export interface AccountEvidence {
  accountId: number;
  personKey: string;
  /** accounts.accountType: 'normal' | 'ironman' | 'hardcore' | 'ultimate' | 'group' | … | null. */
  accountType: string | null;
  levels: Record<string, number>;
  xp: Record<string, number>;
  kc: Record<string, number>;
  /** Gains over the recent window (member_daily_stats). Null when we have no dated history. */
  recentKc: Record<string, number> | null;
  recentXp: Record<string, number> | null;
  /** Best time in seconds per activity key. */
  pbSeconds: Record<string, number>;
  /** 0 (none) … 6 (Grandmaster). */
  caTier: number | null;
  /** Null = the plugin hasn't synced the task list for this account. */
  caDone: CaDone[] | null;
  /** Lowercased item names in the collection log. Null = never synced. */
  clogItems: Set<string> | null;
}

export interface ActivityAbility {
  key: string;
  means: number;
  knowhow: number;
  likely: number;
  ability: number;
  /** KC on THIS account. */
  proven: boolean;
}

const IRON_TYPES = new Set(['ironman', 'hardcore', 'ultimate', 'group', 'hardcore_group', 'unranked_group']);
export const isIron = (accountType: string | null | undefined) => !!accountType && IRON_TYPES.has(accountType);

// ── means ──────────────────────────────────────────────────────────────────────────────────────

/** Levels short of a realistic requirement before that skill alone rules the account out. */
const SHORTFALL_LEVELS = 20;
const STYLE_SKILLS = new Set(['attack', 'strength', 'ranged', 'magic']);

export function meansFor(account: AccountEvidence, spec: ActivitySpec): number {
  if ((account.kc[spec.key] ?? 0) > 0) return 1;
  const haveLevels = Object.keys(account.levels).length > 0;
  if (!haveLevels) return 0.5; // no hiscores at all: neither able nor unable, the honest middle
  const level = (skill: string) => account.levels[skill] ?? 1;
  for (const [skill, need] of Object.entries(spec.hard)) if (level(skill) < need) return 0;
  const factor = (skill: string, need: number) => Math.max(0, 1 - Math.max(0, need - level(skill)) / SHORTFALL_LEVELS);
  // Attack styles: a raid lists all of them, but a player brings the two they're built for (a
  // ranged/mage ToB role doesn't need 90 attack). The best two count, averaged. Support skills
  // (defence, prayer, hitpoints, anything else) each count in full.
  const styleFactors: number[] = [];
  let m = 1;
  for (const [skill, need] of Object.entries(spec.realistic)) {
    if (skill === 'defence' && spec.pureFriendly) continue;
    if (STYLE_SKILLS.has(skill)) styleFactors.push(factor(skill, need));
    else m *= factor(skill, need);
  }
  if (styleFactors.length) {
    styleFactors.sort((a, b) => b - a);
    const top = styleFactors.slice(0, 2);
    m *= top.reduce((a, b) => a + b, 0) / top.length;
  }
  if (isIron(account.accountType) && spec.ironGear.length) {
    if (!account.clogItems) m *= 0.6; // unknown gear: an iron at the stats probably has something
    else {
      for (const group of spec.ironGear) {
        if (!group.some((item) => account.clogItems!.has(item))) m *= 0.25;
      }
    }
  }
  // Hardcore / ultimate risk aversion lives in `likely`, not here: they CAN, they may choose not to.
  return m;
}

// ── know-how ───────────────────────────────────────────────────────────────────────────────────

const CA_TIER_WEIGHT: Record<CaTier, number> = {
  Easy: 0.02,
  Medium: 0.04,
  Hard: 0.08,
  Elite: 0.15,
  Master: 0.25,
  Grandmaster: 0.4,
};
// Kill-count tasks only restate KC; skill shows in perfection and speed.
const CA_TYPE_WEIGHT: Record<string, number> = {
  Perfection: 1,
  Speed: 1,
  Mechanical: 0.8,
  Restriction: 0.7,
  Stamina: 0.7,
  'Kill Count': 0.1,
};
const RELATED_SPILL = 0.4;

export interface KnowhowSignals {
  kc: number;
  pb: number;
  ca: number;
  related: number;
  knowhow: number;
}

function kcSignal(kc: number, fullKc: number): number {
  if (kc <= 0) return 0;
  // 1 KC ≈ 0.3 (they've done it once), fullKc ≈ 1 — the same log ramp the capability markers use.
  return Math.min(1, 0.3 + 0.7 * Math.min(1, Math.log1p(kc) / Math.log1p(Math.max(2, fullKc))));
}

function pbSignal(pbSeconds: number | undefined, target: number | null): number {
  if (!pbSeconds || pbSeconds <= 0) return 0;
  if (!target) return 0.4; // finished it, no benchmark to compare against
  const ratio = target / pbSeconds; // ≥1 = beat the fastest CA target
  return Math.max(0.4, Math.min(1, ratio * ratio));
}

function caSignal(done: CaDone[], key: string): number {
  let sum = 0;
  for (const t of done) if (t.activity === key) sum += CA_TIER_WEIGHT[t.tier] * (CA_TYPE_WEIGHT[t.type] ?? 0.5);
  return sum > 0 ? 1 - Math.exp(-2 * sum) : 0;
}

/**
 * Know-how is the PERSON's, gathered over all their accounts. The strongest signal sets it; the
 * second adds a quarter of what's left. A Grandmaster CA tier lifts low-KC players who have at least
 * done the content (the 5-KC GM case) — it never invents know-how for content never touched.
 */
export function knowhowFor(
  accounts: AccountEvidence[],
  spec: ActivitySpec,
  relatedKnowhow: (key: string) => number = () => 0,
): KnowhowSignals {
  let kc = 0;
  let pbBest: number | undefined;
  let caTier = 0;
  const done: CaDone[] = [];
  for (const a of accounts) {
    kc = Math.max(kc, a.kc[spec.key] ?? 0);
    const pb = a.pbSeconds[spec.key];
    if (pb && (pbBest == null || pb < pbBest)) pbBest = pb;
    caTier = Math.max(caTier, a.caTier ?? 0);
    if (a.caDone) done.push(...a.caDone);
  }
  let kcS = kcSignal(kc, spec.fullKc);
  if (kcS > 0 && caTier > 0) kcS += (1 - kcS) * 0.5 * (caTier / 6);
  const pbS = pbSignal(pbBest, spec.speedTargetSeconds);
  const caS = caSignal(done, spec.key);
  let rel = 0;
  for (const r of spec.related) rel = Math.max(rel, relatedKnowhow(r) * RELATED_SPILL);
  const sorted = [kcS, pbS, caS, rel].sort((a, b) => b - a);
  const knowhow = Math.min(1, sorted[0] + 0.25 * (1 - sorted[0]) * sorted[1]);
  return { kc: kcS, pb: pbS, ca: caS, related: rel, knowhow };
}

// ── likely ─────────────────────────────────────────────────────────────────────────────────────

export interface SignupInterest {
  /** The person filled a sign-up form at all — an unticked boss then means something. */
  answered: boolean;
  bosses: Set<string>;
  skills: Set<string>;
}

export function recentlyActive(account: AccountEvidence, spec: ActivitySpec): boolean {
  return (account.recentKc?.[spec.key] ?? 0) >= spec.recentKills;
}

export function likelyFor(
  accounts: AccountEvidence[],
  spec: ActivitySpec,
  knowhow: number,
  signup: SignupInterest | null,
): number {
  let likely = signup?.answered ? (signup.bosses.has(spec.key) ? 0.9 : 0.15) : 0.3 + 0.3 * knowhow;
  if (accounts.some((a) => recentlyActive(a, spec))) likely = Math.max(likely, 0.8);
  // A hardcore or ultimate is less likely to risk a deadly fight it hasn't already chosen to do.
  if (accounts.length && accounts.every((a) => a.accountType === 'hardcore' || a.accountType === 'hardcore_group')) {
    if (!signup?.bosses.has(spec.key)) likely *= 0.6;
  }
  return Math.min(1, likely);
}

// ── the table ──────────────────────────────────────────────────────────────────────────────────

/**
 * Every activity for one ENTERED account, using the person's whole account list for know-how.
 * Related spill-over is one hop and uses KC/PB/CA only (no recursion).
 */
export function abilityTable(
  entered: AccountEvidence,
  personAccounts: AccountEvidence[],
  specs: ActivitySpec[],
  signup: SignupInterest | null,
): Map<string, ActivityAbility> {
  const all = personAccounts.length ? personAccounts : [entered];
  const base = new Map<string, number>();
  const specByKey = new Map(specs.map((s) => [s.key, s]));
  for (const s of specs) base.set(s.key, knowhowFor(all, s).knowhow);
  const out = new Map<string, ActivityAbility>();
  for (const s of specs) {
    const k = knowhowFor(all, s, (r) => (specByKey.has(r) ? (base.get(r) ?? 0) : 0)).knowhow;
    const means = meansFor(entered, s);
    out.set(s.key, {
      key: s.key,
      means,
      knowhow: k,
      likely: likelyFor([entered], s, k, signup),
      ability: means * k,
      proven: (entered.kc[s.key] ?? 0) > 0,
    });
  }
  return out;
}

// ── hours (taken with a grain of salt) ─────────────────────────────────────────────────────────

export interface HoursEvidence {
  /** Claimed active-equivalent hours per week from the sign-up form; null = not given. */
  claimedWeekly: number | null;
  /** Past events: share of the event's days they were active (player_event_facts). */
  pastAttendance: number[];
}

/**
 * How much of the pool's typical play time this person will put in, as a multiplier around 1.
 *
 * Hours typed on a form are cheap — people put anything — so a claim is clamped to [¼×, 3×] the pool
 * median and only ever carries a minority of the weight: 40% with no history (the rest is the pool
 * median, i.e. "assume typical"), 25% once past bingos show how much they really turn up. The result
 * is square-rooted: more hours help, with diminishing returns, and one wild claim can't make anyone
 * the top pick.
 */
export function hoursFactor(person: HoursEvidence, pool: { medianClaimed: number | null; medianAttendance: number | null }): number {
  const claimRel =
    person.claimedWeekly != null && pool.medianClaimed
      ? Math.min(3, Math.max(0.25, person.claimedWeekly / pool.medianClaimed))
      : 1;
  const hist = person.pastAttendance.length
    ? person.pastAttendance.reduce((a, b) => a + b, 0) / person.pastAttendance.length
    : null;
  const histRel = hist != null && pool.medianAttendance ? Math.min(3, Math.max(0.1, hist / pool.medianAttendance)) : null;
  const rel = histRel != null ? 0.25 * claimRel + 0.75 * histRel : 0.4 * claimRel + 0.6;
  return Math.sqrt(rel);
}

/** Sign-up hours → active-equivalent hours per week. AFK time counts at half. */
export function claimedWeeklyHours(profile: {
  activeWeeklyHours?: { min?: number; max?: number };
  activeDailyHours?: { min?: number; max?: number };
  afkWeeklyHours?: { min?: number; max?: number };
  afkDailyHours?: { min?: number; max?: number };
} | null | undefined): number | null {
  if (!profile) return null;
  const mid = (r?: { min?: number; max?: number }) =>
    r && (r.min != null || r.max != null) ? ((r.min ?? r.max!) + (r.max ?? r.min!)) / 2 : null;
  const active = mid(profile.activeWeeklyHours) ?? (mid(profile.activeDailyHours) != null ? mid(profile.activeDailyHours)! * 7 : null);
  const afk = mid(profile.afkWeeklyHours) ?? (mid(profile.afkDailyHours) != null ? mid(profile.afkDailyHours)! * 7 : null);
  if (active == null && afk == null) return null;
  return (active ?? 0) + 0.5 * (afk ?? 0);
}

// ── sign-up form suggestions ───────────────────────────────────────────────────────────────────

/** Skills whose XP piles up as a side effect of other content need a higher bar to read as interest. */
const PASSIVE_SKILL_BAR: Record<string, number> = {
  agility: 500_000, // shortcuts, lamps, Sepulchre side loot
  thieving: 500_000, // CoX chests, side activities
  hunter: 400_000,
  fishing: 400_000,
  woodcutting: 400_000,
  herblore: 400_000,
  farming: 400_000,
};
const DEFAULT_SKILL_BAR = 300_000;
/** Combat XP comes from bossing, so it says nothing about wanting to train the skill. */
const COMBAT_SKILLS = new Set(['attack', 'strength', 'defence', 'ranged', 'magic', 'hitpoints', 'prayer']);
const WELL_PAST_99_XP = 25_000_000;

export function skillBar(skill: string): number {
  return PASSIVE_SKILL_BAR[skill] ?? DEFAULT_SKILL_BAR;
}

/**
 * What to pre-tick on a sign-up form for the accounts being entered: bosses they're doing NOW and
 * non-combat skills they clearly train. Deep but undated KC is deliberately not here — ticking means
 * "I'll do this", and old KC can't say that.
 */
export function suggestSignup(
  accounts: AccountEvidence[],
  specs: ActivitySpec[],
  skills: readonly string[],
): { bosses: string[]; skills: string[] } {
  const bosses = specs.filter((s) => accounts.some((a) => recentlyActive(a, s))).map((s) => s.key);
  const picked: string[] = [];
  for (const skill of skills) {
    const key = skill.toLowerCase();
    if (COMBAT_SKILLS.has(key)) continue;
    const deep = accounts.some((a) => (a.xp[key] ?? 0) >= WELL_PAST_99_XP);
    const recent = accounts.some((a) => (a.recentXp?.[key] ?? 0) >= skillBar(key));
    if (deep || recent) picked.push(skill);
  }
  return { bosses, skills: picked };
}
