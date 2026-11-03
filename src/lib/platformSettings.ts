// Platform-wide settings (the platform_settings key/value table), and whether this deployment is the
// owner's preview. Anything Anvil itself configures once — not per clan — lives here.

import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { platformSettings } from '@/db/schema';

export async function getPlatformSetting(key: string): Promise<string | null> {
  const row = await db.query.platformSettings.findFirst({ where: eq(platformSettings.key, key) });
  return row?.value?.trim() || null;
}

export async function setPlatformSetting(key: string, value: string | null): Promise<void> {
  await db
    .insert(platformSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedAt: new Date().toISOString() } });
}

/**
 * The owner's preview (beta) never announces anything or changes anyone's Discord roles: it shares
 * the real Anvil Discord with production, so only production may act on it.
 */
export function isPreview(): boolean {
  const apex = (process.env.ANVIL_APEX_DOMAIN || '').toLowerCase();
  return apex.startsWith('beta.') || process.env.ANVIL_RELEASES_PUBLISH === 'off';
}
