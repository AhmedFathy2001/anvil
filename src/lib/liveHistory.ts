import type { HiscoresSnapshot } from '@/lib/hiscores';
import { readAllActivities } from '@/lib/hiscoresActivities';
import { levelFromXp } from '@/lib/xp';

// THE EFFECTIVE SNAPSHOT: what the hiscores said, raised by what the plugin has pushed since.
//
// History (member_daily_stats, member_milestones) is written from BOTH paths now — the plugin push
// the moment a gain happens, and the hiscores poll that reconciles every few hours. They stay in step
// because both measure gains between effective snapshots: a push records effective-before →
// effective-after, and a poll records effective-before-the-poll → effective-after. What the plugin
// already reported is in both sides of the poll's comparison and nets to zero; only what the plugin
// never saw (mobile play, a client that was off) is new. Diffing raw hiscores snapshots on the poll
// would count every pushed gain a second time.
//
// Pure — no database — so the arithmetic can be tested without one (tests/pure-module-imports).

type SkillEntry = { xp?: number; level?: number; rank?: number };
type BossEntry = { score?: number; rank?: number };

/**
 * `snapshot` with every overlay key raised to max(snapshot, overlay). Skills get their level
 * recomputed from the raised XP, and overall is re-totalled when any skill moved — the two things
 * daily XP and "99 Slayer" are read from. Keys the snapshot doesn't carry are ignored: a key is a
 * skill or a boss only because the snapshot says so — unless it is in `addBosses`, which display
 * reads pass so a boss the hiscores don't list yet (too few kills to rank) still shows the plugin's
 * count. History must not: a boss appearing from nothing would count its whole KC as one day's gain.
 */
export function overlaySnapshot(
  snapshot: HiscoresSnapshot,
  live: Record<string, number>,
  addBosses?: ReadonlySet<string>,
): HiscoresSnapshot {
  const skills = { ...((snapshot.skills ?? {}) as Record<string, SkillEntry>) };
  const bosses = { ...((snapshot.bosses ?? {}) as Record<string, BossEntry>) };
  let skillMoved = false;

  for (const [key, raw] of Object.entries(live)) {
    const v = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : 0;
    if (v <= 0 || key === 'overall') continue;
    const skill = skills[key];
    if (skill != null) {
      if ((skill.xp ?? 0) < v) {
        skills[key] = { ...skill, xp: v, level: Math.max(skill.level ?? 1, levelFromXp(v)) };
        skillMoved = true;
      }
      continue;
    }
    const boss = bosses[key] ?? (addBosses?.has(key) ? { rank: -1, score: 0 } : null);
    if (boss != null && (boss.score ?? 0) < v) bosses[key] = { ...boss, score: v };
  }

  if (skillMoved && skills.overall) {
    let xp = 0;
    let level = 0;
    for (const [key, s] of Object.entries(skills)) {
      if (key === 'overall') continue;
      xp += Math.max(0, s.xp ?? 0);
      level += Math.max(1, s.level ?? 1);
    }
    const was = skills.overall;
    skills.overall = { ...was, xp: Math.max(was.xp ?? 0, xp), level: Math.max(was.level ?? 0, level) };
  }

  return { ...snapshot, skills, bosses } as HiscoresSnapshot;
}

/**
 * Whether any boss or activity SCORE differs between two snapshots, ranks aside. The sweep re-saves
 * a snapshot when overall XP moves, and that alone missed two real changes: kills or clues that came
 * with no XP, and a boss the parser learned to read (lib/hiscores EXTRA_HISCORE_BOSSES) — an account
 * idle since then kept a stored snapshot without the key and showed 0 KC on every card. Ranks are
 * left out on purpose: they shift on every poll, and saving on them would rewrite every row.
 */
export function scoresMoved(previous: HiscoresSnapshot, current: HiscoresSnapshot): boolean {
  const a = (previous.bosses ?? {}) as Record<string, BossEntry>;
  const b = (current.bosses ?? {}) as Record<string, BossEntry>;
  const score = (e: BossEntry | undefined) => Math.max(0, e?.score ?? 0);
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!(key in a) || !(key in b) || score(a[key]) !== score(b[key])) return true;
  }
  const before = readAllActivities(previous);
  const after = readAllActivities(current);
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if ((before[key]?.score ?? 0) !== (after[key]?.score ?? 0)) return true;
  }
  return false;
}
