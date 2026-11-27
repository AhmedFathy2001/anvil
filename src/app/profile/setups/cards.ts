// My setups' cards, worked out on the server: one per saved setup, with the item names its pictures use.

import type { InvItem } from '@/lib/guideTiers';
import { contentFromKey, TRIP_CONTENT } from '@/lib/tripContent';
import { presetTags } from '@/lib/tripSetupNames';
import type { SavedSetup } from '@/lib/tripSetups';

export interface SetupCard {
  id: number;
  accountId: number;
  content: string;
  contentName: string;
  contentShort: string;
  raid: boolean;
  name: string;
  tag: string | null;
  presets: string[];
  isDefault: boolean;
  shareClan: boolean;
  shareToken: string | null;
  gear: Record<string, number>;
  inventory: (InvItem | null)[];
  runePouch: InvItem[];
  spellbook: number | null;
  /** "3 days ago", worked out on the server. */
  saved: string;
}

/** "today", "yesterday", "3 days ago", "on 2026-10-02". */
export function savedWhen(iso: string, now: number): string {
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000);
  if (!Number.isFinite(days)) return '';
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return `on ${iso.slice(0, 10)}`;
}

const RAIDS = new Set(TRIP_CONTENT.filter((c) => c.instance).map((c) => c.key));

/** The card for a setup; the names of every item it shows go into `names`. */
export function cardOf(s: SavedSetup, byId: Map<number, string>, names: Record<number, string>, now: number): SetupCard {
  const c = contentFromKey(s.content);
  const inv = (s.setup.inventory ?? []).slice(0, 28);
  for (const id of [...Object.values(s.setup.gear), ...inv.map((x) => x?.id), ...(s.setup.runePouch ?? []).map((x) => x.id)]) {
    if (typeof id === 'number' && byId.has(id)) names[id] = byId.get(id)!;
  }
  return {
    id: s.id,
    accountId: s.accountId,
    content: s.content,
    contentName: c?.name ?? s.content,
    contentShort: c?.short ?? s.content,
    raid: RAIDS.has(s.content),
    name: s.name || s.setup.name,
    tag: s.tag,
    presets: [...presetTags(s.content)],
    isDefault: s.isDefault,
    shareClan: s.shareClan,
    shareToken: s.shareToken,
    gear: s.setup.gear,
    inventory: inv,
    runePouch: s.setup.runePouch ?? [],
    spellbook: s.setup.spellbook ?? null,
    saved: savedWhen(s.updatedAt, now),
  };
}
