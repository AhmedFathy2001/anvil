import type { GuideDict, PartialGuideDict } from './en';
import { en } from './en';

// The guide's language registry.
//
// Adding a language is one file (`_i18n/<code>.ts`, exporting a partial of `en`) plus one row here.
// Nothing else in the app changes: routing, the switcher and the contents rail all read this list.
//
// A locale may translate as little as it likes — anything missing falls back to English key by key,
// so a half-finished translation ships as a usable page rather than a broken one. `complete: false`
// says so on the page instead of letting a reader wonder why the copy changes language mid-guide.

export interface LocaleMeta {
  /** URL segment and `lang` attribute. Lowercase; BCP-47 for regional variants. */
  code: string;
  /** Written in the language itself — a reader scanning the switcher is looking for their own word. */
  label: string;
  /** English name, for the `hreflang` title and for staff reading the registry. */
  english: string;
  dir: 'ltr' | 'rtl';
  /** Whether the file covers every key. False renders a "falls back to English" note. */
  complete: boolean;
  /**
   * Whether a speaker of the language has actually read it.
   *
   * Separate from `complete` on purpose: a file can cover every key and still be a translation
   * nobody fluent has checked. Shipping that is fine — a good-enough page in your own language
   * beats a perfect one you can't read — but saying so is what makes it fine, and it's what turns
   * a reader who spots a bad sentence into someone who reports it.
   */
  reviewed: boolean;
  load: () => Promise<{ default: PartialGuideDict }>;
}

/** English is the source of truth: it is never loaded, it IS the fallback. */
export const DEFAULT_LOCALE = 'en';

export const LOCALES: LocaleMeta[] = [
  { code: 'en', label: 'English', english: 'English', dir: 'ltr', complete: true, reviewed: true, load: async () => ({ default: en }) },
  { code: 'da', label: 'Dansk', english: 'Danish', dir: 'ltr', complete: true, reviewed: false, load: () => import('./da') },
  { code: 'ar', label: 'العربية', english: 'Arabic', dir: 'rtl', complete: true, reviewed: false, load: () => import('./ar') },
  { code: 'sv', label: 'Svenska', english: 'Swedish', dir: 'ltr', complete: true, reviewed: false, load: () => import('./sv') },
  { code: 'no', label: 'Norsk', english: 'Norwegian', dir: 'ltr', complete: true, reviewed: false, load: () => import('./no') },
  { code: 'fi', label: 'Suomi', english: 'Finnish', dir: 'ltr', complete: true, reviewed: false, load: () => import('./fi') },
  { code: 'de', label: 'Deutsch', english: 'German', dir: 'ltr', complete: true, reviewed: false, load: () => import('./de') },
  { code: 'nl', label: 'Nederlands', english: 'Dutch', dir: 'ltr', complete: true, reviewed: false, load: () => import('./nl') },
  { code: 'fr', label: 'Français', english: 'French', dir: 'ltr', complete: true, reviewed: false, load: () => import('./fr') },
  { code: 'it', label: 'Italiano', english: 'Italian', dir: 'ltr', complete: true, reviewed: false, load: () => import('./it') },
  { code: 'pl', label: 'Polski', english: 'Polish', dir: 'ltr', complete: true, reviewed: false, load: () => import('./pl') },
  { code: 'es', label: 'Español', english: 'Spanish', dir: 'ltr', complete: true, reviewed: false, load: () => import('./es') },
  { code: 'pt-br', label: 'Português (BR)', english: 'Brazilian Portuguese', dir: 'ltr', complete: true, reviewed: false, load: () => import('./pt-br') },
  { code: 'zh-hans', label: '简体中文', english: 'Simplified Chinese', dir: 'ltr', complete: true, reviewed: false, load: () => import('./zh-hans') },
  { code: 'ja', label: '日本語', english: 'Japanese', dir: 'ltr', complete: true, reviewed: false, load: () => import('./ja') },
  { code: 'ko', label: '한국어', english: 'Korean', dir: 'ltr', complete: true, reviewed: false, load: () => import('./ko') },
];

/**
 * Languages asked for but not yet written. Nothing reads this — it is the to-do list, kept beside
 * the registry so the next person can see the intended set instead of guessing at it. Empty right
 * now: everything that had been asked for is in LOCALES above.
 *
 * To ship one: copy `_i18n/da.ts` to `_i18n/<code>.ts`, translate as much as you have time for
 * (anything you leave out falls back to English), and add its row to LOCALES — `complete: false`
 * until every key is covered, `reviewed: false` until somebody who speaks it has read it through.
 * `npm run test:guides` prints the coverage and fails on a row that claims more than it has. No
 * other file changes.
 */
export const PLANNED_LOCALES: Omit<LocaleMeta, 'load' | 'complete' | 'reviewed'>[] = [];

const BY_CODE = new Map(LOCALES.map((l) => [l.code, l]));

export function findLocale(code: string | undefined): LocaleMeta | undefined {
  return code ? BY_CODE.get(code.toLowerCase()) : undefined;
}

/**
 * Every page under /guide. '' is the index.
 *
 * Named once, here, because three other files iterate it — the language switcher, the index cards
 * and the route wrappers — and a guide missing from one of them is a page nobody can reach in their
 * own language.
 */
export type GuidePage = '' | 'plugin' | 'admin' | 'clan' | 'clan-vs-clan' | 'board' | 'captain' | 'formats' | 'fees' | 'moderator';

/** `/guide/plugin` for English, `/guide/da/plugin` for the rest — English keeps the shareable URL. */
export function guideHref(locale: string, page: GuidePage): string {
  const base = locale === DEFAULT_LOCALE ? '/guide' : `/guide/${locale}`;
  return page ? `${base}/${page}` : base;
}

type Plain = Record<string, unknown>;

/**
 * Overlay a translation on English, key by key.
 *
 * Arrays are atomic: a translated legend replaces the English one whole, because a per-index merge
 * would silently pair a Danish label with an English body the first time someone reorders a list.
 */
function overlay<T>(base: T, over: unknown): T {
  if (over === undefined || over === null) return base;
  if (Array.isArray(base) || typeof base !== 'object' || typeof over !== 'object') return over as T;
  const out: Plain = { ...(base as Plain) };
  for (const [k, v] of Object.entries(over as Plain)) {
    out[k] = k in out ? overlay((base as Plain)[k], v) : v;
  }
  return out as T;
}

const cache = new Map<string, GuideDict>();

/** The dictionary for a locale, with every missing string filled in from English. */
export async function getDict(code: string): Promise<GuideDict> {
  const meta = findLocale(code);
  if (!meta || meta.code === DEFAULT_LOCALE) return en;
  const hit = cache.get(meta.code);
  if (hit) return hit;
  try {
    const mod = await meta.load();
    const merged = overlay(en, mod.default);
    cache.set(meta.code, merged);
    return merged;
  } catch {
    // A registry row whose file isn't written yet reads as English rather than a 500.
    return en;
  }
}

export type { GuideDict, LocaleMeta as GuideLocale };
