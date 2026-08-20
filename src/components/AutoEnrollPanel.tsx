'use client';

import { useCallback, useEffect, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';

type Placement = 'one_team' | 'draft_pool' | 'individual';

interface Props {
  eventId: number;
  // False once the draft has started — team-creating placements (one_team / individual) are locked.
  canCreateTeams: boolean;
  // True while the snake draft is active/paused — the whole panel is disabled.
  draftInProgress: boolean;
  // Called after a successful enroll so the parent can refresh the pool / team lists.
  onEnrolled: () => void | Promise<void>;
  // Format-first flow: pin the panel to one placement and hide the chooser — the Teams tab
  // already asked "draft / one team each / one shared team", so don't ask again here.
  fixedPlacement?: Placement;
}

const OPTIONS: { value: Placement; label: string; hint: string; needsTeams: boolean }[] = [
  { value: 'draft_pool', label: 'Draft pool', hint: 'Unassigned — draft into teams later', needsTeams: false },
  { value: 'individual', label: 'One team each', hint: 'Every member races on their own team', needsTeams: true },
  { value: 'one_team', label: 'One shared team', hint: 'Whole clan on a single team', needsTeams: true },
];

// Bulk-enroll every plugin-active clan member into this event. Sits on the Teams tab's pool step.
export default function AutoEnrollPanel({ eventId, canCreateTeams, draftInProgress, onEnrolled, fixedPlacement }: Props) {
  const [placement, setPlacement] = useState<Placement>(fixedPlacement ?? 'draft_pool');
  const [counts, setCounts] = useState<{ eligible: number; notEnrolled: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const loadCounts = useCallback(async () => {
    try {
      const res = await clanFetch(`/api/admin/events/${eventId}/auto-enroll`);
      if (res.ok) setCounts(await res.json());
    } catch {
      /* leave counts null — the button still works */
    }
  }, [eventId]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const selected = OPTIONS.find((o) => o.value === placement)!;
  const blocked = draftInProgress || (selected.needsTeams && !canCreateTeams);

  async function enroll() {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await clanFetch(`/api/admin/events/${eventId}/auto-enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placement }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || 'Enroll failed.');
        return;
      }
      const parts = [`${data.added} newly enrolled`];
      if (data.teamsCreated) parts.push(`${data.teamsCreated} team${data.teamsCreated === 1 ? '' : 's'} created`);
      parts.push(`${data.eligible} plugin-active total`);
      setResult(parts.join(' · '));
      await loadCounts();
      await onEnrolled();
    } catch {
      setErr('Network error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 border border-card-border rounded-xl p-4 bg-card-bg space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-1 h-4 bg-gold rounded-full" />
        <h3 className="text-base font-bold">Auto-enroll plugin members</h3>
      </div>
      <p className="text-xs text-text-muted">
        Add every clan member who has linked / verified an account through the Anvil plugin — one tap, no
        sign-up form. Ideal for tile races and other open, no-payout events.
        {counts && (
          <>
            {' '}
            <span className="text-foreground/80">
              {counts.notEnrolled} of {counts.eligible} eligible member{counts.eligible === 1 ? '' : 's'} not yet enrolled.
            </span>
          </>
        )}
      </p>

      {!fixedPlacement && (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {OPTIONS.map((o) => {
          const active = placement === o.value;
          const locked = o.needsTeams && !canCreateTeams;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setPlacement(o.value)}
              disabled={locked}
              className={`text-left rounded-lg border px-3 py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                active
                  ? 'border-gold/60 bg-gold/10'
                  : 'border-card-border hover:border-gold/30'
              }`}
            >
              <div className="text-sm font-medium">{o.label}</div>
              <div className="text-[11px] text-text-muted leading-tight mt-0.5">
                {locked ? 'Locked — draft has started' : o.hint}
              </div>
            </button>
          );
        })}
      </div>
      )}

      <button
        onClick={enroll}
        disabled={busy || blocked}
        className="w-full text-sm font-medium bg-accent-green/15 text-accent-green-light border border-accent-green/30 px-4 py-2 rounded-lg hover:bg-accent-green/25 transition-colors disabled:opacity-50"
      >
        {busy
          ? 'Enrolling…'
          : draftInProgress
            ? 'Unavailable while the draft is running'
            : `Enroll active plugin members (${selected.label})`}
      </button>

      {result && <p className="text-xs text-accent-green-light">Enrolled: {result}</p>}
      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  );
}
