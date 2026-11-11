'use client';

import { useState } from 'react';

import Checkbox from '@/components/Checkbox';
import NumberInput from '@/components/NumberInput';
import { MAX_ACCOUNTS_CAP } from '@/lib/accountCap';
import { clanFetch } from '@/lib/clanFetch';
import SettingsCard from './SettingsCard';

type SlotMode = 'per-person' | 'per-account';

/**
 * How many of a person's characters may enter, and whether alts share their team. Was only on the
 * Teams page's first step (solo / one-team boards, before a draft) and the create form, so a host who
 * set it when creating the board had nowhere to change it. Locked once the board starts (the event
 * API refuses it then).
 */
export default function AccountsPanel({
  eventId,
  initialMax,
  initialSlot,
  started,
  solo,
}: {
  eventId: number;
  initialMax: number;
  initialSlot: SlotMode;
  started: boolean;
  /** A board where everyone plays alone: "When a person has alts" decides the teams. */
  solo: boolean;
}) {
  const [max, setMax] = useState(initialMax);
  const [slot, setSlot] = useState<SlotMode>(initialSlot);
  const [saved, setSaved] = useState(initialMax);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    const res = await clanFetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setMsg(data.error || 'Couldn’t save.');
      return false;
    }
    setMsg('Saved.');
    return true;
  }

  const saveMax = async (v: number) => {
    setMax(v);
    if (v !== saved && (await save({ maxAccountsPerPerson: v }))) setSaved(v);
  };

  return (
    <SettingsCard
      title="Characters per person"
      description="How many of a person’s characters may enter this board. Applies to sign-ups, Add them all, keep adding, and adding people by hand. Fixed once the board starts."
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          {max !== 0 && (
            <NumberInput
              value={max}
              onChange={setMax}
              onBlur={() => void saveMax(max)}
              min={1}
              max={MAX_ACCOUNTS_CAP}
              fallback={1}
              disabled={busy || started}
              aria-label="Characters per person"
              className="w-20 rounded-lg border border-card-border bg-brown-dark px-2 py-1.5 text-right focus:border-gold/50 focus:outline-none disabled:opacity-50"
            />
          )}
          <Checkbox checked={max === 0} disabled={busy || started} onChange={(on) => void saveMax(on ? 0 : 1)} label="No limit" />
          <span className="text-text-muted">
            {max === 0 ? 'Every character they have.' : max === 1 ? 'One character each.' : `Up to ${max} characters each.`}
          </span>
        </div>
        {solo && max !== 1 && (
          <div>
            <div className="mb-1.5 font-medium text-foreground/80">When a person has alts</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                { v: 'per-person', label: 'One team per person', hint: 'Alts share the team; totals combine.' },
                { v: 'per-account', label: 'Each alt its own team', hint: 'Every character is a separate team.' },
              ] as const).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  disabled={busy || started}
                  onClick={async () => {
                    if (o.v === slot) return;
                    if (await save({ accountSlotMode: o.v })) setSlot(o.v);
                  }}
                  className={`rounded-lg border px-3 py-2 text-left disabled:opacity-50 ${slot === o.v ? 'border-gold/60 bg-gold/10' : 'border-card-border hover:border-gold/30'}`}
                >
                  <div className="font-medium">{o.label}</div>
                  <div className="text-[11px] text-text-muted">{o.hint}</div>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[12px] text-text-muted">Changes how new teams are made; teams that already exist keep their players.</p>
          </div>
        )}
        {msg && <p className={`text-[12px] ${msg === 'Saved.' ? 'text-accent-green-light' : 'text-red-400'}`}>{msg}</p>}
      </div>
    </SettingsCard>
  );
}
