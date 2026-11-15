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
  /** What the export shows from this table: the section it goes under and the columns allowed out. */
  export?: { section: string; columns: string[] };
}

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
    ex('characters', 'id', 'rsn', 'previous_rsns', 'status', 'is_primary', 'shared', 'account_type', 'verified_at', 'verification_method', 'claimed_at', 'supporter_style', 'created_at')),
  e('accounts', 'verified_by_user_id', 'user', 'detach', 'fk', 'who approved somebody else’s character'),

  // Per character. These say what happens for a character that STAYS on a clan record; a character
  // on no clan record is deleted outright and every one of these goes with it.
  e('account_clan_emission', 'account_id', 'account', 'delete', 'sql', 'their per-clan announcement choices', ex('preferences', 'account_id', 'clan_id', 'enabled', 'updated_at')),
  e('account_game_clans', 'account_id', 'account', 'delete', 'sql', 'the in-game clan their own plugin reported', ex('characters_game_clans', 'account_id', 'rank', 'title', 'joined_on', 'observed_at', 'hidden')),
  e('account_media', 'account_id', 'account', 'delete', 'sql', 'character picture and banner; the stored images are deleted after', ex('profile_media', 'account_id', 'avatar_url', 'banner_url', 'updated_at')),
  e('account_media', 'owner_player_id', 'player', 'delete', 'sql', 'the same pictures, found by who uploaded them (no foreign key)'),
  e('account_ownership_claims', 'account_id', 'account', 'delete', 'sql', 'disputes over who owns the character'),
  e('account_period_baselines', 'account_id', 'account', 'keep', 'none', 'hiscores numbers for the character, public game data the roster record is built from'),
  e('account_plugin_seen', 'account_id', 'account', 'delete', 'sql', 'when their plugin was last seen'),
  e('account_records', 'account_id', 'account', 'keep', 'none', 'best day / week, worked out from hiscores'),
  e('account_sighting_days', 'account_id', 'account', 'delete', 'sql', 'which login played the character on which day'),
  e('account_sightings', 'account_id', 'account', 'delete', 'sql', 'which login played the character'),
  e('account_stat_snapshots', 'account_id', 'account', 'keep', 'none', 'the last hiscores page for the character'),
  e('analytics_events', 'account_id', 'account', 'delete', 'sql', 'usage events tied to the character'),
  e('character_reports', 'account_id', 'account', 'delete', 'sql', 'reports and claim requests about the character'),
  e('clan_bans', 'account_id', 'account', 'detach', 'custom', 'which character prompted a ban; cleared on a ban that is kept'),
  e('clan_join_requests', 'account_id', 'account', 'delete', 'sql', 'their requests to join a clan', ex('clan_join_requests', 'clan_id', 'account_id', 'status', 'message', 'source', 'requested_at', 'decided_at')),
  e('clan_memberships', 'account_id', 'account', 'keep', 'none', 'THE SEAT: the clan’s record that this in-game name is or was in the clan',
    ex('clan_memberships', 'id', 'clan_id', 'account_id', 'kind', 'rank', 'source', 'joined_at', 'left_at', 'ingame_joined_on')),
  e('clans', 'ingame_name_claimed_by_account_id', 'account', 'keep', 'none', 'which character proved the clan’s in-game name; the clan’s record'),
  e('display_case_items', 'account_id', 'account', 'delete', 'sql', 'their profile display case'),
  e('event_participants', 'account_id', 'account', 'keep', 'custom',
    'the clan’s event entry stays under the in-game name; the Discord name, timezone and player token on it are cleared',
    ex('event_entries', 'id', 'event_id', 'account_id', 'name', 'discord', 'timezone', 'team_id', 'pick_number', 'deaths', 'loot_gp_gained', 'pvp_kills', 'minutes_played')),
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
  e('player_goals', 'account_id', 'account', 'delete', 'sql', 'their saved goals', ex('goals', 'account_id', 'kind', 'metric', 'target', 'due_on', 'created_at')),
  e('player_snapshots', 'account_id', 'account', 'keep', 'none', 'start / end numbers of a clan’s weekly competition'),

  // ── Named by the person (players) ───────────────────────────────────────────────────────────────
  e('account_ownership_claims', 'claimant_player_id', 'player', 'delete', 'fk', 'their claim on a character'),
  e('account_ownership_claims', 'owner_player_id', 'player', 'delete', 'fk', 'a claim made against them'),
  e('character_reports', 'claimant_player_id', 'player', 'detach', 'fk', 'who asked for somebody else’s character'),
  e('clan_bans', 'player_id', 'player', 'keep', 'custom',
    'A BAN SURVIVES. A ban still in force moves to a blank stand-in person that holds only the Discord id; the reason and the character are cleared. A lifted ban is deleted.'),
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
  own('clan_staff', 'user_id', 'their staff roles in clans', ex('roles', 'clan_id', 'role', 'can_edit_tiles', 'can_edit_guides', 'created_at')),
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
    'the clan’s sign-up record (team, status, fees) stays on the seat; the schema would delete it, so it is detached first and the answers they typed are emptied'),
  e('event_signups', 'clan_member_id', 'seat', 'keep', 'none', 'the same sign-up, found by the seat it was made for (a sign-up staff made for them has no login on it)',
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
    'the clan’s log about its seat stays; any row that carries their Discord id is deleted', ex('audit_about_my_seats', 'clan_id', 'event_type', 'occurred_at')),
  e('moments', 'clan_member_id', 'seat', 'keep', 'none', 'drops and achievements on the clan’s feed, under the in-game name',
    ex('moments', 'id', 'rsn', 'kind', 'event_id', 'item_name', 'quantity', 'value_gp', 'source', 'occurred_at')),
  e('weekly_participants', 'clan_member_id', 'seat', 'keep', 'none', 'weekly competition standings', ex('weekly_entries', 'competition_id', 'rsn', 'baseline_value', 'current_value', 'opted_out')),
  e('payouts', 'clan_member_id', 'seat', 'keep', 'none', 'the clan’s prize payments', ex('payouts', 'event_id', 'rsn', 'place', 'amount', 'status', 'paid_at')),
  e('coffer_entries', 'clan_member_id', 'seat', 'keep', 'none', 'the clan’s coffer ledger', ex('coffer_entries', 'clan_id', 'kind', 'amount', 'status', 'rsn', 'created_at')),
  e('submissions', 'player_id', 'participant', 'keep', 'none', 'event submissions and their proof images: the clan’s event history',
    ex('proofs_submitted', 'id', 'tile_id', 'team_id', 'amount', 'image_url', 'note', 'source', 'created_at')),
  e('completions', 'credit_player_id', 'participant', 'keep', 'none', 'completed tiles: the clan’s event history', ex('event_completions', 'id', 'tile_id', 'team_id', 'completed_at', 'awarded_points')),
  e('event_start_proofs', 'player_id', 'participant', 'keep', 'none', 'start-of-event proof screenshots: evidence in the clan’s event', ex('proofs_start', 'event_id', 'rsn', 'image_url', 'status', 'created_at')),
  e('integrity_network', 'participant_id', 'participant', 'delete', 'sql', 'network fingerprint and country seen during an event'),
  e('integrity_signals', 'participant_id', 'participant', 'keep', 'none', 'cheating flags a clan’s staff raised or reviewed: evidence in the clan’s event'),

  // ── Somebody else’s record that only says they did something ────────────────────────────────────
  e('clan_audit_log', 'actor_user_id', 'user', 'detach', 'fk', 'what they did stays in each clan’s log without a name; rows carrying their Discord id are deleted (custom step)',
    ex('audit_my_actions', 'clan_id', 'event_type', 'occurred_at')),
  e('clans', 'friends_owner_user_id', 'user', 'detach', 'custom', 'their private friends host stays for the friends who played in it, with no owner and a plain name'),
  ...[
    ['account_change_requests', 'decided_by_user_id'], ['account_ownership_claims', 'decided_by_user_id'], ['blocked_webhooks', 'blocked_by_user_id'],
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
    ['guide_bulk_runs', 'created_by_user_id'], ['guide_posts', 'posted_by_user_id'], ['guide_proposals', 'reviewed_by_user_id'],
    ['guide_revisions', 'edited_by_user_id'], ['guides', 'created_by_user_id'], ['guides', 'updated_by_user_id'], ['h2h_challenges', 'challenger_user_id'],
    ['lab_scenarios', 'updated_by'], ['library_boards', 'published_by_user_id'], ['library_proposals', 'reviewed_by_user_id'],
    ['library_tasks', 'created_by_user_id'], ['library_tasks', 'updated_by_user_id'], ['mode_line_patterns', 'updated_by'], ['owner_trials', 'granted_by'],
    ['owner_trials', 'revoked_by'], ['payouts', 'paid_by_user_id'], ['pending_renames', 'submitted_by_user_id'], ['platform_notices', 'created_by_user_id'],
    ['promo_blocked_domains', 'added_by_user_id'], ['promo_reports', 'reporter_user_id'], ['promo_reports', 'resolved_by_user_id'],
    ['race_road_picks', 'picked_by_user_id'], ['shared_webhooks', 'decided_by_user_id'], ['signup_fees', 'collected_by_user_id'],
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
  { table: 'accounts', column: 'discord_id', handling: 'detach', why: 'their Discord id written on a character (any character, not only theirs): cleared' },
  { table: 'event_discord_members', column: 'discord_id', handling: 'delete', why: 'their Discord id in an event’s Discord server list: row deleted' },
  { table: 'billing_ledger', column: 'buyer_email', handling: 'detach', why: 'the payment line stays for the books; the email on it is cleared' },
  { table: 'unmatched_purchases', column: 'buyer_email', handling: 'detach', why: 'the payment record stays; the email on it is cleared' },
  { table: 'h2h_prefs', column: 'blocked', handling: 'detach', why: 'other people’s block lists drop this person’s id' },
  { table: 'clan_audit_log', column: 'new_value', handling: 'delete', why: 'any log row whose text carries their Discord id is deleted' },
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
  userBanned: boolean;
  userBannedAt: string | null;
  playerBanned: boolean;
  playerBannedAt: string | null;
  /** Ids of clan bans still in force on the person. */
  liveClanBanIds: number[];
}

