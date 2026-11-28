// The item hunt form's value (components/weekly/HuntFields): what it holds, what it posts, and a
// stored hunt as it holds it, for editing one that has not started. Pure, and not in the
// 'use client' form file, because the settings page builds a form value on the server.
//
// The form only writes v2, so a v1 hunt opened here comes back as v2 rows: its items as they were,
// a pet hunt as the rows of its pets, each with the "Closest to it" the data picks (a v1 hunt had
// one stat for all of them). Nothing changes until it is saved; a hunt left alone stays v1.

import { DEFAULT_RUSH, type RushRules } from '@/lib/bossRushRules';
import { type HuntConfig, type HuntConfirm, type HuntCountMode, type HuntEnding, type HuntRowStat, type HuntRule, autoRowStat, huntRows } from '@/lib/itemHunt';

export interface HuntFormItem {
  id: number;
  name: string;
  /** Sources the drop dataset lists for it: the choices offered. */
  known: string[];
  sources: string[];
  anySource: boolean;
  count: HuntCountMode;
  /** Rule 'points': what one drop (or piece, counting the quantity) scores. */
  points: number;
  /** A pet: no source to choose, one at a time. */
  pet: boolean;
  /** Its bounty: what the 1st, 2nd… player to get one is paid. Empty = none (lib/itemHunt bountyFromInput). */
  bounty: number[];
  /** "Closest to it": 'boss:<keys>' / 'skill:<key>', '' for nothing (encodeStat). */
  stat: string;
  /** Still the one picked for it: an item's follows its sources until someone picks by hand. */
  statAuto: boolean;
  /** Boss Rush: the picked bosses that put it on the list, so taking a boss off takes its drops too. Absent = added by hand. */
  rushFrom?: string[];
  /** Boss Rush: its 1-in-N at the commonest picked boss, shown to help set the points. */
  rate?: number | null;
  /** Boss Rush: only each player's first one scores (lib/itemHunt HuntItem.once). */
  once?: boolean;
  /** Boss Rush: only the first player to get one scores it (lib/itemHunt HuntItem.first). */
  first?: boolean;
}

export interface HuntFormValue {
  items: HuntFormItem[];
  rule: HuntRule;
  /** Rule 'points': 'first' scores only each player's first drop of each item. */
  repeat: 'every' | 'first';
  ends: HuntEnding;
  confirm: HuntConfirm;
  /** The prizes shortcut: gp for each paid place, first place first. Empty = none set here. */
  prizes: number[];
  /** Boss Rush: its targets and scoring. */
  rush: RushRules;
}

export const DEFAULT_HUNT: HuntFormValue = { items: [], rule: 'first', repeat: 'every', ends: { kind: 'date' }, confirm: 'staff', prizes: [], rush: DEFAULT_RUSH };

export const encodeStat = (stat: HuntRowStat | null | undefined): string => (stat ? `${stat.type}:${stat.metric}` : '');
export function decodeStat(v: string): HuntRowStat | null {
  const [type, metric] = [v.slice(0, v.indexOf(':')), v.slice(v.indexOf(':') + 1)];
  return (type === 'boss' || type === 'skill') && metric ? { type, metric } : null;
}

/** A new row: items take the sources they were picked with, everything takes its stat from the data. */
export function huntFormRow(t: { id: number; name: string; known?: string[]; sources?: string[]; pet?: boolean; points?: number }): HuntFormItem {
  const pet = !!t.pet;
  const sources = pet ? [] : (t.sources ?? []);
  return {
    id: t.id,
    name: t.name,
    known: pet ? [] : (t.known ?? sources),
    sources,
    anySource: false,
    count: 'drops',
    points: t.points ?? 1,
    pet,
    bounty: [],
    stat: encodeStat(autoRowStat({ id: t.id, name: t.name, sources, pet })),
    statAuto: true,
  };
}

/** What the form posts as `hunt`. */
export function huntPayload(v: HuntFormValue) {
  if (v.rule === 'rush') {
    return {
      v: 2,
      rule: 'rush',
      rush: v.rush,
      repeat: v.repeat,
      items: v.items.map((it) => ({ id: it.id, name: it.name, sources: it.pet || it.anySource ? [] : it.sources, points: it.points, ...(it.first ? { first: true } : it.once ? { once: true } : {}) })),
      confirm: v.confirm,
    };
  }
  return {
    v: 2,
    items: v.items.map((it) => ({
      id: it.id,
      name: it.name,
      sources: it.pet || it.anySource ? [] : it.sources,
      anySource: it.anySource,
      count: it.count,
      points: it.points,
      ...(it.bounty.length ? { bounty: it.bounty } : {}),
      // Sent as chosen, "Nothing" included, so the server never re-picks what someone changed.
      stat: decodeStat(it.stat),
    })),
    rule: v.rule,
    ...(v.rule === 'points' ? { repeat: v.repeat } : {}),
    ends: v.ends,
    confirm: v.confirm,
  };
}

/** The prize ladder the shortcut sets (lib/weeklyPrizes shape), or null when it sets none. */
export function huntPrizesPayload(v: HuntFormValue): { places: { gp: number }[]; payZeroGain: false } | null {
  const places = v.prizes.filter((gp) => gp > 0);
  return places.length > 0 && places.length === v.prizes.length ? { places: places.map((gp) => ({ gp })), payZeroGain: false } : null;
}

/** An item still waiting for its "Counts from" choice, if any. The form refuses to submit on one. */
export function huntUnchosen(v: HuntFormValue): HuntFormItem | null {
  return v.items.find((it) => !it.pet && !it.anySource && it.sources.length === 0) ?? null;
}

export function huntFormFromConfig(config: HuntConfig): HuntFormValue {
  const items = huntRows(config).map((it) => {
    if (config.v !== 2) return { ...huntFormRow({ id: it.id, name: it.name, known: it.sources, sources: it.sources, pet: it.pet }), anySource: !it.pet && it.sources.length === 0, count: it.count, points: it.points ?? 1, bounty: it.bounty ?? [] };
    return {
      id: it.id,
      name: it.name,
      known: it.sources,
      sources: it.sources,
      anySource: !it.pet && it.sources.length === 0,
      count: it.count,
      points: it.points ?? 1,
      pet: !!it.pet,
      bounty: it.bounty ?? [],
      stat: encodeStat(it.stat),
      // What was saved is what was chosen: it does not follow the sources any more.
      statAuto: false,
    };
  });
  const rush = config.rule === 'rush' && config.rush;
  return {
    items: rush ? items.map((it) => { const row = config.items.find((x) => x.id === it.id); return { ...it, points: row?.points ?? 0, once: !!row?.once, first: !!row?.first }; }) : items,
    rule: config.rule,
    repeat: config.repeat ?? 'every',
    ends: config.ends,
    confirm: config.confirm,
    prizes: [],
    rush: rush || DEFAULT_RUSH,
  };
}
