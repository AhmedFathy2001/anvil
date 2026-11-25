// Everything Anvil holds about one person, in one list.
//
// Deleting an account and exporting its data are the same question asked twice: "where is this
// person written down?". Two separate answers would drift, and the drift is silent in both
// directions — a table the delete forgot keeps personal data, a table the export forgot hides it. So
// there is ONE list. lib/erasePerson walks it to delete, lib/exportPerson walks it to export, and
// tests/person-data-inventory.test.ts fails when the schema grows a column that points at `users`,
// `players` or `accounts` and nobody has said here what happens to it.
//
// THE RULE THAT DECIDES EVERY ROW: a clan owns its seats (a roster row is the clan's record of an
// in-game clan member, sourced from the game), a person owns their Anvil account and characters.
// Deleting a person removes the person, not the clan's records.
//
//   delete  the row is the person's and goes
//   detach  the row is a clan's or the platform's and stays; it stops pointing at the person
//   keep    the row is a clan's record of a character (keyed by seat or character) and stays as is
//
// Pure: no database, no `@/` imports, so the tests need neither.

import { parseStamp } from './dbTime';

export type Handling = 'delete' | 'detach' | 'keep';

/**
 * What a row is found by.
 *   user        users.id            the login
 *   player      players.id          the person
 *   account     accounts.id         each of their characters
 *   seat        clan_memberships.id each roster seat of those characters
 *   participant event_participants.id each event entry of those characters
 */
export type PersonKey = 'user' | 'player' | 'account' | 'seat' | 'participant';

/**
 * How the handling is carried out.
 *   fk      the schema's ON DELETE does it when the users / players row is deleted (the test checks
 *           the action still matches: cascade for delete, set null for detach)
 *   sql     one plain statement run by erasePerson: DELETE, or UPDATE ... SET column = NULL
 *   custom  a named step in erasePerson (the reason says which)
 *   none    nothing is written (keep)
 */
export type Via = 'fk' | 'sql' | 'custom' | 'none';

export interface PersonDataEntry {
  table: string;
  column: string;
  key: PersonKey;
  handling: Handling;
  via: Via;
  why: string;
  /** Other columns blanked in the same statement as a `sql` detach (free text the person typed). */
  scrub?: string[];
  /**
   * What the export shows from this table: the section it goes under and the columns allowed out.
   * `tie` is how a row found through a CHARACTER (by account, seat or event entry) is shown to
   * belong to the person asking; see ExportTie. Required on every such entry.
   */
  export?: { section: string; columns: string[]; tie?: ExportTie };
}

/**
 * A CHARACTER CHANGES HANDS (release, a claim transfer), and the rows that hang off it stay. So a
 * row found by account, seat or event entry may be a PREVIOUS holder's, and exporting it would hand
 * one person another's data. Each such entry says how its rows are tied to the requester:
 *
 *   writer   the row names who wrote it; only rows naming this login / person leave
 *   since    the row carries a time; only rows from when this person claimed the character leave
 *            (accounts.claimed_at, which a release clears and the next claim sets). No claim time on
 *            record = nothing leaves.
 *   unowned  nothing ties the row to anybody, so it must list no personal or free-text column:
 *            ids, dates and results only (the test holds the list to that)
 */
export type ExportTie = { writer: string; key: 'user' | 'player' } | { since: string } | { unowned: true };

/** Keys that find a row through a character rather than through the person. */
export const CHARACTER_KEYS: readonly PersonKey[] = ['account', 'seat', 'participant'];

/** Column names that hold what somebody typed or said about themselves. Never in an `unowned` export. */
export const FREE_TEXT_COLUMN =
  /(^|_)(discord|timezone|profile_data|answers|message|note|notes|body|contact|email|reason|description|details|text|label|title|payload|props|url|style)($|_)/i;

type Opt = Pick<PersonDataEntry, 'scrub' | 'export'>;
const e = (table: string, column: string, key: PersonKey, handling: Handling, via: Via, why: string, opt: Opt = {}): PersonDataEntry => ({
  table,
  column,
  key,
  handling,
  via,
  why,
  ...opt,
});
const ex = (section: string, ...columns: string[]) => ({ export: { section, columns } });
const tied = (tie: ExportTie, x: { export: { section: string; columns: string[] } }) => ({ export: { ...x.export, tie } });

/** A staff or author pointer on somebody else's record: the record stays, the pointer is cleared. */
const actor = (table: string, column: string): PersonDataEntry =>
  e(table, column, 'user', 'detach', 'fk', 'who did it, on a clan or platform record; the record stays without a name on it');

/** A row that exists only for this login: it goes with it. */
const own = (table: string, column: string, why: string, opt: Opt = {}): PersonDataEntry => e(table, column, 'user', 'delete', 'fk', why, opt);

/** Columns of the `users` row the export may show. Never a token, a hash or the legacy password. */
export const USER_EXPORT_COLUMNS = [
  'id', 'display_name', 'created_at', 'last_login_at', 'discord_id', 'discord_username', 'discord_global_name', 'discord_avatar', 'email',
  'onboarding_completed_at', 'onboarding_skipped', 'onboarding_intent', 'block_guest_emissions', 'level_posts_clan', 'level_rules',
  'notify_prefs', 'referral_code', 'supporter_style', 'announce_supporter', 'supporter_wall', 'game_chat_flair', 'chat_feed_prefs',
  'anvil_dms', 'notice_sound',
] as const;

