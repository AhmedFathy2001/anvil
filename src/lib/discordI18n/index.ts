// Which language the bot answers in, and how a locale file gets loaded.
//
// Discord hands us the locale on every interaction — `locale` is the invoking member's own client
// language, `guild_locale` is the server's. That's the whole detection story: no setting to find,
// no profile to fill in, a Danish member gets Danish the first time they type `/bingo board`.
//
// Two wrinkles decided the design:
//
//   A SHARED answer is read by the channel, not by the person who asked. Answering a public post in
//   the sharer's language would put Swedish in front of an English-speaking clan because Sven
//   pressed the button. So private answers use the member's locale and shared ones use the guild's.
//
//   Discord has no Arabic client locale, so `ar` can never arrive by detection — an Arabic-speaking
//   clan's members all report English. That's what the clan-level override is for: set it and it
//   wins outright, because a clan that picks a language has said something detection cannot know.

import { en, type DiscordDict, type PartialDiscordDict } from './en';

export const DEFAULT_LOCALE = 'en';

export interface DiscordLocaleMeta {
  code: string;
  label: string;
  english: string;
  /**
   * Discord's own locale codes that should resolve to this file. Also the keys Discord expects in
   * `name_localizations` / `description_localizations`, which is why they live here and not in a
   * second table that could drift.
   */
  discord: string[];
  reviewed: boolean;
  load: () => Promise<{ default: PartialDiscordDict }>;
}

export const DISCORD_LOCALES: DiscordLocaleMeta[] = [
  { code: 'en', label: 'English', english: 'English', discord: ['en-US', 'en-GB'], reviewed: true, load: async () => ({ default: en }) },
  { code: 'da', label: 'Dansk', english: 'Danish', discord: ['da'], reviewed: false, load: () => import('./da') },
  // No Discord client locale maps here — Discord has no Arabic UI. Reachable via the clan override.
  { code: 'ar', label: 'العربية', english: 'Arabic', discord: [], reviewed: false, load: () => import('./ar') },
  { code: 'sv', label: 'Svenska', english: 'Swedish', discord: ['sv-SE'], reviewed: false, load: () => import('./sv') },
  { code: 'no', label: 'Norsk', english: 'Norwegian', discord: ['no'], reviewed: false, load: () => import('./no') },
  { code: 'fi', label: 'Suomi', english: 'Finnish', discord: ['fi'], reviewed: false, load: () => import('./fi') },
  { code: 'de', label: 'Deutsch', english: 'German', discord: ['de'], reviewed: false, load: () => import('./de') },
  { code: 'nl', label: 'Nederlands', english: 'Dutch', discord: ['nl'], reviewed: false, load: () => import('./nl') },
  { code: 'fr', label: 'Français', english: 'French', discord: ['fr'], reviewed: false, load: () => import('./fr') },
  { code: 'it', label: 'Italiano', english: 'Italian', discord: ['it'], reviewed: false, load: () => import('./it') },
  { code: 'pl', label: 'Polski', english: 'Polish', discord: ['pl'], reviewed: false, load: () => import('./pl') },
  { code: 'es', label: 'Español', english: 'Spanish', discord: ['es-ES', 'es-419'], reviewed: false, load: () => import('./es') },
  { code: 'pt-br', label: 'Português (BR)', english: 'Brazilian Portuguese', discord: ['pt-BR'], reviewed: false, load: () => import('./pt-br') },
  // zh-TW readers get Simplified rather than English: imperfect, but far closer than the fallback.
  { code: 'zh-hans', label: '简体中文', english: 'Simplified Chinese', discord: ['zh-CN', 'zh-TW'], reviewed: false, load: () => import('./zh-hans') },
  { code: 'ja', label: '日本語', english: 'Japanese', discord: ['ja'], reviewed: false, load: () => import('./ja') },
  { code: 'ko', label: '한국어', english: 'Korean', discord: ['ko'], reviewed: false, load: () => import('./ko') },
];

const BY_CODE = new Map(DISCORD_LOCALES.map((l) => [l.code, l]));

/** Discord's locale code → ours. Built from the table above so the two can never disagree. */
const FROM_DISCORD = new Map<string, string>(
  DISCORD_LOCALES.flatMap((l) => l.discord.map((d) => [d.toLowerCase(), l.code] as const)),
);

export function findDiscordLocale(code: string | null | undefined): DiscordLocaleMeta | undefined {
  return code ? BY_CODE.get(code.toLowerCase()) : undefined;
}

/**
 * Resolve one interaction to a locale code.
 *
 * `override` is the clan's setting and wins outright when set. Otherwise the Discord locale, then
 * the language part alone (`de-AT` → `de`, which Discord doesn't send today but costs nothing to
 * tolerate), then English.
 */
export function resolveLocale(discordLocale: string | null | undefined, override?: string | null): string {
  if (override && BY_CODE.has(override)) return override;
  if (!discordLocale) return DEFAULT_LOCALE;
  const exact = FROM_DISCORD.get(discordLocale.toLowerCase());
  if (exact) return exact;
  const base = discordLocale.split('-')[0]?.toLowerCase();
  return (base && (FROM_DISCORD.get(base) ?? (BY_CODE.has(base) ? base : null))) || DEFAULT_LOCALE;
}

/** Merge an overlay onto English. Arrays are atomic; a missing key falls back per-key. */
function overlay<T>(base: T, over: unknown): T {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return (over as T) ?? base;
  const out = { ...(base as object) } as Record<string, unknown>;
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    if (v === undefined) continue;
    const b = (base as Record<string, unknown>)[k];
    out[k] = b && typeof b === 'object' && !Array.isArray(b) ? overlay(b, v) : v;
  }
  return out as T;
}

const CACHE = new Map<string, DiscordDict>();

/** The dictionary for a locale, English-backed. Cached: a busy channel resolves the same file a lot. */
export async function getDiscordDict(code: string): Promise<DiscordDict> {
  const hit = CACHE.get(code);
  if (hit) return hit;
  const locale = BY_CODE.get(code);
  if (!locale || locale.code === DEFAULT_LOCALE) {
    CACHE.set(code, en);
    return en;
  }
  try {
    const mod = await locale.load();
    const merged = overlay(en, mod.default);
    CACHE.set(code, merged);
    return merged;
  } catch {
    // A locale file that fails to import must not take the command down with it.
    CACHE.set(code, en);
    return en;
  }
}

/** `{name}` substitution. Anything not supplied is left alone rather than blanked. */
export function fmt(template: string, vars: Record<string, string | number | null | undefined> = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? whole : String(v);
  });
}

/** Pick the singular or plural string, then interpolate `{n}`. */
export function plural(
  n: number,
  one: string,
  other: string,
  vars: Record<string, string | number | null | undefined> = {},
): string {
  return fmt(n === 1 ? one : other, { n, ...vars });
}

export { en };
export type { DiscordDict, PartialDiscordDict };
