'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import Checkbox from '@/components/Checkbox';
import RoleSelect from '@/components/RoleSelect';
import { clanFetch } from '@/lib/clanFetch';

export interface PingValue {
  roleId: string;
  onStart: boolean;
  onEnd: boolean;
}

/**
 * A Discord role a competition pings on its start and/or results post (lib/discord rolePing). The
 * daily and halfway posts never ping: a role pinged every day stops being read. With no role, the
 * two ticks have nothing to do and stay off.
 */
export function CompetitionPingFields({ value, onChange, disabled }: { value: PingValue; onChange: (v: PingValue) => void; disabled?: boolean }) {
  const none = !value.roleId;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1 basis-64">
          <label className="mb-1.5 block text-sm font-medium text-foreground/70">Ping a role</label>
          <RoleSelect
            value={value.roleId}
            onChange={(roleId) => onChange({ roleId, onStart: roleId ? (value.roleId ? value.onStart : true) : false, onEnd: roleId ? (value.roleId ? value.onEnd : true) : false })}
            noneLabel="No ping"
            ariaLabel="Role to ping"
          />
        </div>
        <div role="group" aria-label="When to ping" className="flex flex-wrap gap-x-5 gap-y-1">
          <Checkbox checked={value.onStart} onChange={(onStart) => onChange({ ...value, onStart })} label="When it starts" disabled={none || disabled} className="text-sm text-foreground/80" />
          <Checkbox checked={value.onEnd} onChange={(onEnd) => onChange({ ...value, onEnd })} label="When it ends" disabled={none || disabled} className="text-sm text-foreground/80" />
        </div>
      </div>
      <p className="text-xs text-text-muted">The daily and halfway posts never ping. A repeating competition keeps the same ping each week.</p>
    </div>
  );
}

/** The same choice on a competition that exists: its own card and save, like "Which game counts". */
export function WeeklyPingPanel({ competitionId, initial }: { competitionId: number; initial: PingValue }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const dirty = value.roleId !== saved.roleId || value.onStart !== saved.onStart || value.onEnd !== saved.onEnd;

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await clanFetch(`/api/admin/weekly/${competitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pingRoleId: value.roleId || null, pingOnStart: !!value.roleId && value.onStart, pingOnEnd: !!value.roleId && value.onEnd }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Could not save.' });
        return;
      }
      setSaved(value);
      setMessage({ type: 'success', text: 'Saved.' });
      router.refresh();
    } catch {
      setMessage({ type: 'error', text: 'Could not save.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="weekly-ping" className="scroll-mt-24 rounded-xl border border-card-border bg-card-bg p-5">
      <h2 className="mb-4 flex items-center gap-2 font-semibold">
        <span className="h-5 w-1 rounded-full bg-gold" />
        Discord ping
      </h2>
      <CompetitionPingFields value={value} onChange={setValue} disabled={saving} />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="min-h-10 rounded-lg bg-gold px-4 text-sm font-semibold text-black disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {message && <span className={`text-sm ${message.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>{message.text}</span>}
      </div>
    </section>
  );
}
