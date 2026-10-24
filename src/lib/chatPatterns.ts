// The stored chat-line overrides. The catalog, the checks and the tester are in lib/chatPatternRules
// (no database, so the staff editor runs them in the browser); see there for the whole story.

import { asc } from 'drizzle-orm';

import { db } from '@/db';
import { chatPatternOverrides } from '@/db/schema';
import { CHAT_PATTERN_CATALOG } from '@/lib/chatPatternRules';

export { CHAT_PATTERN_CATALOG, checkOverride } from '@/lib/chatPatternRules';

export interface ChatPatternOverride {
  key: string;
  regex: string;
  hint: string | null;
  note: string | null;
  updatedBy: number | null;
  updatedAt: string;
}

export async function listOverrides(): Promise<ChatPatternOverride[]> {
  return db.select().from(chatPatternOverrides).orderBy(asc(chatPatternOverrides.key));
}

/**
 * What GET /api/plugin/chat-patterns serves: the whole set every time (the plugin treats a key that
 * is absent as "back to the default"), ordered so the ETag is stable. Overrides whose key the
 * catalog no longer has are still sent; the plugin ignores keys it does not know.
 */
export async function pluginOverridePayload(): Promise<{
  version: number;
  overrides: { key: string; regex: string; hint?: string }[];
}> {
  const rows = await listOverrides();
  return {
    version: CHAT_PATTERN_CATALOG.version,
    overrides: rows.map((r) => ({ key: r.key, regex: r.regex, ...(r.hint ? { hint: r.hint } : {}) })),
  };
}
