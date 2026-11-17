'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Select from '@/components/Select';
import Input from '@/components/Input';
import { AUDIT_PAGE_SIZE, appendOlder, filterAudit, oldestId, pageOf, type AuditScope } from '@/lib/auditFilter';
import { clanFetch } from '@/lib/clanFetch';

interface RenameSuggestion {
  leftMemberId: number;
  joinedMemberId: number;
  oldRsn: string;
  newRsn: string;
  rank: string | null;
  leftAt: string;
  joinedAt: string;
  deltaSeconds: number;
  leftXp: number | null;
  joinedXp: number | null;
  xpMatchPct: number | null;
  /** The old character has an owner — its rename is Anvil's to apply, so this sends it there. */
  leftClaimed?: boolean;
}

export interface AuditEntry {
  id: number;
  clanMemberId: number | null;
  eventType: string;
  oldValue: string | null;
  newValue: string | null;
  actorDisplayName: string | null;
  notes: string | null;
  occurredAt: string;
  memberRsn: string | null;
}

export interface LeftMember {
  id: number;
  rsn: string;
  leftAt: string;
  rank: string | null;
}

export interface JoinedMember {
  id: number;
  rsn: string;
  joinedAt: string;
  rank: string | null;
}

/** A type with no label yet: the words, not the stored name. */
function sentenceCase(type: string): string {
  const t = type.replace(/^platform_/, '').replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  joined: { label: 'Joined', color: 'text-accent-green-light' },
  // Clan ownership transfer requests (lib/ownershipTransfers): the 3-day hold, start to finish.
  ownership_transfer_requested: { label: 'Ownership transfer asked', color: 'text-gold' },
  ownership_transfer_cancelled: { label: 'Ownership transfer cancelled', color: 'text-text-muted' },
  ownership_transfer_declined: { label: 'Ownership transfer declined', color: 'text-text-muted' },
  ownership_transfer_blocked: { label: 'Ownership transfer blocked by Anvil', color: 'text-red-400' },
  ownership_transfer_lapsed: { label: 'Ownership transfer lapsed', color: 'text-text-muted' },
  ownership_transferred: { label: 'Ownership transferred', color: 'text-gold' },
  boost_recruiting_line_set: { label: 'Recruiting line', color: 'text-gold' },
  boost_recruit_post_sent: { label: 'Discord recruitment post', color: 'text-gold' },
  left: { label: 'Left', color: 'text-red-400' },
  returned: { label: 'Returned', color: 'text-accent-green-light' },
  renamed: { label: 'Renamed', color: 'text-yellow-400' },
  verified: { label: 'Verified', color: 'text-gold' },
  claimed: { label: 'Claimed', color: 'text-gold' },
  fee_reminders_sent: { label: 'Fee reminders', color: 'text-gold' },
  merged: { label: 'Merged', color: 'text-purple-400' },
  rename_dismissed: { label: 'Not a rename', color: 'text-text-muted' },
  mod_approved: { label: 'Mod approved', color: 'text-accent-green-light' },
  mod_rejected: { label: 'Mod rejected', color: 'text-red-400' },
  user_signed_up: { label: 'Signed up', color: 'text-text-muted' },
  signup_approved: { label: 'Sign-up approved', color: 'text-accent-green-light' },
  signup_rejected: { label: 'Sign-up rejected', color: 'text-red-400' },
  signup_withdrawn: { label: 'Sign-up withdrawn', color: 'text-yellow-400' },
  signup_admin_added: { label: 'Signed up by admin', color: 'text-gold' },
  signup_answers_edited: { label: 'Sign-up answers edited', color: 'text-text-muted' },
  captain_promoted: { label: 'Captain promoted', color: 'text-gold' },
  captain_demoted: { label: 'Captain demoted', color: 'text-text-muted' },
  fee_collected: { label: 'Fee marked paid', color: 'text-gold' },
  fee_confirmed: { label: 'Fee confirmed', color: 'text-accent-green-light' },
  feature_toggled: { label: 'Feature switched', color: 'text-gold' },
  settings_changed: { label: 'Settings changed', color: 'text-text-muted' },
  claim_request_approved: { label: 'Claim linked', color: 'text-accent-green-light' },
  claim_request_forwarded: { label: 'Claim sent to Anvil', color: 'text-gold' },
  claim_request_rejected: { label: 'Claim turned down', color: 'text-red-400' },
  character_report_applied: { label: "Owner's report done", color: 'text-gold' },
  character_report_reverted: { label: 'Reverted by Anvil', color: 'text-red-400' },
  member_chose_this_clan: { label: 'Made this their clan', color: 'text-accent-green-light' },
  member_left_for_another_clan: { label: 'Moved to another clan', color: 'text-yellow-400' },
  roster_memberships_released: { label: 'Members released by Anvil', color: 'text-red-400' },
  // Everything below once fell through to its raw name ("GUEST REJECTED"). Plain phrases only.
  guest_approved: { label: 'Join request approved', color: 'text-accent-green-light' },
  guest_rejected: { label: 'Join request declined', color: 'text-red-400' },
  guest_made_viewer: { label: 'Event player made a viewer', color: 'text-text-muted' },
  viewer_made_guest: { label: 'Viewer made an event player', color: 'text-text-muted' },
  mod_not_member: { label: 'Mod said not a member', color: 'text-red-400' },
  mod_reported: { label: 'Mod sent it to Anvil', color: 'text-gold' },
  manual_requested: { label: 'Asked for a manual check', color: 'text-gold' },
  rank_changed: { label: 'Rank changed', color: 'text-text-muted' },
  primary_changed: { label: 'Main character changed', color: 'text-text-muted' },
  unclaimed: { label: 'Character unlinked', color: 'text-yellow-400' },
  role_pre_assigned: { label: 'Role set before joining', color: 'text-gold' },
  clan_banned: { label: 'Banned from the clan', color: 'text-red-400' },
  clan_unbanned: { label: 'Ban lifted', color: 'text-accent-green-light' },
  clan_ban_restored: { label: 'Ban put back', color: 'text-red-400' },
  staff_removed_on_ban: { label: 'Staff role removed by a ban', color: 'text-red-400' },
  clan_created: { label: 'Clan created', color: 'text-gold' },
  clan_policy_changed: { label: 'Who can join changed', color: 'text-text-muted' },
  clan_profile_changed: { label: 'Clan profile changed', color: 'text-text-muted' },
  ingame_name_verified: { label: 'In-game name verified', color: 'text-accent-green-light' },
  ingame_name_unverified: { label: 'In-game name unverified', color: 'text-yellow-400' },
  ingame_name_released: { label: 'In-game name released', color: 'text-yellow-400' },
  ingame_name_claim_refused: { label: 'In-game name claim refused', color: 'text-red-400' },
  ingame_name_owner_confirmed: { label: 'In-game name confirmed by its owner', color: 'text-accent-green-light' },
  roster_sync_refused: { label: 'Roster update refused', color: 'text-red-400' },
  friends_host_renamed: { label: 'Friends event host renamed', color: 'text-text-muted' },
  editor_boards_set: { label: 'Board editor access set', color: 'text-gold' },
  event_entry_gates_changed: { label: 'Event entry rules changed', color: 'text-text-muted' },
  fees_closed_out: { label: 'Fees closed out', color: 'text-gold' },
  discord_linked_by_hand: { label: 'Discord linked by hand', color: 'text-gold' },
  discord_link_removed: { label: 'Discord link removed', color: 'text-yellow-400' },
  discord_roles_removed: { label: 'Discord roles removed', color: 'text-yellow-400' },
  onboarding_nudge_sent: { label: 'Welcome reminder sent', color: 'text-text-muted' },
  accent_color_set: { label: 'Accent colour set', color: 'text-text-muted' },
  boost_name_style_set: { label: 'Name style set', color: 'text-text-muted' },
  gear_dataset_refreshed: { label: 'Gear data refreshed', color: 'text-text-muted' },
  gear_override_changed: { label: 'Gear data changed', color: 'text-text-muted' },
  gear_override_reverted: { label: 'Gear data change undone', color: 'text-text-muted' },
  supporter_gift_granted: { label: 'Supporter gift given', color: 'text-gold' },
  supporter_gift_ended: { label: 'Supporter gift ended', color: 'text-text-muted' },
  stream_channel_moved_in: { label: 'Stream channel moved here', color: 'text-text-muted' },
  stream_channel_moved_out: { label: 'Stream channel moved away', color: 'text-text-muted' },
  stream_highlights_changed: { label: 'Stream highlights changed', color: 'text-text-muted' },
  streaming_settings_changed: { label: 'Streaming settings changed', color: 'text-text-muted' },
  creator_page_changed: { label: 'Creator page changed', color: 'text-text-muted' },
  creator_settings_changed: { label: 'Creator settings changed', color: 'text-text-muted' },
  creator_kick_connected: { label: 'Kick connected', color: 'text-text-muted' },
  creator_kick_disconnected: { label: 'Kick disconnected', color: 'text-text-muted' },
  creator_kick_settings: { label: 'Kick settings changed', color: 'text-text-muted' },
  creator_twitch_disconnected: { label: 'Twitch disconnected', color: 'text-text-muted' },
  creator_youtube_disconnected: { label: 'YouTube disconnected', color: 'text-text-muted' },
};

