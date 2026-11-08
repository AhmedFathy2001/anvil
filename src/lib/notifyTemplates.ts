/**
 * Message templates per announcement kind: the sentence a Discord post leads with, with placeholders.
 *
 * Each kind has a fixed allow-list of placeholders; anything else in braces stays literal text. The
 * default is today's wording, and an unset template leaves the post exactly as the builder writes it
 * (lib/pluginEmbeds, lib/notifyKindsPost): a template only replaces the first line of a post's
 * description when someone set one. Resolves like every other setting: the player's, else their clan's
 * default, else Anvil's. GE, trades and group storage are the player's alone.
 *
 * Safety: a template is capped, markdown links are reduced to their text, and mentions (@everyone,
 * @here, <@…>, <@&…>, <#…>) are defused, in the template and in every value put into it. Posts also go
 * out with allowed_mentions none (lib/discord), so this is the second lock, not the only one.
 *
 * Pure: no database.
 */

export type Source = 'custom' | 'clan' | 'platform';

interface Spec {
  label: string;
  /** Allowed placeholders, without braces, with a sample value for the preview. */
  vars: Record<string, string>;
  /** Today's wording. */
  def: string;
  /** Only the player can set it. */
  personalOnly?: boolean;
}

export const TEMPLATE_SPECS = {
  drops: {
    label: 'Loot',
    vars: { player: 'Zezima', item: 'Twisted bow', quantity: '1', value: '1,200,000,000 gp', source: 'Chambers of Xeric', kc: '312' },
    def: '{player} received a valuable drop from {source}.',
  },
  pets: { label: 'Pet', vars: { player: 'Zezima', pet: 'Olmlet', source: 'Chambers of Xeric', kc: '312' }, def: "{player} has a funny feeling like they're being followed." },
  clog: { label: 'Collection log', vars: { player: 'Zezima', item: 'Dragon pickaxe', slots: '812', source: 'Kalphite Queen' }, def: '{player} added {item} to their collection.' },
  ca: { label: 'Combat tasks', vars: { player: 'Zezima', task: 'Into the Den of Giants', tier: 'hard', points: '216' }, def: '{player} completed a {tier} combat task.' },
  diaries: { label: 'Achievement diary', vars: { player: 'Zezima', area: 'Ardougne', tier: 'Elite' }, def: '{player} just completed the **{area} {tier}** achievement diary!' },
  quests: { label: 'Quests', vars: { player: 'Zezima', quest: 'Dragon Slayer II', difficulty: 'Grandmaster' }, def: '{player} just completed **{quest}** ({difficulty})!' },
  levels: { label: 'Levels', vars: { player: 'Zezima', level: '99', skill: 'Slayer' }, def: '{player} just reached **level {level} {skill}**!' },
  deaths: { label: 'Death', vars: { player: 'Zezima', killer: 'Vorkath' }, def: '{player} just died!' },
  pvp: { label: 'Player kills', vars: { player: 'Zezima' }, def: '' },
  slayer: { label: 'Slayer', vars: { player: 'Zezima', streak: '50', points: '1,234' }, def: '{player} finished a Slayer task. Streak **{streak}**, **{points}** points.' },
  clues: { label: 'Clue scrolls', vars: { player: 'Zezima', tier: 'hard', count: '100' }, def: '{player} completed a **{tier}** clue scroll — **{count}** so far.' },
  speedruns: { label: 'Speedruns', vars: { player: 'Zezima', time: '1:23.40', line: 'Fight duration: 1:23.40 (new personal best)' }, def: '{player}: {line}' },
  kc: { label: 'Kill count', vars: { player: 'Zezima', count: '500', boss: 'Zulrah' }, def: '{player} reached **{count}** — {boss} kill count.' },
  ba: { label: 'BA gambles', vars: { player: 'Zezima', count: '100' }, def: '{player} reached **{count}** high level gambles.' },
  ge: { label: 'Grand Exchange', vars: { player: 'Zezima', action: 'sold', quantity: '1', item: 'Twisted bow', value: '1,200,000,000 gp' }, def: '{player} {action} **{quantity} × {item}** for **{value}**.', personalOnly: true },
  trade: { label: 'Player trades', vars: { player: 'Zezima', gave: '500 gp', got: '1,500,000 gp' }, def: '{player} completed a trade.', personalOnly: true },
  storage: { label: 'Group storage', vars: { player: 'Zezima', deposited: '500 gp', withdrew: '1,500,000 gp' }, def: '{player} changed the group storage.', personalOnly: true },
} as const satisfies Record<string, Spec>;

