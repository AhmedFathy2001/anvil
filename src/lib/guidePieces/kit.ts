// Kit pieces: what to have set up before a trip. PURE.
//
//   plugin          — "install Tick Counter" (a Plugin Hub plugin by its internal name)
//   pluginConfig    — a few settings of a plugin, from a strict allowlist of plugins and keys
//   groundMarkers   — a RuneLite Ground Markers export (lib/groundMarkers)
//   inventorySetup  — an Inventory Setups export (lib/runeliteImport)
//   bankTag         — a Bank Tags export (lib/runeliteImport)
//
// IMPORTS ARE PARSED, NEVER KEPT. A paste goes through the strict parser for its format; what is
// stored is the parsed data, and an export is written fresh from it (lib/runeliteExport,
// groundMarkersJson). Nothing of the pasted text — an extra field, a comment, a script in a name —
// survives the trip. Every import is size-capped before it is parsed.
//
// PLUGIN CONFIGS ARE THE DANGEROUS ONE. A shared config is applied to somebody else's client: a
// config that sets a webhook, an upload address or a "send screenshots to" field would quietly leak
// that player's data to whoever wrote the guide. So only the plugins and keys listed in
// CONFIG_ALLOWLIST are taken, each with a fixed value type (on/off, a number in range, a colour, a
// list of names), and any value that looks like an address is refused whatever its key.

import { parseGroundMarkers, groundMarkersJson } from '../groundMarkers';
import { parseBankTag, parseInventorySetup } from '../runeliteImport';
import { bankTagString, cleanTagName, inventorySetupJson, type EquipSlot } from '../runeliteExport';
import { cleanText, HUB_NAME, looksLikeUrl } from './text';
import { EQUIP_SLOTS, fail, invItem, isPlain, itemId, LIMITS, s, type PieceItem, type Result, type Schema } from './validate';

export const KIT_IMPORT_MAX = 50_000;

// ── Plugin config allowlist ──────────────────────────────────────────────────────────────────
//
// Group and key names are RuneLite's own (the @ConfigGroup and @ConfigItem keyName in each plugin's
// Config interface). Add a key only after reading what it does: never anything that takes an
// address, a file path, a command or free text another plugin interprets.

type ConfigType = { t: 'bool' } | { t: 'int'; min: number; max: number } | { t: 'color' } | { t: 'names'; max: number };

export const CONFIG_ALLOWLIST: Record<string, { label: string; keys: Record<string, ConfigType> }> = {
  npcindicators: {
    label: 'NPC Indicators',
    keys: {
      highlightHull: { t: 'bool' },
      highlightTile: { t: 'bool' },
      highlightTrueTile: { t: 'bool' },
      highlightSouthWestTile: { t: 'bool' },
      highlightOutline: { t: 'bool' },
      npcToHighlight: { t: 'names', max: 500 },
      npcColor: { t: 'color' },
      drawNames: { t: 'bool' },
      borderWidth: { t: 'int', min: 0, max: 10 },
    },
  },
  grounditems: {
    label: 'Ground Items',
    keys: {
      highlightedItems: { t: 'names', max: 1000 },
      hiddenItems: { t: 'names', max: 1000 },
      showHighlightedOnly: { t: 'bool' },
      highlightedColor: { t: 'color' },
    },
  },
  tileindicators: {
    label: 'Tile Indicators',
    keys: {
      highlightDestinationTile: { t: 'bool' },
      highlightCurrentTile: { t: 'bool' },
      highlightHoveredTile: { t: 'bool' },
    },
  },
  prayer: {
    label: 'Prayer',
    keys: {
      showPrayerDoseIndicator: { t: 'bool' },
      showPrayerBar: { t: 'bool' },
    },
  },
};

export type ConfigValue = boolean | number | string;

/** A RuneLite colour as stored ("-16711936", an ARGB int) or written ("#RRGGBB" / "#AARRGGBB") → "#AARRGGBB". */
function colorOf(v: unknown): string | null {
  if (typeof v === 'number' || (typeof v === 'string' && /^-?\d{1,10}$/.test(v.trim()))) {
    const n = Number(v);
    if (!Number.isInteger(n) || n < -2_147_483_648 || n > 4_294_967_295) return null;
    return `#${(n >>> 0).toString(16).padStart(8, '0').toUpperCase()}`;
  }
  if (typeof v !== 'string') return null;
  const m = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(v.trim());
  return m ? `#${m[1].length === 6 ? 'FF' : ''}${m[1]}`.toUpperCase() : null;
}

