'use client';

import { useEffect, useState } from 'react';

import LocalTime from '@/components/LocalTime';
import { clanFetch } from '@/lib/clanFetch';
import type { SupporterStanding } from '@/lib/supporterGiftRules';
import { SUPPORTER_TIERS, type SupporterTierId } from '@/lib/supporterTiers';
import Select from '@/components/Select';
import Checkbox from '@/components/Checkbox';
import Input from '@/components/Input';

interface Gift {
  id: number;
  tier: SupporterTierId;
  startedAt: string;
  endsAt: string | null;
  live: boolean;
  boostSlots?: boolean;
  grantedBy?: string | null;
  endedBy?: string | null;
  neverStarted?: boolean;
  note?: string | null;
  mode?: 'lift' | 'add';
  addedDays?: number;
  queued?: boolean;
  queuedDays?: number | null;
}

type Mode = 'lift' | 'add';
interface Preview {
  text: string;
  nothing: boolean;
  blocked: boolean;
}

const MODES: { value: Mode; label: string; says: string }[] = [
  { value: 'lift', label: 'Lift to a tier', says: 'Until the end date they have at least this tier, on top of whatever they pay for.' },
  { value: 'add', label: 'Add time', says: 'The time is added to what they already hold at this tier. It never overlaps.' },
];

const tierName = (t: SupporterTierId | null) => (t ? SUPPORTER_TIERS[t].name : 'None');

const LENGTHS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '3 months' },
  { days: 182, label: '6 months' },
  { days: 365, label: '1 year' },
];

