// Every Discord destination a clan can configure, as data.
//
// This exists because the same list was written down in three places — the fields the admin page
// renders, the keys `/api/admin/settings` will save, and the keys `/api/admin/discord/webhooks`
// will let the bot create into — and the third one drifted. Adding the coffer channel updated two
// of them, so pasting a URL worked and pressing "Create webhook" answered "Unknown webhook
// setting.": a field that looked configurable and refused to be configured by the one route that
// exists to configure it.
//
// One catalogue, three consumers. A destination added here is rendered, saveable and creatable at
// once, and `tests/webhook-fields.test.ts` fails if a plugin channel is added without a field.
//
// Pure on purpose — both API routes import it, and so does a client component.

/** The sub-tabs the webhooks page is split into. Order is the order they appear in. */
export const WEBHOOK_GROUPS = [
  { id: 'site', label: 'Anvil posts' },
  { id: 'plugin', label: 'Plugin posts' },
  { id: 'filters', label: 'Who gets announced' },
] as const;

export type WebhookGroupId = (typeof WEBHOOK_GROUPS)[number]['id'];

/** A webhook URL destination, a plain text setting, or a boolean — the three shapes on this page. */
export type SettingFieldKind = 'webhook' | 'plain' | 'toggle';

export interface SettingField {
  readonly kind: SettingFieldKind;
  readonly key: string;
  readonly label: string;
  readonly help: string;
  /** `plain` only. */
  readonly placeholder?: string;
}

export interface WebhookSection {
  readonly id: string;
  readonly group: WebhookGroupId;
  readonly title: string;
  readonly blurb: string;
  readonly fields: readonly SettingField[];
}

