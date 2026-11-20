// Where the staff Today page keeps which lines were dismissed (lib/staffDecisions has the rule).
// One shared list for the platform team: a line one operator has dealt with is dealt with.

import { getPlatformSetting, setPlatformSetting } from '@/lib/platformSettings';
import { parseDismissed, type Dismissed } from '@/lib/staffDecisions';

const KEY = 'staff_dismissed_decisions';

export async function readDismissed(): Promise<Dismissed> {
  return parseDismissed(await getPlatformSetting(KEY).catch(() => null));
}

export async function dismissDecision(key: string, size: number): Promise<void> {
  const next = { ...(await readDismissed()), [key]: size };
  await setPlatformSetting(KEY, JSON.stringify(next));
}

export async function restoreDecisions(): Promise<void> {
  await setPlatformSetting(KEY, null);
}
