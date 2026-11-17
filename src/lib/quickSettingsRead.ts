// Reads the facts behind the quick-settings block (lib/quickSettings) for one person and one clan.
// Every value comes from the place its real Settings page reads it.

import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accountClanEmission, accounts, clanMemberships, users } from '@/db/schema';
import { FEEDS_OFF_KEY, FEED_KEYS, effectiveKey, feedById, parseFeedsOff } from '@/lib/discordFeeds';
import { clanBlocksGuestEmissions } from '@/lib/emissionRouting';
import { parseNotifyPrefs } from '@/lib/notifyPrefs';
import { quickSettingsDone, buildQuickSettings, type QuickSettingsView } from '@/lib/quickSettings';
import { getSettingMap } from '@/lib/settings';

/** Which of the clan's game posts about a player reach a Discord channel right now. */
async function clanGamePosts(clanId: number): Promise<{ drops: boolean; deaths: boolean; levels: boolean }> {
  const map = await getSettingMap(clanId, [...FEED_KEYS, FEEDS_OFF_KEY]);
  const isSet = (k: string) => !!map.get(k)?.trim();
  const off = parseFeedsOff(map.get(FEEDS_OFF_KEY));
  const on = (id: string) => {
    const feed = feedById(id);
    return !!feed && !off.has(id) && effectiveKey(feed, isSet) != null;
  };
  return { drops: on('rareDrops'), deaths: on('deaths'), levels: on('levels') };
}

/**
 * The quick settings for this person in this clan, or null when there is nothing to ask (no seat
 * here: staff who never joined the roster). `done` says the step was already dealt with.
 */
export async function quickSettingsFor(
  userId: number,
  playerId: number | null,
  clan: { id: number; name: string },
  /** The Settings home shows it again after it was dealt with. */
  opts: { ignoreDone?: boolean } = {},
): Promise<{ view: QuickSettingsView | null; done: boolean }> {
  if (playerId == null) return { view: null, done: true };
  const [user] = await db
    .select({ skipped: users.onboardingSkipped, block: users.blockGuestEmissions, notifyPrefs: users.notifyPrefs, dms: users.anvilDms })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const done = quickSettingsDone(user?.skipped, clan.id);
  if (done && !opts.ignoreDone) return { view: null, done: true };

  // clan-scope: global -- the subject is a PERSON; the seat rows below are filtered to this one clan.
  const mine = await db
    .select({ id: accounts.id, rsn: accounts.rsn, shared: accounts.shared })
    .from(accounts)
    .where(eq(accounts.playerId, playerId))
    .orderBy(desc(accounts.isPrimary), asc(accounts.id));
  const characters = mine.filter((a) => !a.rsn.startsWith('guest:'));
  const seats = await db
    .select({ accountId: clanMemberships.accountId, kind: clanMemberships.kind })
    .from(clanMemberships)
    .where(and(eq(clanMemberships.clanId, clan.id), isNull(clanMemberships.leftAt)));
  const mineIds = new Set(characters.map((a) => a.id));
  const mySeats = seats.filter((s) => mineIds.has(s.accountId));
  if (mySeats.length === 0) return { view: null, done: true };
  const seat = mySeats.some((s) => s.kind === 'member') ? 'member' : mySeats.some((s) => s.kind === 'guest') ? 'guest' : null;
  if (!seat) return { view: null, done: true };

  const guestIds = mySeats.filter((s) => s.kind === 'guest').map((s) => s.accountId);
  const overrides = guestIds.length
    ? await db
        .select({ accountId: accountClanEmission.accountId, enabled: accountClanEmission.enabled })
        .from(accountClanEmission)
        .where(eq(accountClanEmission.clanId, clan.id))
    : [];
  const prefs = parseNotifyPrefs(user?.notifyPrefs);
  const main = characters[0] ?? null;

  const view = buildQuickSettings({
    clanId: clan.id,
    clanName: clan.name,
    seat,
    clanPosts: await clanGamePosts(clan.id),
    clanRefusesGuests: await clanBlocksGuestEmissions(clan.id),
    prefs: { drops: prefs.drops, deaths: prefs.deaths, levels: prefs.levels },
    blockGuestPosts: !!user?.block,
    guestCharacters: guestIds.map((id) => ({ accountId: id, allowed: overrides.some((o) => o.accountId === id && o.enabled) })),
    main: main ? { accountId: main.id, rsn: main.rsn, shared: !!main.shared } : null,
    characterCount: characters.length,
    dms: user?.dms === 'yes',
  });
  return { view, done: false };
}
