import ClanLink from '@/components/ClanLink';

import SupporterName from '@/components/SupporterName';
import { emissionSettingsView } from '@/lib/emissionSettings';
import { supporterForUser } from '@/lib/supporter';
import { AnnouncementsGeneral, PluginPostsPanel } from '../EmissionPanels';
import { NeedsCharacter } from '../_none';
import { SettingsBlock, SettingsGroup, SettingsRow } from '../_ui';
import { settingsSession } from '@/app/settings/settingsSession';

/** The page's sections, as the strip under the title links them (ids also used by lib/memberSettingsIndex). */
const JUMPS = [
  { id: 'posts-drops', label: 'Drops & pets' },
  { id: 'posts-deaths', label: 'Deaths & PvP' },
  { id: 'posts-achievements', label: 'Achievements' },
  { id: 'screenshot-privacy', label: 'Screenshot privacy' },
  { id: 'where-posts-go', label: 'Which clans' },
  { id: 'per-character', label: 'Per character' },
];

/**
 * Discord posts & screenshots, on Posts & alerts (/settings/posts#discord-posts redirects here: the plugin and old links use
 * it). Was titled "Announcements", which said nothing about screenshot privacy living here too.
 */
export async function PostsGroups() {
  const session = await settingsSession();
  const [view, supporter] = await Promise.all([
    session.playerId ? emissionSettingsView(session.userId, session.playerId) : Promise.resolve(null),
    supporterForUser(session.userId),
  ]);

  return (
    <>
      {!view || view.accounts.length === 0 ? (
        <NeedsCharacter what="Discord posts" />
      ) : (
        <>
          <nav aria-label="Discord posts sections" className="mb-6 flex flex-wrap items-center gap-x-1 gap-y-2 text-[13px]">
            <span className="mr-1 text-text-dim">Jump to:</span>
            {JUMPS.map((j) => (
              <a
                key={j.id}
                href={`#${j.id}`}
                className="rounded-full border border-card-border bg-card-bg px-2.5 py-0.5 text-text-muted transition-colors hover:border-gold/40 hover:text-foreground"
              >
                {j.label}
              </a>
            ))}
          </nav>
          <SettingsGroup
            title="What your plugin posts"
            id="plugin-posts"
            note="These used to be in RuneLite: they now follow you to every computer, and to every clan."
          >
            <SettingsBlock>
              <PluginPostsPanel initial={view} />
            </SettingsBlock>
          </SettingsGroup>
          <SettingsGroup title="Where your posts go" id="where-posts-go">
            <SettingsBlock>
              <AnnouncementsGeneral initial={view} />
            </SettingsBlock>
          </SettingsGroup>
          <SettingsGroup title="Per character" id="per-character" note="Which clans each character announces in is set on that character's page.">
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
