// "Quick settings": the few choices a person is most likely to want to make the moment they become
// part of a clan, because the real settings are spread over five Settings pages. Which switches show,
// for whom, and what each one says, is decided here; nothing in this file reads a database
// (lib/quickSettingsRead gathers the facts), so tests/guided-flows.test.ts runs it directly.
//
// Every switch is an existing setting saved through its existing route: this only describes the
// request to send, so the page and the Settings pages can never disagree about what a switch does.

export type QuickSeat = 'member' | 'guest';

/** One request to an existing settings route. */
export interface QuickRequest {
  url: string;
  method: 'PATCH' | 'POST';
  body: Record<string, unknown>;
}

export interface QuickItem {
  id: string;
  label: string;
  /** What turning it on does, in one plain sentence. */
  sentence: string;
  /** The value right now: nothing changes until the person acts. */
  checked: boolean;
  /** Requests that turn it on / off, in order. */
  on: QuickRequest[];
  off: QuickRequest[];
  /** Hidden while the item with this id is on (it already covers this one). */
  hideWhenOn?: string;
}

export interface QuickGroup {
  heading: string;
  items: QuickItem[];
}

export interface QuickSettingsView {
  clanId: number;
  clanName: string;
  seat: QuickSeat;
  groups: QuickGroup[];
}

/** The most items the block ever shows. */
export const QUICK_MAX_ITEMS = 6;

export interface QuickFacts {
  clanId: number;
  clanName: string;
  seat: QuickSeat;
  /** Which of this clan's Discord posts about a player are actually connected and switched on. */
  clanPosts: { drops: boolean; deaths: boolean; levels: boolean };
  /** The clan refuses posts about people who only guest in it ("Only announce your own members"). */
  clanRefusesGuests: boolean;
  /** The person's own plugin post switches (users.notify_prefs). */
  prefs: { drops: boolean; deaths: boolean; levels: boolean };
  /** users.block_guest_emissions: true = nothing posts in clans where they only guest. */
  blockGuestPosts: boolean;
  /** The person's characters that hold a GUEST seat in this clan, with their per-clan allow. */
  guestCharacters: { accountId: number; allowed: boolean }[];
  /** "DM me important updates" (users.anvil_dms = 'yes'). */
  dms: boolean;
}

const EMISSIONS = '/api/profile/emissions';

export function buildQuickSettings(f: QuickFacts): QuickSettingsView | null {
  const groups: QuickGroup[] = [];
  const clan = f.clanName;

  const posts: QuickItem[] = [];
  if (f.seat === 'member') {
    const pref = (id: 'drops' | 'deaths' | 'levels', label: string, sentence: string) => {
      if (!f.clanPosts[id]) return;
      posts.push({
        id,
        label,
        sentence,
        checked: f.prefs[id],
        on: [{ url: EMISSIONS, method: 'PATCH', body: { notifyPrefs: { [id]: true } } }],
        off: [{ url: EMISSIONS, method: 'PATCH', body: { notifyPrefs: { [id]: false } } }],
      });
    };
    pref('drops', `Post my rare drops in ${clan}'s Discord`, `Announces your valuable and rare drops in ${clan}'s Discord channel.`);
    pref('deaths', `Post my deaths in ${clan}'s Discord`, `Announces it in ${clan}'s Discord channel when you die in game.`);
    pref('levels', `Post my level-ups in ${clan}'s Discord`, `Announces your level-ups and XP milestones in ${clan}'s Discord channel, within the clan's own rules.`);
  } else if (f.guestCharacters.length > 0 && !f.clanRefusesGuests && (f.clanPosts.drops || f.clanPosts.deaths || f.clanPosts.levels)) {
    posts.push({
      id: 'guest-clan',
      label: `Post my activity in ${clan}`,
      sentence: `Announces your drops, deaths, pets and levels in ${clan}'s Discord, and in no other clan where you are a guest.`,
      checked: f.guestCharacters.every((c) => c.allowed),
      on: f.guestCharacters.map((c) => ({ url: EMISSIONS, method: 'PATCH' as const, body: { accountId: c.accountId, clanId: f.clanId, state: 'always' } })),
      off: f.guestCharacters.map((c) => ({ url: EMISSIONS, method: 'PATCH' as const, body: { accountId: c.accountId, clanId: f.clanId, state: 'default' } })),
      hideWhenOn: 'guest-all',
    });
    posts.push({
      id: 'guest-all',
      label: 'Post my activity in every clan where I am a guest',
      sentence: `Announces your drops, deaths, pets and levels in the Discord of every clan you only guest in, ${clan} included. Your own clan always posts, and bingo proofs always reach the board.`,
      checked: !f.blockGuestPosts,
      on: [{ url: EMISSIONS, method: 'PATCH', body: { blockGuestEmissions: false } }],
      off: [{ url: EMISSIONS, method: 'PATCH', body: { blockGuestEmissions: true } }],
    });
  }
  if (posts.length) groups.push({ heading: f.seat === 'member' ? 'What is posted about you' : `Posts about you in ${clan}`, items: posts });

  groups.push({
    heading: 'Messages to you',
    items: [
      {
        id: 'dms',
        label: 'DM me important updates',
        sentence: "Anvil's bot sends you a Discord message about important things only, never marketing. Every message has a Stop button.",
        checked: f.dms,
        on: [{ url: '/api/notices', method: 'POST', body: { action: 'prefs', dms: true } }],
        off: [{ url: '/api/notices', method: 'POST', body: { action: 'prefs', dms: false } }],
      },
    ],
  });

  return { clanId: f.clanId, clanName: f.clanName, seat: f.seat, groups };
}

// ── Remembering that it was dealt with ─────────────────────────────────────────────────────────
// Stored in users.onboarding_skipped, the existing "steps they chose to pass on" JSON list, as one
// `qs:<clanId>` entry per clan. Looking at the step and pressing "Looks good" or "Skip" both write it,
// and neither is ever asked again.

const KEY = /^qs:(\d+)$/;

export const quickDoneEntry = (clanId: number): string => `qs:${clanId}`;

function entries(raw: string | null | undefined): unknown[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function quickSettingsDone(raw: string | null | undefined, clanId: number): boolean {
  return entries(raw).includes(quickDoneEntry(clanId));
}

/** The stored list with this clan's entry added (everything else kept as it was). */
export function withQuickSettingsDone(raw: string | null | undefined, clanId: number): string {
  const list = entries(raw);
  if (!list.includes(quickDoneEntry(clanId))) list.push(quickDoneEntry(clanId));
  return JSON.stringify(list);
}

/** `next` step keys written over the stored list, keeping the quick-settings entries it also holds. */
export function keepQuickEntries(raw: string | null | undefined, next: readonly string[]): string {
  const keep = entries(raw).filter((e): e is string => typeof e === 'string' && KEY.test(e));
  return JSON.stringify([...next, ...keep]);
}