export type TemplateKind = keyof typeof TEMPLATE_SPECS;
export const TEMPLATE_KINDS = Object.keys(TEMPLATE_SPECS) as TemplateKind[];
export const TEMPLATE_MAX = 200;
export const isTemplateKind = (k: unknown): k is TemplateKind => typeof k === 'string' && k in TEMPLATE_SPECS;
const personalOnly = (k: TemplateKind) => 'personalOnly' in TEMPLATE_SPECS[k];

export type Templates = Partial<Record<TemplateKind, string>>;

/** Mentions defused and markdown links reduced to their text. Used on templates and on values. */
export function defuse(s: string): string {
  // Links: markdown links collapse to their text until none are left (nested ones can't survive),
  // a stray "](" is broken, and bare or bracketed URLs are dropped — templates and values carry text only.
  let out = s;
  for (let prev = ''; prev !== out; ) {
    prev = out;
    out = out.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  }
  return out
    .replace(/\]\(/g, '] (')
    .replace(/<\s*[a-z][\w+.-]*:[^>]*>/gi, '')
    .replace(/\b(?:https?|discord(?:app)?|steam|ftp):\/\/\S+/gi, '')
    .replace(/\bwww\.\S+/gi, '')
    .replace(/<(@[!&]?|#)(\d+)>/g, '‹$1$2›')
    .replace(/@(everyone|here)/gi, '@​$1');
}

/** A value from game text: no markdown, no mentions, no line breaks. */
export function escapeValue(v: string): string {
  return defuse(v.replace(/[\r\n]+/g, ' ')).replace(/[*_~`|>\\[\]]/g, (c) => `\\${c}`).replace(/@/g, '@​').slice(0, 120);
}

/** A stored template, cleaned: trimmed, one line, capped, mentions and links defused. Empty → null. */
export function normalizeTemplate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = defuse(raw.replace(/[\r\n]+/g, ' ').trim()).slice(0, TEMPLATE_MAX);
  return t || null;
}

export function normalizeTemplates(raw: unknown, who: 'personal' | 'clan'): Templates {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Templates = {};
  for (const k of TEMPLATE_KINDS) {
    if (who === 'clan' && personalOnly(k)) continue;
    const t = normalizeTemplate(o[k]);
    if (t) out[k] = t;
  }
  return out;
}

/** The template in force and where it came from; a private kind never reads the clan's. */
export function resolveTemplate(kind: TemplateKind, personal: Templates = {}, clan: Templates = {}): { template: string; source: Source } {
  if (personal[kind]) return { template: personal[kind]!, source: 'custom' };
  if (!personalOnly(kind) && clan[kind]) return { template: clan[kind]!, source: 'clan' };
  return { template: TEMPLATE_SPECS[kind].def, source: 'platform' };
}

/** Fill the allowed placeholders; unknown ones stay literal, missing values become empty. */
export function renderTemplate(kind: TemplateKind, template: string, values: Record<string, string | number | null | undefined>): string {
  const allowed = TEMPLATE_SPECS[kind].vars as Record<string, string>;
  const out = defuse(template).replace(/\{(\w+)\}/g, (whole, name: string) => {
    if (!(name in allowed) && !(kind === 'deaths' && name === 'name')) return whole;
    const v = values[name === 'name' ? 'player' : name];
    return v == null ? '' : escapeValue(String(v));
  });
  return out.replace(/\s{2,}/g, ' ').trim().slice(0, TEMPLATE_MAX + 400);
}

/** The settings page's preview: the template with the sample values. */
export const previewTemplate = (kind: TemplateKind, template: string) =>
  renderTemplate(kind, template, TEMPLATE_SPECS[kind].vars as Record<string, string>);

// ── Values off a post's facts ─────────────────────────────────────────────────────────────────────

const o = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const s = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null);
const gp = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? `${Math.abs(v).toLocaleString('en-US')} gp` : null);
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('en-US') : null);

/**
 * Which template a notify post uses, from its kind (and channel for the plain PvP post). Tier clears,
 * total-level milestones and other-plugin posts keep their own wording.
 */
export function templateKindOf(kind: unknown, channel: string, facts: unknown): TemplateKind | null {
  if (kind === undefined || kind === null) return channel === 'pvpKills' ? 'pvp' : null;
  const k = String(kind);
  if (k === 'line') {
    const sub = s(o(facts).k);
    return sub && sub !== 'custom' && isTemplateKind(sub) ? sub : null;
  }
  const map: Record<string, TemplateKind> = {
    drop: 'drops', pet: 'pets', clogSlot: 'clog', caTask: 'ca', diary: 'diaries', quest: 'quests', level: 'levels', level99: 'levels',
    death: 'deaths', ge: 'ge', trade: 'trade', storage: 'storage',
  };
  return map[k] ?? null;
}

/** The placeholder values for one post, read defensively off its (unvalidated) facts and RSN. */
export function templateValues(kind: TemplateKind, rawFacts: unknown, rsn: string | null): Record<string, string | null> {
  const f = o(rawFacts);
  const player = s(f.rsn) ?? rsn ?? 'A clan member';
  const items = Array.isArray(f.items) ? f.items.map(o) : [];
  switch (kind) {
    case 'drops': {
      const top = items.reduce<Record<string, unknown> | null>((b, it) => (!b || Number(it.value) > Number(b.value) ? it : b), null) ?? {};
      const total = items.reduce((a, it) => a + (typeof it.value === 'number' ? it.value : 0), 0);
      return { player, item: s(top.name), quantity: n(top.qty), value: gp(items.length > 1 ? total : top.value), source: s(f.source), kc: n(f.kc) };
    }
    case 'pets':
      return { player, pet: s(f.name) ?? 'a pet', source: s(f.source) ?? s(f.skill), kc: n(f.kc) };
    case 'clog':
      return { player, item: s(f.item), slots: n(f.slots), source: s(f.source) };
    case 'ca':
      return { player, task: s(f.task), tier: s(f.tier)?.toLowerCase() ?? null, points: n(f.totalPoints) };
    case 'diaries':
      return { player, area: s(f.area), tier: s(f.tier) };
    case 'quests':
      return { player, quest: s(f.quest), difficulty: s(f.difficulty) };
    case 'levels':
      return { player, level: n(f.level) ?? '99', skill: s(f.skill) };
    case 'deaths':
      return { player, killer: s(f.source) };
    case 'pvp':
      return { player: rsn ?? 'A clan member' };
    case 'slayer': {
      const line = s(f.line) ?? '';
      const m = /completed ([\d,]+) tasks?\b.*?total of ([\d,]+)/i.exec(line);
      return { player, streak: m?.[1] ?? null, points: m?.[2] ?? null };
    }
    case 'clues': {
      const m = /completed ([\d,]+) (\w+) treasure trails?/i.exec(s(f.line) ?? '');
      return { player, tier: m?.[2]?.toLowerCase() ?? null, count: m?.[1] ?? null };
    }
    case 'speedruns': {
      const line = s(f.line) ?? '';
      return { player, line, time: /(\d+:\d{2}(?:\.\d+)?)/.exec(line)?.[1] ?? null };
    }
    case 'kc': {
      const m = /^your (.{1,80}?)(?: kill| chest| harvest| lap| completion)? count is: ([\d,]+)/i.exec(s(f.line) ?? '');
      return { player, boss: m?.[1] ?? null, count: m?.[2] ?? null };
    }
    case 'ba':
      return { player, count: /gamble count: ([\d,]+)/i.exec(s(f.line) ?? '')?.[1] ?? null };
    case 'ge':
      return { player, action: f.sold === true ? 'sold' : 'bought', quantity: n(f.qty), item: s(f.item), value: gp(f.value) };
    case 'trade':
    case 'storage': {
      const list = (neg: boolean) =>
        items.filter((i) => (neg ? Number(i.qty) < 0 : Number(i.qty) > 0)).map((i) => `${Math.abs(Number(i.qty)).toLocaleString('en-US')} × ${s(i.name)}`).join(', ') || null;
      return kind === 'trade' ? { player, gave: list(true), got: list(false) } : { player, deposited: list(true), withdrew: list(false) };
    }
  }
}

/** The post's description with its first line replaced by the rendered template. */
export function withTemplate(description: string | undefined, line: string): string {
  const rest = (description ?? '').split('\n').slice(1);
  return [line, ...rest].join('\n');
}
