import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanMemberships, userWebhooks } from '@/db/schema';
import { parseKinds } from '@/lib/emissionRouting';
import { isDropMode, NO_CLAN_DROPS, PLATFORM_DROP_DEFAULTS, type ClanDropSettings, type HookDropFilter } from '@/lib/notifyPrefs';
import { getClanDropDefaults } from '@/lib/pluginConfig';

/**
 * The drop settings in force for ONE character. The default comes from the clan that character is a
 * MEMBER of (characters of one person can sit in different clans), and none when they have no member
 * seat: Anvil's default applies. An unresolved character (the login screen) is taken to be in the
 * addressed clan. The hard floor stays the addressed clan's, as it always was: it guards that clan's
 * channels.
 */
export async function characterClanDrops(
  accountId: number | null,
  addressedClanId: number,
  hardFloor: number | null,
): Promise<ClanDropSettings> {
  let clanId: number | null = addressedClanId;
  if (accountId != null) {
    const [seat] = await db
      .select({ clanId: clanMemberships.clanId })
      .from(clanMemberships)
      .where(and(eq(clanMemberships.accountId, accountId), eq(clanMemberships.kind, 'member'), isNull(clanMemberships.leftAt)))
      .limit(1);
    clanId = seat?.clanId ?? null;
  }
  const defaults = clanId != null ? await getClanDropDefaults(clanId) : NO_CLAN_DROPS;
  return { ...defaults, hardFloor: hardFloor != null && hardFloor > 0 ? hardFloor : null };
}

/** The person's own webhooks that take rare drops, with their own filters (null = follow the person). */
export async function dropHookFilters(userId: number): Promise<HookDropFilter[]> {
  const rows = await db.select().from(userWebhooks).where(eq(userWebhooks.userId, userId));
  return rows
    .filter((h) => parseKinds(h.kinds).includes('rareDrops'))
    .map((h) => ({ id: h.id, minValue: h.minValue, minRarity: h.minDropRarity, mode: isDropMode(h.minDropMode) ? h.minDropMode : null }));
}

/** A clan's main-game rarity gate for a member on its defaults (what a game mode's unset half is judged by). */
export async function clanMainRarity(clanId: number): Promise<number> {
  const d = await getClanDropDefaults(clanId);
  return Math.max(d.rarity ?? PLATFORM_DROP_DEFAULTS.rarity, d.hardFloor ?? 0);
}