export default function AuditLogClient({
  entries: firstEntries,
  hasMore: firstHasMore,
  leftMembers,
  activeMembers,
}: {
  entries: AuditEntry[];
  hasMore: boolean;
  leftMembers: LeftMember[];
  activeMembers: JoinedMember[];
}) {
  const router = useRouter();
  // The page hands over the newest 500; "Load older" fetches the next slice and the filter and search below
  // run over everything loaded.
  const [older, setOlder] = useState<AuditEntry[]>([]);
  const [hasMore, setHasMore] = useState(firstHasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState<string | null>(null);
  const entries = useMemo(() => appendOlder(firstEntries, older), [firstEntries, older]);
  async function loadOlder() {
    const before = oldestId(entries);
    if (before == null || loadingOlder) return;
    setLoadingOlder(true);
    setOlderError(null);
    try {
      const res = await clanFetch(`/api/admin/clan/audit?before=${before}`);
      const data = (await res.json().catch(() => ({}))) as { entries?: AuditEntry[]; hasMore?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not load older entries.');
      setOlder((prev) => appendOlder(prev, data.entries ?? []));
      setHasMore(!!data.hasMore);
    } catch (e) {
      setOlderError(e instanceof Error ? e.message : 'Could not load older entries.');
    } finally {
      setLoadingOlder(false);
    }
  }
  const [filter, setFilter] = useState<string>('all');
  // People's actions first: the roster sync writes joins and leaves all day and buried them.
  const [scope, setScope] = useState<AuditScope>('people');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [showMerge, setShowMerge] = useState(false);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronous re-entry lock for the mutating actions (merge/confirm/dismiss). The
  // buttons' `disabled` prop only updates after a React re-render, so a burst of rapid
  // native clicks can all fire their handler before that — firing the same merge 3+ times.
  // A ref flips synchronously on the first click and blocks the rest until the request
  // settles.
  const actionLock = useRef(false);

  const [suggestions, setSuggestions] = useState<RenameSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [actingOn, setActingOn] = useState<number | null>(null); // joinedMemberId currently being merged/dismissed
  const [dismissed, setDismissed] = useState<Set<number>>(new Set()); // joinedMemberId

  useEffect(() => {
    let cancelled = false;
    clanFetch('/api/admin/clan/suspected-renames')
      .then((r) => (r.ok ? r.json() : { suggestions: [] }))
      .then((data: { suggestions: RenameSuggestion[] }) => {
        if (!cancelled) {
          setSuggestions(data.suggestions ?? []);
          setSuggestionsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setSuggestionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function confirmSuggestion(s: RenameSuggestion) {
    if (actionLock.current) return;
    actionLock.current = true;
    setActingOn(s.joinedMemberId);
    setError(null);
    try {
      // A claimed character is its player's in every clan, so its rename goes to Anvil
      // (lib/characterReports); an unclaimed roster entry is this clan's to merge.
      const res = s.leftClaimed
        ? await clanFetch('/api/admin/character-reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              seatId: s.leftMemberId,
              kind: 'rename',
              requestedRsn: s.newRsn,
              body: `Roster shows ${s.oldRsn} leaving and ${s.newRsn} joining ${s.deltaSeconds}s apart at rank ${s.rank ?? 'unknown'}; XP within ${s.xpMatchPct ?? '?'}%.`,
            }),
          })
        : await clanFetch('/api/admin/clan/merge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceId: s.leftMemberId,
              targetId: s.joinedMemberId,
              note: `Approved as rename: ${s.oldRsn} → ${s.newRsn} (${s.deltaSeconds}s apart, rank ${s.rank ?? 'unknown'})`,
            }),
          });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Merge failed');
      } else {
        // Drop this suggestion from the list and refresh the audit feed below.
        setSuggestions((prev) => prev.filter((p) => p.joinedMemberId !== s.joinedMemberId));
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setActingOn(null);
      actionLock.current = false;
    }
  }

  async function dismissSuggestion(s: RenameSuggestion) {
    if (actionLock.current) return;
    actionLock.current = true;
    // Optimistically hide it, then persist so it doesn't return on the next load.
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(s.joinedMemberId);
      return next;
    });
    setActingOn(s.joinedMemberId);
    setError(null);
    try {
      const res = await clanFetch('/api/admin/clan/suspected-renames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leftMemberId: s.leftMemberId, joinedMemberId: s.joinedMemberId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Could not save dismissal — it may reappear.');
        // Roll back the optimistic hide so the mod can retry.
        setDismissed((prev) => {
          const next = new Set(prev);
          next.delete(s.joinedMemberId);
          return next;
        });
      } else {
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      setDismissed((prev) => {
        const next = new Set(prev);
        next.delete(s.joinedMemberId);
        return next;
      });
    } finally {
      setActingOn(null);
      actionLock.current = false;
    }
  }

  const visibleSuggestions = suggestions.filter((s) => !dismissed.has(s.joinedMemberId));

  const filtered = useMemo(() => filterAudit(entries, { scope, type: filter, query }), [entries, scope, filter, query]);
  const paged = useMemo(() => pageOf(filtered, page, AUDIT_PAGE_SIZE), [filtered, page]);

  async function doMerge() {
    if (!sourceId || !targetId) return;
    if (actionLock.current) return;
    actionLock.current = true;
    setMerging(true);
    setError(null);
    try {
      const res = await clanFetch('/api/admin/clan/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, targetId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Merge failed');
      } else {
        setShowMerge(false);
        setSourceId(null);
        setTargetId(null);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setMerging(false);
      actionLock.current = false;
    }
  }

  return (
    <div>
      {/* Suspected renames — heuristic matches of left+joined pairs that look like renames */}
      {!suggestionsLoading && visibleSuggestions.length > 0 && (
        <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div>
              <h3 className="font-semibold text-yellow-300 flex items-center gap-2">
                <span className="w-1 h-5 bg-yellow-500 rounded-full" />
                Suspected renames
                <span className="text-xs font-normal text-text-muted">({visibleSuggestions.length})</span>
              </h3>
              <p className="text-xs text-text-muted mt-1">
                Left+joined pairs from the same sync, sharing a rank, whose Hiscores XP matches
                closely enough to be the same account. Confirm to merge histories, or dismiss if unrelated.
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {visibleSuggestions.map((s) => {
              const busy = actingOn === s.joinedMemberId;
              return (
                <li
                  key={s.joinedMemberId}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 bg-brown-dark/40 border border-yellow-500/20 rounded-lg flex-wrap"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      <span className="text-red-400">{s.oldRsn}</span>
                      <span className="text-text-muted mx-2">→</span>
                      <span className="text-accent-green-light">{s.newRsn}</span>
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5">
                      {s.rank ? <>rank: <span className="text-foreground/80">{s.rank}</span> · </> : null}
                      {s.deltaSeconds}s apart · {new Date(s.joinedAt).toLocaleString()}
                    </div>
                    {s.leftXp != null && s.joinedXp != null && (
                      <div className="text-[11px] text-accent-green-light/80 mt-0.5">
                        XP match: {s.leftXp.toLocaleString()} → {s.joinedXp.toLocaleString()}
                        {s.xpMatchPct != null && <span className="text-text-muted"> ({s.xpMatchPct}% diff)</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => dismissSuggestion(s)}
                      disabled={busy}
                      className="text-xs px-2.5 py-1 border border-card-border text-text-muted hover:text-foreground hover:bg-brown-light rounded transition-colors disabled:opacity-50"
                    >
                      Not a rename
                    </button>
                    <button
                      onClick={() => confirmSuggestion(s)}
                      disabled={busy}
                      className="text-xs px-2.5 py-1 bg-accent-green/20 border border-accent-green/40 text-accent-green-light hover:bg-accent-green/30 rounded transition-colors disabled:opacity-50"
                    >
                      {busy ? 'Working…' : s.leftClaimed ? 'Confirm — send to Anvil' : 'Confirm rename'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {error && (
            <p className="text-red-400 text-sm mt-3">{error}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-card-border text-xs" role="group" aria-label="Which entries">
            {([
              ['people', 'People’s actions'],
              ['sync', 'Roster sync'],
              ['all', 'Everything'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={scope === key}
                onClick={() => {
                  setScope(key);
                  setPage(1);
                }}
                className={`px-3 py-1.5 transition-colors ${scope === key ? 'bg-gold/15 text-gold' : 'text-text-muted hover:text-foreground'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <Input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search name or note"
            aria-label="Search the log"
            className="w-48 max-sm:w-full"
          />
          <Select
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setPage(1);
            }}
            ariaLabel="Filter by event type"
            className="w-56 max-w-full max-sm:w-full"
            options={[
              { value: 'all', label: 'All events' },
              ...Object.entries(EVENT_LABELS).map(([value, meta]) => ({ value, label: meta.label })),
            ]}
          />
        </div>
        <button
          onClick={() => setShowMerge((v) => !v)}
          className="px-3 py-1.5 text-sm bg-purple-500/15 border border-purple-500/40 text-purple-300 hover:bg-purple-500/25 rounded-lg transition-colors"
        >
          {showMerge ? 'Close merge tool' : 'Merge two members'}
        </button>
      </div>

      {showMerge && (
        <div className="border border-purple-500/30 bg-purple-500/5 rounded-xl p-4 mb-4">
          <p className="text-sm text-foreground/80 mb-3">
            Select the &ldquo;left&rdquo; record (source) and the active record it should be merged into (target).
            All event history, weekly participation, and audit entries from source will move to target.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wide text-text-muted mb-1">Source (left)</label>
              <Select
                value={sourceId == null ? '' : String(sourceId)}
                onChange={(v) => setSourceId(v ? Number(v) : null)}
                ariaLabel="Source (left record)"
                placeholder="— pick a left record —"
                options={leftMembers.map((m) => ({
                  value: String(m.id),
                  label: `${m.rsn} (left ${new Date(m.leftAt).toLocaleDateString()})`,
                }))}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-text-muted mb-1">Target (active)</label>
              <Select
                value={targetId == null ? '' : String(targetId)}
                onChange={(v) => setTargetId(v ? Number(v) : null)}
                ariaLabel="Target (active record)"
                placeholder="— pick an active record —"
                options={activeMembers.map((m) => ({
                  value: String(m.id),
                  label: `${m.rsn} (joined ${new Date(m.joinedAt).toLocaleDateString()})`,
                }))}
              />
            </div>
          </div>
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          <div className="flex justify-end mt-3">
            <button
              onClick={doMerge}
              disabled={!sourceId || !targetId || merging || sourceId === targetId}
              className="bg-purple-500 hover:bg-purple-400 text-white font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {merging ? 'Merging…' : 'Merge'}
            </button>
          </div>
        </div>
      )}

      <div className="border border-card-border rounded-xl bg-card-bg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-text-muted text-sm p-8 text-center">No matching audit entries.</div>
        ) : (
          <ul className="divide-y divide-card-border">
            {paged.rows.map((e) => {
              // Unknown types (not in EVENT_LABELS) can be long ALL_CAPS_SNAKE tokens — de-snake them
              // so they wrap at spaces instead of overflowing the fixed-width label column into the RSN.
              const meta = EVENT_LABELS[e.eventType] ?? {
                label: sentenceCase(e.eventType),
                color: 'text-foreground',
              };
              return (
                <li key={e.id} className="px-4 py-3 flex flex-wrap items-start gap-x-4 gap-y-1">
                  <div
                    className={`text-xs font-semibold uppercase tracking-wide w-32 shrink-0 break-words leading-snug ${meta.color}`}
                  >
                    {meta.label}
                  </div>
                  {/* On phones the detail drops to its own full-width line under label + timestamp */}
                  <div className="flex-1 min-w-0 basis-full order-last sm:basis-0 sm:order-none">
                    <div className="text-sm">
                      {e.memberRsn || (() => {
                        try {
                          if (e.newValue) {
                            const parsed = JSON.parse(e.newValue);
                            return parsed.rsn || parsed.discordUsername || `member ${e.clanMemberId ?? '?'}`;
                          }
                        } catch {}
                        return `member ${e.clanMemberId ?? '?'}`;
                      })()}
                      {e.oldValue && (() => {
                        try {
                          const parsed = JSON.parse(e.oldValue);
                          if (parsed.rsn && e.eventType === 'renamed') {
                            return <span className="text-text-muted text-xs ml-2">was {parsed.rsn}</span>;
                          }
                        } catch {}
                        return null;
                      })()}
                    </div>
                    {e.notes && <div className="text-xs text-text-muted mt-0.5">{e.notes}</div>}
                  </div>
                  <div className="text-[11px] text-text-muted shrink-0 text-right ml-auto sm:ml-0">
                    <div>{new Date(e.occurredAt).toLocaleString()}</div>
                    {e.actorDisplayName && <div className="opacity-70">by {e.actorDisplayName}</div>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {hasMore && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-muted">
          <button
            type="button"
            onClick={() => void loadOlder()}
            disabled={loadingOlder}
            className="rounded border border-card-border px-3 py-1.5 hover:text-foreground disabled:opacity-40"
          >
            {loadingOlder ? 'Loading…' : 'Load older entries'}
          </button>
          <span>{entries.length} loaded, and there are older ones.</span>
          {olderError && <span className="text-red-400">{olderError}</span>}
        </div>
      )}
      {paged.pages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
          <span>
            {filtered.length} entries · page {paged.page} of {paged.pages}
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage(paged.page - 1)}
              disabled={paged.page <= 1}
              className="rounded border border-card-border px-3 py-1.5 hover:text-foreground disabled:opacity-40"
            >
              Newer
            </button>
            <button
              type="button"
              onClick={() => setPage(paged.page + 1)}
              disabled={paged.page >= paged.pages}
              className="rounded border border-card-border px-3 py-1.5 hover:text-foreground disabled:opacity-40"
            >
              Older
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