export const PERSON_DATA: PersonDataEntry[] = [
  // ── The login and the person ────────────────────────────────────────────────────────────────────
  e('users', 'id', 'user', 'delete', 'custom', 'the login itself: name, email, Discord id, username and avatar, plugin token, preferences, Supporter look', ex('account', ...USER_EXPORT_COLUMNS)),
  e('users', 'player_id', 'player', 'delete', 'custom', 'the same row, found from the person; erasePerson deletes it by id'),
  e('users', 'banned_by_user_id', 'user', 'detach', 'sql', 'who banned somebody else; no foreign key, so cleared by hand'),
  e('users', 'created_by', 'user', 'detach', 'sql', 'who created somebody else’s login; no foreign key, so cleared by hand'),
  e('players', 'id', 'player', 'delete', 'custom', 'the person: display name and the two profile privacy switches', ex('person', 'id', 'display_name', 'link_accounts_publicly', 'discover_events', 'created_at')),

  // ── Characters ──────────────────────────────────────────────────────────────────────────────────
  e('accounts', 'player_id', 'player', 'detach', 'custom',
    'a character on any clan’s roster or event stays as an unclaimed name (as releaseCharacter leaves it) with its proof, Discord id, account hash, look and live stats cleared; a character on no clan record is deleted',
    ex('characters', 'id', 'rsn', 'previous_rsns', 'status', 'is_primary', 'account_type', 'verified_at', 'verification_method', 'claimed_at', 'created_at')),
  e('accounts', 'verified_by_user_id', 'user', 'detach', 'fk', 'who approved somebody else’s character'),

  // Per character. These say what happens for a character that STAYS on a clan record; a character
  // on no clan record is deleted outright and every one of these goes with it.
  e('account_clan_emission', 'account_id', 'account', 'delete', 'sql', 'their per-clan announcement choices', tied({ since: 'updated_at' }, ex('preferences', 'account_id', 'clan_id', 'enabled', 'updated_at'))),
  e('account_game_clans', 'account_id', 'account', 'delete', 'sql', 'the in-game clan their own plugin reported', tied({ since: 'observed_at' }, ex('characters_game_clans', 'account_id', 'rank', 'title', 'joined_on', 'observed_at'))),
  e('account_media', 'account_id', 'account', 'delete', 'sql', 'character picture and banner; the stored images are deleted after', tied({ writer: 'owner_player_id', key: 'player' }, ex('profile_media', 'account_id', 'avatar_url', 'banner_url', 'updated_at'))),
  e('account_media', 'owner_player_id', 'player', 'delete', 'sql', 'the same pictures, found by who uploaded them (no foreign key)'),
  e('account_ownership_claims', 'account_id', 'account', 'delete', 'sql', 'disputes over who owns the character'),
  // ── Guides ──────────────────────────────────────────────────────────────────────────────────────
  e('player_item_snapshots', 'account_id', 'account', 'delete', 'sql', 'bank, inventory, worn gear and looting bag their plugin shared for guides, and its spellbook, rune pouch and unlocked prayers for the pre-trip check'),
  e('trip_setups', 'account_id', 'account', 'delete', 'sql', 'their own saved setups for the pre-trip check'),
  e('guide_item_skips', 'account_id', 'account', 'delete', 'sql', 'items they marked as skipped or unaffordable in guides'),
  e('guide_viewer_prefs', 'account_id', 'account', 'delete', 'sql', 'their guide budget cap and view choices'),
  e('guide_setup_votes', 'account_id', 'account', 'detach', 'sql', 'the character a "used it" vote was made on (the vote itself goes with the login)'),
  own('guide_edit_credits', 'user_id', 'their guide-writing credit'),
  own('guide_reports', 'user_id', 'guide pieces they reported'),
  own('guide_route_follows', 'user_id', 'progression routes they follow and their ticks'),
  own('guide_setup_votes', 'user_id', 'their "used it" votes on guide setups'),
  own('guide_tip_votes', 'user_id', 'their votes on guide tips'),
  own('guide_views', 'user_id', 'guides they opened'),
  own('guide_writer_awards', 'user_id', 'writer awards they were given'),
  e('guide_contributions', 'author_user_id', 'user', 'detach', 'fk', 'guide pieces they wrote stay in the shared guide without their name'),
  e('guide_tips', 'author_user_id', 'user', 'detach', 'fk', 'guide tips they wrote stay without their name'),
  e('guide_wanted', 'requested_by_user_id', 'user', 'detach', 'fk', 'a Wanted request they made stays without their name'),
  e('guide_wanted', 'filled_by_user_id', 'user', 'detach', 'fk', 'a Wanted request they filled stays without their name'),
  e('account_period_baselines', 'account_id', 'account', 'keep', 'none', 'hiscores numbers for the character, public game data the roster record is built from'),
  e('account_plugin_seen', 'account_id', 'account', 'delete', 'sql', 'when their plugin was last seen'),
  e('account_records', 'account_id', 'account', 'keep', 'none', 'best day / week, worked out from hiscores'),
  e('account_sighting_days', 'account_id', 'account', 'delete', 'sql', 'which login played the character on which day'),
  e('account_sightings', 'account_id', 'account', 'delete', 'sql', 'which login played the character'),
  e('account_stat_snapshots', 'account_id', 'account', 'keep', 'none', 'the last hiscores page for the character'),
  e('analytics_events', 'account_id', 'account', 'delete', 'sql', 'usage events tied to the character'),
  e('character_reports', 'account_id', 'account', 'delete', 'sql', 'reports and claim requests about the character'),
  e('clan_bans', 'account_id', 'account', 'delete', 'custom', 'which character prompted a ban; the ban row goes with the person (clan_bans.player_id), so nothing is left to clear'),
  e('clan_join_requests', 'account_id', 'account', 'delete', 'sql', 'their requests to join a clan', tied({ writer: 'player_id', key: 'player' }, ex('clan_join_requests', 'clan_id', 'account_id', 'status', 'message', 'source', 'requested_at', 'decided_at'))),
  e('clan_memberships', 'account_id', 'account', 'keep', 'none', 'THE SEAT: the clan’s record that this in-game name is or was in the clan',
    tied({ unowned: true }, ex('clan_memberships', 'id', 'clan_id', 'account_id', 'kind', 'rank', 'source', 'joined_at', 'left_at', 'ingame_joined_on'))),
  e('clans', 'ingame_name_claimed_by_account_id', 'account', 'keep', 'none', 'which character proved the clan’s in-game name; the clan’s record'),
  e('display_case_items', 'account_id', 'account', 'delete', 'sql', 'their profile display case'),
  e('event_participants', 'account_id', 'account', 'keep', 'custom',
    'the clan’s event entry stays under the in-game name; the Discord name, timezone and player token on it are cleared',
    tied({ unowned: true }, ex('event_entries', 'id', 'event_id', 'account_id', 'name', 'team_id', 'pick_number', 'deaths', 'loot_gp_gained', 'pvp_kills', 'minutes_played'))),
  e('feed_items', 'account_id', 'account', 'keep', 'none', 'which clan feed posts were already made for the character, so none is posted twice'),
  e('forge_player_events', 'account_id', 'account', 'delete', 'sql', 'queued plugin events for the character'),
  e('guest_presence', 'account_id', 'account', 'delete', 'sql', 'where the character was last seen as a guest'),
  e('h2h_challenges', 'challenger_account_id', 'account', 'delete', 'sql', 'head-to-head challenges are between two people, not a clan’s event'),
  e('h2h_challenges', 'opponent_account_id', 'account', 'delete', 'sql', 'head-to-head challenges are between two people, not a clan’s event'),
  e('hiscores_fetches', 'account_id', 'account', 'delete', 'sql', 'queued hiscores lookups (no foreign key)'),
  e('lab_log', 'account_id', 'account', 'keep', 'none', 'the staff test lab’s request log'),
  e('member_clog', 'account_id', 'account', 'delete', 'sql', 'collection log their plugin synced'),
  e('member_clog_items', 'account_id', 'account', 'delete', 'sql', 'collection log their plugin synced'),
  e('member_clog_kc', 'account_id', 'account', 'delete', 'sql', 'collection log their plugin synced'),
  e('member_daily_stats', 'account_id', 'account', 'keep', 'none', 'daily hiscores gains; clan weeklies and leaderboards read them'),
  e('member_milestones', 'account_id', 'account', 'keep', 'none', 'which level milestones were already announced'),
  e('member_personal_bests', 'account_id', 'account', 'delete', 'sql', 'personal bests their plugin synced'),
  e('member_progress', 'account_id', 'account', 'delete', 'sql', 'quest / diary progress their plugin synced'),
  e('member_progress_items', 'account_id', 'account', 'delete', 'sql', 'quest / diary progress their plugin synced'),
  e('player_goals', 'account_id', 'account', 'delete', 'sql', 'their saved goals', tied({ since: 'created_at' }, ex('goals', 'account_id', 'kind', 'metric', 'target', 'due_on', 'created_at'))),
  e('player_snapshots', 'account_id', 'account', 'keep', 'none', 'start / end numbers of a clan’s weekly competition'),

  // ── Named by the person (players) ───────────────────────────────────────────────────────────────
  e('account_ownership_claims', 'claimant_player_id', 'player', 'delete', 'fk', 'their claim on a character'),
  e('account_ownership_claims', 'owner_player_id', 'player', 'delete', 'fk', 'a claim made against them'),
  e('character_reports', 'claimant_player_id', 'player', 'detach', 'fk', 'who asked for somebody else’s character'),
  e('clan_bans', 'player_id', 'player', 'delete', 'fk',
    'A BAN SURVIVES, BUT NOT HERE. Before the person is deleted, a ban still in force is copied to banned_discord_ids (Discord id, clan, date, and the clan’s own reason with their Discord id and name taken out); these rows then go with the person. A lifted ban is simply deleted.'),
  e('clan_join_requests', 'player_id', 'player', 'delete', 'sql', 'their requests to join a clan'),
  e('event_invites', 'player_id', 'player', 'delete', 'fk', 'an invite is an offer to them, not a record of anything that happened'),
  e('h2h_challenges', 'cancel_requested_by', 'player', 'detach', 'fk', 'who asked to cancel'),
  e('h2h_challenges', 'challenger_player_id', 'player', 'delete', 'fk', 'head-to-head challenges are between two people', ex('challenges', 'id', 'kind', 'label', 'status', 'created_at', 'finished_at')),
  e('h2h_challenges', 'opponent_player_id', 'player', 'delete', 'fk', 'head-to-head challenges are between two people', ex('challenges', 'id', 'kind', 'label', 'status', 'created_at', 'finished_at')),
  e('h2h_prefs', 'player_id', 'player', 'delete', 'fk', 'their challenge settings; other people’s block lists drop them too', ex('preferences', 'closed', 'updated_at')),

  // ── Rows that exist only for this login ─────────────────────────────────────────────────────────
  own('account_change_requests', 'requested_by_user_id', 'their request to swap character in an event'),
  own('account_ownership_claims', 'claimant_user_id', 'their claim on a character'),
  own('account_sighting_days', 'user_id', 'which characters this login played'),
  own('account_sightings', 'user_id', 'which characters this login played'),
  own('clan_boosts', 'user_id', 'the Supporter boosts they placed on clans', ex('supporter_boosts', 'clan_id', 'slot', 'placed_at', 'ended_at', 'end_reason')),
  own('clan_event_rsvps', 'user_id', 'their “I’m coming” on a clan calendar event', ex('clan_event_rsvps', 'clan_event_id', 'occurrence', 'created_at')),
  own('clan_event_signups', 'user_id', 'their sign-up to a clan calendar event. The column cannot be empty, so the row cannot stay without them',
    ex('clan_event_signups', 'clan_id', 'clan_event_id', 'occurrence', 'rsn', 'answers', 'status', 'fee_amount', 'fee_status', 'proof_url', 'created_at')),
  own('clan_ownership_transfers', 'from_user_id', 'a past hand-over of a clan (a current owner cannot delete)'),
  own('clan_ownership_transfers', 'to_user_id', 'a hand-over of a clan to them'),
  own('clan_staff', 'user_id', 'their staff roles in clans', ex('roles', 'clan_id', 'role', 'can_edit_tiles', 'can_edit_guides', 'can_pay_plan', 'created_at')),
  own('detected_accounts', 'user_id', 'characters their plugin saw, and the ones they ignored', ex('detected_characters', 'rsn', 'status', 'detected_at', 'last_seen_at')),
  own('display_case_items', 'user_id', 'their profile display case', ex('display_case', 'position', 'kind', 'account_id', 'item_id', 'stat_key', 'created_at')),
  own('draft_shortlists', 'user_id', 'their private draft notes'),
  own('event_chat_messages', 'user_id', 'what they wrote in event chat', ex('event_chat_messages', 'event_id', 'channel', 'rsn', 'body', 'created_at', 'deleted_at')),
  own('event_chat_mutes', 'user_id', 'a chat mute on them'),
  own('event_chat_reads', 'user_id', 'how far they had read'),
  own('event_editors', 'user_id', 'their board editor and treasurer grants', ex('roles_events', 'event_id', 'role', 'created_at')),
  own('event_gate_claims', 'user_id', 'the streaming account they used to get into an event'),
  own('event_twitch_claims', 'user_id', 'the Twitch account they used to get into an event'),
  own('guest_presence', 'user_id', 'where they were last seen as a guest'),
  own('guide_proposals', 'proposer_user_id', 'guide changes they proposed', ex('guide_proposals', 'id', 'title', 'summary', 'body', 'note', 'status', 'created_at')),
  own('kick_link_codes', 'user_id', 'one-time codes for linking Kick'),
  own('library_proposals', 'proposer_user_id', 'library changes they proposed', ex('library_proposals', 'id', 'kind', 'payload', 'note', 'status', 'created_at')),
  own('moment_reactions', 'user_id', 'their reactions', ex('reactions', 'moment_id', 'kind', 'created_at')),
  own('owner_trials', 'user_id', 'a trial given to them'),
  own('platform_act_as', 'user_id', 'staff access they borrowed'),
  own('platform_notice_reads', 'user_id', 'which notices they read'),
  own('plugin_device_codes', 'user_id', 'plugin sign-in codes', ex('plugin_sign_ins_codes', 'status', 'created_at', 'expires_at')),
  own('plugin_link_codes', 'user_id', 'plugin link codes'),
  own('plugin_links', 'user_id', 'every plugin sign-in and device link', ex('plugin_sign_ins', 'id', 'created_at', 'last_used_at', 'revoked_at')),
  own('profile_media', 'user_id', 'profile picture and banner; the stored images are deleted after', ex('profile_media', 'avatar_url', 'banner_url', 'updated_at')),
  own('referrals', 'referred_user_id', 'who invited them'),
  own('referrals', 'referrer_user_id', 'who they invited', ex('referrals', 'kind', 'status', 'reward_months', 'created_at')),
  own('supporter_gift_intents', 'buyer_user_id', 'an unfinished gift checkout'),
  own('supporter_gift_intents', 'recipient_user_id', 'an unfinished gift checkout'),
  // A chip-in keeps counting for the clan (the membership is still Gumroad's to end): the name comes off it.
  e('clan_fund_pledges', 'user_id', 'user', 'detach', 'fk', 'their chip-ins to a clan fund; the chip-in stays without a name on it',
    ex('clan_fund', 'clan_id', 'cents', 'status', 'started_at', 'current_period_end', 'ended_at')),
  own('supporter_subscriptions', 'user_id', 'their Supporter membership rows',
    ex('supporter', 'tier', 'status', 'recurrence', 'started_at', 'tenure_started_at', 'current_period_end', 'ended_at', 'gift_months')),
  own('team_staff', 'user_id', 'their team staff seats', ex('roles_teams', 'team_id', 'created_at')),
  own('tile_claims', 'user_id', 'their “I’m on this tile” notes'),
  own('user_connected_prefs', 'user_id', 'which linked accounts show on their profile', ex('preferences', 'platform', 'show_on_profile', 'updated_at')),
  own('user_discord_tokens', 'user_id', 'the Discord sign-in keys'),
  own('user_first_touch', 'user_id', 'where they first came from'),
  own('user_kick_links', 'user_id', 'linked Kick account', ex('linked_accounts', 'kick_username', 'linked_at')),
  own('user_medal_links', 'user_id', 'linked Medal account', ex('linked_accounts', 'medal_username', 'linked_at')),
  own('user_notices', 'user_id', 'their inbox', ex('notices', 'kind', 'title', 'body', 'created_at', 'read_at')),
  own('user_twitch_links', 'user_id', 'linked Twitch account', ex('linked_accounts', 'twitch_login', 'linked_at', 'clip_my_moments')),
  own('user_webhooks', 'user_id', 'their personal Discord webhooks', ex('webhooks', 'label', 'kinds', 'created_at')),
  own('user_youtube_links', 'user_id', 'linked YouTube channel', ex('linked_accounts', 'youtube_title', 'linked_at')),
  own('user_youtube_proofs', 'user_id', 'YouTube membership checks'),
  own('verification_attempts', 'user_id', 'their attempts to prove a character', ex('verification_attempts', 'rsn', 'created_at', 'completed_at', 'succeeded')),

  // ── About the person, on a record that is not theirs ────────────────────────────────────────────
  e('analytics_events', 'user_id', 'user', 'delete', 'sql', 'usage events; the schema would only blank the user, which leaves a trail tied together by its session id'),
  e('clan_event_survey_responses', 'user_id', 'user', 'detach', 'fk', 'the clan’s survey answers stay, with no name on them', ex('survey_answers', 'clan_event_id', 'answers', 'submitted_at')),
  e('survey_responses', 'user_id', 'user', 'detach', 'fk', 'the clan’s survey answers stay, with no name on them', ex('survey_answers', 'event_id', 'answers', 'submitted_at')),
  e('event_discord_members', 'user_id', 'user', 'delete', 'custom', 'holds their Discord id; deleted by login and by Discord id'),
  e('event_signups', 'user_id', 'user', 'detach', 'custom',
    'the clan’s sign-up record (team, status, fees) stays on the seat; the schema would delete it, so it is detached first and the answers they typed are emptied',
    ex('event_signups', 'event_id', 'clan_member_id', 'profile_data', 'status', 'signed_up_at')),
  e('feedback', 'user_id', 'user', 'detach', 'sql', 'the feedback text stays; who sent it and the contact they left are cleared', { scrub: ['contact'], ...ex('feedback', 'kind', 'subject', 'body', 'contact', 'page_url', 'created_at') }),
  e('player_event_facts', 'user_id', 'user', 'detach', 'fk', 'event results stay with the clan under the in-game name', ex('event_results', 'event_id', 'rsn', 'points', 'tiles_contributed', 'tiles_finished', 'submissions', 'xp_gained', 'kc_gained', 'team_rank', 'teams_total')),
  e('stream_highlights', 'user_id', 'user', 'delete', 'custom', 'clips from THEIR OWN channel are deleted; a clip on the host’s channel stays without them', ex('stream_highlights', 'event_id', 'platform', 'channel_owner', 'channel_name', 'title', 'clip_url', 'occurred_at')),
  e('submission_attachments', 'user_id', 'user', 'detach', 'fk', 'extra proof on a clan’s event submission: it stays as evidence', ex('proofs_attached', 'submission_id', 'kind', 'url', 'label', 'created_at')),
  e('tile_suggestions', 'user_id', 'user', 'detach', 'fk', 'a tile idea given to a clan stays, with no name on it', ex('tile_suggestions', 'event_id', 'title', 'details', 'status', 'created_at')),
  e('unmatched_purchases', 'attached_user_id', 'user', 'detach', 'custom', 'a payment record stays; the buyer email on it is cleared'),
  e('proof_uploads', 'user_id', 'user', 'detach', 'custom',
    'an image used as proof in a clan’s event stays, without the uploader; an upload no event uses is deleted, and the stored image with it (no foreign key)',
    ex('proofs_uploaded', 'url', 'via', 'event_id', 'created_at')),
  e('tile_locks', 'user_id', 'user', 'delete', 'sql', 'a short-lived editing lock carrying their name (no foreign key)'),

  // ── Clan records found through the seat or the event entry: all stay ────────────────────────────
  e('clan_audit_log', 'clan_member_id', 'seat', 'keep', 'custom',
    'the clan’s log about its seat stays whole; their Discord id and username inside a row are replaced with [deleted]', tied({ unowned: true }, ex('audit_about_my_seats', 'clan_id', 'event_type', 'occurred_at'))),
  e('moments', 'clan_member_id', 'seat', 'keep', 'none', 'drops and achievements on the clan’s feed, under the in-game name',
    tied({ since: 'occurred_at' }, ex('moments', 'id', 'rsn', 'kind', 'event_id', 'item_name', 'quantity', 'value_gp', 'source', 'occurred_at'))),
  e('weekly_participants', 'clan_member_id', 'seat', 'keep', 'none', 'weekly competition standings', tied({ unowned: true }, ex('weekly_entries', 'competition_id', 'rsn', 'baseline_value', 'current_value', 'opted_out'))),
  e('payouts', 'clan_member_id', 'seat', 'keep', 'none', 'the clan’s prize payments', tied({ since: 'created_at' }, ex('payouts', 'event_id', 'rsn', 'place', 'amount', 'status', 'paid_at'))),
  e('coffer_entries', 'clan_member_id', 'seat', 'keep', 'none', 'the clan’s coffer ledger', tied({ since: 'created_at' }, ex('coffer_entries', 'clan_id', 'kind', 'amount', 'status', 'rsn', 'created_at'))),
  e('submissions', 'player_id', 'participant', 'keep', 'none', 'event submissions and their proof images: the clan’s event history',
    tied({ since: 'created_at' }, ex('proofs_submitted', 'id', 'tile_id', 'team_id', 'amount', 'image_url', 'note', 'source', 'created_at'))),
  e('completions', 'credit_player_id', 'participant', 'keep', 'none', 'completed tiles: the clan’s event history', tied({ since: 'completed_at' }, ex('event_completions', 'id', 'tile_id', 'team_id', 'completed_at', 'awarded_points'))),
  e('event_start_proofs', 'player_id', 'participant', 'keep', 'none', 'start-of-event proof screenshots: evidence in the clan’s event', tied({ since: 'created_at' }, ex('proofs_start', 'event_id', 'rsn', 'image_url', 'status', 'created_at'))),
  e('integrity_network', 'participant_id', 'participant', 'delete', 'sql', 'network fingerprint and country seen during an event'),
  e('integrity_signals', 'participant_id', 'participant', 'keep', 'none', 'cheating flags a clan’s staff raised or reviewed: evidence in the clan’s event'),

  // ── Somebody else’s record that only says they did something ────────────────────────────────────
  e('clan_audit_log', 'actor_user_id', 'user', 'detach', 'fk', 'what they did, and what was done about them, stays in each clan’s log; the actor pointer is cleared and their Discord id and username inside a row are replaced with [deleted]',
    ex('audit_my_actions', 'clan_id', 'event_type', 'occurred_at')),
  e('clans', 'friends_owner_user_id', 'user', 'detach', 'custom', 'their private friends host stays for the friends who played in it, with no owner and a plain name'),
  ...[
    ['account_change_requests', 'decided_by_user_id'], ['account_ownership_claims', 'decided_by_user_id'], ['accounts', 'discord_id_linked_by_user_id'],
    ['banned_discord_ids', 'banned_by_user_id'], ['blocked_webhooks', 'blocked_by_user_id'],
    ['character_reports', 'reported_by_user_id'], ['character_reports', 'resolved_by_user_id'], ['chat_pattern_overrides', 'updated_by'],
    ['clan_bans', 'banned_by_user_id'], ['clan_bans', 'lifted_by_user_id'], ['clan_blocks', 'blocked_by_user_id'], ['clan_boost_state', 'gifted_by'],
    ['clan_boost_state', 'last_recruit_post_by'], ['clan_event_payouts', 'paid_by_user_id'], ['clan_events', 'created_by_id'],
    ['clan_event_signups', 'collected_by_user_id'], ['clan_event_signups', 'confirmed_by_user_id'], ['clan_join_requests', 'decided_by_user_id'],
    ['clan_kick_channels', 'linked_by_user_id'], ['clan_ownership_transfers', 'decided_by_user_id'], ['clan_ownership_transfers', 'staff_cleared_by_user_id'],
    ['clan_twitch_channels', 'linked_by_user_id'], ['clan_youtube_channels', 'linked_by_user_id'], ['coffer_entries', 'created_by_user_id'],
    ['coffer_entries', 'settled_by_user_id'], ['discord_broadcasts', 'sent_by_user_id'], ['error_events', 'resolved_by_user_id'],
    ['event_chat_messages', 'deleted_by'], ['event_chat_mutes', 'by_user_id'], ['event_cohosts', 'accepted_by_user_id'], ['event_cohosts', 'invited_by_user_id'],
    ['event_editors', 'granted_by_user_id'], ['event_invites', 'invited_by_user_id'], ['event_presets', 'created_by_user_id'], ['event_start_proofs', 'reviewed_by'],
    ['event_webhooks', 'created_by_user_id'], ['gear_datasets', 'created_by_user_id'], ['gear_overrides', 'updated_by_user_id'],
    ['guide_bulk_runs', 'created_by_user_id'], ['guide_contributions', 'reviewed_by_user_id'], ['guide_writer_awards', 'granted_by_user_id'],['guide_posts', 'posted_by_user_id'], ['guide_proposals', 'reviewed_by_user_id'],
    ['guide_revisions', 'edited_by_user_id'], ['guides', 'created_by_user_id'], ['guides', 'updated_by_user_id'], ['h2h_challenges', 'challenger_user_id'],
    ['lab_scenarios', 'updated_by'], ['library_boards', 'published_by_user_id'], ['library_proposals', 'reviewed_by_user_id'],
    ['hunt_drops', 'requested_by_user_id'], ['hunt_drops', 'decided_by_user_id'],
    ['weekly_participants', 'entered_by_user_id'], ['weekly_participants', 'fee_collected_by_user_id'], ['weekly_participants', 'fee_confirmed_by_user_id'],
    ['library_tasks', 'created_by_user_id'], ['library_tasks', 'updated_by_user_id'], ['mode_line_patterns', 'updated_by'], ['owner_trials', 'granted_by'],
    ['owner_trials', 'revoked_by'], ['payouts', 'paid_by_user_id'], ['pending_renames', 'submitted_by_user_id'], ['platform_notices', 'created_by_user_id'],
    ['promo_blocked_domains', 'added_by_user_id'], ['promo_reports', 'reporter_user_id'], ['promo_reports', 'resolved_by_user_id'],
    ['practice_boards', 'created_by_user_id'], ['clans', 'plan_paid_by_user_id'], ['race_lifelines', 'used_by_user_id'], ['race_road_picks', 'picked_by_user_id'], ['shared_webhooks', 'decided_by_user_id'], ['signup_fees', 'collected_by_user_id'],
    ['signup_fees', 'confirmed_by_user_id'], ['signup_fees', 'reported_collector_user_id'], ['space_panels', 'staff_hidden_by_user_id'],
    ['space_profiles', 'hidden_by_user_id'], ['stream_highlights', 'staff_hidden_by_user_id'], ['supporter_subscriptions', 'gifted_by_user_id'],
    ['team_invites', 'created_by_user_id'], ['teams', 'captain_user_id'], ['team_staff', 'granted_by_user_id'], ['tile_audit_log', 'actor_user_id'],
    ['tile_library', 'created_by_user_id'], ['tile_suggestions', 'decided_by_user_id'], ['unmatched_purchases', 'resolved_by_user_id'],
    ['weekly_competition_clans', 'decided_by_user_id'], ['weekly_competition_clans', 'invited_by_user_id'], ['weekly_competitions', 'created_by_id'],
  ].map(([t, c]) => actor(t, c)),
];

