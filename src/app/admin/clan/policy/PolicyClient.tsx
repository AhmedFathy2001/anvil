'use client';

import { useEffect, useState } from 'react';

import { clanFetch } from '@/lib/clanFetch';
import Checkbox from '@/components/Checkbox';

interface Policy {
  visibility: 'public' | 'members';
  guestPolicy: 'approval' | 'open' | 'closed';
  listed: boolean;
}

/**
 * Three decisions about who can reach this clan, in one place.
 *
 * They already existed — as a column, a default and code that read them — with no way to change any
 * of them. A setting nobody can set is worse than one that does not exist: the behaviour is real,
 * somebody eventually notices it, and there is nowhere to go.
 *
 * Written as choices with their consequences spelled out, not as switches. "Members only" and
 * "Closed" are the two that make a clan quieter, and somebody picking them should know what stops
 * working before they find out from a confused member.
 */
export default function PolicyClient() {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clanFetch('/api/admin/clan/policy')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load'))))
      .then(setPolicy)
      .catch((e: Error) => setError(e.message));
  }, []);

  async function save(patch: Partial<Policy>) {
    if (!policy) return;
    const next = { ...policy, ...patch };
    setPolicy(next);
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await clanFetch('/api/admin/clan/policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Could not save');
      }
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (error && !policy) {
    return <p className="rounded-xl border border-accent-red/40 bg-accent-red/10 p-4 text-sm">{error}</p>;
  }
  if (!policy) {
    return <p className="text-sm text-text-muted">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <Group
        title="Who can see this clan"
        lede="Boards, roster and records. Most clans paste the board link into Discord, so this is public by default."
      >
        <Choice
          name="visibility"
          value={policy.visibility}
          onChange={(v) => save({ visibility: v as Policy['visibility'] })}
          options={[
            {
              value: 'public',
              label: 'Anyone',
              hint: 'A link to a board works for whoever you send it to, signed in or not.',
            },
            {
              value: 'members',
              label: 'Members only',
              hint: 'Everyone else gets the clan’s card and an invitation to apply. Your own members and staff are unaffected.',
            },
          ]}
        />
      </Group>

      <Group
        title="How people join"
        lede="A guest holds a seat here without leaving their own clan — that is how somebody plays in your event."
      >
        <Choice
          name="guestPolicy"
          value={policy.guestPolicy}
          onChange={(v) => save({ guestPolicy: v as Policy['guestPolicy'] })}
          options={[
            {
              value: 'approval',
              label: 'Ask first',
              hint: 'Requests land on Needs review and nobody gets a seat until you say so.',
            },
            { value: 'open', label: 'Anyone', hint: 'Turning up is enough. Good for an open event, noisy otherwise.' },
            {
              value: 'closed',
              label: 'Nobody',
              hint: 'No guests and no requests. Outsiders cannot enter your events at all.',
            },
          ]}
        />
      </Group>

      <Group
        title="Listing"
        lede="Whether this clan appears where people go looking for one."
      >
        <Checkbox
          className="rounded-xl border border-card-border bg-card-bg p-4 transition-colors hover:border-gold/40"
          checked={policy.listed}
          onChange={(listed) => save({ listed })}
          labelClassName="block text-[14.5px] font-medium"
          label="List in the Clan Hall"
          description={
            <span className="mt-0.5 block text-[13px] text-text-muted">
              And on the cross-clan records. Unlisted is not the same as private — a link still works
              if the setting above allows it.
            </span>
          }
        />
      </Group>

      <div className="flex h-5 items-center gap-3 text-[13px]">
        {saving && <span className="text-text-muted">Saving…</span>}
        {!saving && saved && <span className="text-accent-green-light">Saved</span>}
        {error && <span className="text-accent-red">{error}</span>}
      </div>
    </div>
  );
}

function Group({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-2.5">
        <span className="molten h-5 w-1 shrink-0 rounded-sm" />
        <h2 className="text-[16.5px] font-semibold">{title}</h2>
      </div>
      <p className="mb-3.5 ml-4 max-w-[62ch] text-[13.5px] text-text-muted">{lede}</p>
      {children}
    </section>
  );
}

function Choice({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; hint: string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <label
            key={o.value}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
              active ? 'border-gold/50 bg-gold/[0.06]' : 'border-card-border bg-card-bg hover:border-gold/30'
            }`}
          >
            <input
              type="radio"
              name={name}
              checked={active}
              onChange={() => onChange(o.value)}
              className="mt-0.5 h-4 w-4 accent-gold"
            />
            <span>
              <span className={`block text-[14.5px] font-medium ${active ? 'text-gold' : ''}`}>
                {o.label}
              </span>
              <span className="mt-0.5 block text-[13px] text-text-muted">{o.hint}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
