import ClanLink from '@/components/ClanLink';
import CreatorChip from '@/components/CreatorChip';
import { groupClansAndSpaces } from '@/lib/creatorSpaces';
import { notFound } from 'next/navigation';

import SupporterName from '@/components/SupporterName';
import { verifyUser } from '@/lib/auth';
import { supporterForUser } from '@/lib/supporter';
import { emissionSettingsView } from '@/lib/emissionSettings';
import { gameClanForAccount } from '@/lib/gameClans';
import { membershipConflicts } from '@/lib/homeClan';
import { alsoPlayedFromByAccount } from '@/lib/accountSightings';
import { characterSeats, settingsCharacters } from '@/lib/settingsData';
import HomeClanConflicts from '@/app/profile/HomeClanConflicts';
import RenameRequestClient from '@/app/profile/RenameRequestClient';
import WrongClanReport from '@/app/profile/WrongClanReport';
import { CharacterAnnouncements } from '../../EmissionPanels';
import { ActionButton, SettingSwitch } from '../../_client';
import { Pill, SettingsBlock, SettingsGroup, SettingsRow, SettingsTitle } from '../../_ui';

const METHOD_LABEL: Record<string, string> = {
  plugin: 'Verified by the plugin',
  plugin_first_use: 'Linked by the plugin',
  stat_delta: 'Verified by XP gain',
  manual: 'Verified by a moderator',
  discord_name_match: 'Verified by Discord name',
  federation: 'Verified',
};

const TYPE_LABEL: Record<string, string> = {
  ironman: 'ironman',
  ultimate: 'ultimate',
  hardcore: 'hardcore',
  group: 'group iron',
  hardcore_group: 'hc group iron',
  unranked_group: 'unranked gim',
};