/**
 * Personal values that are not a pointer to a row, so no foreign key and no id finds them. Each is
 * handled by a named step in erasePerson; listed here so the report and the tests can see them.
 */
export const PERSON_VALUE_COLUMNS: { table: string; column: string; handling: Handling; why: string }[] = [
  { table: 'accounts', column: 'discord_id', handling: 'detach', why: 'their Discord id written on a character (any character, not only theirs): cleared, with its source and who linked it' },
  {
    table: 'banned_discord_ids',
    column: 'discord_id',
    handling: 'keep',
    why: 'KEPT BY DESIGN, and written BY the deletion: one row per ban still in force (platform, or one clan), so the ban holds if the same Discord account signs in again. It holds the Discord id, the date and the clan’s own reason text; no name, email, avatar or character. Staff lifting the ban deletes the row; a clan row is also deleted once it has been put back on a returning account.',
  },
  { table: 'event_discord_members', column: 'discord_id', handling: 'delete', why: 'their Discord id in an event’s Discord server list: row deleted' },
  { table: 'billing_ledger', column: 'buyer_email', handling: 'detach', why: 'the payment line stays for the books; the email on it is cleared' },
  { table: 'unmatched_purchases', column: 'buyer_email', handling: 'detach', why: 'the payment record stays; the email on it is cleared' },
  { table: 'h2h_prefs', column: 'blocked', handling: 'detach', why: 'other people’s block lists drop this person’s id' },
  { table: 'clan_audit_log', column: 'new_value', handling: 'detach', why: 'log rows are never deleted; their Discord id and username inside old_value / new_value / notes are replaced with [deleted], and a merge entry loses their person id and name' },
];

