// Sample Discord posts: every in-game post type built by the real builders from made-up facts (a
// player called Zezima, a stand-in screenshot), so staff can send them to any channel and see how
// each one looks (/staff/discord → Preview posts). Nothing here is real or stored.
//
// Bingo event posts (tile complete, submissions, reveals, standings, payouts) are composed inside the
// functions that send them (lib/discord) and aren't here yet.

import { proxyWikiUrl } from '@/lib/assetUrls';
import { currentSupporterEmbed, newSupporterEmbed } from '@/lib/anvilDiscord';
import { playerEventEmbed } from '@/lib/discordEmbeds';
import { modeEventEmbed } from '@/lib/modeLines';
import { buildPluginEmbed } from '@/lib/pluginEmbeds';
import { parseReleaseNote, releaseEmbed } from '@/lib/releaseNotes';
import { absoluteAssetUrl, apexOrigin } from '@/lib/seo';
import { withSupporterAuthor } from '@/lib/supporterTiers';
import { markMode, resolveWorldMode } from '@/lib/worldModes';

export interface DiscordSample {
  id: string;
  group: 'In-game posts' | 'Game modes' | 'Supporters' | 'Releases';
  label: string;
  embed: () => Record<string, unknown>;
}

/** Stands in for the player's screenshot. */
const SCREENSHOT = () => absoluteAssetUrl(proxyWikiUrl('https://oldschool.runescape.wiki/images/Vorkath.png'));

function plugin(kind: string, facts: Record<string, unknown>, screenshot = true): () => Record<string, unknown> {
  return () => {
    const built = buildPluginEmbed(kind, facts, {});
    if (!built.ok) return { title: `Sample failed: ${built.error}` };
    const e = built.embed as unknown as Record<string, unknown>;
    return screenshot ? { ...e, image: { url: SCREENSHOT() } } : e;
  };
}

const ZEZ = { rsn: 'Zezima' };

const RELEASE = `---
version: 9.9.9
title: A sample release
---
## Highlights
- One line about the biggest thing in this release.

## New
- Something players can now do.

## Improved
- Something that got better.

## Fixed
- Something that was broken and isn't now.
`;

