'use client';

import { useState } from 'react';
import ClanCrest from '@/components/ClanCrest';
import ClanPicker, { type PickedClan } from '@/components/ClanPicker';

import { clanFetch } from '@/lib/clanFetch';
import type { CohostRow } from '@/lib/coHost';
import type { EventSettlement } from '@/lib/coHostSettlement';
import Select from '@/components/Select';
import {
  ACCESS_PRESETS,
  TILE_ACTIONS,
  parseBoardAccess,
  type AccessWho,
  type BoardAccess,
  type TileAction,
} from '@/lib/cohostBoardAccess';

const ACTION_LABEL: Record<TileAction, string> = { suggest: 'Suggest tiles', create: 'Add tiles', edit: 'Edit tiles', delete: 'Delete tiles' };
const sameAccess = (a: BoardAccess, b: BoardAccess) => TILE_ACTIONS.every((k) => a[k] === b[k]);

/** Compact gp: 3,000,000 → "3M". */
function gp(n: number): string {
  const sign = n < 0 ? '−' : '';
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${sign}${(a / 1_000_000).toFixed(a % 1_000_000 === 0 ? 0 : 1)}M`;
  if (a >= 1_000) return `${sign}${(a / 1_000).toFixed(a % 1_000 === 0 ? 0 : 1)}K`;
  return `${sign}${a}`;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'invited · pending', cls: 'text-text-muted border-card-border' },
  accepted: { label: 'co-hosting', cls: 'text-accent-green-light border-accent-green/40 bg-accent-green/10' },
  declined: { label: 'declined', cls: 'text-accent-red border-accent-red/40' },
};


const CASH: { value: string; label: string; hint: string }[] = [
  { value: 'host-holds', label: 'Host holds the pot', hint: 'You collect every fee and pay every winner.' },
  { value: 'each-settles', label: 'Each clan settles its own', hint: 'Every clan collects its members’ fees and pays its own.' },
  { value: 'clans-collect-host-pays', label: 'Clans collect → host pays', hint: 'Clans gather fees into your pot; you pay all winners.' },
];

/**
 * Host-side co-host management — invite other clans to help run this event, and see where each stands.
 * Each accepted co-host becomes a team of its own on the board below, run by that clan's staff.
 */
export default function CoHostPanel({
  eventId,
  initial,
  cashPolicy: initialCashPolicy,
  settlement: initialSettlement,
}: {
  eventId: number;
  initial: CohostRow[];
  cashPolicy: string;
  settlement: EventSettlement | null;
}) {
  const [cohosts, setCohosts] = useState(initial);
  // Cash policy and each co-host's board access are DRAFTS until Save — clicking an option is not
  // committing to it. `cohosts` holds what's saved; `boardDraft` only the unsaved flips.
  const [savedCash, setSavedCash] = useState(initialCashPolicy);
  const [cashPolicy, setCashPolicy] = useState(initialCashPolicy);
  const [boardDraft, setBoardDraft] = useState<Record<number, BoardAccess>>({});
  const [settlement, setSettlement] = useState(initialSettlement);
  const [customOpen, setCustomOpen] = useState<Record<number, boolean>>({});
  const [pickedClan, setPickedClan] = useState<PickedClan | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savedAccess = (c: CohostRow) => parseBoardAccess(c.boardAccess, c.staffCanEditBoard);
  const boardAccess = (c: CohostRow) => boardDraft[c.id] ?? savedAccess(c);
  const changedBoard = cohosts.filter((c) => c.id in boardDraft && !sameAccess(boardDraft[c.id], savedAccess(c)));
  const dirty = cashPolicy !== savedCash || changedBoard.length > 0;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const patch = async (body: object) => {
        const res = await clanFetch(`/api/events/${eventId}/co-hosts`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? 'Could not save');
        }
      };
      if (cashPolicy !== savedCash) {
        await patch({ cashPolicy });
        setSavedCash(cashPolicy);
      }
      for (const c of changedBoard) {
        await patch({ cohostId: c.id, boardAccess: boardDraft[c.id] });
      }
      setBoardDraft({});
      // The settlement table is computed under the saved policy — re-read it.
      await refresh();
      setSavedNote(true);
      setTimeout(() => setSavedNote(false), 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setCashPolicy(savedCash);
    setBoardDraft({});
    setError(null);
  }

  async function refresh() {
    const res = await clanFetch(`/api/events/${eventId}/co-hosts`);
    if (res.ok) {
      const data = await res.json();
      setCohosts(data.cohosts ?? []);
      setSettlement(data.settlement ?? null);
    }
  }

  async function end(id: number, name: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch(`/api/cohosts/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `Could not remove ${name}`);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function invite() {
    const clanSlug = pickedClan?.slug;
    if (!clanSlug) return;
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/co-hosts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clanSlug }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Could not invite');
      if (data?.created === false) {
        // Already pending or already accepted — nothing happened, and saying so beats a cleared box
        // that looks like it worked. (A DECLINED row is re-opened server-side and comes back
        // `created: true`, so this no longer fires for the case that used to be a dead end.)
        setError('That clan is already on this event.');
      }
      setPickedClan(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-card-border bg-card-bg">
      <div className="flex items-center gap-2.5 border-b border-card-border px-5 py-3.5">
        <span className="molten h-5 w-1 shrink-0 rounded-sm" />
        <h2 className="text-[15px] font-semibold">Co-hosts</h2>
        <span className="ml-auto text-[12px] text-text-muted">Invite other clans to run a team here.</span>
      </div>

      {cohosts.length > 0 && (
        <ul className="divide-y divide-card-border">
          {cohosts.map((c) => {
            const st = STATUS[c.status] ?? STATUS.pending;
            return (
              <li key={c.id} className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <ClanCrest
                    variant="letter"
                    slug={c.clanSlug}
                    name={c.clanName}
                    logoUrl={c.clanLogoUrl ?? null}
                    size={32}
                    rounded="rounded-lg"
                    className="text-[13px]"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium">{c.clanName}</div>
                    <div className="font-mono text-[11px] text-text-muted">c / {c.clanSlug}</div>
                  </div>
                  <span className={`ml-auto shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] ${st.cls}`}>{st.label}</span>
                  {/* There was no way to undo any of this from either side. `declineCoHostInvite` even
                      told an accepted co-host to "leave the event instead", pointing at a thing that
                      did not exist. Refused once the event starts — by then their team is on the board
                      and unwinding it is a scoring decision, not a membership one. */}
                  <button
                    type="button"
                    onClick={() => end(c.id, c.clanName)}
                    disabled={busy}
                    className="shrink-0 rounded-lg border border-card-border px-2.5 py-1 text-[11.5px] text-text-muted transition-colors hover:border-accent-red/40 hover:text-accent-red disabled:opacity-50"
                  >
                    {c.status === 'accepted' ? 'Remove' : 'Withdraw'}
                  </button>
                </div>
                {c.status !== 'declined' && (() => {
                  const access = boardAccess(c);
                  const preset = ACCESS_PRESETS.find((p) => sameAccess(p.access, access))?.id ?? 'custom';
                  const set = (next: BoardAccess) => setBoardDraft((d) => ({ ...d, [c.id]: next }));
                  return (
                    <div className="mt-2 ml-11 space-y-2 text-[12.5px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">Tiles</span>
                        <Select
                          className="w-72"
                          value={preset}
                          ariaLabel={`What ${c.clanName} may do with the tiles`}
                          options={[...ACCESS_PRESETS.map((p) => ({ value: p.id, label: p.label })), { value: 'custom', label: 'Custom…' }]}
                          onChange={(v) => {
                            const p = ACCESS_PRESETS.find((x) => x.id === v);
                            if (p) set({ ...p.access });
                            else set({ ...access });
                            if (v === 'custom') setCustomOpen((o) => ({ ...o, [c.id]: true }));
                          }}
                        />
                      </div>
                      {(preset === 'custom' || customOpen[c.id]) && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {TILE_ACTIONS.map((a) => (
                            <label key={a} className="flex items-center justify-between gap-2 text-text-muted">
                              {ACTION_LABEL[a]}
                              <Select
                                className="w-40"
                                value={access[a]}
                                ariaLabel={`${ACTION_LABEL[a]}: who`}
                                options={[
                                  { value: 'nobody', label: 'Nobody' },
                                  { value: 'staff', label: 'Their staff' },
                                  ...(a === 'suggest' ? [{ value: 'players', label: 'Any of their players' }] : []),
                                ]}
                                onChange={(v) => set({ ...access, [a]: v as AccessWho })}
                              />
                            </label>
                          ))}
                        </div>
                      )}
                      <p className="text-text-muted">
                        Their staff means {c.clanName}&rsquo;s moderators and up, and its tile editors. Suggestions wait on your
                        Tiles tab until you accept them.
                      </p>
                    </div>
                  );
                })()}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
        <ClanPicker value={pickedClan} onChange={setPickedClan} disabled={busy} />
        <button
          type="button"
          onClick={invite}
          disabled={busy || !pickedClan}
          className="shrink-0 rounded-lg bg-gold px-4 py-2 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
        >
          {busy ? 'Inviting…' : 'Invite'}
        </button>
      </div>
      {error && <p className="px-5 pb-3 text-[12.5px] text-accent-red">{error}</p>}
      <p className="px-5 pb-4 text-[12px] text-text-muted">
        On accept, the clan gets its own team here and its staff can run it — roster, proof, their
        players’ fees. Subs, the board and the payout stay yours.
      </p>

      {/* Who holds the cash */}
      <div className="border-t border-card-border px-5 py-4">
        <div className="mb-2.5 text-[13px] font-semibold">Who holds the cash</div>
        <div className="flex flex-col gap-2">
          {CASH.map((c) => {
            const active = c.value === cashPolicy;
            return (
              <label
                key={c.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                  active ? 'border-gold/50 bg-gold/[0.06]' : 'border-card-border bg-background hover:border-gold/30'
                }`}
              >
                <input type="radio" name="cashPolicy" checked={active} onChange={() => setCashPolicy(c.value)} className="mt-0.5 h-4 w-4 accent-gold" />
                <span>
                  <span className={`block text-[13.5px] font-medium ${active ? 'text-gold' : ''}`}>{c.label}</span>
                  <span className="mt-0.5 block text-[12.5px] text-text-muted">{c.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {(dirty || savedNote) && (
        <div className="flex items-center gap-3 border-t border-card-border px-5 py-3">
          {dirty ? (
            <>
              <span className="text-[12.5px] text-text-muted">Unsaved changes.</span>
              <button
                type="button"
                onClick={discard}
                disabled={saving}
                className="ml-auto text-[12.5px] text-text-muted hover:text-foreground hover:underline underline-offset-4"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-gold px-4 py-1.5 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </>
          ) : (
            <span className="text-[12.5px] text-accent-green-light">Saved.</span>
          )}
        </div>
      )}

      {/* Settlement — the policy made concrete, once there's a co-host and a fee. */}
      {settlement?.relevant && (
        <div className="border-t border-card-border px-5 py-4">
          <div className="mb-1 text-[13px] font-semibold">Settlement</div>
          {/* What the numbers MEAN depends on the policy the settlement was computed under (lib/coHostSettlement). */}
          <p className="mb-2.5 text-[12px] text-text-muted">
            {settlement.cashPolicy === 'each-settles'
              ? 'No money crosses clans: each clan keeps its players’ fees and pays its own winners. Keeps = fees − winnings.'
              : settlement.cashPolicy === 'clans-collect-host-pays'
                ? 'Each clan sends the fees it collected to you; you pay every winner. Transfer is what each clan owes you.'
                : 'You collected every fee and pay every winner directly, so nothing crosses clans. You keep the fees left after payouts.'}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-text-muted">
                  <th className="py-1 pr-3 font-medium">Clan</th>
                  <th className="px-3 py-1 text-right font-medium">Entrants</th>
                  <th className="px-3 py-1 text-right font-medium">Fees in</th>
                  <th className="px-3 py-1 text-right font-medium">Winnings</th>
                  {settlement.cashPolicy === 'clans-collect-host-pays' && (
                    <th className="px-3 py-1 text-right font-medium" title="Negative: the clan pays the host">Transfer</th>
                  )}
                  <th className="py-1 pl-3 text-right font-medium" title="What the clan holds once transfers and its payouts are done">Keeps</th>
                </tr>
              </thead>
              <tbody>
                {settlement.clans.map((c) => (
                  <tr key={c.clanId} className="border-t border-card-border/60">
                    <td className="py-1.5 pr-3">
                      {c.name}
                      {c.isHost && <span className="ml-1.5 rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] text-gold">host</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{c.entrants}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{gp(c.fees)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{gp(c.winnings)}</td>
                    {settlement.cashPolicy === 'clans-collect-host-pays' && (
                      <td className={`px-3 py-1.5 text-right tabular-nums ${c.transfer < 0 ? 'text-accent-red' : c.transfer > 0 ? 'text-accent-green-light' : ''}`}>
                        {gp(c.transfer)}
                      </td>
                    )}
                    <td className={`py-1.5 pl-3 text-right font-medium tabular-nums ${c.keeps > 0 ? 'text-accent-green-light' : c.keeps < 0 ? 'text-accent-red' : ''}`}>
                      {gp(c.keeps)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-card-border text-text-muted">
                  <td className="py-1.5 pr-3">Total</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{settlement.clans.reduce((n, c) => n + c.entrants, 0)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{gp(settlement.totals.fees)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{gp(settlement.totals.winnings)}</td>
                  {settlement.cashPolicy === 'clans-collect-host-pays' && <td />}
                  <td className="py-1.5 pl-3 text-right tabular-nums">{gp(settlement.totals.fees - settlement.totals.winnings)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
