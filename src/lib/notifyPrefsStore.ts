import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { normalizeNotifyPrefs, parseNotifyPrefs, type NotifyPrefs } from '@/lib/notifyPrefs';

/** The person's notify prefs; the defaults when never set. */
export async function getNotifyPrefs(userId: number): Promise<NotifyPrefs> {
  const [row] = await db.select({ p: users.notifyPrefs }).from(users).where(eq(users.id, userId)).limit(1);
  return parseNotifyPrefs(row?.p);
}

/** Whether this person has ever saved prefs (the plugin's one-time upload only fills an empty row). */
export async function hasNotifyPrefs(userId: number): Promise<boolean> {
  const [row] = await db.select({ p: users.notifyPrefs }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.p != null;
}

export async function setNotifyPrefs(userId: number, prefs: NotifyPrefs): Promise<NotifyPrefs> {
  const clean = normalizeNotifyPrefs(prefs);
  await db.update(users).set({ notifyPrefs: JSON.stringify(clean) }).where(eq(users.id, userId));
  return clean;
}