// ── Export redaction ──────────────────────────────────────────────────────────────────────────────

/**
 * Column names that never leave in an export, whatever a list above says. Secrets (tokens, hashes,
 * keys), and notes staff wrote for themselves. The inventory test checks no export list names one;
 * redactRow strips them again at run time, so a mistake in the list is still not a leak.
 */
const NEVER_EXPORT = [
  /token/i, /hash/i, /secret/i, /password/i, /^session_version$/i, /^url$/i /* a webhook URL is a credential */,
  /admin_notes/i, /staff_note/i, /review_note/i, /decision_note/i, /decided_note/i, /resolution/i, /^notes$/i, /fee_notes/i,
  /flagged_reason/i, /flag_reason/i, /banned_reason/i, /net_hash/i,
];

/** A proof link is a URL the person uploaded, and is the one place a column called `url` may leave. */
const URL_ALLOWED_IN = new Set(['submission_attachments', 'proof_uploads']);

export function neverExported(table: string, column: string): boolean {
  if (column === 'url' && URL_ALLOWED_IN.has(table)) return false;
  return NEVER_EXPORT.some((re) => re.test(column));
}

/** One row as it leaves in the export: only the listed columns, and never a forbidden one. */
export function redactRow(table: string, allowed: readonly string[], row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const column of allowed) {
    if (neverExported(table, column)) continue;
    if (column in row) out[column] = row[column];
  }
  return out;
}

