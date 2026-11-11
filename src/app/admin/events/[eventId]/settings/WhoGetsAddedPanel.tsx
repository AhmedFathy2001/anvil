'use client';

import { useEffect, useState } from 'react';

import Checkbox from '@/components/Checkbox';
import { clanFetch } from '@/lib/clanFetch';
import SettingsCard from './SettingsCard';

/**
 * How players reach this board, in one place: the public sign-up form (events.signups_enabled) and
 * "keep adding members as they get the plugin" (events.auto_enroll, lib/enroll autoEnrollTick). Both
 * lived only on their own tabs (Sign-ups; the Teams page's Add-them-all card, shown on some steps).
 */
export default function WhoGetsAddedPanel({
  eventId,
  initialSignups,
  placement,
  started,
}: {
  eventId: number;
  initialSignups: boolean;
  /** Where kept-adding puts people: a team each on a board of individuals, else the draft pool. */
  placement: 'individual' | 'draft_pool';
  started: boolean;
}) {
  const [signups, setSignups] = useState(initialSignups);
  const [keep, setKeep] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void clanFetch(`/api/admin/events/${eventId}/auto-enroll`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setKeep(!!d?.keep))
      .catch(() => setKeep(false));
  }, [eventId]);

  async function call(url: string, method: string, body: unknown): Promise<boolean> {
    setBusy(true);
    setMsg(null);
    const res = await clanFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) setMsg(data.error || 'Couldn’t save.');
    else setMsg('Saved.');
    return !!res?.ok;
  }

  return (
    <SettingsCard
      title="Who gets added"
      description="How players reach this board. Everyone added counts as signed up, so fees, prizes and placements work the same."
    >
      <div className="space-y-4">
        <Checkbox
          checked={signups}
          disabled={busy}
          onChange={async (on) => {
            if (await call(`/api/events/${eventId}`, 'PATCH', { signupsEnabled: on })) setSignups(on);
          }}
          label="Players sign up with a form"
          description="Off: no sign-up form. You add players yourself, or let Anvil keep adding them (below)."
        />
        <Checkbox
          checked={!!keep}
          disabled={busy || keep === null || started}
          onChange={async (on) => {
            if (await call(`/api/admin/events/${eventId}/auto-enroll`, 'POST', on ? { placement, keep: true } : { keep: false })) setKeep(on);
          }}
          label="Keep adding clan members as they get the plugin"
          description={`Turning it on adds everyone eligible now. Until the event starts, anyone in the clan who installs the plugin or links their character (including people who join the clan later) is added too, ${placement === 'individual' ? 'each on their own team' : 'into the draft pool'}. Members only, never guests, and within the characters-per-person limit.`}
        />
        {msg && <p className={`text-[12px] ${msg === 'Saved.' ? 'text-accent-green-light' : 'text-red-400'}`}>{msg}</p>}
      </div>
    </SettingsCard>
  );
}