/** Free Supporter time for one person (lib/supporterGifts). Root only. */
export default function SupporterGift({ playerId }: { playerId: number }) {
  const [open, setOpen] = useState(false);
  const [gifts, setGifts] = useState<Gift[] | null>(null);
  const [standing, setStanding] = useState<SupporterStanding | null>(null);
  const [tier, setTier] = useState<SupporterTierId>('supporter');
  const [days, setDays] = useState(30);
  const [custom, setCustom] = useState('');
  const [note, setNote] = useState('');
  // Off by default: a gift is flair unless staff choose to give its clan boost slots too.
  const [boostSlots, setBoostSlots] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('lift');
  const [preview, setPreview] = useState<Preview | null>(null);
  // A lift that would change nothing visible: the button then reads "Give anyway" (the second click).
  const [confirming, setConfirming] = useState(false);

  const url = `/api/staff/people/${playerId}/supporter`;

  async function call(init?: RequestInit, query = '') {
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch(url + query, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // "Changes nothing" is already said by the preview line, with what to press next: the same
        // sentence a second time in red read as a failure. Only shown when there is no preview to say it.
        if (data.needsConfirm) setConfirming(true);
        if (!(data.needsConfirm && preview?.nothing)) setError(data.error ?? 'Failed');
      } else {
        setGifts(data.gifts);
        setStanding(data.standing ?? null);
        setConfirming(false);
      }
    } finally {
      setBusy(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && gifts === null) void call();
  }

  const length = custom.trim() ? Number(custom) : days;

  // What this gift WOULD do, in plain words, before anything is saved (the server works it out).
  useEffect(() => {
    if (!open || !(length >= 1)) return;
    let stale = false;
    const t = setTimeout(async () => {
      const res = await clanFetch(`${url}?tier=${tier}&days=${length}&mode=${mode}`);
      const data = await res.json().catch(() => ({}));
      if (!stale && res.ok) setPreview(data.preview ?? null);
    }, 200);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [open, url, tier, length, mode, gifts]);
  const reset = () => {
    setConfirming(false);
    setError(null);
  };

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={toggle}
        className="rounded-lg border border-card-border px-3 py-1 text-xs text-gold hover:border-gold/40"
      >
        Gift Supporter… {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="mt-2 space-y-3 rounded-lg border border-card-border bg-brown-dark/40 p-3 text-xs">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-gray-400">
              What to give
              <Select
                value={mode}
                onChange={(v) => {
                  setMode(v as Mode);
                  reset();
                }}
                options={MODES.map((m) => ({ value: m.value, label: m.label }))}
                ariaLabel="What to give"
                className="mt-1 w-36"
              />
            </label>
            <label className="text-gray-400">
              Tier
              <Select
                value={tier}
                onChange={(v) => {
                  setTier(v as SupporterTierId);
                  reset();
                }}
                options={(Object.keys(SUPPORTER_TIERS) as SupporterTierId[]).map((t) => ({ value: t, label: SUPPORTER_TIERS[t].name }))}
                ariaLabel="Tier"
                className="mt-1 w-32"
              />
            </label>
            <label className="text-gray-400">
              For
              <Select
                value={String(days)}
                onChange={(v) => {
                  setDays(Number(v));
                  setCustom('');
                }}
                options={LENGTHS.map((l) => ({ value: String(l.days), label: l.label }))}
                ariaLabel="For"
                className="mt-1 w-36"
              />
            </label>
            <label className="text-gray-400">
              or days
              <Input
                inputMode="numeric"
                className="mt-1 block w-20 px-2 py-1 text-xs"
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))}
                placeholder="—"
              />
            </label>
            <label className="min-w-40 flex-1 text-gray-400">
              Note (recorded)
              <Input
                className="mt-1 block w-full px-2 py-1 text-xs"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. event prize"
              />
            </label>
            <button
              type="button"
              disabled={busy || !(length >= 1) || preview?.blocked === true}
              onClick={() =>
                void call({
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tier, days: length, note, boostSlots, mode, confirm: confirming }),
                })
              }
              className="rounded-lg bg-gold px-3 py-1.5 font-semibold text-brown-dark disabled:opacity-50"
            >
              {confirming ? 'Give anyway' : mode === 'add' ? `Add ${SUPPORTER_TIERS[tier].name} time` : `Lift to ${SUPPORTER_TIERS[tier].name}`}
            </button>
          </div>
          <p className="text-gray-400">{MODES.find((m) => m.value === mode)?.says}</p>
          {preview && (
            <p className={`rounded-lg border px-3 py-2 ${preview.nothing || preview.blocked ? 'border-yellow-500/40 text-yellow-200' : 'border-card-border text-gray-200'}`}>
              <span className="text-gray-500">What this will do: </span>
              {preview.text}
              {preview.nothing && ' Press the button twice to give it anyway.'}
              <span className="text-gray-500"> Dates are UTC. Nothing is sent to Gumroad.</span>
            </p>
          )}
          <Checkbox
            checked={boostSlots}
            onChange={setBoostSlots}
            label="With clan boost slots"
            description={`${SUPPORTER_TIERS[tier].name} slots to boost clans they're a member of. Off: flair and perks only, no boosts.`}
          />
          {error && <p className="text-red-300">{error}</p>}
          {standing && (
            // Paid vs. worn: a gift is a separate row laid over the paid one, never an edit of it.
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border border-card-border px-3 py-2">
              <dt className="text-gray-500">Pays for</dt>
              <dd className="text-gray-200">{tierName(standing.paid)}</dd>
              {standing.earned && (
                <>
                  <dt className="text-gray-500">Invite time</dt>
                  <dd className="text-gray-200">{tierName(standing.earned)}</dd>
                </>
              )}
              <dt className="text-gray-500">Wears now</dt>
              <dd className={standing.source === 'gift' ? 'text-gold' : 'text-gray-200'}>
                {tierName(standing.effective)}
                {standing.source === 'gift' && standing.gift && (
                  <span className="text-gray-400">
                    {' '}
                    · temporary, from a staff gift
                    {(() => {
                      const by = gifts?.find((g) => g.id === standing.gift?.id)?.grantedBy;
                      return by ? ` by ${by}` : '';
                    })()}
                    {standing.gift.endsAt ? (
                      <>
                        {' '}
                        until <LocalTime date={standing.gift.endsAt} />, then {tierName(standing.paid ?? standing.earned)}
                      </>
                    ) : null}
                  </span>
                )}
              </dd>
            </dl>
          )}
          {gifts && gifts.length > 0 && (
            <ul className="space-y-1">
              {gifts.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-2 text-gray-300">
                  <span className={g.live || g.queued ? 'text-gold' : 'text-gray-500'}>{SUPPORTER_TIERS[g.tier].name}</span>
                  <span className="rounded-full border border-card-border px-1.5 text-[10px] text-gray-400">{g.mode === 'add' ? 'Add time' : 'Lift to a tier'}</span>
                  {g.boostSlots && <span className="rounded-full border border-card-border px-1.5 text-[10px] text-gray-400">with boost slots</span>}
                  {g.queued ? (
                    <span className="text-gray-400">{g.queuedDays ?? 0} days stored, starting when their paid membership ends</span>
                  ) : g.neverStarted ? (
                    <span className="text-gray-500">
                      {g.queuedDays ?? 0} days stored · removed before it started{g.endedBy ? ` by ${g.endedBy}` : ''}
                    </span>
                  ) : (
                  <span className="text-gray-500">
                    from <LocalTime date={g.startedAt} />
                    {g.endsAt && (
                      <>
                        {' '}
                        to <LocalTime date={g.endsAt} />
                      </>
                    )}
                    {!g.live && (g.endedBy ? ` · ended early by ${g.endedBy}` : ' · ended')}
                    {!!g.addedDays && ` · ${g.addedDays} days added since`}
                  </span>
                  )}
                  <span className="text-gray-500">· given by {g.grantedBy ?? 'unknown (no audit entry)'}</span>
                  {g.note && <span className="text-gray-500">· “{g.note}”</span>}
                  {(g.live || g.queued) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void call({ method: 'DELETE' }, `?gift=${g.id}`)}
                      className="text-red-300 hover:text-red-200 max-sm:min-h-11 max-sm:px-2"
                    >
                      {g.queued ? 'Remove' : 'End now'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {gifts && gifts.length === 0 && <p className="text-gray-500">No gifts yet.</p>}
        </div>
      )}
    </div>
  );
}