// ── The rules around deleting ─────────────────────────────────────────────────────────────────────

/** How long after signing in a session may delete the account. Past it they sign in again. */
export const ERASE_RECENT_SESSION_MS = 15 * 60 * 1000;

export function sessionIsRecent(issuedAtMs: number | null | undefined, now: number = Date.now()): boolean {
  if (typeof issuedAtMs !== 'number' || !Number.isFinite(issuedAtMs)) return false;
  const age = now - issuedAtMs;
  return age >= -5 * 60 * 1000 && age <= ERASE_RECENT_SESSION_MS;
}

/**
 * The moment this session stops being recent enough to delete, or null when it already is not.
 * The settings page hands this to the button, which checks it at the click: a page left open past
 * the window must send them to sign in again BEFORE the confirm dialog, not after they typed.
 */
export function recentSessionUntil(issuedAtMs: number | null | undefined, now: number = Date.now()): number | null {
  if (!sessionIsRecent(issuedAtMs, now)) return null;
  return (issuedAtMs as number) + ERASE_RECENT_SESSION_MS;
}

/** They must type the word DELETE, or their own display name, exactly enough to mean it. */
export function confirmPhraseMatches(typed: unknown, displayName: string | null | undefined): boolean {
  if (typeof typed !== 'string') return false;
  const t = typed.trim();
  if (!t) return false;
  if (t === 'DELETE') return true;
  const name = (displayName ?? '').trim();
  return name.length > 0 && t.toLowerCase() === name.toLowerCase();
}

