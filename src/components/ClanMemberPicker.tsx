'use client';

import { useEffect, useMemo, useState } from 'react';
import { avatarUrl } from '@/lib/discord-oauth';
import Input from '@/components/Input';

export interface PickableMember {
  id: number;
  rsn: string;
  rank: string | null;
  isPrimary: boolean;
  verifiedAt: string | null;
  verificationMethod: string | null;
  provisional: boolean;
  lastSeenInClan: string | null;
  user: {
    id: number;
    displayName: string | null;
    discordId: string | null;
    discordUsername: string | null;
    discordAvatar: string | null;
  } | null;
  enrolledPlayerId: number | null;
}

interface CommonProps {
  eventId?: number;
  // When true, Discord-linked members get prioritized at the top and grey-out hint for unlinked.
  preferLinked?: boolean;
  emptyState?: string;
}

interface SingleProps extends CommonProps {
  mode: 'single';
  value: number | null;
  // Second arg is the picked member object (or null on clear) — convenience for consumers
  // that need fields beyond the id (e.g. team captain assignment needs `user.id`).
  onChange: (memberId: number | null, member: PickableMember | null) => void;
  // When true, reject members without a linked Discord user (captain seats need this).
  requireDiscordUser?: boolean;
  // Tooltip shown on rows disabled by requireDiscordUser. Defaults to the captain-seat
  // wording, the original consumer of this flag.
  requireDiscordUserHint?: string;
}

interface MultiProps extends CommonProps {
  mode: 'multi';
  value: number[];
  onChange: (memberIds: number[], members: PickableMember[]) => void;
  disableEnrolled?: boolean; // grey out members already enrolled in this event
}

type Props = SingleProps | MultiProps;

