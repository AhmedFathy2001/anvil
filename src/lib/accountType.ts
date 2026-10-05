// A character's game mode — ironman and friends.
//
// The source is the plugin, reading the in-game IRONMAN varbit (VarbitID.IRONMAN = 1777) on the
// logged-in character. The hiscores can't do this job: they have separate ironman / hardcore /
// ultimate tables (one extra lookup each, from a scarce poll budget) and no group-ironman tables at
// all, so GIM, hardcore GIM and unranked GIM are indistinguishable there.
//
// Raw values: 0 normal, 1 ironman, 2 ultimate, 3 hardcore, 4 group, 5 hardcore group — the order of
// RuneLite's own (deprecated) AccountType enum. 6 = unranked group is from the game's later addition
// and not in that enum; anything else is ignored rather than guessed.
//
// Pure — no @/db — so the plugin route and the tests can both use it.

export const ACCOUNT_TYPES = ['normal', 'ironman', 'ultimate', 'hardcore', 'group', 'hardcore_group', 'unranked_group'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** The varbit's raw value → our name, or null for anything we don't recognise. */
export function accountTypeFromVarbit(raw: unknown): AccountType | null {
  if (typeof raw !== 'number' || !Number.isInteger(raw)) return null;
  return ACCOUNT_TYPES[raw] ?? null;
}

export function isAccountType(v: unknown): v is AccountType {
  return typeof v === 'string' && (ACCOUNT_TYPES as readonly string[]).includes(v);
}

const LABEL: Record<AccountType, string> = {
  normal: 'Regular',
  ironman: 'Ironman',
  ultimate: 'Ultimate Ironman',
  hardcore: 'Hardcore Ironman',
  group: 'Group Ironman',
  hardcore_group: 'Hardcore Group Ironman',
  unranked_group: 'Unranked Group Ironman',
};

const SHORT: Record<AccountType, string> = {
  normal: '',
  ironman: 'IM',
  ultimate: 'UIM',
  hardcore: 'HCIM',
  group: 'GIM',
  hardcore_group: 'HCGIM',
  unranked_group: 'UGIM',
};

/** "Hardcore Ironman" — or null for an unknown value. */
export function accountTypeLabel(v: string | null | undefined): string | null {
  return isAccountType(v) ? LABEL[v] : null;
}

/** "HCIM" — or null when there is nothing worth a badge (unknown, or a regular account). */
export function accountTypeBadge(v: string | null | undefined): string | null {
  return isAccountType(v) && SHORT[v] ? SHORT[v] : null;
}