export const DISCORD_SAMPLES: readonly DiscordSample[] = [
  {
    id: 'drop.rare',
    group: 'In-game posts',
    label: 'Rare drop',
    embed: plugin('drop', {
      ...ZEZ, source: 'Vorkath', sourceKind: 'npc', kc: 54, dropRate: 1 / 1000,
      items: [{ id: 22111, name: 'Dragonbone necklace', qty: 1, value: 12_345_678 }],
    }),
  },
  {
    id: 'drop.spoon',
    group: 'In-game posts',
    label: 'Lucky drop (spooned)',
    embed: plugin('drop', {
      ...ZEZ, source: 'Vorkath', sourceKind: 'npc', kc: 1, dropRate: 1 / 5000, spoon: true,
      items: [{ id: 22006, name: 'Skeletal visage', qty: 1, value: 8_500_000 }],
    }),
  },
  {
    id: 'drop.valuable',
    group: 'In-game posts',
    label: 'Valuable loot (several items)',
    embed: plugin('drop', {
      ...ZEZ, source: 'Chambers of Xeric', sourceKind: 'event', kc: 312,
      items: [
        { id: 20997, name: 'Twisted bow', qty: 1, value: 1_250_000_000 },
        { id: 21043, name: 'Kodai insignia', qty: 1, value: 95_000_000 },
      ],
    }),
  },
  {
    id: 'pet',
    group: 'In-game posts',
    label: 'Pet',
    embed: plugin('pet', { ...ZEZ, name: 'Vorki', itemId: 21992, source: 'Vorkath', kc: 1_500, dropRate: 1 / 3000 }),
  },
  {
    id: 'clogSlot',
    group: 'In-game posts',
    label: 'Collection log slot',
    embed: plugin('clogSlot', { ...ZEZ, item: 'Abyssal whip', itemId: 4151, slots: 548, slotsMax: 1712, source: 'Abyssal demon', kc: 2500 }, false),
  },
  {
    id: 'caTask',
    group: 'In-game posts',
    label: 'Combat task',
    embed: plugin('caTask', { ...ZEZ, tier: 'Grandmaster', task: 'Perfect Zulrah', totalPoints: 2500, nextThreshold: 0 }, false),
  },
  { id: 'caTier', group: 'In-game posts', label: 'Combat task tier', embed: plugin('caTier', { ...ZEZ, tier: 'Elite' }, false) },
  { id: 'diary', group: 'In-game posts', label: 'Achievement diary', embed: plugin('diary', { ...ZEZ, area: 'Lumbridge & Draynor', tier: 'Elite' }, false) },
  { id: 'quest', group: 'In-game posts', label: 'Quest', embed: plugin('quest', { ...ZEZ, quest: 'Dragon Slayer II', difficulty: 'Grandmaster' }, false) },
  { id: 'level99', group: 'In-game posts', label: 'Level 99', embed: plugin('level99', { ...ZEZ, skill: 'Slayer', at99: 12, skills: 23 }, false) },
  { id: 'level', group: 'In-game posts', label: 'Level up', embed: plugin('level', { ...ZEZ, skill: 'Agility', level: 90, at99: 12, skills: 23 }, false) },
  { id: 'totalLevel', group: 'In-game posts', label: 'Total level milestone', embed: plugin('totalLevel', { ...ZEZ, total: 2200, maxed: false, milestone: 2200 }, false) },
  {
    id: 'death',
    group: 'In-game posts',
    label: 'Death',
    embed: () => ({ ...playerEventEmbed({ kind: 'death', rsn: 'Zezima', message: 'Zezima has died to Vorkath. Better luck next time!' }), image: { url: SCREENSHOT() } }),
  },
  {
    id: 'pvp',
    group: 'In-game posts',
    label: 'PvP kill',
    embed: () => ({ ...playerEventEmbed({ kind: 'pvp_kill', rsn: 'Zezima', message: 'Zezima has defeated Lynx Titan in the Wilderness.' }), image: { url: SCREENSHOT() } }),
  },
  {
    id: 'supporter.drop',
    group: 'Supporters',
    label: "A Patron's drop (gradient star)",
    embed: () =>
      withSupporterAuthor(
        plugin('drop', { ...ZEZ, source: 'Zulrah', sourceKind: 'npc', kc: 400, dropRate: 1 / 512, items: [{ id: 12922, name: 'Tanzanite fang', qty: 1, value: 2_100_000 }] })(),
        'patron',
        apexOrigin(),
      ),
  },
  { id: 'supporter.new', group: 'Supporters', label: 'New supporter', embed: () => newSupporterEmbed('Zezima', 'champion', apexOrigin()) },
  {
    id: 'supporter.current',
    group: 'Supporters',
    label: 'Supporter since (announce current supporters)',
    embed: () => currentSupporterEmbed('Zezima', 'patron', '2026-03-01T00:00:00Z', apexOrigin()),
  },
  {
    id: 'mode.relic',
    group: 'Game modes',
    label: 'Leagues relic',
    embed: () => {
      const mode = resolveWorldMode('MEMBERS,SEASONAL', 'Leagues')!;
      return markMode(modeEventEmbed('Relic unlocked: Endless Harvest', 'Zezima'), mode.label, mode.icon ? absoluteAssetUrl(proxyWikiUrl(mode.icon)) : null)!;
    },
  },
  {
    id: 'mode.drop',
    group: 'Game modes',
    label: 'Deadman drop',
    embed: () => {
      const mode = resolveWorldMode('DEADMAN,MEMBERS', 'Deadman')!;
      const drop = plugin('drop', { ...ZEZ, source: 'Revenant knight', sourceKind: 'npc', kc: 40, items: [{ id: 22542, name: "Viggora's chainmace (u)", qty: 1, value: 30_000_000 }] })();
      return markMode(drop, mode.label, mode.icon ? absoluteAssetUrl(proxyWikiUrl(mode.icon)) : null)!;
    },
  },
  { id: 'release', group: 'Releases', label: 'Release announcement', embed: () => releaseEmbed(parseReleaseNote(RELEASE), apexOrigin()) },
];

export function sampleById(id: string): DiscordSample | undefined {
  return DISCORD_SAMPLES.find((s) => s.id === id);
}
