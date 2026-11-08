import ClanLink from '@/components/ClanLink';

import SupporterName from '@/components/SupporterName';
import { emissionSettingsView } from '@/lib/emissionSettings';
import { supporterForUser } from '@/lib/supporter';
import { AnnouncementsGeneral, PluginPostsPanel } from '../EmissionPanels';
import { NeedsCharacter } from '../_none';
import { SettingsBlock, SettingsGroup, SettingsRow, SettingsTitle } from '../_ui';
import { settingsSession } from '@/app/settings/settingsSession';

export default async function AnnouncementsSettingsPage() {
  const session = await settingsSession();
  const [view, supporter] = await Promise.all([
    session.playerId ? emissionSettingsView(session.userId, session.playerId) : Promise.resolve(null),
    supporterForUser(session.userId),
  ]);

  return (
    <>
      <SettingsTitle title="Announcements">
        Where your drops, pets, deaths and combat achievements get posted in your clans&rsquo; Discords. Bingo submissions
        aren&rsquo;t affected: those always reach the clan running the board.
      </SettingsTitle>
      {!view || view.accounts.length === 0 ? (
        <NeedsCharacter what="Announcements" />
      ) : (
        <>
          <SettingsGroup title="Every character">
            <SettingsBlock>
              <AnnouncementsGeneral initial={view} />
            </SettingsBlock>
          </SettingsGroup>
          <SettingsGroup title="What your plugin posts" note="Once RuneLite settings; they follow you to every clan.">
            <SettingsBlock>
              <PluginPostsPanel initial={view} />
            </SettingsBlock>
          </SettingsGroup>
          <SettingsGroup title="Per character" note="Which clans each character announces in is set on that character's page.">
            {view.accounts.map((a) => (
              <SettingsRow
                key={a.accountId}
                label={<SupporterName name={a.rsn} tier={supporter?.tier.id} style={supporter?.style} plain />}
                description={
                  [a.memberClan ? `Member of ${a.memberClan.name}` : 'No member clan', a.clans.length ? `${a.clans.length} other clan${a.clans.length === 1 ? '' : 's'}` : null]
                    .filter(Boolean)
                    .join(' · ')
                }
              >
                <ClanLink href={`/settings/characters/${a.accountId}#clans`} className="text-[13px] text-gold hover:text-gold-light">
                  Clans →
                </ClanLink>
              </SettingsRow>
            ))}
          </SettingsGroup>
        </>
      )}
    </>
  );
}
