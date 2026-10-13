import { fetchGuildWidget, platformGuildId } from '@/lib/discordWidget';
import { mergeClanHall } from '@/lib/clanHallMerge';
import { SITE } from '@/lib/site';

/**
 * Anvil's own Discord, on the platform pages: one line with who's there and a way in. The same
 * widget and counting as a clan's card (lib/clanHallMerge), minus the roster — the apex has none.
 * Nothing at all when the server or its widget is unavailable.
 */
export default async function PlatformDiscordStrip() {
  const guildId = platformGuildId();
  if (!guildId || !SITE.supportDiscord) return null;
  const result = await fetchGuildWidget(guildId);
  if (!result.ok) return null;
  const { counts } = mergeClanHall({
    widget: result.widget,
    roster: [],
    weekXp: new Map(),
    teamByAccount: new Map(),
    inviteUrl: SITE.supportDiscord,
    includeNames: false,
  });

  return (
    <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-6 sm:px-6">
      <span className="text-sm font-semibold">Anvil on Discord</span>
      <span className="flex flex-wrap gap-3 text-[13px] text-text-muted tabular-nums">
        <span>
          <i className="mr-1.5 inline-block h-[7px] w-[7px] rounded-full bg-accent-green-light" />
          {counts.discord} online
        </span>
        {counts.inGame > 0 && <span className="text-gold-light">{counts.inGame} in game</span>}
      </span>
      <a
        // Counted, then on to the invite (api/discord/join).
        href="/api/discord/join?src=footer"
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-card-border px-3 py-1.5 text-[12.5px] text-text-muted transition-colors hover:border-gold/45 hover:text-foreground"
      >
        Setup help and bug reports
      </a>
    </div>
  );
}
