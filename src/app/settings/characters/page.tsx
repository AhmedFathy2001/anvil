import ClanLink from '@/components/ClanLink';
import SupporterName from '@/components/SupporterName';
import { settingsCharacters } from '@/lib/settingsData';
import { supporterForUser } from '@/lib/supporter';
import { settingsSession } from '@/app/settings/settingsSession';
import { AddGroups } from '../_parts/add';
import { ClaimsGroups } from '../_parts/claims';
import { PartJumps, Pill, SettingsGroup, SettingsPart, SettingsRow, SettingsTitle } from '../_ui';

export const dynamic = 'force-dynamic';

/**
 * Characters: the ones you have (each opens its own page: clans, visibility, main, remove), adding
 * one, and "this is my account" claims. Was Add a character and Ownership claims, plus a redirect
 * to your main character. `?connect=<rsn>` still pre-fills the name to add.
 */
export default async function CharactersSettingsPage({ searchParams }: { searchParams: Promise<{ connect?: string }> }) {
  const session = await settingsSession();
  const [characters, supporter] = await Promise.all([
    session.playerId ? settingsCharacters(session.playerId) : Promise.resolve([]),
    supporterForUser(session.userId),
  ]);

  return (
    <>
      <SettingsTitle title="Characters">
        Your RuneScape characters on Anvil. Play one with the Anvil plugin and it links itself; open a character to choose its clans, who
        sees it, or remove it.
      </SettingsTitle>
      <PartJumps
        parts={[
          { id: 'your-characters', label: 'Your characters' },
          { id: 'add', label: 'Add a character' },
          { id: 'claims', label: 'Ownership claims' },
        ]}
      />

      <SettingsPart id="your-characters" title="Your characters">
        <SettingsGroup title="Linked" note={characters.length > 1 ? 'Your main is the one your name and plugin card use first.' : undefined}>
          {characters.length === 0 && <SettingsRow label="No characters yet" description="Add one below." />}
          {characters.map((c) => (
            <SettingsRow
              key={c.accountId}
              label={
                <>
                  <SupporterName name={c.rsn} tier={supporter?.tier.id} style={supporter?.style} plain />
                  {c.isPrimary && <Pill tone="gold">main</Pill>}
                  {c.provisional ? <Pill tone="yellow">in review</Pill> : c.verified ? <Pill tone="green">verified</Pill> : <Pill tone="yellow">not verified</Pill>}
                </>
              }
              description={c.shared ? 'Public' : 'Only its clans'}
            >
              <ClanLink href={`/settings/characters/${c.accountId}`} className="text-[13px] text-gold hover:text-gold-light">
                Clans &amp; settings →
              </ClanLink>
            </SettingsRow>
          ))}
        </SettingsGroup>
      </SettingsPart>

      <SettingsPart
        id="add"
        title="Add a character"
        intro="Play it once with the Anvil plugin and it links itself. On mobile or the official client, link it by name instead."
      >
        <AddGroups searchParams={searchParams} />
      </SettingsPart>

      <SettingsPart
        id="claims"
        title="Ownership claims"
        intro="When a character is linked to another Anvil account, its real owner can claim it: they prove control with a quick XP check, and only then is the current owner asked. Nothing moves without the owner being told, and everything a character earned stays where it was recorded."
      >
        <ClaimsGroups />
      </SettingsPart>
    </>
  );
}
