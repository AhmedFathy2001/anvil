// Where the level / XP milestone rules live, and the lookups the routes need. The rules themselves
// and all matching are in lib/levelRules (pure); this file only reads and writes them.
//
//   clan      settings row `level_rules` (JSON MilestoneRules). Unset = defaults.
//   person    users.level_posts_clan ('clan' | 'ninetyNinesAndMax' | 'off') and users.level_rules
//             (JSON MilestoneRules for their own webhooks; NULL = defaults). Per login, global
//             across clans — the same choice applies in every clan the person posts into.

import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, users } from '@/db/schema';
import { personalWebhookTargets, socialEmissionClans } from '@/lib/emissionRouting';
import {
  effectiveClanRules,
  isLevelPostsChoice,
  levelHalf,
  normalizeMilestoneRules,
  parseMilestoneRules,
  type LevelPostsChoice,
  type LevelRules,
  type MilestoneRules,
} from '@/lib/levelRules';
import { getNotificationWebhooks } from '@/lib/pluginConfig';
import { getSetting, setSetting } from '@/lib/settings';

export const LEVEL_RULES_SETTING_KEY = 'level_rules';

export async function getClanMilestoneRules(clanId: number): Promise<MilestoneRules> {
  return parseMilestoneRules(await getSetting(clanId, LEVEL_RULES_SETTING_KEY));
}

export async function setClanMilestoneRules(clanId: number, raw: unknown): Promise<MilestoneRules> {
  const rules = normalizeMilestoneRules(raw);
  await setSetting(clanId, LEVEL_RULES_SETTING_KEY, JSON.stringify(rules));
  return rules;
}

export interface MemberLevelPrefs {
  clanChoice: LevelPostsChoice;
  personal: MilestoneRules;
}

const DEFAULT_PREFS = (): MemberLevelPrefs => ({ clanChoice: 'clan', personal: parseMilestoneRules(null) });

export async function getMemberLevelPrefs(userId: number): Promise<MemberLevelPrefs> {
  const [row] = await db
    .select({ choice: users.levelPostsClan, rules: users.levelRules })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return DEFAULT_PREFS();
  return {
    clanChoice: isLevelPostsChoice(row.choice) ? row.choice : 'clan',
    personal: parseMilestoneRules(row.rules),
  };
}

/** The login behind an account (its person's first login), with its prefs — for site-side posts. */
export async function levelPrefsForAccount(
  accountId: number,
): Promise<{ userId: number | null; rsn: string | null; prefs: MemberLevelPrefs }> {
  const [row] = await db
    .select({ rsn: accounts.rsn, userId: users.id, choice: users.levelPostsClan, rules: users.levelRules })
    .from(accounts)
    .leftJoin(users, eq(users.playerId, accounts.playerId))
    .where(eq(accounts.id, accountId))
    .orderBy(users.id)
    .limit(1);
  if (!row) return { userId: null, rsn: null, prefs: DEFAULT_PREFS() };
  return {
    userId: row.userId ?? null,
    rsn: row.rsn,
    prefs: {
      clanChoice: isLevelPostsChoice(row.choice) ? row.choice : 'clan',
      personal: parseMilestoneRules(row.rules),
    },
  };
}

/**
 * The `levelRules` block of /api/plugin/config (capability 'level-rules').
 *
 *   clan      the EFFECTIVE rules for this member's posts to the clan the plugin is talking to — the
 *             clan's rules after the member's own choice. Null when they chose 'off' or the clan has
 *             no levels channel.
 *   personal  the member's own rules, or null when none of their personal webhooks takes level posts.
 */
export async function pluginLevelRules(
  clanId: number,
  userId: number,
): Promise<{ clan: LevelRules | null; personal: LevelRules | null }> {
  const [clanRules, prefs, webhooks, personalTargets] = await Promise.all([
    getClanMilestoneRules(clanId),
    getMemberLevelPrefs(userId),
    getNotificationWebhooks(clanId),
    personalWebhookTargets(userId, 'levels'),
  ]);
  const effective = webhooks.levels ? effectiveClanRules(clanRules, prefs.clanChoice) : null;
  return {
    clan: effective ? levelHalf(effective) : null,
    personal: personalTargets.length > 0 ? levelHalf(prefs.personal) : null,
  };
}

/**
 * Every total-XP step (millions) some destination of this account would announce: each clan it posts
 * into (clan rules after the person's choice) and the person's own webhooks. lib/statHistory keeps
 * an off-ladder detected step only when one of these divides it.
 */
export async function wantedTotalXpStepsM(accountId: number): Promise<number[]> {
  const { userId, prefs } = await levelPrefsForAccount(accountId);
  const steps = new Set<number>();
  for (const ec of await socialEmissionClans(accountId)) {
    const eff = effectiveClanRules(await getClanMilestoneRules(ec.clanId), prefs.clanChoice);
    if (eff && eff.totalXpStepM > 0) steps.add(eff.totalXpStepM);
  }
  if (userId != null && prefs.personal.totalXpStepM > 0 && (await personalWebhookTargets(userId, 'levels')).length > 0) {
    steps.add(prefs.personal.totalXpStepM);
  }
  return [...steps];
}
