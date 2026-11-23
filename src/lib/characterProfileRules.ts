/**
 * Which sections the one character profile (components/character/CharacterProfile) shows, by where
 * it is rendered and who is looking. Pure, so the whole matrix is testable without a database.
 *
 *   public — /p/<rsn> on the apex.
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
  /** The person behind the character (players.id), if any. */
  personId: number | null;
  /** That person's own switches. */
  owner: { banned: boolean; linkAccountsPublicly: boolean } | null | undefined;
}

export interface ProfileSections {
  /** Owner's uploaded banner/avatar: shown on every character of theirs by default (the owner's call,
      7 Nov 2026), unless they are banned. */
  personMedia: boolean;
  /** Connected streams: only when they show their characters as one person, or to themselves. */
  personStreams: boolean;
  /** The Supporter display case. Always this character's pins only. */
  displayCase: boolean;
  /** Clan placings, rank/guest/joined badges, account type, competition history, moments, radar. */
  clanSections: boolean;
  /** The persona (who plays this, their other accounts): signed-in clan viewers only. */
  persona: boolean;
  /** Clan chip, in-game clan chip, "also plays" — the apex's answer to "which clan?". */
  platformHeader: boolean;
  /** GoalsCard editing, the share link. */
  ownerControls: boolean;
  /** "Your characters" switcher on /p/ (the locker switches with its own card chips). */
  publicSwitcher: boolean;
}

/** A person's own uploads on their characters: on by default; a banned person's are not shown. */
export function personMediaVisible(input: Pick<ProfileSectionInput, 'personId' | 'owner' | 'viewerOwns'>): boolean {
  if (input.personId == null) return false;
  return input.viewerOwns || (!!input.owner && !input.owner.banned);
}

export function personSectionsVisible(input: Pick<ProfileSectionInput, 'personId' | 'owner' | 'viewerOwns'>): boolean {
  if (input.personId == null) return false;
  if (input.viewerOwns) return true;
  return !!input.owner && !input.owner.banned && !!input.owner.linkAccountsPublicly;
}

export function profileSections(i: ProfileSectionInput): ProfileSections {
  const clan = i.context === 'clan';
  return {
    personMedia: personMediaVisible(i),
    personStreams: personSectionsVisible(i),
    displayCase: i.personId != null,
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
