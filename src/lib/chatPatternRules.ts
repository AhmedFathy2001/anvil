// Chat-line overrides — the site's half of the plugin's ChatPatterns registry. The rules and the
// tester, database-free so the staff editor can run them in the browser; lib/chatPatterns holds the
// stored overrides.
//
// The plugin recognises game events from chat lines ("Your Vorkath kill count is: 12.", "You have a
// funny feeling like you're being followed."), and every one of those lines is Jagex's wording, which
// Jagex changes. Until now a rewording broke tracking until a plugin release cleared hub review —
// days, during which nobody's pets, KC or clog unlocks counted. Each line now has a key, a built-in
// regex in the plugin, and an optional override here that every plugin picks up on its next poll.
//
// THE CATALOG IS THE PLUGIN'S. src/data/chatPatterns.json is a copy of the plugin's
// src/main/resources/com/anvil/chat-patterns.json — keys, default regexes, required named groups and
// real sample lines. Refresh the copy when the plugin adds a key; an override for a key the plugin
// does not know is ignored by it, so a stale copy can only hide a key, never break a client.
//
// THE PLUGIN IS THE VALIDATOR OF RECORD. It compiles each override with Java's engine, checks the
// required groups, runs it against its samples and junk under a step budget, and keeps its default
// on anything it rejects. The checks here are the same in spirit and run first so a typo is caught
// before saving, but they run JavaScript's engine, which is close to Java's and not identical
// (possessive quantifiers and atomic groups, for instance, are Java-only). A JS compile failure is a
// warning rather than a refusal for that reason.

import catalogJson from '@/data/chatPatterns.json';

export interface ChatPatternSample {
  line: string;
  expect: Record<string, string>;
}

export interface ChatPatternEntry {
  key: string;
  description: string;
  types: string[];
  /** Which form of the line the regex runs on — see `inputFor`. */
  input: 'plain' | 'raw' | 'tags-stripped' | 'lowercase';
  /** 'full' = the whole line must match; 'find' = anywhere in it. */
  match: 'find' | 'full';
  regex: string;
  groups: string[];
  flags?: string[];
  hint?: string;
  samples: ChatPatternSample[];
}

export const CHAT_PATTERN_CATALOG: { version: number; patterns: ChatPatternEntry[] } = catalogJson as never;

const byKey = new Map(CHAT_PATTERN_CATALOG.patterns.map((p) => [p.key, p]));

export function catalogEntry(key: string): ChatPatternEntry | undefined {
  return byKey.get(key);
}

/** Same ceiling the plugin enforces. */
export const MAX_OVERRIDE_LENGTH = 500;

/**
 * The line as the regex sees it. An approximation of the plugin's own preparation (it strips the
 * game's colour/img tags and normalises non-breaking spaces), good enough for the tester.
 */
export function inputFor(mode: ChatPatternEntry['input'], line: string): string {
  if (mode === 'raw') return line;
  const stripped = line.replace(/<[^>]*>/g, '').replace(/ /g, ' ');
  return mode === 'lowercase' ? stripped.toLowerCase() : stripped;
}

function jsFlags(entry: ChatPatternEntry): string {
  let f = '';
  if (entry.flags?.includes('CASE_INSENSITIVE')) f += 'i';
  if (entry.flags?.includes('DOTALL')) f += 's';
  return f;
}

/** Compile for the tester. Null when JavaScript cannot compile it (Java might — see the header). */
export function compileForTest(entry: ChatPatternEntry, regex: string): RegExp | null {
  try {
    const body = entry.match === 'full' ? `^(?:${regex})$` : regex;
    return new RegExp(body, jsFlags(entry));
  } catch {
    return null;
  }
}

/** Run one line through a pattern the way the plugin would. Null = no match. */
export function testLine(entry: ChatPatternEntry, regex: string, line: string): Record<string, string> | null | 'uncompilable' {
  const re = compileForTest(entry, regex);
  if (!re) return 'uncompilable';
  const m = re.exec(inputFor(entry.input, line));
  if (!m) return null;
  // Every named group, not only the required ones: some keys read optional groups too.
  const groups: Record<string, string> = {};
  for (const g of entry.groups) groups[g] = '';
  for (const [g, v] of Object.entries(m.groups ?? {})) if (v !== undefined) groups[g] = v;
  return groups;
}

export interface OverrideCheck {
  /** Reasons the plugin would refuse it. Saving is refused while this is non-empty. */
  errors: string[];
  /** Things worth a look that the plugin may still accept. */
  warnings: string[];
}

/** The checks the plugin will run, done here first so the editor can say why before saving. */
export function checkOverride(key: string, regex: string): OverrideCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const entry = catalogEntry(key);
  if (!entry) return { errors: [`Unknown key "${key}" — the plugin would ignore it.`], warnings };
  if (!regex.trim()) errors.push('Empty pattern.');
  if (regex.length > MAX_OVERRIDE_LENGTH) errors.push(`Longer than ${MAX_OVERRIDE_LENGTH} characters.`);
  for (const g of entry.groups) {
    if (!regex.includes(`(?<${g}>`)) errors.push(`Missing the named group (?<${g}>…) — the plugin reads it by name.`);
  }
  if (!compileForTest(entry, regex)) {
    warnings.push("JavaScript can't compile this. Java may (possessive/atomic syntax), but double-check it.");
  }
  // Nested unbounded quantifiers are the classic catastrophic-backtracking shape. The plugin budgets
  // every match, so this would be dropped at runtime rather than hang a client — but say so now.
  if (/\((?:[^()]|\\.)*[+*](?:[^()]|\\.)*\)[+*{]/.test(regex)) {
    warnings.push('Nested repetition like (a+)+ can backtrack badly; the plugin will drop it if it runs long.');
  }
  return { errors, warnings };
}
