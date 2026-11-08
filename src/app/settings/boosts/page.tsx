import { MAX_SLOTS, myBoosts, SEAT_MIN_DAYS, MOVE_COOLDOWN_DAYS, PER_PERSON_CAP, LEVEL_AT } from '@/lib/clanBoosts';
import ClanLink from '@/components/ClanLink';
import { BoostBadgeChips, BoostGem } from '@/components/ClanBoost';
import { Pill, SettingsBlock, SettingsGroup, SettingsRow, SettingsTitle } from '../_ui';
import { BoostActions, PlaceBoost } from './_client';
import { settingsSession } from '@/app/settings/settingsSession';

export const dynamic = 'force-dynamic';

const day = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const STATE: Record<string, { text: string; tone: 'green' | 'yellow' | 'muted' }> = {
  active: { text: 'counting', tone: 'green' },
  paused: { text: 'paused', tone: 'yellow' },
  'seat-gone': { text: 'seat gone', tone: 'muted' },
};

/**
 * Settings → Clan boosts: your slots, where each boost sits, and the clans you could put one on.
 * Every rule is enforced by api/profile/boosts (lib/clanBoosts); this page only says what they are.
 */
export default async function BoostsSettingsPage() {
  const session = await settingsSession();
  const mine = await myBoosts(session.userId, session.playerId ?? null);
  const now = mine.now;
  const eligible = mine.candidates.filter((c) => c.verdict.ok);
  // One per clan, its seat picked for them (lib/clanBoostRules onePerClan): boosts are the person's.
  const moveTargets = eligible.map((c) => ({ seatId: c.seatId, clanId: c.clanId, label: c.clanName }));
  const paused = mine.placements.filter((p) => p.state === 'paused').length;

  return (
    <>
      <SettingsTitle
        title="Clan boosts"
        badge={mine.slots > 0 ? <Pill tone="gold">{mine.used} of {mine.slots} placed</Pill> : null}
      >
        Put your boosts on clans you&rsquo;re a member of. A boosted clan gets a badge, a coloured name and a better spot in the
        Clan Hall; you get a Booster mark there. Looks only: boosts never change a rank, a score or a seat.
      </SettingsTitle>

      {mine.slots === 0 && mine.placements.length === 0 && (
        <SettingsGroup title="Your slots">
          <SettingsBlock>
            <p className="text-[13.5px] text-text-muted">
              Boosts come with a paid Champion or Patron membership: Champion 1, Patron {MAX_SLOTS}. Time earned through invites
              doesn&rsquo;t add slots.{' '}
              <ClanLink href="/supporter" className="text-gold hover:text-gold-light">
                About Supporter →
              </ClanLink>
            </p>
          </SettingsBlock>
        </SettingsGroup>
      )}

      {(mine.slots > 0 || mine.placements.length > 0) && (
        <SettingsGroup
          title="Your boosts"
          id="your-boosts"
          note={
            paused > 0
              ? `${paused === 1 ? 'One boost is' : `${paused} boosts are`} paused: your tier has fewer slots than you've placed. The oldest keep counting; the rest come back if your slots do.`
              : mine.coolingUntil && mine.free > 0
                ? `Your free slot opens again on ${day(mine.coolingUntil)} (a boost can move once a week).`
                : null
          }
        >
          {mine.placements.map((p) => (
            <SettingsRow
              key={p.id}
              label={
                <>
                  <BoostGem size={13} />
                  <ClanLink href={`/c/${p.clanSlug}`} className="hover:text-gold">
                    {p.clanName}
                  </ClanLink>
                  <Pill tone={STATE[p.state].tone}>{STATE[p.state].text}</Pill>
                  {p.state === 'active' && !p.counted && <Pill>over the {PER_PERSON_CAP}-per-person cap</Pill>}
                </>
              }
              description={
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>
                    since {day(p.since)}
                    {p.state !== 'seat-gone' && p.movableAt > now && <> · move available on {day(p.movableAt)}</>}
                    {p.state === 'seat-gone' && <> · {p.rsn}, the character it rode on, isn&rsquo;t a member there any more</>}
                  </span>
                  <BoostBadgeChips badges={p.badges} />
                </span>
              }
            >
              <BoostActions
                boostId={p.id}
                canMove={p.movableAt <= now}
                movableOn={p.movableAt > now ? day(p.movableAt) : null}
                // Another clan; or, once its character left, another of your seats in the same one.
                targets={moveTargets
                  .filter((t) => (p.state === 'seat-gone' ? t.seatId !== p.seatId : t.clanId !== p.clanId))
                  .map(({ seatId, label }) => ({ seatId, label }))}
                clanName={p.clanName}
              />
            </SettingsRow>
          ))}
          {Array.from({ length: Math.max(0, mine.slots - mine.used) }, (_, i) => (
            <SettingsRow
              key={`free-${i}`}
              label={<span className="text-text-muted">Free slot</span>}
              description={eligible.length === 0 ? 'No clan you can boost yet: see below.' : 'Pick a clan below.'}
            />
          ))}
        </SettingsGroup>
      )}

      {(mine.slots > 0 || mine.placements.length > 0) && (
        <SettingsGroup
          title="Clans you can boost"
          id="boostable-clans"
          note={`Boosts are yours, not a character's. Each one rides on a member seat one of your characters holds in the in-game clan, ${SEAT_MIN_DAYS} days old or more; we pick it for you (your main where it can). The clan sees that character, never your others. Up to ${PER_PERSON_CAP} of yours count toward one clan's level; levels at ${LEVEL_AT.join(', ')}. A placed boost can move once every ${MOVE_COOLDOWN_DAYS} days.`}
        >
          {mine.candidates.length === 0 && (
            <SettingsBlock>
              <p className="text-[13.5px] text-text-muted">
                None of your characters holds a seat in an in-game clan on Anvil yet.{' '}
                <ClanLink href="/clans" className="text-gold hover:text-gold-light">
                  Find your clan →
                </ClanLink>
              </p>
            </SettingsBlock>
          )}
          {mine.candidates.map((c) => (
            <SettingsRow
              key={c.clanId}
              label={
                <>
                  <ClanLink href={`/c/${c.clanSlug}`} className="hover:text-gold">
                    {c.clanName}
                  </ClanLink>
                  {c.mine > 0 && <Pill tone="gold">{c.mine === 1 ? 'boosted by you' : `${c.mine} of yours`}</Pill>}
                </>
              }
              description={c.why ?? undefined}
            >
              {c.verdict.ok && mine.slots > 0 && (
                <PlaceBoost
                  seatId={c.seatId}
                  disabled={mine.free <= 0 || !!mine.coolingUntil}
                  why={mine.free <= 0 ? 'All your slots are in use. Move or remove a boost first.' : mine.coolingUntil ? `Your free slot opens on ${day(mine.coolingUntil)}.` : null}
                />
              )}
            </SettingsRow>
          ))}
        </SettingsGroup>
      )}
    </>
  );
}
