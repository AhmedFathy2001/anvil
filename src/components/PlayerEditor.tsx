'use client';

import { useEffect, useState } from 'react';
import Input from '@/components/Input';
import Select from '@/components/Select';
import ClanMemberPicker from '@/components/ClanMemberPicker';
import { clanFetch } from '@/lib/clanFetch';

interface Props {
  eventId: number;
  player: {
    id: number;
    name: string;
    discord: string | null;
    timezone: string | null;
  };
  onClose: () => void;
  onSaved: () => void;
}

interface LinkedAccount {
  clanMemberId: number;
  rsn: string;
  status: string;
  isCurrent: boolean;
}

export default function PlayerEditor({ eventId, player, onClose, onSaved }: Props) {
  const [name, setName] = useState(player.name);
  const [discord, setDiscord] = useState(player.discord || '');
  const [timezone, setTimezone] = useState(player.timezone || '');
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [selectedClanMemberId, setSelectedClanMemberId] = useState<number | null>(null);
  const [ownerUserId, setOwnerUserId] = useState<number | null>(null);
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  // Discord owner of the account picked from the full roster (for the cross-owner warning).
  const [pickedOwnerUserId, setPickedOwnerUserId] = useState<number | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the RuneScape accounts linked to this player's Discord owner — swap candidates for when an
  // RSN gets banned/renamed and they play on an alt.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await clanFetch(`/api/events/${eventId}/players/${player.id}/linked-accounts`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            const list: LinkedAccount[] = data.accounts ?? [];
            setAccounts(list);
            setOwnerUserId(data.ownerUserId ?? null);
            const cur = list.find((a) => a.isCurrent);
            setSelectedClanMemberId(cur ? cur.clanMemberId : null);
          }
        }
      } catch {
        /* ignore — the RSN text field still works without the account list */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, player.id]);

  const currentClanMemberId = accounts.find((a) => a.isCurrent)?.clanMemberId ?? null;
  const accountChanged = selectedClanMemberId != null && selectedClanMemberId !== currentClanMemberId;
  // Picked (from the full roster) an account linked to a DIFFERENT Discord user than this player's —
  // the plugin overlay won't resolve it for them (it keys off the owner's linked accounts).
  const crossOwner =
    pickedOwnerUserId !== undefined &&
    pickedOwnerUserId !== null &&
    ownerUserId !== null &&
    pickedOwnerUserId !== ownerUserId;

  function pickAccount(cmId: number) {
    setSelectedClanMemberId(cmId);
    const acc = accounts.find((a) => a.clanMemberId === cmId);
    if (acc) setName(acc.rsn); // the tracked RSN follows the chosen account
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await clanFetch(`/api/events/${eventId}/players`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: player.id,
          name: name.trim(),
          discord: discord.trim() || null,
          timezone: timezone.trim() || null,
          ...(selectedClanMemberId != null ? { clanMemberId: selectedClanMemberId } : {}),
        }),
      });

      if (res.ok) {
        onSaved();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save');
      }
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card-bg border border-card-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-4 border-b border-card-border flex items-center justify-between">
          <h2 className="text-lg font-bold text-gold">Edit Player</h2>
          <button onClick={onClose} className="text-text-muted hover:text-foreground text-xl">
            &times;
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Tracked account. The dropdown offers the accounts already linked to this player's Discord
              owner (the common case). "Assign a different account" opens the full clan roster for edge
              cases — an account not linked yet, a ghost, a mislink. Either way it swaps which RSN is
              tracked for the plugin + hiscores, and (for an unlinked account) links it to this player's
              Discord owner so the plugin overlay resolves. */}
          <div>
            <label className="block text-xs text-text-muted mb-1">Tracked account</label>
            {accounts.length > 1 && (
              <Select
                value={String(selectedClanMemberId ?? '')}
                onChange={(v) => {
                  setPickedOwnerUserId(undefined);
                  pickAccount(parseInt(v, 10));
                }}
                options={accounts.map((a) => ({
                  value: String(a.clanMemberId),
                  label: `${a.rsn}${a.status && a.status !== 'active' ? ` (${a.status})` : ''}${
                    a.isCurrent ? ' — current' : ''
                  }`,
                }))}
                ariaLabel="Which character"
              />
            )}
            <button
              type="button"
              onClick={() => setShowAllAccounts((v) => !v)}
              className="text-[11px] text-gold/90 hover:text-gold mt-1"
            >
              {showAllAccounts ? 'Hide account search' : 'Assign a different account (search the roster)'}
            </button>
            {showAllAccounts && (
              <div className="mt-2 border border-card-border rounded-lg p-2 bg-brown-dark/30">
                <p className="text-[11px] text-text-muted mb-1.5">
                  Pick any clan account to track for this player — use this when the account isn&apos;t
                  in the list above (unlinked, ghost, or mislinked).
                </p>
                <ClanMemberPicker
                  mode="single"
                  eventId={eventId}
                  preferLinked
                  value={selectedClanMemberId}
                  onChange={(id, member) => {
                    if (id != null && member) {
                      setSelectedClanMemberId(id);
                      setName(member.rsn);
                      setPickedOwnerUserId(member.user?.id ?? null);
                    }
                  }}
                />
              </div>
            )}
            {accountChanged && (
              <p className="text-[11px] text-yellow-400 mt-1 leading-relaxed">
                Swaps tracking to this RSN for both the RuneLite plugin and the hiscores stat cron,
                and re-baselines stats from it (gains count from the swap onward).
              </p>
            )}
            {crossOwner && (
              <p className="text-[11px] text-orange-400 mt-1 leading-relaxed">
                This account is linked to a <span className="font-semibold">different Discord user</span>.
                Website + hiscores tracking will follow it, but the in-game plugin overlay only works for
                that account&apos;s own Discord owner.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">RSN (In-Game Name)</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
              placeholder="Player name..."
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Discord Username</label>
            <Input
              type="text"
              value={discord}
              onChange={(e) => setDiscord(e.target.value)}
              className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
              placeholder="Discord username..."
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Timezone</label>
            <Input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
              placeholder="e.g. UTC, EST, PST..."
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2 text-sm font-semibold rounded bg-gold/20 border border-gold text-gold hover:bg-gold/30 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