// Picker that surfaces the active clan roster (sourced from `clan_members` joined with
// `users`). Replaces the legacy "type an RSN" textareas — admins now pick from the live
// synced roster, and the player/captain link is keyed on `clan_member_id`.
//
// Single mode: emits a single id (or null when cleared). Used for team captain.
// Multi mode: emits an array of ids. Used for player pool / participant selection.
export default function ClanMemberPicker(props: Props) {
  const [members, setMembers] = useState<PickableMember[] | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = props.eventId
      ? `/api/admin/clan/active-members?eventId=${props.eventId}`
      : '/api/admin/clan/active-members';
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to load roster');
        return r.json();
      })
      .then(setMembers)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Network error');
        setMembers([]);
      });
  }, [props.eventId]);

  const filtered = useMemo(() => {
    if (!members) return [];
    const q = search.trim().toLowerCase();
    let list = members;
    if (q) {
      list = list.filter((m) => {
        const haystack = `${m.rsn} ${m.user?.displayName ?? ''} ${m.user?.discordUsername ?? ''}`.toLowerCase();
        return haystack.includes(q);
      });
    }
    if (props.preferLinked) {
      list = [...list].sort((a, b) => {
        const al = a.user?.discordId ? 0 : 1;
        const bl = b.user?.discordId ? 0 : 1;
        if (al !== bl) return al - bl;
        return a.rsn.localeCompare(b.rsn);
      });
    }
    return list;
  }, [members, search, props.preferLinked]);

  if (members === null) {
    return <div className="text-sm text-text-muted py-3 text-center">Loading roster…</div>;
  }

  if (members.length === 0) {
    return (
      <div className="text-sm text-text-muted text-center py-6 border border-dashed border-card-border rounded-lg">
        {props.emptyState ??
          'No active clan members. Run a clan-sync from the plugin to populate the roster.'}
      </div>
    );
  }

  function isSelected(id: number) {
    if (props.mode === 'single') return props.value === id;
    return props.value.includes(id);
  }

  function toggle(id: number) {
    const member = members?.find((m) => m.id === id) ?? null;
    if (props.mode === 'single') {
      if (props.requireDiscordUser && member && !member.user?.discordId) {
        // Captain seats are claimed via Discord login, so picking an unlinked member
        // would leave the seat unclaimable. UI flags those rows; this is the safety net.
        return;
      }
      const willClear = props.value === id;
      props.onChange(willClear ? null : id, willClear ? null : member);
    } else {
      const isAdding = !props.value.includes(id);
      const nextIds = isAdding ? [...props.value, id] : props.value.filter((v) => v !== id);
      const nextMembers = members
        ? nextIds.map((mid) => members.find((m) => m.id === mid)).filter((m): m is PickableMember => Boolean(m))
        : [];
      props.onChange(nextIds, nextMembers);
    }
  }

  const selectedCount = props.mode === 'multi' ? props.value.length : props.value != null ? 1 : 0;

  return (
    <div>
      {error && (
        <div className="text-red-400 text-sm mb-2 border border-red-500/30 bg-red-500/10 rounded px-3 py-2">
          {error}
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by RSN, Discord name…"
          className="flex-1 bg-brown-light border border-card-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gold"
        />
        <span className="text-xs text-text-muted shrink-0">
          {selectedCount > 0
            ? `${selectedCount} selected`
            : `${filtered.length}/${members.length}`}
        </span>
      </div>
      <ul className="border border-card-border rounded-lg bg-brown-dark/40 max-h-72 overflow-y-auto divide-y divide-card-border">
        {filtered.length === 0 ? (
          <li className="px-3 py-3 text-sm text-text-muted text-center">No matches.</li>
        ) : (
          filtered.map((m) => {
            const selected = isSelected(m.id);
            const enrolled = props.mode === 'multi' && props.disableEnrolled && m.enrolledPlayerId != null;
            const linked = Boolean(m.user?.discordId);
            const requiresLink = props.mode === 'single' && props.requireDiscordUser && !linked;
            const disabled = enrolled || requiresLink;
            const avatar = m.user?.discordId ? avatarUrl(m.user.discordId, m.user.discordAvatar) : null;
            const disabledReason = enrolled
              ? 'Already added to this event'
              : requiresLink
                ? (props.mode === 'single' && props.requireDiscordUserHint) ||
                  'No Discord login linked — captain access needs a Discord-linked user'
                : '';
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => !disabled && toggle(m.id)}
                  disabled={disabled}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                    selected
                      ? 'bg-gold/10'
                      : disabled
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-brown-light'
                  }`}
                  title={disabledReason}
                >
                  <span
                    className={`w-4 h-4 rounded border ${
                      selected
                        ? 'bg-gold border-gold'
                        : 'border-card-border'
                    } flex items-center justify-center shrink-0`}
                  >
                    {selected && <span className="text-brown-dark text-[10px] font-bold">✓</span>}
                  </span>
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar} alt="" width={24} height={24} className="rounded-full shrink-0" />
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-gold/20 text-gold text-xs flex items-center justify-center font-semibold shrink-0">
                      {m.rsn.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate flex items-center gap-1.5">
                      {m.rsn}
                      {m.provisional && (
                        <span className="text-[9px] uppercase tracking-wide bg-yellow-500/20 text-yellow-400 px-1 py-0.5 rounded">
                          provisional
                        </span>
                      )}
                      {!linked && (
                        <span
                          className="text-[9px] uppercase tracking-wide bg-text-muted/15 text-text-muted px-1 py-0.5 rounded"
                          title="No Discord-linked user — magic link fallback may be needed"
                        >
                          unlinked
                        </span>
                      )}
                    </div>
                    {m.user && (
                      <div className="text-xs text-text-muted truncate">
                        {m.user.displayName}
                        {m.user.discordUsername && ` · @${m.user.discordUsername}`}
                      </div>
                    )}
                  </div>
                  {enrolled && (
                    <span className="text-[10px] text-text-muted shrink-0">enrolled</span>
                  )}
                  {requiresLink && (
                    <span className="text-[10px] text-text-muted shrink-0">no Discord</span>
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