// `as const` so the keys stay LITERAL: /api/admin/settings types its request body off them, and a
// widened `string[]` would quietly turn that into "any key at all".
export const WEBHOOK_SECTIONS = [
  {
    id: 'master',
    group: 'site',
    title: 'Master announcements webhook',
    blurb:
      'The one channel Anvil posts everything to by default — event start / end, draft, submissions, weekly results, sign-up nudges. Set only this for a simple single-channel setup, or split specific posts into their own channels below.',
    fields: [
      {
        kind: 'webhook',
        key: 'discord_webhook_url',
        label: 'Discord webhook',
        help: 'Paste a webhook URL from Discord → Server Settings → Integrations → Webhooks.',
      },
    ],
  },
  {
    id: 'separate',
    group: 'site',
    title: 'Separate channels',
    blurb:
      'Split bingo, weekly and sign-up posts into their own channels. Leave blank to fall back to the master webhook.',
    fields: [
      {
        kind: 'webhook',
        key: 'discord_webhook_bingo',
        label: 'Bingo events channel',
        help: 'Event start/end, draft, blackout, and submission notifications post here.',
      },
      {
        kind: 'webhook',
        key: 'discord_webhook_weekly',
        label: 'SOTW / BOTW channel',
        help: 'Weekly competition start and results (winner) notifications post here.',
      },
      {
        kind: 'webhook',
        key: 'discord_webhook_signups',
        label: 'Sign-up approvals channel',
        help: 'Posts a fee-payment nudge (pinging the member) each time a sign-up is approved.',
      },
      // The only webhook here with no fallback to the announcements channel. The others carry clan
      // news and a general channel is a fine home for them; this is a running commentary on the
      // clan's money, and a clan that has not asked for it should get silence.
      {
        kind: 'webhook',
        key: 'discord_webhook_coffer',
        label: 'Coffer channel (optional)',
        help: "Every movement of the clan's gp — donations reported and approved, prizes owed and paid, adjustments — each with the balance it leaves behind. Unlike the channels above this one has no fallback: leave it blank and nothing about the coffer is posted anywhere.",
      },
    ],
  },
  {
    id: 'plugin-base',
    group: 'plugin',
    title: 'Plugin notifications',
    blurb:
      'One channel for everything the Anvil plugin posts — drops, pets, deaths, CA tiers, levels, quests, diaries, collection log, PvP kills and clips. Set this and you’re done; split whichever ones you want their own channel below. Members fetch these on launch, so remapping takes effect on their next login.',
    fields: [
      {
        kind: 'webhook',
        key: 'webhook_plugin_default',
        label: 'All plugin notifications',
        help: 'Everything the plugin posts goes here unless you give it a channel of its own below.',
      },
    ],
  },
  {
    id: 'plugin-split',
    group: 'plugin',
    title: 'Split plugin channels',
    blurb:
      'Optional. Leave any of these blank and it uses the channel above; with neither set, that kind of post is off.',
    fields: [
      {
        kind: 'webhook',
        key: 'webhook_rare_drops',
        label: 'Rare drops channel',
        help: 'Valuable drops and pets are posted here by the plugin.',
      },
      {
        kind: 'webhook',
        key: 'webhook_pets',
        label: 'Pets channel',
        help: 'Splits pet drops out of the rare-drops channel. Blank keeps them with the drops.',
      },
      {
        kind: 'webhook',
        key: 'webhook_deaths',
        label: 'Deaths channel',
        help: 'Death notifications (and the occasional surprise) are posted here by the plugin.',
      },
      {
        kind: 'webhook',
        key: 'webhook_combat_achievements',
        label: 'Combat achievements channel',
        help: 'CA tier clears (and high-tier task completions) are posted here by the plugin.',
      },
      {
        kind: 'webhook',
        key: 'webhook_levels',
        label: 'Levels channel',
        help: '99s, total-level milestones and maxes. Blank keeps them with combat achievements.',
      },
      {
        kind: 'webhook',
        key: 'webhook_quests',
        label: 'Quests channel',
        help: 'Quest completions, at whatever difficulty each member has chosen to announce. Blank keeps them with combat achievements.',
      },
      {
        kind: 'webhook',
        key: 'webhook_diaries',
        label: 'Achievement diaries channel',
        help: 'Diary tier completions. Blank keeps them with combat achievements.',
      },
      {
        kind: 'webhook',
        key: 'webhook_collection_log',
        label: 'Collection log channel',
        help: 'New collection log slots. Blank keeps them with combat achievements.',
      },
      {
        kind: 'webhook',
        key: 'webhook_pvp_kills',
        label: 'PvP kills channel',
        help: "When 'Notify on PvP kill' is enabled in the plugin, a screenshot of the kill is posted here.",
      },
      {
        kind: 'webhook',
        key: 'webhook_clips',
        label: 'Clips channel',
        help: "On-demand OBS replay clips (captured via the plugin's clip hotkey) are posted here when small enough for Discord.",
      },
      {
        kind: 'webhook',
        key: 'webhook_leagues',
        label: 'Leagues channel',
        help: 'While a member is on a seasonal (Leagues) world, ALL their notifications go here instead of the channels above — league drops and kill counts are meaningless next to main-game ones, and mixing them makes both channels unreadable. Leave blank to keep everything in the normal channels; seasonal posts are marked either way.',
      },
      {
        kind: 'plain',
        key: 'leagues_icon_url',
        label: 'Leagues icon (optional)',
        placeholder: 'https://oldschool.runescape.wiki/images/...',
        help: "Thumbnail on seasonal posts. Left blank, Anvil looks up the current league's logo from the wiki once a day and falls back to the generic Leagues icon if it can't. Set this to pin a specific image.",
      },
    ],
  },
  {
    id: 'audience',
    group: 'filters',
    title: 'Whose activity',
    blurb:
      'Two halves of one question: the first decides whose activity you HEAR about, the second whose activity COUNTS as yours.',
    fields: [
      {
        kind: 'toggle',
        key: 'block_guest_emissions',
        label: 'Only announce your own members',
        help: "Off by default, so the guests you've admitted to an event have their drops, deaths and combat achievements announced here too. Turn this ON to carry your MEMBERS only, so a visitor guesting for one event doesn't fill your feed with unrelated activity. Bingo submissions from guests always post regardless — this is only about the social notifications. A guest who'd rather stay quiet can silence your clan from their own profile.",
      },
      {
        kind: 'toggle',
        key: 'members_count_guests',
        label: "Count guests in your clan's activity",
        help: "Off by default. The Members page headline, the week's podium and your clan EHP/EHB are your members' — a guest is somebody we have seen who is not on your roster, and their hours are not your clan's. Turn this on if your regulars never formally join and you want them counted. Guests appear in the member list either way.",
      },
    ],
  },
] as const satisfies readonly WebhookSection[];

