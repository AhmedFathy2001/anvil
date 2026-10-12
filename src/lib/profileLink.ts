// Where a profile opens, from its URL: ?tab=, ?stat=, ?page= (a log page). Its own module — not the
// client tab component — because the server pages read it from searchParams, and a server component
// can't call into a 'use client' module.

export type ProfileTab = 'stats' | 'records' | 'collection' | 'luck' | 'trophies';
export type ProfileStatKind = 'skills' | 'bosses' | 'clues' | 'minigames';

/** The URL spelling of each tab — "overview" reads better in a link than the internal "stats". */
export const TAB_SLUG: Record<ProfileTab, string> = {
  stats: 'overview',
  records: 'records',
  collection: 'collection',
  luck: 'luck',
  trophies: 'trophies',
};

export interface ProfileLinkState {
  tab?: ProfileTab;
  stat?: ProfileStatKind;
  page?: string;
}

export function profileLinkState(sp: Record<string, string | string[] | undefined>): ProfileLinkState {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? undefined;
  const tabSlug = one(sp.tab);
  const tab = (Object.keys(TAB_SLUG) as ProfileTab[]).find((t) => TAB_SLUG[t] === tabSlug);
  const stat = one(sp.stat);
  const page = one(sp.page);
  return {
    // A log page only lives on the Collection tab, so naming one opens it.
    tab: tab ?? (page ? 'collection' : undefined),
    stat: stat === 'skills' || stat === 'bosses' || stat === 'clues' || stat === 'minigames' ? stat : undefined,
    page: page || undefined,
  };
}
