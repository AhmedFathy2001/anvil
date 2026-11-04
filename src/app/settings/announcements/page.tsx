import ClanLink from '@/components/ClanLink';

import { verifyUser } from '@/lib/auth';
import { emissionSettingsView } from '@/lib/emissionSettings';
import { AnnouncementsGeneral } from '../EmissionPanels';
import { NeedsCharacter } from '../_none';
import { SettingsBlock, SettingsGroup, SettingsRow, SettingsTitle } from '../_ui';

export default async function AnnouncementsSettingsPage() {
  const session = (await verifyUser())!;
  const view = session.playerId ? await emissionSettingsView(session.userId, session.playerId) : null;

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
          <SettingsGroup title="Per character" note="Which clans each character announces in is set on that character's page.">
            {view.accounts.map((a) => (
              <SettingsRow
                key={a.accountId}
                label={a.rsn}
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