// Widened back to the interface before flattening: the const tuple's per-section literal types make
// flatMap infer a union of tuples rather than one list.
const SECTIONS: readonly WebhookSection[] = WEBHOOK_SECTIONS;

export const ALL_SETTING_FIELDS: readonly SettingField[] = SECTIONS.flatMap((s) => [...s.fields]);

export type WebhookPageSettingKey = (typeof WEBHOOK_SECTIONS)[number]['fields'][number]['key'];

/** Every settings key this page owns — what `/api/admin/settings` must expose to save any of it. */
export const WEBHOOK_PAGE_SETTING_KEYS = ALL_SETTING_FIELDS.map((f) => f.key) as WebhookPageSettingKey[];

/** The subset a bot-created webhook URL may be written to. */
export const WEBHOOK_URL_KEYS = ALL_SETTING_FIELDS.filter((f) => f.kind === 'webhook').map((f) => f.key);

// ── Search ──────────────────────────────────────────────────────────────────────────────────────

/** Lowercased words, punctuation dropped, so "sign-up" finds "sign up" and "SOTW/BOTW" finds sotw. */
export function searchTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

export const groupLabel = (id: WebhookGroupId): string =>
  WEBHOOK_GROUPS.find((g) => g.id === id)?.label ?? id;

/**
 * Everything a field can be searched BY: its label and help, its section and tab, and its settings
 * key. The key matters more than it looks — the plugin docs and the wire format talk about
 * `webhook_rare_drops`, so somebody arriving from either will type that.
 */
function haystackOf(section: WebhookSection, field: SettingField): string[] {
  return searchTokens(
    `${field.label} ${field.help} ${field.key} ${section.title} ${section.blurb} ${groupLabel(section.group)}`,
  );
}

export interface FieldMatch {
  section: WebhookSection;
  field: SettingField;
}

const hitsAll = (terms: string[], words: string[]) => terms.every((t) => words.some((w) => w.startsWith(t)));

/**
 * How well a field answers the query. Matching on help text is generous on purpose — the pets field
 * says it splits out of the rare-drops channel, so a search for "rare drops" reaches it, which is
 * useful — but the field actually NAMED by the query has to come first, or the generosity buries
 * the answer under its own cross-references.
 */
function scoreOf(field: SettingField, terms: string[]): number {
  return (
    (hitsAll(terms, searchTokens(field.key)) ? 100 : 0) +
    (hitsAll(terms, searchTokens(field.label)) ? 50 : 0)
  );
}

/**
 * Fields matching every word of the query, across all tabs, best first.
 *
 * Every term has to hit, so extra words narrow instead of widen. Prefix rather than exact, so a
 * search is useful while it is still being typed: "coff" finds the coffer channel and "drop" finds
 * drops. An empty query matches nothing rather than everything — the caller shows its tabs instead.
 */
export function searchFields(query: string): FieldMatch[] {
  const terms = searchTokens(query);
  if (terms.length === 0) return [];
  const out: (FieldMatch & { score: number })[] = [];
  for (const section of SECTIONS) {
    for (const field of section.fields) {
      if (hitsAll(terms, haystackOf(section, field))) {
        out.push({ section, field, score: scoreOf(field, terms) });
      }
    }
  }
  // Stable: equal scores keep catalogue order, which is the order the page reads in.
  return out
    .map((m, i) => ({ m, i }))
    .sort((a, b) => b.m.score - a.m.score || a.i - b.i)
    .map(({ m }) => ({ section: m.section, field: m.field }));
}
