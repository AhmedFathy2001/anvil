import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { supporterForUser } from '@/lib/supporter';
import { referralSummary } from '@/lib/referrals';
import { myBoosts } from '@/lib/clanBoosts';
import { apexOrigin } from '@/lib/seo';
import { SUPPORTER_TIER_ORDER, type SupporterTierId } from '@/lib/supporterTiers';
import ClanLink from '@/components/ClanLink';
import SupporterSection, { supporterView } from '@/components/SupporterSection';
import { Pill, SettingsGroup, SettingsRow, SettingsTitle } from '../_ui';

/**
 * Anvil Supporter: the subscription, the perks it unlocks, and the settings that only exist because
 * of it (name colours, game-chat flair, the Discord announcement, the invite link).
 *
 * Each perk's own control lives where the perk shows — chat colours under In-game chat — so this
 * page lists every perk once with the tier it needs and whether it's theirs, and links across.
 */
const PERKS: { label: string; where: string; tier: SupporterTierId }[] = [
  { label: 'Name colours on boards, rosters and Discord posts', where: 'below', tier: 'supporter' },
  { label: 'Your name colour in other players’ game chat', where: 'below', tier: 'supporter' },
  { label: 'A display case of your best drops (4 / 8 / 12 slots)', where: '/settings/look', tier: 'supporter' },
  { label: 'Your own avatar and banner, animated', where: '/settings/look', tier: 'champion' },
  { label: 'Your own chat feed colours', where: '/settings/chat', tier: 'supporter' },
  { label: 'Choose what your login brief covers', where: '/settings/chat', tier: 'champion' },
  { label: 'A star by your name in other players’ chat feeds', where: '/settings/chat', tier: 'patron' },
  { label: 'Boosts for clans you’re in (1 / 2 / 3 slots)', where: '/settings/boosts', tier: 'supporter' },
];
const atLeast = (tier: SupporterTierId | null, need: SupporterTierId) =>
  tier != null && SUPPORTER_TIER_ORDER.indexOf(tier) >= SUPPORTER_TIER_ORDER.indexOf(need);
const TIER_NAME: Record<SupporterTierId, string> = { supporter: 'Supporter', champion: 'Champion', patron: 'Patron' };

export default async function SupporterSettingsPage() {
  const session = (await verifyUser())!;
  const [user, supporter, referral, boosts] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, session.userId) }),
    supporterForUser(session.userId),
    referralSummary(session.userId).catch(() => null),
    myBoosts(session.userId, session.playerId ?? null).catch(() => null),
  ]);
  const tier = supporter?.tier.id ?? null;

  return (
    <>
      <SettingsTitle title="Anvil Supporter" badge={supporter ? <Pill tone="gold">{supporter.tier.name}</Pill> : null}>
        Supporters pay for Anvil&rsquo;s servers and their name says so. Perks are looks only: nothing here changes tracking, scoring or
        what an event counts.
      </SettingsTitle>

      {boosts && boosts.free > 0 && (
        <ClanLink
          href="/settings/boosts"
          className="mb-6 flex flex-wrap items-center gap-x-2 rounded-xl border border-gold/35 bg-gold/[0.06] px-4 py-3 text-[13.5px] transition-colors hover:border-gold/60"
        >
          <span className="font-medium text-gold">
            You have {boosts.free} boost{boosts.free === 1 ? '' : 's'} to place.
          </span>
          <span className="text-text-muted">Boost any clan you&rsquo;re a member of →</span>
        </ClanLink>
      )}

      <SettingsGroup title="Perks">
        {PERKS.map((p) => {
          const mine = atLeast(tier, p.tier);
          return (
            <SettingsRow key={p.label} label={p.label} locked={mine ? null : TIER_NAME[p.tier]}>
              {mine && <Pill tone="green">yours</Pill>}
              {mine && p.where !== 'below' && (
                <ClanLink href={p.where} className="text-[13px] text-gold hover:text-gold-light">
                  Set →
                </ClanLink>
              )}
            </SettingsRow>
          );
        })}
      </SettingsGroup>

      <SupporterSection
        bare
        supporter={supporterView(supporter)}
        name={user?.displayName ?? null}
        announce={user?.announceSupporter ?? true}
        gameChat={user?.gameChatFlair ?? true}
        invite={
          referral && process.env.GUMROAD_URL_SUPPORTER
            ? { link: `${apexOrigin()}/r/${referral.code}`, held: referral.held, granted: referral.granted, monthsEarned: referral.monthsEarned, next: referral.next }
            : null
        }
      />
    </>
  );
}
