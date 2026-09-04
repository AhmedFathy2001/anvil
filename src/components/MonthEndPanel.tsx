'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import Input from '@/components/Input';
import { clanFetch } from '@/lib/clanFetch';
import { parseEventRules } from '@/lib/eventRules';

/**
 * What happens when a month ends on a ladder that keeps running.
 *
 * Only shown for a ladder, because it is the only format where "the month" means anything: its
 * monthly board is a window over the same completions the all-time board reads, so a month ending is
 * a moment rather than a reset. Off by default — a board that runs for a fortnight has no months.
 */
export default function MonthEndPanel({
  event,
  allowed = true,
}: {
  event: { id: number; rules?: string | null };
  /** False on every format but a ladder. */
  allowed?: boolean;
}) {
  const router = useRouter();
  const rules = parseEventRules(event.rules);
  const [enabled, setEnabled] = useState(rules.monthlyAward != null);
  const [announce, setAnnounce] = useState(rules.monthlyAward?.announce ?? true);
  const [roleId, setRoleId] = useState(rules.monthlyAward?.roleId ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  if (!allowed) return null;

  async function save() {
    setSaving(true);
    setMsg('');
    try {
      const monthlyAward = enabled ? { announce, roleId: roleId.trim() || null } : null;
      const res = await clanFetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: { ...rules, monthlyAward } }),
      });
      if (res.ok) {
        setMsg('Saved.');
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setMsg(d.error || 'Save failed.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-0 mb-6">
      <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
        <span className="w-1 h-5 bg-gold rounded-full" />
        Month end
      </h2>
      <p className="text-sm text-text-muted mb-3">
        The monthly board is a window, not a wipe — the all-time table keeps everything. This is what
        happens the moment a month closes.
      </p>

      <div className="border border-card-border rounded-xl bg-card-bg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            aria-pressed={enabled}
            className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-gold' : 'bg-card-border'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : ''}`} />
          </button>
          <span className="text-sm">Crown a champion each month</span>
        </div>

        {enabled && (
          <div className="space-y-3 border-l border-gold/25 pl-3 ml-[0.6rem]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAnnounce(!announce)}
                aria-pressed={announce}
                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${announce ? 'bg-gold' : 'bg-card-border'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${announce ? 'translate-x-5' : ''}`} />
              </button>
              <span className="text-xs text-text-muted">Post the winner to Discord</span>
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1">
                Champion role <span className="text-text-muted/60">(Discord role ID — blank for no role)</span>
              </label>
              <Input
                type="text"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                placeholder="1234567890123456789"
                className="w-64"
                aria-label="Champion role id"
              />
              <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
                Handed to whoever tops the month, and taken off whoever held it. The bot needs Manage
                Roles, and its own role has to sit ABOVE this one in the server list — Discord refuses
                otherwise, and the winner keeps the points but not the colour.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-gold/20 border border-gold text-gold hover:bg-gold/30 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {msg && <span className="text-xs text-text-muted">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