export interface EraseFacts {
  /** Clans and creator spaces where they hold the owner seat (never the hidden friends host). */
  ownedClans: { id: number; slug: string; name: string; kind: string }[];
  /** Supporter rows as the site sees them. */
  supporterRows: { status: string; gumroadSubscriptionId: string | null }[];
  platformRole: string;
  /** Other logins on the same person. */
  otherLogins: number;
}

export type EraseBlocker =
  | { kind: 'owns-clan'; clans: { id: number; slug: string; name: string; kind: string }[]; message: string }
  | { kind: 'active-plan'; subscriptionId: string; message: string }
  | { kind: 'platform-staff'; message: string }
  | { kind: 'second-login'; message: string };

/**
 * A paid Supporter plan the site still sees as renewing: a row Gumroad opened (it has a subscription
 * id) whose status is 'active'. A gift or an invite reward has no subscription to cancel, and a
 * 'cancelling' row is one they already cancelled there: the term they paid for just has not run out.
 */
export function activePaidPlan(rows: EraseFacts['supporterRows']): string | null {
  return rows.find((r) => r.status === 'active' && !!r.gumroadSubscriptionId)?.gumroadSubscriptionId ?? null;
}

/** Everything that stops this person deleting their account right now. Empty = go ahead. */
export function eraseBlockers(facts: EraseFacts): EraseBlocker[] {
  const out: EraseBlocker[] = [];
  if (facts.ownedClans.length > 0) {
    const names = facts.ownedClans.map((c) => c.name).join(', ');
    out.push({
      kind: 'owns-clan',
      clans: facts.ownedClans,
      message: `You own ${names}. Hand ownership to someone else, or have it deleted, before you delete your account.`,
    });
  }
  const plan = activePaidPlan(facts.supporterRows);
  if (plan) {
    out.push({
      kind: 'active-plan',
      subscriptionId: plan,
      message: 'You have a Supporter plan that still renews. Cancel it on Gumroad first, then come back: deleting your account here does not stop the payments.',
    });
  }
  if (facts.platformRole !== 'none') {
    out.push({ kind: 'platform-staff', message: 'This is an Anvil staff account. Ask another staff member to remove your staff role first.' });
  }
  if (facts.otherLogins > 0) {
    out.push({ kind: 'second-login', message: 'More than one Discord login is attached to you, so this cannot be done here. Contact Anvil support.' });
  }
  return out;
}

