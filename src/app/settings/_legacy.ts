import { redirect } from 'next/navigation';

type Params = Record<string, string | string[] | undefined>;

/**
 * An old Settings address (/settings/look, /settings/chat, …): on to the page that holds it now.
 *
 * The section rides as `?at=<id>`, not as a #fragment: a redirect without a fragment keeps the one
 * the old link carried (/settings/announcements#screenshot-privacy still lands on that section, whose
 * id never changed), and components/SettingsAt turns `at` into the fragment when there was none.
 * Every other query parameter (?connect=, ?twitch=) is passed on as it was.
 */
export async function legacyRedirect(page: string, at: string, searchParams?: Promise<Params>): Promise<never> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries((await searchParams) ?? {})) {
    if (k === 'at') continue;
    for (const one of Array.isArray(v) ? v : v == null ? [] : [v]) q.append(k, one);
  }
  q.set('at', at);
  redirect(`${page}?${q.toString()}`);
}

/** Where each old page went, for the redirects and the tests. */
export const LEGACY_SETTINGS: Record<string, { page: string; at: string }> = {
  look: { page: '/settings/profile', at: 'look' },
  supporter: { page: '/settings/profile', at: 'plan' },
  boosts: { page: '/settings/profile', at: 'boosts' },
  chat: { page: '/settings/in-game', at: 'chat-feed' },
  plugin: { page: '/settings/in-game', at: 'plugin' },
  add: { page: '/settings/characters', at: 'add' },
  claims: { page: '/settings/characters', at: 'claims' },
  notifications: { page: '/settings/posts', at: 'notifications' },
  announcements: { page: '/settings/posts', at: 'discord-posts' },
  webhooks: { page: '/settings/posts', at: 'webhooks' },
  connections: { page: '/settings/account', at: 'streaming' },
  privacy: { page: '/settings/account', at: 'privacy' },
};
