import { redirect } from 'next/navigation';

import { db } from '@/db';
import { clanHref } from '@/lib/clanPath';
import { clanAuditLog } from '@/db/schema';
import { getSetting, setSetting } from '@/lib/settings';
import {
  FEATURES_OFF_SETTING,
  featureFlags,
  parseFeaturesOff,
  serializeFeaturesOff,
  type FeatureFlags,
  type FeatureKey,
} from '@/lib/features';

/** This clan's feature switches. Everything is on unless the clan switched it off. */
export async function getClanFeatures(clanId: number): Promise<FeatureFlags> {
  return featureFlags(parseFeaturesOff(await getSetting(clanId, FEATURES_OFF_SETTING)));
}

/** Switch one feature on or off, and record who did it in the Activity log. */
export async function setClanFeature(
  clanId: number,
  key: FeatureKey,
  on: boolean,
  actorUserId: number | null,
): Promise<FeatureFlags> {
  const off = new Set(parseFeaturesOff(await getSetting(clanId, FEATURES_OFF_SETTING)));
  const wasOn = !off.has(key);
  if (on) off.delete(key);
  else off.add(key);
  await setSetting(clanId, FEATURES_OFF_SETTING, serializeFeaturesOff(off));
  if (wasOn !== on) {
    await db.insert(clanAuditLog).values({
      clanId,
      eventType: 'feature_toggled',
      actorUserId,
      oldValue: JSON.stringify({ feature: key, on: wasOn }),
      newValue: JSON.stringify({ feature: key, on }),
    });
  }
  return featureFlags(off);
}

/**
 * For a page that belongs to a feature: when the clan has it switched off, send the visitor to
 * `fallback` (clan-relative) instead. Off is off for everyone, so this runs before any role check.
 */
export async function requireFeature(clanId: number, key: FeatureKey, fallback: string): Promise<void> {
  if ((await getClanFeatures(clanId)).on(key)) return;
  redirect(await clanHref(fallback));
}