// ── What a ban keeps ──────────────────────────────────────────────────────────────────────────────

export interface BanFacts {
  discordId: string | null;
  /** Their Discord username, Discord display name and Anvil display name: taken out of a kept reason. */
  names?: (string | null | undefined)[];
  userBanned: boolean;
  userBannedAt: string | null;
  playerBanned: boolean;
  playerBannedAt: string | null;
  /** Clan bans still in force on the person. */
  liveClanBans: { clanId: number; reason: string | null; bannedAt: string | null; bannedByUserId: number | null }[];
}

/** One row of `banned_discord_ids`: everything that outlives the account, and nothing else. */
export interface RetainedBanRow {
  discordId: string;
  scope: 'platform' | 'clan';
  clanId: number | null;
  /** The clan's own note, with the person's Discord id and names replaced. Never set for a platform ban. */
  reason: string | null;
  bannedAt: string | null;
  bannedByUserId: number | null;
}

/**
 * What survives so a platform ban or a clan ban still holds after the account is gone: the rows to
 * write to `banned_discord_ids`. Empty when there is no ban to keep.
 *
 * Bans are keyed on the person (`players.id`), and the only thing that ties a returning human to a
 * person is the Discord id they sign in with. So that id is the one identifier kept, with which ban
 * it is and when. No login, no person, no name, no email, no avatar, no characters. Without a
 * Discord id there is nothing to recognise them by, so nothing is kept.
 *
 * A CLAN BAN KEEPS ITS REASON. The reason is the clan's own note about why it barred someone: the
 * clan's record, not the person's data. What IS the person's inside it (their Discord id, their
 * Discord name) is replaced with [deleted]; the rest stays. A platform ban keeps no reason.
 */
