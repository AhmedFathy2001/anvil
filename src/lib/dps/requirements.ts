// Equipment level requirements: which levels (and quests) wearing or wielding a piece needs, and
// whether a player meets them. PURE.
//
// The data (`rq`, `rqq` on each gear item) comes from the OSRS Wiki's skill "Level up table" pages
// (Attack/Level_up_table and so on): each lists what a level unlocks, "Wear X (with 70 Ranged)".
// No wiki bucket holds equipment requirements, so the tables are the cleanest source. Parsed by
// parseLevelUpTable below and attached by scripts/build-gear-dataset.ts (lib/dps/wikiDataset). A
// piece the tables don't name has no requirement on record: it is allowed.

import type { GearItem } from './engine';

export const REQ_SKILLS = ['attack', 'strength', 'defence', 'ranged', 'magic', 'prayer', 'hitpoints', 'slayer', 'agility'] as const;
export type ReqSkill = (typeof REQ_SKILLS)[number];
export type Requirements = Partial<Record<ReqSkill, number>>;

const SKILL_LABEL: Record<ReqSkill, string> = {
  attack: 'Attack',
  strength: 'Strength',
  defence: 'Defence',
  ranged: 'Ranged',
  magic: 'Magic',
  prayer: 'Prayer',
  hitpoints: 'Hitpoints',
  slayer: 'Slayer',
  agility: 'Agility',
};

export interface Missing {
  skill: ReqSkill;
  need: number;
  have: number;
}

export interface EquipCheck {
  ok: boolean;
  missing: Missing[];
  /** Quests the piece needs that the player hasn't done (only checked when `quests` is given). */
  quests: string[];
}

/**
 * Whether a player can wear or wield `item`. `levels`: their base levels by skill name (lowercase, as
 * the plugin and hiscores give them); a skill not given is not checked. `quests`: completed quest
 * names; unset, quest requirements are not checked.
 */
export function canEquip(item: Pick<GearItem, 'rq' | 'rqq'> | null | undefined, levels: Partial<Record<ReqSkill, number>> | object | null | undefined, quests?: Iterable<string>): EquipCheck {
  const missing: Missing[] = [];
  for (const [skill, need] of Object.entries(item?.rq ?? {}) as [ReqSkill, number][]) {
    const have = (levels as Partial<Record<string, unknown>> | null | undefined)?.[skill];
    if (typeof have === 'number' && have < need) missing.push({ skill, need, have });
  }
  const done = quests ? new Set([...quests].map((q) => q.toLowerCase())) : null;
  const q = done ? (item?.rqq ?? []).filter((x) => !done.has(x.toLowerCase())) : [];
  return { ok: !missing.length && !q.length, missing, quests: q };
}

