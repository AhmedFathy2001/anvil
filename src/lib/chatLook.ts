// How Anvil's chat lines look in game, and which of that a Supporter tier unlocks. Pure.
//
// Every line carries a TONE (lib/chatFeedRules TONES); the plugin colours it from the palette the
// site hands it at login. 'anvil' is the default set below, 'plain' tells the plugin to use its own
// prefix/text colours for everything (its existing settings), and 'custom' is the person's own
// colours — a Supporter perk. Choosing what the login brief covers is Champion and up.

import { type BriefItem, type ChatFeedPrefs, DEFAULT_BRIEF, type Palette, TONES, type Tone } from '@/lib/chatFeedRules';
import { SUPPORTER_TIER_ORDER, type SupporterTierId } from '@/lib/supporterTiers';

/** Picked to read on both the transparent and the opaque chatbox. */
export const ANVIL_COLORS: Record<Tone, string> = {
  done: '#16c60c',
  near: '#ffb000',
  drop: '#ff7f27',
  feed: '#9a9a9a',
  warn: '#ff3b3b',
  info: '#ffffff',
};

const atLeast = (tier: SupporterTierId | null | undefined, need: SupporterTierId) =>
  !!tier && SUPPORTER_TIER_ORDER.indexOf(tier) >= SUPPORTER_TIER_ORDER.indexOf(need);

export const canCustomColors = (tier: SupporterTierId | null | undefined) => atLeast(tier, 'supporter');
export const canShapeBrief = (tier: SupporterTierId | null | undefined) => atLeast(tier, 'champion');
export const hasChatStar = (tier: SupporterTierId | null | undefined) => atLeast(tier, 'patron');

export interface ChatLook {
  palette: Exclude<Palette, 'custom'> | 'custom';
  /** Hex per tone without '#', or null for 'plain' (the plugin's own colours). */
  colors: Record<Tone, string> | null;
}

/** What the plugin is told, with the perks the person's tier doesn't cover folded back to defaults. */
export function effectiveLook(prefs: ChatFeedPrefs, tier: SupporterTierId | null | undefined): ChatLook {
  if (prefs.palette === 'plain') return { palette: 'plain', colors: null };
  const custom = prefs.palette === 'custom' && canCustomColors(tier);
  const colors = {} as Record<Tone, string>;
  for (const t of TONES) colors[t] = ((custom && prefs.colors[t]) || ANVIL_COLORS[t]).slice(1);
  return { palette: custom ? 'custom' : 'anvil', colors };
}

export function effectiveBrief(prefs: ChatFeedPrefs, tier: SupporterTierId | null | undefined): BriefItem[] {
  return canShapeBrief(tier) ? prefs.brief : DEFAULT_BRIEF;
}