export function retainedBans(f: BanFacts): RetainedBanRow[] {
  const discordId = f.discordId?.trim() || null;
  if (!discordId) return [];
  const out: RetainedBanRow[] = [];
  if (f.userBanned || f.playerBanned) {
    out.push({
      discordId,
      scope: 'platform',
      clanId: null,
      reason: null,
      // The platform-level ban's date when there is one; else the login-level one's.
      bannedAt: (f.playerBanned ? f.playerBannedAt : null) ?? (f.userBanned ? f.userBannedAt : null) ?? null,
      bannedByUserId: null,
    });
  }
  const seen = new Set<number>();
  for (const b of f.liveClanBans) {
    if (seen.has(b.clanId)) continue;
    seen.add(b.clanId);
    out.push({
      discordId,
      scope: 'clan',
      clanId: b.clanId,
      reason: redactBanReason(b.reason, { discordId, names: f.names }),
      bannedAt: b.bannedAt,
      bannedByUserId: b.bannedByUserId,
    });
  }
  return out;
}

// ── Tying an exported row to the person asking ────────────────────────────────────────────────────

/** Was this row written at or after the moment the person claimed the character? Unknown = no. */
export function tiedSince(rowStamp: unknown, claimedAt: string | null | undefined): boolean {
  const claimed = parseStamp(claimedAt);
  if (claimed == null) return false;
  const at = rowStamp instanceof Date ? rowStamp.getTime() : typeof rowStamp === 'string' ? parseStamp(rowStamp) : null;
  return at != null && !Number.isNaN(at) && at >= claimed;
}

// ── What a deletion leaves in the audit log ───────────────────────────────────────────────────────

export const REDACTED = '[deleted]';

/** A Discord id is a long run of digits and nothing else; anything shorter is not searched for. */
export function isDiscordId(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^\d{15,25}$/.test(value);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * One audit column (old_value, new_value or notes) with the person taken out of it. THE ROW IS NEVER
 * DELETED: what a clan did, to whom and when is the clan's history, and a person must not be able
 * to erase a ban or a role change by deleting their account.
 *
 * The Discord id is replaced only as a WHOLE number (never as digits inside a longer one). Their
 * Discord username or display name is replaced only where it stands as a whole JSON string value,
 * and only in a row that carried the id, so a common word used as a name cannot touch other rows.
 * Returns the text unchanged when neither it nor (rowCarriesId) its row has the id.
 */
export function redactAuditText(
  raw: string | null,
  who: { discordId: string; names?: (string | null | undefined)[] },
  /** Another column of the same row carried the id, so names go from this one too. */
  rowCarriesId = false,
): string | null {
  if (raw == null || !isDiscordId(who.discordId)) return raw;
  const idRe = new RegExp(`(?<![0-9])${who.discordId}(?![0-9])`, 'g');
  if (!rowCarriesId && !idRe.test(raw)) return raw;
  idRe.lastIndex = 0;
  let out = raw.replace(idRe, REDACTED);
  for (const name of who.names ?? []) {
    const n = (name ?? '').trim();
    if (n.length < 2) continue;
    out = out.replace(new RegExp(escapeRe(JSON.stringify(n)), 'g'), JSON.stringify(REDACTED));
  }
  return out;
}

/**
 * A clan's ban reason with the banned person taken out of it, for a ban kept after they delete
 * their account. The note is the clan's; their Discord id and Discord name inside it are not.
 *
 * redactAuditText replaces the id (as a whole number) and a name that stands as a quoted value. A
 * reason is free text, so a name written bare ("zezima#1 kept spamming") is replaced here as well:
 * whole word only, any letter case, three characters or more so a one-letter name cannot shred the
 * sentence. Everything else in the note is kept. Blank stays blank.
 */
export function redactBanReason(
  reason: string | null | undefined,
  who: { discordId: string; names?: (string | null | undefined)[] },
): string | null {
  const text = reason?.trim();
  if (!text) return null;
  let out = redactAuditText(text, who, true) ?? text;
  for (const name of who.names ?? []) {
    const n = (name ?? '').trim();
    if (n.length < 3) continue;
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(n)}(?![\\p{L}\\p{N}_])`, 'giu'), REDACTED);
  }
  return out;
}

/**
 * A merge entry's side (`{"playerId":12,"displayName":"…",…}`, lib/mergePeople) with this person
 * taken out: the id and the name go, everything else (what moved, why) stays. Unchanged when the
 * side is somebody else or is not that shape.
 */
export function redactMergeSide(raw: string | null, playerId: number): string | null {
  if (raw == null) return raw;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return raw;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v) || (v as { playerId?: unknown }).playerId !== playerId) return raw;
  return JSON.stringify({ ...(v as Record<string, unknown>), playerId: null, displayName: REDACTED });
}
