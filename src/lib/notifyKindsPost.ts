/**
 * The newer kinds' posts (lib/notifyKinds), from what the plugin reported to the embed Discord shows.
 *
 * Nothing on the request is trusted. A `line` must satisfy one of the person's OWN watches in force
 * right now (the same list the plugin was sent), gate included, or it is declined. A private kind
 * (GE, trade, storage, another plugin) needs the person's own switch, and only ever goes to their own
 * webhooks. The wording is read off the line here with fixed, anchored patterns on a capped string.
 *
 * Pure: the route loads the settings and routes the result.
 */

import { milestoneOf, type MilestoneFacts } from '@/lib/milestoneMoments';
import { clamp, LIMIT, type DiscordEmbed, type DiscordEmbedField } from '@/lib/discordEmbeds';
import {
  isNewKind,
  matchWatch,
  resolveKind,
  watchesFor,
  type ClanKinds,
  type NewKind,
  type PersonalKinds,
} from '@/lib/notifyKinds';

/** Kinds the plugin may send for these posts. */
export const NEW_POST_KINDS = ['line', 'ge', 'trade', 'storage', 'ext'] as const;
export const isNewPostKind = (k: unknown): k is (typeof NEW_POST_KINDS)[number] =>
  typeof k === 'string' && (NEW_POST_KINDS as readonly string[]).includes(k);

export interface NewKindPost {
  /** The settings kind: what a personal webhook subscribes to. */
  kind: NewKind;
  /** True when no clan channel may take it: private kinds and the person's own patterns. */
  personalOnly: boolean;
  embed: DiscordEmbed;
}

const LINE_MAX = 400;
const TEXT_MAX = 200;
const COLOR = { milestone: 0x4a90d9, trade: 0xd4a017, plugin: 0x7f8c8d } as const;

