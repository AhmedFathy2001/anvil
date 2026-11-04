/**
 * Which sections the one character profile (components/character/CharacterProfile) shows, by where
 * it is rendered and who is looking. Pure, so the whole matrix is testable without a database.
 *
 *   public — /p/<rsn> on the apex. Only reachable for a shared character, or by its owner.
 *   clan   — /c/<clan>/members/<rsn> and the owner's own locker (/c/<clan>/profile).
 *
 * "Owner" is not a page, it is a viewer: an owner sees their editable bits on every surface.
 *
 * RULE: no section is ever shown more widely than the stricter of the two pages showed it before
 * they were merged. Where one page lacked a section, the other page's gate came with it.
 */

export type ProfileContext = 'public' | 'clan';

export interface ProfileSectionInput {
  context: ProfileContext;
  /** The viewer owns this character. */
  viewerOwns: boolean;
  signedIn: boolean;
  /** accounts.shared — published beyond the clans it is in. */
  shared: boolean;
  /** The person behind the character (players.id), if any. */
  personId: number | null;
  /** That person's own switches. */
  owner: { banned: boolean; linkAccountsPublicly: boolean } | null | undefined;
}

export interface ProfileSections {
  /** Owner's banner/avatar and connected streams: only when they show their characters as one
      person, or to themselves (the same banner on two characters says they are one person). */
  personMedia: boolean;
  /** The Supporter display case. Always this character's pins only. */
  displayCase: boolean;
  /** Filter out pins from non-shared characters — everyone but the owner. */
  displayCasePublicView: boolean;
  /** Head-to-head record + Challenge. Its record is cross-clan, so only where /p/ would show it. */
  h2h: boolean;
  /** Links onto the platform pages (/p/, Wrapped, Compare), which answer only for shared or owner. */
  platformLinks: boolean;
  /** Clan placings, rank/guest/joined badges, account type, competition history, moments, radar. */
  clanSections: boolean;
  /** The persona (who plays this, their other accounts): signed-in clan viewers only. */
  persona: boolean;
  /** Clan chip, in-game clan chip, "also plays" — the apex's answer to "which clan?". */
  platformHeader: boolean;
  /** GoalsCard editing, the share link/toggle, the in-game clan toggle. */
  ownerControls: boolean;
  /** "Your characters" switcher on /p/ (the locker switches with its own card chips). */
  publicSwitcher: boolean;
}

export function personSectionsVisible(input: Pick<ProfileSectionInput, 'personId' | 'owner' | 'viewerOwns'>): boolean {
  if (input.personId == null) return false;
  if (input.viewerOwns) return true;
  return !!input.owner && !input.owner.banned && !!input.owner.linkAccountsPublicly;
}

export function profileSections(i: ProfileSectionInput): ProfileSections {
  const clan = i.context === 'clan';
  const platformOpen = i.shared || i.viewerOwns;
  return {
    // Shared (or the owner looking) as well: a banner or connected stream on a private character's
    // clan page would tie that private character to the person's public ones.
    personMedia: platformOpen && personSectionsVisible(i),
    displayCase: i.personId != null,
    displayCasePublicView: !i.viewerOwns,
    h2h: platformOpen,
    platformLinks: platformOpen,
    clanSections: clan,
    persona: clan && i.signedIn,
    platformHeader: !clan,
    ownerControls: i.viewerOwns,
    publicSwitcher: !clan && i.viewerOwns,
  };
}

/**
 * Which of the viewer's characters the locker shows: the one picked (?account=<rsn>) when it is one
 * of theirs here, else their main, else the first. Null when they hold no seat here.
 */
export function pickProfileCharacter<T extends { rsn: string; isPrimary: boolean }>(
  seats: readonly T[],
  focusRsn: string | null,
): T | null {
  return (
    (focusRsn != null ? seats.find((a) => a.rsn === focusRsn) : undefined) ??
    seats.find((a) => a.isPrimary) ??
    seats[0] ??
    null
  );
}
