// The item hunt form's one box: a hunt said the way it is said in clan chat,
//
//   "graardor pet 5, heron 3, rocky 2, bandos chestplate 1, all of them, top 3"
//
// read back as rows (a number after a name is its points), an ending and the places paid. Pets are
// named here, off the collection log's own list (lib/petGroups) and the boss each comes from; any
// other name is handed back for the item search to find, and a word nothing can use is handed back
// as such, never guessed at.
//
// PURE: no database, no datasets beyond the pet list the form already ships.

import { BOSSES } from '@/lib/constants';
import type { HuntRule } from '@/lib/itemHunt';
import { PET_BOSS_KEYS, PET_GROUPS } from '@/lib/petGroups';

export interface TypedRow {
  /** What was typed for it, without the number: "bandos chestplate". */
  query: string;
  /** The number after the name; null when none was given. */
  points: number | null;
  /** Set when the name is a pet: it needs no search. */
  pet: { id: number; name: string } | null;
}

export interface TypedHunt {
  rows: TypedRow[];
  /** "all of them": ends when one player has every row. */
  endsAll: boolean;
  /** "top 3": how many places the prizes pay. */
  places: number | null;
  /** "most points" when any row was given points; "first"/"most" when said; else null (the form keeps its own). */
  rule: HuntRule | null;
  /** Whole pet groups asked for: "gwd pets". Each is a lib/petGroups key. */
  groups: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

const ALL_PETS = PET_GROUPS.find((g) => g.key === 'all')?.items ?? [];
const bossLabel = new Map(BOSSES.map((b) => [b.key, norm(b.label)]));

/** Every name a pet answers to: its own, and the bosses it drops from ("graardor", "general graardor"). */
function petNames(p: { id: number; name: string }): string[] {
  const own = norm(p.name);
  const names = [own, own.replace(/^pet /, '')];
  for (const k of PET_BOSS_KEYS[p.id] ?? []) {
    const label = bossLabel.get(k);
    if (label) names.push(label, label.replace(/^the /, ''));
  }
  return names;
}

/**
 * The pet a phrase names, or null. "heron", "rocky", "pet snakeling" by the pet's own name; "graardor
 * pet", "zulrah pet" by its boss, which needs the word "pet" so "graardor" alone stays an item search
 * (the boss drops a great deal besides). A boss name that is the start of the label is enough
 * ("graardor" for "General Graardor" is not; "general graardor pet" is): last words match too.
 */
export function typedPet(phrase: string): { id: number; name: string } | null {
  const q = norm(phrase);
  if (!q) return null;
  const exact = ALL_PETS.find((p) => norm(p.name) === q || norm(p.name).replace(/^pet /, '') === q);
  if (exact) return exact;
  const m = q.match(/^(?:pet )?(.+?)(?: pet)?$/);
  const saidPet = /(^pet )|( pet$)/.test(q);
  if (!saidPet || !m) return null;
  const core = m[1];
  const hits = ALL_PETS.filter((p) => petNames(p).some((n) => n === core || n.endsWith(` ${core}`) || n.startsWith(`${core} `)));
  // Two pets for one name ("dagannoth pet") is a question the box cannot answer: no pick.
  return hits.length === 1 ? hits[0] : null;
}

/** A pet group named in a clause: "gwd pets", "raid pets", "skilling pets", "all pets". */
function typedGroup(clause: string): string | null {
  const q = norm(clause);
  const m = q.match(/^(?:all |every )?(.+?) pets$/) ?? (q === 'all pets' || q === 'every pet' ? ['', 'all'] : null);
  if (!m) return null;
  const word = m[1].replace(/ pet$/, '');
  const g = PET_GROUPS.find((x) => x.key === word || norm(x.label) === `${word} pets` || norm(x.label) === word || (word === 'raid' && x.key === 'raids') || (word === 'boss' && x.key === 'boss'));
  return g?.key ?? null;
}

/** Read the box. Empty clauses are skipped; nothing here ever throws. */
export function parseTypedHunt(text: string): TypedHunt {
  const out: TypedHunt = { rows: [], endsAll: false, places: null, rule: null, groups: [] };
  let anyPoints = false;
  for (const raw of text.split(/[,;\n]+/)) {
    const clause = norm(raw);
    if (!clause) continue;
    if (/^(?:ends? )?(?:when (?:a|one) player has |until (?:someone|somebody|a player) has |first to (?:get |have )?)?all(?: of them| \d+)?$/.test(clause)) {
      out.endsAll = true;
      continue;
    }
    const top = clause.match(/^top (\d{1,2})(?: win| paid| get paid| places?)?$/);
    if (top) {
      out.places = Math.max(1, Math.min(10, Number(top[1])));
      continue;
    }
    if (/^(?:first to get (?:it|one)|first one|first)$/.test(clause)) {
      out.rule = 'first';
      continue;
    }
    if (/^(?:most by the end|most drops|most)$/.test(clause)) {
      out.rule = 'most';
      continue;
    }
    if (/^(?:most )?points$/.test(clause)) {
      out.rule = 'points';
      continue;
    }
    const group = typedGroup(clause);
    if (group) {
      if (!out.groups.includes(group)) out.groups.push(group);
      continue;
    }
    // "bandos chestplate 1", "heron x3", "rocky 2 pts": a trailing number is the row's points.
    const pts = clause.match(/^(.*?)\s*(?:x\s*)?(\d{1,4})\s*(?:pts?|points?)?$/);
    const name = (pts ? pts[1] : clause).trim();
    if (!name) continue;
    const points = pts ? Math.max(1, Math.min(1000, Number(pts[2]))) : null;
    if (points != null) anyPoints = true;
    out.rows.push({ query: name, points, pet: typedPet(name) });
  }
  if (anyPoints && out.rule == null) out.rule = 'points';
  return out;
}
