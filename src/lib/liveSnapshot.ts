// Pure (no database): the profile's fallback when the hiscores sweep hasn't reached a character but
// its plugin has pushed XP. See lib/memberProfile accountProfileFrom.

import type { HiscoresSnapshot } from '@/lib/hiscores';
import { SKILLS, BOSSES } from '@/lib/constants';
import { levelFromXp } from '@/lib/xp';
import { parsePluginStats } from '@/lib/pluginStats';

/**
 * A hiscores-shaped snapshot from the plugin's live overlay (absolute XP per skill, KC per boss), or
 * null when it carries no skill XP. Ranks are unknown (-1); overall is the sum, as on the hiscores.
 */
export function snapshotFromLiveStats(json: string | null | undefined): HiscoresSnapshot | null {
  const live = parsePluginStats(json);
  const skills: HiscoresSnapshot['skills'] = {};
  let totalXp = 0;
  let totalLevel = 0;
  for (const key of SKILLS) {
    if (key === 'overall') continue;
    const xp = live[key];
    if (typeof xp !== 'number' || xp < 0) continue;
    const level = levelFromXp(xp);
    skills[key] = { rank: -1, level, xp };
    totalXp += xp;
    totalLevel += level;
  }
  if (Object.keys(skills).length === 0) return null;
  skills.overall = { rank: -1, level: totalLevel, xp: totalXp };
  const bosses: HiscoresSnapshot['bosses'] = {};
  for (const { key } of BOSSES) {
    const kc = live[key];
    if (typeof kc === 'number' && kc > 0) bosses[key] = { rank: -1, score: kc };
  }
  return { skills, bosses };
}