/** One config value against its key's type, or why not. */
export function configValue(group: string, key: string, raw: unknown): Result<ConfigValue> {
  const g = Object.prototype.hasOwnProperty.call(CONFIG_ALLOWLIST, group) ? CONFIG_ALLOWLIST[group] : null;
  if (!g) return fail('', `"${cleanText(group).slice(0, 40)}" isn't a plugin Anvil shares settings for`);
  const type = Object.prototype.hasOwnProperty.call(g.keys, key) ? g.keys[key] : null;
  if (!type) return fail('', `${g.label} setting "${cleanText(key).slice(0, 40)}" can't be shared`);
  if (typeof raw === 'string' && looksLikeUrl(raw)) return fail('', `${g.label} setting "${key}" holds an address; settings with addresses are never shared`);
  switch (type.t) {
    case 'bool':
      if (raw === true || raw === 'true') return { ok: true, value: true };
      if (raw === false || raw === 'false') return { ok: true, value: false };
      return fail('', `${key} must be true or false`);
    case 'int': {
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' && /^-?\d{1,6}$/.test(raw.trim()) ? Number(raw) : NaN;
      return Number.isInteger(n) && n >= type.min && n <= type.max ? { ok: true, value: n } : fail('', `${key} must be a whole number from ${type.min} to ${type.max}`);
    }
    case 'color': {
      const c = colorOf(raw);
      return c ? { ok: true, value: c } : fail('', `${key} must be a colour`);
    }
    case 'names': {
      if (typeof raw !== 'string') return fail('', `${key} must be a list of names`);
      // Markup is refused, not cleaned away: a names list that held a tag was not a names list.
      if (/[<>]/.test(raw)) return fail('', `${key} holds something that isn't a name`);
      // Names as RuneLite reads them: comma-separated, wildcards allowed. Plain text only.
      const names = cleanText(raw)
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);
      if (names.some((n) => !/^[\p{L}\p{N} '()*.\-+&]{1,60}$/u.test(n))) return fail('', `${key} holds something that isn't a name`);
      const joined = names.join(',');
      return joined.length <= type.max ? { ok: true, value: joined } : fail('', `${key} is longer than ${type.max} characters`);
    }
  }
}

// ── Bodies ───────────────────────────────────────────────────────────────────────────────────

export interface MarkerPoint {
  regionId: number;
  regionX: number;
  regionY: number;
  z: number;
  color?: string;
  label?: string;
}

export type KitBody =
  | { type: 'plugin'; plugin: string; why?: string }
  | { type: 'pluginConfig'; plugin: string; values: Record<string, ConfigValue>; why?: string }
  | { type: 'groundMarkers'; label?: string; points: MarkerPoint[] }
  | { type: 'inventorySetup'; name: string; worn: Partial<Record<EquipSlot, number>>; inventory: (PieceItem | null)[]; runePouch: PieceItem[]; spellbook?: number }
  | { type: 'bankTag'; name: string; icon: number; items: number[]; layout: [number, number][] };

const kitName = s.text({ max: 40 });
const markerPoint = s.object(
  {
    regionId: s.int(0, 65_535),
    regionX: s.int(0, 63),
    regionY: s.int(0, 63),
    z: s.int(0, 3),
    color: s.pattern(/^#[0-9A-F]{8}$/, 'a colour like #FFFF0000'),
    label: s.text({ max: 40 }),
  },
  ['color', 'label'],
);
const layoutPair: Schema<[number, number]> = (v, p) => {
  if (!Array.isArray(v) || v.length !== 2) return fail(p, 'must be [bank position, item id]');
  const a = s.int(0, 8 * 120)(v[0], p);
  const b = itemId(v[1], p);
  return a.ok && b.ok ? { ok: true, value: [a.value, b.value] } : fail(p, 'must be [bank position, item id]');
};

const KIT_SCHEMAS: Record<KitBody['type'], Schema<KitBody>> = {
  plugin: s.object({ type: s.oneOf(['plugin'] as const), plugin: s.pattern(HUB_NAME, 'a Plugin Hub plugin name, like inventory-setups'), why: s.text(LIMITS.line) }, ['why']) as Schema<KitBody>,
  pluginConfig: ((v, p) => {
    const r = s.object({ type: s.oneOf(['pluginConfig'] as const), plugin: s.pattern(/^[a-z]{2,40}$/, 'a plugin config group'), values: (x: unknown) => ({ ok: true, value: x }) as Result<unknown>, why: s.text(LIMITS.line) }, ['why'])(v, p);
    if (!r.ok) return r;
    if (!isPlain(r.value.values)) return fail(`${p}.values`, 'must be an object');
    const entries = Object.entries(r.value.values);
    if (!entries.length) return fail(`${p}.values`, 'needs at least one setting');
    if (entries.length > 30) return fail(`${p}.values`, 'holds at most 30 settings');
    const values: Record<string, ConfigValue> = {};
    for (const [k, x] of entries) {
      const c = configValue(r.value.plugin, k, x);
      if (!c.ok) return fail(`${p}.values`, c.error);
      values[k] = c.value;
    }
    return { ok: true, value: { type: 'pluginConfig', plugin: r.value.plugin, values, ...(r.value.why ? { why: r.value.why } : {}) } };
  }) as Schema<KitBody>,
  groundMarkers: s.object({ type: s.oneOf(['groundMarkers'] as const), label: s.text(LIMITS.short), points: s.array(markerPoint, 500, 1) }, ['label']) as Schema<KitBody>,
  inventorySetup: s.object(
    {
      type: s.oneOf(['inventorySetup'] as const),
      name: kitName,
      worn: s.record(EQUIP_SLOTS, itemId),
      inventory: s.array(s.nullable(invItem), 28),
      runePouch: s.array(invItem, 4),
      spellbook: s.int(0, 3),
    },
    ['spellbook'],
  ) as Schema<KitBody>,
  bankTag: s.object({ type: s.oneOf(['bankTag'] as const), name: kitName, icon: itemId, items: s.array(itemId, 400, 1), layout: s.array(layoutPair, 400) }) as Schema<KitBody>,
};

export const KIT_TYPES = Object.keys(KIT_SCHEMAS) as KitBody['type'][];

export function checkKitBody(v: unknown, path = 'kit'): Result<KitBody> {
  return s.tagged<KitBody>('type', KIT_SCHEMAS)(v, path);
}

// ── Imports and exports ──────────────────────────────────────────────────────────────────────

/**
 * A pasted export as a kit body. `text` is what RuneLite (or the plugin) copied; the result is
 * checked against the kit schema again, so an import can never store what a direct write couldn't.
 */
export function kitFromImport(type: 'groundMarkers' | 'inventorySetup' | 'bankTag' | 'pluginConfig', text: unknown, opts: { label?: string } = {}): Result<KitBody> {
  if (typeof text !== 'string') return fail('', 'Paste the export as text.');
  if (text.length > KIT_IMPORT_MAX) return fail('', 'That paste is too long.');
  let body: unknown;
  switch (type) {
    case 'groundMarkers': {
      const r = parseGroundMarkers(text);
      if (!r.ok) return fail('', r.error);
      if (!r.points.length) return fail('', 'Paste a Ground Markers export first.');
      body = { type, ...(opts.label ? { label: opts.label } : {}), points: r.points.map((p) => ({ regionId: p.regionId, regionX: p.regionX, regionY: p.regionY, z: p.z, ...(p.color ? { color: p.color } : {}), ...(p.label ? { label: p.label } : {}) })) };
      break;
    }
    case 'inventorySetup': {
      const r = parseInventorySetup(text);
      if (!r.ok) return fail('', r.error);
      const t = r.tag;
      body = { type, name: t.name, worn: { ...(t.gear ?? {}) }, inventory: (t.inventory ?? []).map((i) => (i ? { id: i.id, ...(i.q != null ? { q: i.q } : {}) } : null)), runePouch: (t.runePouch ?? []).map((i) => ({ id: i.id, ...(i.q != null ? { q: i.q } : {}) })), ...(t.spellbook != null ? { spellbook: t.spellbook } : {}) };
      break;
    }
    case 'bankTag': {
      const r = parseBankTag(text);
      if (!r.ok) return fail('', r.error);
      const t = r.tag;
      body = { type, name: t.name, icon: t.icon, items: t.items.filter((id) => id > 0), layout: [...t.layout.entries()].filter(([, id]) => id > 0).sort((a, b) => a[0] - b[0]) };
      break;
    }
    case 'pluginConfig': {
      // RuneLite's own "group.key=value" lines (a profile export, or the config file). One group.
      const values: Record<string, string> = {};
      let group: string | null = null;
      const lines = text.replace(/\r\n?/g, '\n').split('\n');
      if (lines.length > 200) return fail('', 'At most 200 lines.');
      for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith('#') || line.startsWith('!')) continue;
        const m = /^([a-zA-Z]{2,40})\.([a-zA-Z0-9_]{1,60})\s*[=:]\s*(.*)$/.exec(line);
        if (!m) return fail('', `"${cleanText(line).slice(0, 40)}" isn't a plugin setting line (group.key=value).`);
        const g = m[1].toLowerCase();
        if (group && g !== group) return fail('', 'Share one plugin’s settings at a time.');
        group = g;
        values[m[2]] = m[3].replace(/\\(.)/g, '$1');
      }
      if (!group) return fail('', 'Paste some plugin settings first.');
      body = { type, plugin: group, values };
      break;
    }
    default:
      return fail('', 'Unknown import.');
  }
  return checkKitBody(body);
}

/** What a kit's copy button puts on the clipboard, written fresh from the stored data. */
export function kitExport(body: KitBody): string | null {
  switch (body.type) {
    case 'groundMarkers':
      return groundMarkersJson(body.points);
    case 'inventorySetup':
      return inventorySetupJson({ name: body.name, gear: body.worn, inventory: body.inventory, runePouch: body.runePouch, ...(body.spellbook != null ? { spellbook: body.spellbook } : {}) });
    case 'bankTag': {
      // The stored layout as it was imported; with none, the items as the bank would lay them out.
      if (!body.layout.length) return bankTagString({ name: body.name, gear: {}, inventory: body.items.slice(0, 28).map((id) => ({ id })) });
      const parts: (string | number)[] = ['banktags', 1, cleanTagName(body.name), body.icon, 'layout'];
      for (const [idx, id] of body.layout) parts.push(idx, id);
      return parts.join(',');
    }
    case 'pluginConfig':
      return Object.entries(body.values)
        .map(([k, v]) => `${body.plugin}.${k}=${typeof v === 'string' && v.startsWith('#') ? String(Number.parseInt(v.slice(1), 16) | 0) : String(v)}`)
        .join('\n');
    case 'plugin':
      return null;
  }
}