const o = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const int = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) ? v : null);
const gp = (n: number) => `${Math.abs(n).toLocaleString('en-US')} gp`;
const num = (v: string | undefined) => (v ? Number(v.replace(/,/g, '')) : null);
/** Discord markdown off free text, so a line can't restyle or link the post. */
const plain = (t: string) => t.replace(/[*_~`|>[\]()\\]/g, '').replace(/@/g, '@​');

function embed(rsn: string, title: string, description: string, color: number, fields?: DiscordEmbedField[]): DiscordEmbed {
  const e: DiscordEmbed = {};
  if (rsn) e.author = { name: clamp(rsn, LIMIT.author) };
  e.title = clamp(title, LIMIT.title);
  e.description = clamp(description, LIMIT.description);
  e.color = color;
  if (fields?.length) e.fields = fields;
  return e;
}

/** How a matched line reads. `n` is the number the watch's gate read. */
export function lineEmbed(kind: string, line: string, rsn: string, every: number): DiscordEmbed {
  const who = rsn ? `**${plain(rsn)}**` : 'A clan member';
  switch (kind) {
    case 'slayer': {
      const m = /completed ([\d,]+) tasks?\b.*?total of ([\d,]+)/i.exec(line);
      const streak = num(m?.[1]);
      const points = num(m?.[2]);
      const tail = streak != null ? ` Streak **${streak.toLocaleString('en-US')}**${points != null ? `, **${points.toLocaleString('en-US')}** points` : ''}.` : '';
      return embed(rsn, every > 1 ? '🗡️ Slayer streak milestone!' : '🗡️ Slayer task complete!', `${who} finished a Slayer task.${tail}`, COLOR.milestone);
    }
    case 'clues': {
      const m = /completed ([\d,]+) (\w+) treasure trails?/i.exec(line);
      const count = num(m?.[1]);
      const tier = m?.[2]?.toLowerCase() ?? 'clue';
      return embed(rsn, '🧭 Clue scroll complete!', `${who} completed a **${tier}** clue scroll${count != null ? ` — **${count.toLocaleString('en-US')}** so far` : ''}.`, COLOR.milestone);
    }
    case 'speedruns': {
      const pb = /new personal best/i.test(line);
      return embed(rsn, pb ? '⏱️ New personal best!' : '⏱️ Speedrun time', `${who}: ${plain(line)}`, COLOR.milestone);
    }
    case 'kc': {
      const m = /^your (.{1,80}) count is: ([\d,]+)/i.exec(line);
      const what = m ? plain(m[1]) : 'kill';
      const n = num(m?.[2]);
      return embed(rsn, '🔢 Kill count milestone!', `${who} reached **${n != null ? n.toLocaleString('en-US') : '?'}** — ${what} count.`, COLOR.milestone);
    }
    case 'ba': {
      const m = /(\w+ level )?gamble count: ([\d,]+)/i.exec(line);
      const n = num(m?.[2]);
      return embed(rsn, '🎲 Barbarian Assault gamble!', `${who} reached **${n != null ? n.toLocaleString('en-US') : '?'}** ${m?.[1]?.toLowerCase() ?? ''}gambles.`, COLOR.milestone);
    }
    default:
      return embed(rsn, '💬 Game message', `${who}: ${plain(line)}`, COLOR.milestone);
  }
}

interface Item {
  name: string;
  qty: number;
  value: number;
}

function items(raw: unknown): Item[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 30).flatMap((it) => {
    const x = o(it);
    const name = s(x.name, 64);
    const qty = int(x.qty);
    const value = int(x.value) ?? 0;
    return name && qty ? [{ name: plain(name), qty, value }] : [];
  });
}

const list = (xs: Item[]) =>
  clamp(xs.map((i) => `${Math.abs(i.qty).toLocaleString('en-US')} × ${i.name}${i.value ? ` (${gp(i.value)})` : ''}`).join('\n'), LIMIT.fieldValue);
const total = (xs: Item[]) => xs.reduce((a, i) => a + Math.abs(i.value), 0);

/**
 * Vet one reported post against the person's settings in force, and build it. Null = declined (off,
 * below its gate, a line no watch of theirs matches, or a malformed body).
 */
export function vetNewKindPost(postKind: string, rawFacts: unknown, personal: PersonalKinds, clan: ClanKinds): NewKindPost | null {
  const f = o(rawFacts);
  const rsn = s(f.rsn, 12);
  const who = rsn ? `**${plain(rsn)}**` : 'A clan member';
  switch (postKind) {
    case 'line': {
      const k = s(f.k, 16);
      const line = s(f.line, LINE_MAX);
      if (!isNewKind(k) || !line) return null;
      const hit = matchWatch(line, k, watchesFor(personal, clan));
      if (!hit) return null;
      return { kind: k, personalOnly: k === 'custom' && hit.watch.from === 'own', embed: lineEmbed(k, line, rsn, hit.watch.every) };
    }
    case 'ge': {
      const r = resolveKind('ge', personal);
      const value = int(f.value);
      const qty = int(f.qty);
      const item = plain(s(f.item, 64));
      if (!r.on || value == null || value < r.min || !qty || !item) return null;
      const sold = f.sold === true;
      return {
        kind: 'ge',
        personalOnly: true,
        embed: embed(rsn, sold ? '💰 Grand Exchange: sold' : '💰 Grand Exchange: bought', `${who} ${sold ? 'sold' : 'bought'} **${qty.toLocaleString('en-US')} × ${item}** for **${gp(value)}**.`, COLOR.trade),
      };
    }
    case 'trade':
    case 'storage': {
      if (!resolveKind(postKind, personal).on) return null;
      const all = items(f.items);
      const out = all.filter((i) => i.qty < 0);
      const inn = all.filter((i) => i.qty > 0);
      if (!all.length) return null;
      const trade = postKind === 'trade';
      const fields: DiscordEmbedField[] = [];
      if (out.length) fields.push({ name: trade ? `Gave (${gp(total(out))})` : `Deposited (${gp(total(out))})`, value: list(out) });
      if (inn.length) fields.push({ name: trade ? `Got (${gp(total(inn))})` : `Withdrew (${gp(total(inn))})`, value: list(inn) });
      return {
        kind: postKind,
        personalOnly: true,
        embed: embed(rsn, trade ? '🤝 Trade completed' : '📦 Group storage', trade ? `${who} completed a trade.` : `${who} changed the group storage.`, COLOR.trade, fields),
      };
    }
    case 'ext': {
      const source = s(f.source, 40);
      const text = plain(s(f.text, TEXT_MAX));
      if (!resolveKind('ext', personal).on || !source || !text) return null;
      if (!personal.extSources.some((x) => x.toLowerCase() === source.toLowerCase())) return null;
      return { kind: 'ext', personalOnly: true, embed: embed(rsn, `🔌 ${plain(source)}`, `${who}: ${text}`, COLOR.plugin) };
    }
  }
  return null;
}

/**
 * The clan feed row a reported post makes, or null: only a shared line kind that the player has on
 * right now (the same vetting as the Discord post), never a private kind or a player's own pattern.
 */
export function milestoneForFeed(postKind: string, rawFacts: unknown, personal: PersonalKinds, clan: ClanKinds): MilestoneFacts | null {
  if (postKind !== 'line') return null;
  const post = vetNewKindPost(postKind, rawFacts, personal, clan);
  if (!post || post.personalOnly) return null;
  return milestoneOf(post.kind, s(o(rawFacts).line, LINE_MAX));
}
