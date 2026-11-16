import ClanLink from '@/components/ClanLink';
import SupporterName from '@/components/SupporterName';
import { settingsCharacters } from '@/lib/settingsData';
import { supporterForUser } from '@/lib/supporter';
import { runningXpCheck } from '@/lib/xpCheckRead';
import { xpCheckLine } from '@/lib/xpCheck';
import { settingsSession } from '@/app/settings/settingsSession';
import { AddGroups } from '../_parts/add';
import { continueQuery, readContinue } from '@/lib/clanScopedPaths';
import ContinueStrip from './ContinueStrip';
import { ClaimsGroups } from '../_parts/claims';
import { PartJumps, Pill, SettingsGroup, SettingsPart, SettingsRow, SettingsTitle } from '../_ui';

export const dynamic = 'force-dynamic';

/**
 * Characters: the ones you have (each opens its own page: clans, visibility, main, remove), adding
 * one, and "this is my account" claims. Was Add a character and Ownership claims, plus a redirect
 * to your main character. `?connect=<rsn>` still pre-fills the name to add.
 */
export default async function CharactersSettingsPage({ searchParams }: { searchParams: Promise<{ connect?: string; next?: string; for?: string }> }) {
  const session = await settingsSession();
  // Where the person was heading when they were sent here to link a character (lib/clanScopedPaths).
  const cont = readContinue(await searchParams);
  const [characters, supporter, xpCheck] = await Promise.all([
    session.playerId ? settingsCharacters(session.playerId) : Promise.resolve([]),
    supporterForUser(session.userId),
    runningXpCheck(session.userId).catch(() => null),
  ]);

  return (
    <>
      <SettingsTitle title="Characters">
        Your RuneScape characters on Anvil. Play one with the Anvil plugin and it links itself; open a character to choose its clans, who
        sees it, or remove it.
      </SettingsTitle>
      <ContinueStrip fromUrl={cont} linked={characters.length} verified={characters.filter((c) => c.joinable).length} />
      {xpCheck && (
        <div className="mb-4 rounded-lg border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
          <p className="font-semibold text-gold">{xpCheckLine(xpCheck)}</p>
          <p className="mt-0.5 text-xs text-text-muted">
            Gain {xpCheck.minDelta.toLocaleString('en-US')} XP in {xpCheck.targetSkill ? xpCheck.targetSkill : 'the skill we picked'} before it runs out. You can leave this page and come back.{' '}
            <ClanLink href={`/settings/characters${cont ? `?${continueQuery(cont)}` : ''}#link-account`} className="text-gold hover:text-gold-light">
              Open the check →
            </ClanLink>
          </p>
        </div>
      )}
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