/** "needs 80 Defence" / "needs 75 Attack and 75 Strength" (empty when nothing is missing). */
export function missingLine(check: EquipCheck): string {
  const parts = [...check.missing.map((m) => `${m.need} ${SKILL_LABEL[m.skill]}`), ...check.quests];
  if (!parts.length) return '';
  return `needs ${parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`}`;
}

// ── Parsing the wiki's level up tables ─────────────────────────────────────────────────────

/** Requirements that hold only for some of a line's pieces ("40 Defence for the body"). */
export interface Scoped {
  /** Piece words and page names after "for", lowercased. */
  for: string[];
  reqs: Requirements;
  quests: string[];
}

/** One "Wear X (with …)" line: the pages it names and every requirement it carries. */
export interface TableEntry {
  /** The table it came from (its level is in `reqs`). */
  skill: ReqSkill;
  /** The plink targets before "(with", lowercased: an item page or a set page ("torva armour"). */
  targets: string[];
  /** The link texts (txt=), lowercased, for "Fortified Masori armour". */
  texts: string[];
  /** For every piece the line names. */
  reqs: Requirements;
  quests: string[];
  scoped: Scoped[];
}

const SKILL_OF: Record<string, ReqSkill> = Object.fromEntries(REQ_SKILLS.map((s) => [SKILL_LABEL[s].toLowerCase(), s]));

function reqsIn(text: string): { reqs: Requirements; quests: string[] } {
  const reqs: Requirements = {};
  for (const m of text.matchAll(/\{\{SCP\|([A-Za-z]+)\|(\d+)/g)) {
    const s = SKILL_OF[m[1].toLowerCase()];
    if (s) reqs[s] = Math.max(reqs[s] ?? 0, Number(m[2]));
  }
  const quests = /partial completion/i.test(text) ? [] : [...text.matchAll(/\{\{SCP\|Quest\}\}\s*\[\[([^\]|]+)(?:\|[^\]]*)?\]\]\s*completed/gi)].map((m) => m[1].trim());
  return { reqs, quests };
}

/** The pieces a "for …" names: its links and the piece words in its text. */
function forWords(text: string): string[] {
  return [
    ...[...text.matchAll(/\{\{plink\|([^}|]+)/gi)].map((m) => m[1].trim().toLowerCase()),
    ...[...text.matchAll(/\[\[([^\]|]+)/g)].map((m) => m[1].trim().toLowerCase()),
    ...[...text.replace(/\{\{[^}]*\}\}|\[\[[^\]]*\]\]/g, ' ').matchAll(/\b(body|bodies|coif|boots|shield|chaps|vambraces|bracers|platebody|helm|legs)\b/gi)].map((m) => m[1].toLowerCase().replace(/ies$/, 'y')),
  ];
}

/** Splits outside {{…}} and [[…]] on commas and the words "and" / "or". */
function atoms(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < text.length; i++) {
    const two = text.slice(i, i + 2);
    if (two === '{{' || two === '[[') depth++;
    if (two === '}}' || two === ']]') depth = Math.max(0, depth - 1);
    if (!depth) {
      const m = /^(,\s*(?:and |or )?|\s+and\s+|\s+or\s+)/.exec(text.slice(i));
      if (m) {
        out.push(cur);
        cur = '';
        i += m[0].length - 1;
        continue;
      }
    }
    cur += text[i];
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

/** Every Wear/Wield/Equip line of one skill's level up table. */
export function parseLevelUpTable(skill: ReqSkill, wikitext: string): TableEntry[] {
  const out: TableEntry[] = [];
  let level = 0;
  for (const raw of wikitext.split('\n')) {
    const line = raw.trim();
    const head = /^\|\s*(?:freeplay|members)(\d+)\s*=\s*(.*)$/i.exec(line);
    if (head) {
      level = Number(head[1]);
      // A value on the same line as the header ("|members78 = * Wear …") is rare; read it too.
      if (!/^\*+\s*(wear|wield|equip)\b/i.test(head[2])) continue;
    }
    const body = head ? head[2] : line;
    // "** Wield dragon scimitars (with …)": a nested line under a set, its own requirements.
    if (!level || !/^\*+\s*(wear|wield|equip)\b/i.test(body)) continue;
    // "(only usable in Bounty Hunter)": not a main-game piece.
    if (/only usable in/i.test(body)) continue;
    const cut = body.search(/\(with\b/i);
    const before = cut >= 0 ? body.slice(0, cut) : body;
    const targets: string[] = [];
    const texts: string[] = [];
    for (const m of before.matchAll(/\{\{plink\|([^}|]+)((?:\|[^}]*)?)\}\}/gi)) {
      targets.push(m[1].trim().toLowerCase());
      const txt = /\|txt=([^|}]+)/i.exec(m[2] ?? '');
      if (txt) texts.push(txt[1].trim().toLowerCase());
    }
    if (!targets.length) continue;
    const entry: TableEntry = { skill, targets, texts, reqs: { [skill]: level }, quests: [], scoped: [] };
    if (cut >= 0) {
      // "(with 40 Defence and Dragon Slayer I completed for the body)": what comes before a "for"
      // belongs to it; "(with 70 Ranged for Karil's, or 70 Magic for Ahrim's)": each to its own.
      const inner = body.slice(cut + 5).replace(/\)[^)]*$/, '');
      let pending: string[] = [];
      const parts: string[] = [];
      for (const a of atoms(inner)) {
        const r = reqsIn(a);
        // A bare continuation ("coif", "shield") belongs to the part before it.
        if (!Object.keys(r.reqs).length && !r.quests.length && parts.length) parts[parts.length - 1] += `, ${a}`;
        else parts.push(a);
      }
      for (const a of parts) {
        const forAt = a.search(/\sfor\s/i);
        if (forAt < 0) {
          pending.push(a);
          continue;
        }
        const r = reqsIn([...pending, a.slice(0, forAt)].join(' '));
        entry.scoped.push({ for: forWords(a.slice(forAt)), reqs: r.reqs, quests: r.quests });
        pending = [];
      }
      const g = reqsIn(pending.join(' '));
      for (const [s, lv] of Object.entries(g.reqs) as [ReqSkill, number][]) entry.reqs[s] = Math.max(entry.reqs[s] ?? 0, lv);
      entry.quests = g.quests;
    }
    out.push(entry);
  }
  return out;
}

/** Words a set page ends in ("Torva armour"): its pieces share the name before it. */
const SET_WORD = /\s+(armour|armor|robes|equipment|set|outfit)(#(weapons|armour))?$/i;

/** Pages naming a group whose pieces don't share one stem. */
const GROUPS: Record<string, RegExp> = {
  'void knight equipment': /^(void knight (top|robe|gloves)|void (melee|ranger|mage) helm|elite void (top|robe))/i,
  'barrows equipment': /^(ahrim|dharok|guthan|karil|torag|verac)'s (hood|helm|coif|robetop|robeskirt|platebody|platelegs|plateskirt|leathertop|leatherskirt)/i,
  "ahrim the blighted's equipment": /^ahrim's (hood|robetop|robeskirt)/i,
  "karil the tainted's equipment": /^karil's (coif|leathertop|leatherskirt)/i,
  godsword: /godsword/i,
  zenyte: /^(amulet of torture|necklace of anguish|tormented bracelet|ring of suffering)/i,
  'blessed body': /^(ancient|armadyl|bandos|guthix|saradomin|zamorak) d'hide body/i,
  'blessed coif': /^(ancient|armadyl|bandos|guthix|saradomin|zamorak) coif/i,
  "blessed d'hide boots": /^(ancient|armadyl|bandos|guthix|saradomin|zamorak) d'hide boots/i,
  'blessed shield': /^(ancient|armadyl|bandos|guthix|saradomin|zamorak) d'hide shield/i,
  'blessed dragonhide armour': /^(ancient|armadyl|bandos|guthix|saradomin|zamorak) (d'hide (body|boots|shield)|chaps|bracers|coif)/i,
  'god capes': /^(saradomin|guthix|zamorak) cape$/i,
  'god capes#imbuing': /^imbued (saradomin|guthix|zamorak) cape/i,
  'god staves': /^(saradomin|guthix|zamorak) staff$/i,
  battlestaves: /battlestaff$/i,
  'mystic staff': /^mystic .*staff$/i,
};

/** Melee weapon categories (a metal's "weapons" never means its bows or staves). */
const MELEE_CATS = /^(2h sword|axe|banner|blunt|bludgeon|claw|flail|partisan|pickaxe|polearm|polestaff|scythe|slash sword|spear|spiked|stab sword|multi-melee|whip)$/i;
/** Piece words: a set's stem only names armour, never the weapons and ammo sharing its metal. */
const PIECE = /\b(helm|helmet|hat|hood|coif|cowl|mask|faceguard|body|chainbody|platebody|chestplate|chestguard|chest|top|torso|hauberk|cuirass|robe|plateskirt|platelegs|legs|legguards|chaps|skirt|tassets|bottom|greaves|gloves|vambraces|bracers|gauntlets|boots|treads|shield|kiteshield|defender)\b/i;

/**
 * Requirements per gear item id: an entry naming the item's page (or its page plus a form in
 * brackets: "Abyssal tentacle (or)") applies to it; a set page applies to the pieces whose names
 * start with the set's stem. A piece named in several tables keeps the highest level per skill.
 */
export function requirementsByItem(items: Pick<GearItem, 'id' | 'n' | 's' | 'c'>[], entries: TableEntry[]): Map<number, { rq: Requirements; rqq: string[] }> {
  const out = new Map<number, { rq: Requirements; rqq: string[] }>();
  const byName = new Map<string, Pick<GearItem, 'id' | 'n' | 's' | 'c'>[]>();
  for (const it of items) {
    // "Blade of Saeldor (c) (Cadarn)" is the Blade of Saeldor's page.
    const base = it.n.toLowerCase().replace(/(\s*\([^()]*\))+$/, '');
    for (const k of new Set([it.n.toLowerCase(), base])) byName.set(k, [...(byName.get(k) ?? []), it]);
  }
  /** Whether a "for …" names this piece: its page, its group, or its last word ("body"). */
  const named = (it: Pick<GearItem, 'n'>, words: string[]) => {
    const n = it.n.toLowerCase();
    const base = n.replace(/(\s*\([^()]*\))+$/, '');
    const last = base.split(' ').slice(-1)[0];
    return words.some((w) => (GROUPS[w] ? GROUPS[w].test(it.n) : n === w || base === w || last === w));
  };
  // A set's quest is usually one piece's: a set line passes its quests on only through a "for".
  const add = (it: Pick<GearItem, 'id' | 'n'>, e: TableEntry, withQuests: boolean) => {
    const cur = out.get(it.id) ?? { rq: {}, rqq: [] };
    const put = (r: Requirements, qs: string[]) => {
      for (const [s, lv] of Object.entries(r) as [ReqSkill, number][]) cur.rq[s] = Math.max(cur.rq[s] ?? 0, lv);
      for (const q of qs) if (!cur.rqq.includes(q)) cur.rqq.push(q);
    };
    put(e.reqs, withQuests ? e.quests : []);
    for (const sc of e.scoped) if (named(it, sc.for)) put(sc.reqs, sc.quests);
    out.set(it.id, cur);
  };
  // "Black armour" never reaches "Black d'hide chaps": the longest set stem naming a piece wins.
  const stems = new Set<string>();
  const stemOf = (t: string) => t.replace(SET_WORD, '').replace(/ dragonhide$/, " d'hide").toLowerCase();
  for (const e of entries) for (const t of e.targets) if (SET_WORD.test(t) && !byName.has(t) && !GROUPS[t]) stems.add(stemOf(t));
  const longer = (stem: string, n: string) => [...stems].some((x) => x.length > stem.length && x.startsWith(`${stem} `) && n.startsWith(`${x} `));
  for (const e of entries) {
    for (const t of e.targets) {
      const direct = byName.get(t) ?? byName.get(t.replace(/s$/, ''));
      if (direct) {
        for (const it of direct) add(it, e, true);
        continue;
      }
      const group = GROUPS[t];
      if (group) {
        for (const it of items) if (group.test(it.n)) add(it, e, true);
        continue;
      }
      if (!SET_WORD.test(t)) continue;
      // "Black dragonhide armour": the pieces are "Black d'hide …".
      const stem = stemOf(t);
      const anchor = /#(weapons|armour)$/.exec(t)?.[1];
      // A metal's "equipment" in the Attack and Strength tables is its weapons; elsewhere its armour.
      const weapons = anchor ? anchor === 'weapons' : /equipment$/.test(t) && (e.skill === 'attack' || e.skill === 'strength');
      const fortified = e.texts.some((x) => /fortified/.test(x));
      for (const it of items) {
        const n = it.n.toLowerCase();
        if (!n.startsWith(`${stem} `) || it.s === 'ammo' || longer(stem, n)) continue;
        if (weapons) {
          // Warhammers are the Strength table's ("excluding warhammers").
          if (it.s !== 'weapon' || !MELEE_CATS.test(it.c ?? '') || /warhammer|hunter/i.test(n)) continue;
        } else if (it.s === 'weapon' || !PIECE.test(it.n)) continue;
        if (fortified && !/\(f\)/.test(n)) continue;
        add(it, e, false);
      }
    }
  }
  return out;
}
