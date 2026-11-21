'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import Input from '@/components/Input';
import Select from '@/components/Select';
import { clanFetch } from '@/lib/clanFetch';
import { formatGp, parseGpInput } from '@/lib/adminEventsFormat';
import { currencyWords, type PrizeCurrency } from '@/lib/competitionGame';

/**
 * "I put gp in the pot."
 *
 * Says plainly that it is a claim staff will check, because the alternative — a form that looks
 * like a deposit — sets up the disappointment of watching the balance not move.
 */
export default function CofferDonateCard({
  seats,
  signedIn,
  hcwCoffer = false,
  pot = 'gp',
}: {
  seats: { id: number; rsn: string }[];
  signedIn: boolean;
  /** The clan keeps a Hardcore Worlds coffer, so a donation can be filed into either pot. */
  hcwCoffer?: boolean;
  /** The pot the page is showing: where a donation is filed unless they pick the other. */
  pot?: PrizeCurrency;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [seatId, setSeatId] = useState(seats[0]?.id ?? 0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [filed, setFiled] = useState(false);
  const [into, setInto] = useState<PrizeCurrency>(hcwCoffer ? pot : 'gp');
  const unit = currencyWords(into);

  const parsed = parseGpInput(amount);

  if (!signedIn) {
    return (
      <div className="border border-card-border rounded-xl bg-card-bg p-4 text-sm text-text-muted">
        Sign in to tell staff about a donation you have made.
      </div>
    );
  }
  if (seats.length === 0) {
    return (
      <div className="border border-card-border rounded-xl bg-card-bg p-4 text-sm text-text-muted">
        Only members of this clan can donate to its coffer.
      </div>
    );
  }

  async function submit() {
    if (!parsed) {
      setMsg('Enter how much you donated, like 50m.');
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      const res = await clanFetch('/api/coffer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parsed, note: note || null, seatId, currency: into }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFiled(true);
        setAmount('');
        setNote('');
        router.refresh();
      } else {
        setMsg(data.error || 'That did not go through.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-gold/25 rounded-xl bg-gold/5 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold">Donated to the coffer?</p>
        <p className="text-[11px] text-text-muted">
          Tell staff here. It shows in the pot once they confirm it — nothing moves until then.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {hcwCoffer && (
          <div>
            <span className="block text-[10px] text-text-muted mb-1">Which coffer</span>
            {/* Two pots, two economies: HCW gp handed to a staffer's Hardcore Worlds character is
                not main game gp, so the member says which one it was. */}
            <div role="radiogroup" aria-label="Which coffer" className="flex rounded-lg border border-card-border p-0.5 text-xs">
              {(['gp', 'hcw'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={into === c}
                  onClick={() => {
                    setInto(c);
                    setFiled(false);
                  }}
                  className={`rounded-md px-2.5 py-1.5 transition-colors ${
                    into === c ? 'bg-gold/20 text-gold' : 'text-text-muted hover:text-foreground'
                  }`}
                >
                  {c === 'hcw' ? 'Hardcore Worlds' : 'Main game'}
                </button>
              ))}
            </div>
          </div>
        )}
        {seats.length > 1 && (
          <div>
            <label className="block text-[10px] text-text-muted mb-1">From</label>
            <Select
              value={String(seatId)}
              onChange={(v) => setSeatId(Number(v))}
              ariaLabel="Which character donated"
              options={seats.map((s) => ({ value: String(s.id), label: s.rsn }))}
            />
          </div>
        )}
        <div>
          <label className="block text-[10px] text-text-muted mb-1">Amount</label>
          <Input
            type="text"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setFiled(false);
            }}
            placeholder="50m"
            className="w-28"
            aria-label="Amount donated"
          />
        </div>
        <div className="flex-1 min-w-[12rem]">
          <label className="block text-[10px] text-text-muted mb-1">Note (optional)</label>
          <Input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Gave it to Drenvox in game"
            aria-label="Note"
          />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="px-3 py-2 text-sm font-semibold rounded-lg bg-gold/20 border border-gold text-gold hover:bg-gold/30 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Filing…' : 'File it'}
        </button>
      </div>

      {parsed != null && !filed && (
        <p className="text-[11px] text-text-muted">Filing {formatGp(parsed)} {unit} for staff to confirm.</p>
      )}
      {filed && <p className="text-[11px] text-accent-green-light">Filed — staff will confirm it.</p>}
      {msg && <p className="text-[11px] text-amber-300">{msg}</p>}
    </div>
  );
}