function joined(stamp: string | null): string | null {
  if (!stamp) return null;
  const ms = Date.parse(stamp.includes('T') ? stamp : `${stamp.replace(' ', 'T')}Z`);
  return Number.isNaN(ms) ? null : new Date(ms).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * One character: who can see it, the clans it sits in (and what it announces there), and the
 * account-level things you do to it. Everything that used to need the right clan's locker.
 */
export default async function CharacterSettingsPage({ params }: { params: Promise<{ accountId: string }> }) {
  const session = (await verifyUser())!;
  const accountId = Number((await params).accountId);
  if (!session.playerId || !Number.isInteger(accountId)) notFound();

  const characters = await settingsCharacters(session.playerId);
  const c = characters.find((x) => x.accountId === accountId);
  if (!c) notFound();

  const [seats, gameClan, conflicts, emission, sightings, supporter] = await Promise.all([
    characterSeats(accountId),
    gameClanForAccount(accountId),
    membershipConflicts(session.playerId),
    emissionSettingsView(session.userId, session.playerId),
    alsoPlayedFromByAccount([accountId], session.userId),
    supporterForUser(session.userId),
  ]);
  const mine = conflicts.filter((x) => x.accountId === accountId);
  // "Your clans", then "Your spaces": a creator space is not a clan (lib/creatorSpaces).
  const seatGroups = groupClansAndSpaces(seats, (s) => s.clanKind);
  const others = sightings.get(accountId) ?? [];
  const type = c.accountType ? TYPE_LABEL[c.accountType] : null;
  const fullProfileSeat =
    seats.find((s) => s.kind === 'member' && s.clanKind !== 'creator') ?? seats.find((s) => s.clanKind !== 'creator') ?? null;

  return (
    <>
      <SettingsTitle
        title={<SupporterName name={c.rsn} tier={supporter?.tier.id} style={supporter?.style} plain />}
        badge={
          <>
            {c.isPrimary && <Pill tone="gold">main</Pill>}
            {type && <Pill>{type}</Pill>}
            {c.provisional ? <Pill tone="yellow">in review</Pill> : c.verified ? <Pill tone="green">verified</Pill> : <Pill tone="yellow">not verified</Pill>}
          </>
        }
      >
        {c.verified ? METHOD_LABEL[c.verificationMethod ?? ''] ?? 'Verified' : 'Not verified yet'} ·{' '}
        <ClanLink href={`/p/${encodeURIComponent(c.rsn)}`} className="text-gold hover:text-gold-light">
          View public page →
        </ClanLink>
        {fullProfileSeat && (
          <>
            {' · '}
            {/* The full character page as its home clan sees it (falls back to any seat). */}
            <ClanLink
              href={`/c/${fullProfileSeat.clanSlug}/members/${encodeURIComponent(c.rsn)}`}
              className="text-gold hover:text-gold-light"
            >
              View full profile →
            </ClanLink>
          </>
        )}
      </SettingsTitle>

      {others.length > 0 && (
        <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/[0.06] px-4 py-3 text-[13px] text-yellow-300">
          Also logged in through another Anvil account&rsquo;s plugin ({others[0].name}
          {others.length > 1 && <> and {others.length - 1} more</>}). A shared computer is normal; if this character isn&rsquo;t yours, remove
          it below.
        </div>
      )}

      <SettingsGroup title="Visibility">
        <SettingsRow
          label="Show to other clans and on leaderboards"
          description="When off, only the clans it’s a member or guest of can see it."
        >
          <SettingSwitch url={`/api/profile/accounts/${accountId}/share`} field="shared" checked={c.shared} label={`Show ${c.rsn} publicly`} />
        </SettingsRow>
        {gameClan && (
          <SettingsRow
            label={`Show my in-game clan (${gameClan.name})`}
            description="On this character’s public page and on that clan’s Anvil page."
          >
            <SettingSwitch
              url={`/api/profile/accounts/${accountId}/game-clan`}
              field="hidden"
              invert
              checked={!gameClan.hidden}
              label="Show my in-game clan"
            />
          </SettingsRow>
        )}
      </SettingsGroup>

      <SettingsGroup
        title={seatGroups.some((g) => g.key === 'spaces') ? 'Clans and spaces' : 'Clans'}
        id="clans"
        note={
          seats.some((s) => s.heldByRoster)
            ? 'A member seat your clan’s in-game list holds can only be left in game: leave the clan there and Anvil follows.'
            : null
        }
      >
        {!seatGroups.some((g) => g.key === 'clans') && (
          <SettingsRow
            label="Not in a clan"
            description={
              <>
                Join one in game, or{' '}
                <ClanLink href="/clans" className="text-gold hover:text-gold-light">
                  browse the clans on Anvil
                </ClanLink>
                .
              </>
            }
          />
        )}
        {seatGroups.flatMap((g) => [
          ...(g.key === 'spaces'
            ? [
                <div key="spaces-heading" className="px-4 pt-3 text-[11px] font-medium uppercase tracking-wider text-text-dim">
                  {g.label}
                </div>,
              ]
            : []),
          ...g.items.map((s) => (
          <SettingsRow
            key={s.seatId}
            label={
              <>
                <ClanLink href={`/c/${s.clanSlug}/profile`} className="hover:text-gold">
                  {s.clanName}
                </ClanLink>
                {g.key === 'spaces' ? (
                  <CreatorChip />
                ) : (
                  <Pill tone={s.kind === 'member' ? 'green' : 'muted'}>{s.kind === 'member' ? 'member' : 'guest'}</Pill>
                )}
              </>
            }
            description={joined(s.joinedAt) ? `Since ${joined(s.joinedAt)}` : undefined}
          >
            {s.heldByRoster ? (
              <span className="text-[12px] text-text-dim">in-game list</span>
            ) : (
              <ActionButton
                url={`/api/me/seats/${s.seatId}/leave`}
                tone="danger"
                confirm={{
                  title: `Leave ${s.clanName} with ${c.rsn}?`,
                  body: 'Results already recorded there stay. You can come back if the clan lets you in again.',
                  confirmLabel: 'Leave',
                }}
              >
                Leave
              </ActionButton>
            )}
          </SettingsRow>
          )),
        ])}
        {mine.length > 0 && (
          <SettingsBlock>
            <HomeClanConflicts initial={mine} />
          </SettingsBlock>
        )}
        {seats.length > 0 && (
          <SettingsBlock>
            <div className="mb-2 text-[13px] font-medium">Announce drops & achievements</div>
            <CharacterAnnouncements initial={emission} accountId={accountId} />
          </SettingsBlock>
        )}
        {seats.length > 0 && (
          <SettingsBlock>
            <WrongClanReport
              accountId={accountId}
              rsn={c.rsn}
              options={seats.map((s) => ({ clanId: s.clanId, name: s.clanName, kind: s.kind }))}
            />
          </SettingsBlock>
        )}
      </SettingsGroup>

      <SettingsGroup title="Character">
        {characters.length > 1 && (
          <SettingsRow label="Main character" description="Names your team in solo events and leads your Discord nickname.">
            {c.isPrimary ? (
              <Pill tone="gold">this is your main</Pill>
            ) : (
              <ActionButton url={`/api/profile/characters/${accountId}`} method="PATCH" body={{ primary: true }}>
                Make main
              </ActionButton>
            )}
          </SettingsRow>
        )}
        {seats.length > 0 && (
          <SettingsBlock>
            <RenameRequestClient accounts={[{ id: seats[0].seatId, rsn: c.rsn }]} />
          </SettingsBlock>
        )}
        <SettingsRow label="Remove from my account" description="Unlinks it. Its results stay with the clans they were earned in.">
          <ActionButton
            url={`/api/profile/characters/${accountId}`}
            method="DELETE"
            tone="danger"
            then="/settings/account"
            confirm={{
              title: `Remove ${c.rsn} from your account?`,
              body: 'Results already recorded under it stay where they are. You can add it back by playing it with the plugin.',
              confirmLabel: 'Remove',
            }}
          >
            Remove
          </ActionButton>
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}
