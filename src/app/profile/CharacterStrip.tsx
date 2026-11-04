import ClanLink from '@/components/ClanLink';
import SupporterName from '@/components/SupporterName';
import { ProfileAvatar } from '@/components/ProfileMedia';
import { fullProfileHref, type FoldCharacter } from '@/lib/characterFold';
import type { ShownMedia } from '@/lib/profileMediaRules';
import type { SupporterStyle } from '@/lib/supporterStyle';
import type { SupporterTierId } from '@/lib/supporterTiers';
import CharacterFold from './CharacterFold';

/**
 * The top of /profile's CHARACTER VIEW (?account=<rsn>): the person shrunk to one strip — "← Ahmed"
 * back to the overview, the fold to switch character — and that character's own doors (its settings,
 * the page others see). The character's profile is the page from here down.
 */
export default function CharacterStrip({
  displayName,
  supporterTier = null,
  supporterStyle = null,
  avatar,
  customAvatar = null,
  characters,
  selected,
  space,
}: {
  displayName: string;
  supporterTier?: SupporterTierId | null;
  supporterStyle?: SupporterStyle | null;
  avatar: string | null;
  customAvatar?: ShownMedia | null;
  characters: FoldCharacter[];
  selected: FoldCharacter;
  space: boolean;
}) {
  return (
    <section
      aria-label="Your characters"
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-card-border bg-card-bg px-4 py-3 sm:px-5"
    >
      {/* A link, not history.back(): a deep link has no overview behind it to go back to. */}
      <ClanLink
        href="/profile"
        className="inline-flex min-w-0 items-center gap-2 text-sm text-text-muted transition-colors hover:text-gold-light"
        aria-label={`Back to ${displayName}'s overview`}
      >
        <span aria-hidden>←</span>
        {customAvatar ? (
          <ProfileAvatar avatar={customAvatar} size={28} className="border border-gold/45" />
        ) : avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded-full border border-gold/45" />
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/45 bg-gold/15 text-xs font-bold text-gold-light">
            {(displayName || '?').charAt(0).toUpperCase()}
          </span>
        )}
        <SupporterName name={displayName} tier={supporterTier} style={supporterStyle} plain className="truncate font-semibold text-foreground" />
      </ClanLink>

      <div className="flex flex-wrap items-start gap-2">
        <CharacterFold
          characters={characters}
          selectedRsn={selected.rsn}
          supporterTier={supporterTier}
          supporterStyle={supporterStyle}
          space={space}
        />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] sm:ml-auto">
        <ClanLink
          href={`/settings/characters/${selected.accountId}`}
          className="text-text-muted hover:text-gold"
          aria-label={`Settings for ${selected.rsn}`}
        >
          ⚙ {selected.rsn} settings
        </ClanLink>
        <ClanLink href={fullProfileHref(selected, space)} className="text-gold hover:underline">
          View full profile →
        </ClanLink>
      </div>
    </section>
  );
}
