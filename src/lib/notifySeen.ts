import { sql } from 'drizzle-orm';

import { db } from '@/db';
import { itemKey } from '@/lib/notifyDedupe';

const SEEN_SECONDS = 120;

/**
 * True when this person posted this collection-log slot in the last two minutes, recorded in the
 * database so a restart can't forget it. The in-memory check (lib/notifyDedupe) lives in one server
 * process: chelsea7513's Elidinis' ward posted at 13:34:48, the site redeployed at 13:35:15, and the
 * second sighting of the same unlock posted again a minute later.
 *
 * One statement: the row is written when it is new or older than the window, and the write returning
 * nothing means the slot was posted just now. Rows older than a day are swept now and then.
 */
export async function clogSlotPostedRecently(userId: number, item: unknown): Promise<boolean> {
  if (typeof item !== 'string' || !item.trim()) return false;
  const key = `clogSlot:${userId}:${itemKey(item)}`;
  try {
    const res = await db.execute(sql`
      insert into notify_seen (key, seen_at) values (${key}, now())
      on conflict (key) do update set seen_at = now()
        where notify_seen.seen_at < now() - make_interval(secs => ${SEEN_SECONDS})
      returning key
    `);
    if (Math.random() < 0.02) void db.execute(sql`delete from notify_seen where seen_at < now() - interval '1 day'`).catch(() => {});
    return res.rows.length === 0;
  } catch {
    // A database hiccup shouldn't swallow a real unlock: the in-memory check still stands.
    return false;
  }
}
