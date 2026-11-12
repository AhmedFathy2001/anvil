import { desc, eq } from 'drizzle-orm';

import { giftedMonthsFor } from '@/lib/supporterGiftCheckout';
import { db } from '@/db';
import { accounts, users } from '@/db/schema';
import { supporterForUser } from '@/lib/supporter';
import { referralSummary } from '@/lib/referrals';
import { myBoosts } from '@/lib/clanBoosts';
import { apexOrigin } from '@/lib/seo';
import { SUPPORTER_TIER_ORDER, type SupporterTierId } from '@/lib/supporterTiers';
import { parseSupporterStyle } from '@/lib/supporterStyle';
import ClanLink from '@/components/ClanLink';
import SupporterSection, { supporterView } from '@/components/SupporterSection';
import { Pill, SettingsGroup, SettingsRow } from '../_ui';
import { settingsSession } from '@/app/settings/settingsSession';

/**
 * Your plan (the top of Profile & look): the subscription, every perk once with the tier it needs,
 * and the settings that only exist because of it (game-chat flair, the wall, the Discord
 * announcement, the invite link). Each perk's own control is further down the page, or under In
 * game, and anyone may try it there before subscribing.
 */
const PERKS: { label: string; where: string | null; tier: SupporterTierId }[] = [
  { label: 'Name colours on boards, rosters and Discord posts', where: '/settings/profile#name-colours', tier: 'supporter' },
  { label: 'Your name colour in other players’ game chat', where: '/settings/profile#name-colours', tier: 'supporter' },
  { label: 'A display case of your best drops (4 / 8 / 12 slots)', where: '/settings/profile#display-case', tier: 'supporter' },
  { label: 'Your own chat line colours', where: '/settings/profile#chat-colours', tier: 'supporter' },
  { label: 'Your own avatar and banner, animated', where: '/settings/profile#avatar-banner', tier: 'champion' },
  { label: 'Choose what your login brief covers', where: '/settings/in-game#chat-feed', tier: 'champion' },
  { label: 'Boosts for clans you’re in (1 / 2 slots)', where: '/settings/profile#boosts', tier: 'champion' },
  { label: 'A star by your name in other players’ chat feeds', where: null, tier: 'patron' },
];
const atLeast = (tier: SupporterTierId | null, need: SupporterTierId) =>
  tier != null && SUPPORTER_TIER_ORDER.indexOf(tier) >= SUPPORTER_TIER_ORDER.indexOf(need);
const TIER_NAME: Record<SupporterTierId, string> = { supporter: 'Supporter', champion: 'Champion', patron: 'Patron' };

export async function PlanGroups() {
  const session = await settingsSession();
  const [user, supporter, referral, boosts, characters, gifted] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, session.userId) }),
    supporterForUser(session.userId),
    referralSummary(session.userId).catch(() => null),
    myBoosts(session.userId, session.playerId ?? null).catch(() => null),
    session.playerId
      ? db.select({ accountId: accounts.id, rsn: accounts.rsn, style: accounts.supporterStyle })
          .from(accounts).where(eq(accounts.playerId, session.playerId)).orderBy(desc(accounts.isPrimary), accounts.rsn)
      : Promise.resolve([]),
    giftedMonthsFor([session.userId]).then((m) => m.get(session.userId) ?? 0).catch(() => 0),
  ]);
  const tier = supporter?.tier.id ?? null;

  return (
    <>
      {boosts && boosts.free > 0 && (
        <ClanLink
          href="/settings/profile#boosts"
          className="mb-6 flex flex-wrap items-center gap-x-2 rounded-xl border border-gold/35 bg-gold/[0.06] px-4 py-3 text-[13.5px] transition-colors hover:border-gold/60"
        >
          <span className="font-medium text-gold">
            You have {boosts.free} boost{boosts.free === 1 ? '' : 's'} to place.
          </span>
          <span className="text-text-muted">Boost any clan you&rsquo;re a member of →</span>
        </ClanLink>
      )}

      <SupporterSection
        bare
        looks={false}
        supporter={supporterView(supporter)}
        name={user?.displayName ?? null}
        announce={user?.announceSupporter ?? true}
        gameChat={user?.gameChatFlair ?? true}
        wall={user?.supporterWall ?? true}
        gifted={gifted}
        characters={characters.map((c) => ({ ...c, style: parseSupporterStyle(c.style) }))}
        invite={
          referral && process.env.GUMROAD_URL_SUPPORTER
            ? { link: `${apexOrigin()}/r/${referral.code}`, held: referral.held, granted: referral.granted, monthsEarned: referral.monthsEarned, next: referral.next }
            : null
        }
      />

      <div className="mt-6">
      <SettingsGroup title="Perks" id="perks">
          {PERKS.map((p) => {
            const mine = atLeast(tier, p.tier);
            return (
              <SettingsRow key={p.label} label={p.label} locked={mine ? null : TIER_NAME[p.tier]}>
                {mine && <Pill tone="green">yours</Pill>}
                {p.where && (
                  <ClanLink href={p.where} className="text-[13px] text-gold hover:text-gold-light">
                    {mine ? 'Set →' : 'Try it →'}
                  </ClanLink>
                )}
              </SettingsRow>
            );
          })}
        </SettingsGroup>
      </div>
    </>
  );
}
