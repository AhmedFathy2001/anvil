// How a Supporter's RuneScape characters wear their name colours, read off what is stored. Pure, no
// database, so the settings screen and its tests share one reading.
//
// Storage has two levels and nothing else:
//   users.supporter_style     the Anvil display name's look
//   accounts.supporter_style  one character's look; NULL means "wear the Anvil name's look"
// "Save for all characters" writes the same look into every character row. So the screen's
// "Same as my Anvil name" vs "A separate look for my characters" is read from the rows: whichever
// most characters do wins (NULL rows vs the most common stored look), and any character that does
// something else is customized.

import type { SupporterLookStyle, SupporterStyle } from './supporterStyle.ts';

/** One look reduced to what matters for comparing: the default is `{}`, `null` and `{}` alike. */
export function normalSupporterStyle(s: SupporterStyle | null | undefined): SupporterStyle {
  if (!s) return {};
  const look = (l: SupporterLookStyle | undefined): SupporterLookStyle =>
    l?.stops?.length ? { stops: l.stops } : l?.preset ? { preset: l.preset } : {};
  return { ...look(s), ...(s.dark ? { dark: look(s.dark) } : {}), ...(s.light ? { light: look(s.light) } : {}) };
}

/** A stable key for a look, for grouping and equality. */
export function supporterStyleKey(s: SupporterStyle | null | undefined): string {
  return JSON.stringify(normalSupporterStyle(s));
}

export const isDefaultSupporterStyle = (s: SupporterStyle | null | undefined): boolean => supporterStyleKey(s) === '{}';

/** A character as stored: `style` null follows the Anvil name. */
export interface CharacterLookRow {
  accountId: number;
  style: SupporterStyle | null;
}

export interface CharacterLookPlan {
  /** 'same': characters follow the Anvil name. 'separate': they share a look of their own. */
  mode: 'same' | 'separate';
  /** The characters' shared look when 'separate'; null when 'same' (the Anvil name's look). */
  shared: SupporterStyle | null;
  /** Characters that differ from the mode's default: their own look, or NULL under 'separate'. */
  customized: Set<number>;
}

const INHERIT = '\u0000inherit';

/**
 * Read the mode off the stored rows. NULL rows vote for 'same'; the largest group of identical
 * stored looks votes for 'separate' (ties go to the earlier character, the list being primary
 * first). A tie between the two goes to 'same', the default.
 *
 * `prefer` (supporterStyleKey of the shared look the screen showed before an edit) wins ties, so
 * customizing one of two characters doesn't swap which look counts as the shared one.
 */
export function characterLookPlan(rows: readonly CharacterLookRow[], prefer: string | null = null): CharacterLookPlan {
  const groups = new Map<string, { count: number; style: SupporterStyle | null }>();
  for (const r of rows) {
    const key = r.style == null ? INHERIT : supporterStyleKey(r.style);
    const g = groups.get(key);
    if (g) g.count += 1;
    else groups.set(key, { count: 1, style: r.style });
  }
  const inherit = groups.get(INHERIT)?.count ?? 0;
  let best: { key: string; count: number; style: SupporterStyle | null } | null = null;
  for (const [key, g] of groups) {
    if (key === INHERIT) continue;
    if (!best || g.count > best.count || (g.count === best.count && key === prefer)) best = { key, ...g };
  }
  if (!best || inherit > best.count || (inherit === best.count && best.key !== prefer)) {
    return { mode: 'same', shared: null, customized: new Set(rows.filter((r) => r.style != null).map((r) => r.accountId)) };
  }
  const sharedKey = best.key;
  return {
    mode: 'separate',
    shared: best.style,
    customized: new Set(rows.filter((r) => r.style == null || supporterStyleKey(r.style) !== sharedKey).map((r) => r.accountId)),
  };
}

/**
 * What "Use the default" stores for one character: NULL (follow the Anvil name) under 'same', the
 * characters' shared look under 'separate'.
 */
export function characterDefaultStyle(plan: CharacterLookPlan): SupporterStyle | null {
  return plan.mode === 'same' ? null : plan.shared;
}

/** The look a character is actually wearing: its own row, else the Anvil name's. */
export function wornCharacterStyle(row: CharacterLookRow, accountStyle: SupporterStyle | null): SupporterStyle | null {
  return row.style ?? accountStyle;
}