/** The stand-in left behind so a ban still works: a login and a person with nothing on them but this. */
export interface RetainedBan {
  user: { discordId: string; displayName: ''; banned: boolean; bannedAt: string | null };
  player: { displayName: null; banned: boolean; bannedAt: string | null };
  clanBanIds: number[];
}

/**
 * What survives so a platform ban or a clan ban still holds after the account is gone, or null when
 * there is no ban to keep.
 *
 * Bans are keyed on the person (`players.id`), and the only thing that ties a returning human to a
 * person is the Discord id they sign in with. So that id is the one identifier kept, on an otherwise
 * empty login pointing at an otherwise empty person that the live clan bans are moved to. No name,
 * no email, no avatar, no characters, no reason text. Without a Discord id there is nothing to
 * recognise them by, so nothing is kept.
 */
export function retainedBan(f: BanFacts): RetainedBan | null {
  if (!f.discordId) return null;
  if (!f.userBanned && !f.playerBanned && f.liveClanBanIds.length === 0) return null;
  return {
    user: { discordId: f.discordId, displayName: '', banned: f.userBanned, bannedAt: f.userBanned ? f.userBannedAt : null },
    player: { displayName: null, banned: f.playerBanned, bannedAt: f.playerBanned ? f.playerBannedAt : null },
    clanBanIds: [...f.liveClanBanIds],
  };
}
