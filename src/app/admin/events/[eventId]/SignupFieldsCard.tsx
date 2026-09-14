'use client';

import { useEffect, useState } from 'react';

import Checkbox from '@/components/Checkbox';
import { clanFetch } from '@/lib/clanFetch';
import { DEFAULT_SIGNUP_FIELDS, type SignupFields } from '@/lib/eventRules';

/**
 * What this board asks people when they sign up.
 *
 * THE FORM WAS THE SAME FORM FOR EVERY BOARD, and most of it only matters to a draft. A clan running
 * a straight 5x5 was asking its members for active hours per day, AFK hours per week, a timezone,
 * every boss they do and every skill they train — a page of questions to enter a bingo nobody was
 * being picked for. Each one is a choice now.
 *
 * Saves on toggle rather than behind a button: there is no half-finished state to protect, and a
 * checkbox that needs confirming is one people leave unconfirmed.
 */

const ROWS: { key: keyof SignupFields; label: string; hint: string }[] = [
  {
    key: 'availability',
    label: 'Play hours',
    hint: 'Active and AFK, per day and per week — four ranges. Only the draft war room and the applicant drawer ever read them.',
  },
  { key: 'timezone', label: 'Timezone', hint: 'One dropdown. Useful whenever people have to be online together.' },
  { key: 'bosses', label: 'Bosses they do', hint: 'A long checklist. Worth it when captains pick on content coverage.' },
  { key: 'skills', label: 'Skills they train', hint: 'The same, for skilling tiles.' },
  { key: 'notes', label: 'Anything else for captains', hint: 'A free-text box. Cheap to leave on.' },
];

export default function SignupFieldsCard({ eventId }: { eventId: number }) {
  const [fields, setFields] = useState<SignupFields | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clanFetch(`/api/admin/events/${eventId}/signup-fields`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load'))))
      .then((d) => setFields(d.fields ?? DEFAULT_SIGNUP_FIELDS))
      .catch(() => setFields(DEFAULT_SIGNUP_FIELDS));
  }, [eventId]);

  async function toggle(key: keyof SignupFields, on: boolean) {
    if (!fields) return;
    const next = { ...fields, [key]: on };
    setFields(next); // optimistic: the checkbox should move when it is clicked
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch(`/api/admin/events/${eventId}/signup-fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { [key]: on } }),
      });
      if (!res.ok) {
        setFields(fields); // put it back — the server is the truth
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'That did not save.');
      }
    } catch {
      setFields(fields);
      setError('That did not save.');
    } finally {
      setBusy(false);
    }
  }

  if (!fields) return null;

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-gold" />
        <h3 className="font-semibold">What the sign-up form asks</h3>
      </div>
      <p className="mb-3 text-[13px] text-text-muted">
        Everyone is always asked which character they are playing, and for the fee when there is one.
        The rest is up to you.
      </p>

      <ul className="space-y-2.5">
        {ROWS.map((r) => (
          <li key={r.key} className="flex items-start gap-2.5">
            <Checkbox
              checked={fields[r.key]}
              onChange={(on) => toggle(r.key, on)}
              disabled={busy}
              label={r.label}
            />
            <span className="mt-[3px] text-[12.5px] text-text-dim">{r.hint}</span>
          </li>
        ))}
      </ul>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
