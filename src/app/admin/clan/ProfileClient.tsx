'use client';

import { useEffect, useState } from 'react';

import { clanFetch } from '@/lib/clanFetch';
import Checkbox from '@/components/Checkbox';
import Input from '@/components/Input';
import type { ClanFocus } from '@/lib/clanHome';

const FOCUS: { value: ClanFocus; label: string }[] = [
  { value: 'pvm', label: 'PvM' },
  { value: 'skilling', label: 'Skilling' },
  { value: 'pvp', label: 'PvP' },
  { value: 'social', label: 'Social' },
  { value: 'ironman', label: 'Ironman' },
];

interface Form {
  tagline: string;
  description: string;
  focus: ClanFocus[];
  recruiting: boolean;
  openToChallenges: boolean;
  requirements: { minTotal?: number; minEhp?: number; region?: string; timezone?: string };
}

/**
 * The clan's public profile — what a stranger reads at /c/<slug> before joining. Text fields save on a
 * button rather than per keystroke; toggles and focus chips are part of the same saved form so one
 * "Save" covers everything.
 */
export default function ProfileClient() {
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clanFetch('/api/admin/clan/profile')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load'))))
      .then((d) =>
        setForm({
          tagline: d.tagline ?? '',
          description: d.description ?? '',
          focus: Array.isArray(d.focus) ? d.focus : [],
          recruiting: !!d.recruiting,
          openToChallenges: !!d.openToChallenges,
          requirements: d.requirements ?? {},
        }),
      )
      .catch((e: Error) => setError(e.message));
  }, []);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setSaved(false);
  }
  function setReq(key: keyof Form['requirements'], value: number | string | undefined) {
    setForm((f) => {
      if (!f) return f;
      const requirements = { ...f.requirements };
      if (value === undefined || value === '' || (typeof value === 'number' && !Number.isFinite(value))) delete requirements[key];
      else (requirements[key] as number | string) = value;
      return { ...f, requirements };
    });
    setSaved(false);
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await clanFetch('/api/admin/clan/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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

  if (error && !form) return <p className="rounded-xl border border-accent-red/40 bg-accent-red/10 p-4 text-sm">{error}</p>;
  if (!form) return <p className="text-sm text-text-muted">Loading…</p>;

  const numOrUndef = (v: string) => (v.trim() === '' ? undefined : Math.max(0, Math.floor(Number(v) || 0)));

  return (
    <div className="flex max-w-[62ch] flex-col gap-8">
      <Group title="The hook" lede="One line under your name, and a longer introduction. This is the first thing a stranger reads.">
        <label className="text-[13px] font-medium text-text-muted">Tagline</label>
        <Input
          value={form.tagline}
          onChange={(e) => set('tagline', e.target.value.slice(0, 120))}
          placeholder="Slow gains, good company."
          className="mt-1"
        />
        <label className="mt-4 block text-[13px] font-medium text-text-muted">About</label>
        <textarea
          value={form.description}
          onChange={(e) => set('description', e.target.value.slice(0, 2000))}
          placeholder="What your clan is, who it's for, what a week looks like…"
          rows={5}
          className="mt-1 w-full rounded-lg border border-card-border bg-card-bg px-3 py-2 text-sm text-foreground placeholder:text-text-muted/60 focus:border-gold/50 focus:outline-none"
        />
      </Group>

      <Group title="What you're about" lede="Pick the tags that fit — most clans are two or three.">
        <div className="flex flex-wrap gap-2">
          {FOCUS.map((f) => {
            const on = form.focus.includes(f.value);
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => set('focus', on ? form.focus.filter((x) => x !== f.value) : [...form.focus, f.value])}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  on ? 'border-gold/60 bg-gold/10 text-gold' : 'border-card-border bg-card-bg text-text-muted hover:border-gold/30'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="Discovery" lede="Whether you want more members, and whether other clans can challenge you.">
        <div className="flex flex-col gap-2.5">
          <Checkbox
            className="rounded-xl border border-card-border bg-card-bg p-3.5 transition-colors hover:border-gold/40"
            checked={form.recruiting}
            onChange={(v) => set('recruiting', v)}
            labelClassName="block text-[14px] font-medium"
            label="We're recruiting"
            description={<span className="mt-0.5 block text-[13px] text-text-muted">Shows a recruiting call on your clan home. Who can actually apply follows your Access settings.</span>}
          />
          <Checkbox
            className="rounded-xl border border-card-border bg-card-bg p-3.5 transition-colors hover:border-gold/40"
            checked={form.openToChallenges}
            onChange={(v) => set('openToChallenges', v)}
            labelClassName="block text-[14px] font-medium"
            label="Open to challenges"
            description={<span className="mt-0.5 block text-[13px] text-text-muted">Other clans can invite you to co-hosted events.</span>}
          />
        </div>
      </Group>

      <Group title="To join" lede="Optional — what a recruit needs. Left blank, nothing shows.">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[13px] font-medium text-text-muted">Min total level</label>
            <Input value={form.requirements.minTotal?.toString() ?? ''} onChange={(e) => setReq('minTotal', numOrUndef(e.target.value))} inputMode="numeric" placeholder="any" className="mt-1" />
          </div>
          <div>
            <label className="text-[13px] font-medium text-text-muted">Min EHP</label>
            <Input value={form.requirements.minEhp?.toString() ?? ''} onChange={(e) => setReq('minEhp', numOrUndef(e.target.value))} inputMode="numeric" placeholder="any" className="mt-1" />
          </div>
          <div>
            <label className="text-[13px] font-medium text-text-muted">Region</label>
            <Input value={form.requirements.region ?? ''} onChange={(e) => setReq('region', e.target.value.slice(0, 40) || undefined)} placeholder="EU / NA…" className="mt-1" />
          </div>
          <div>
            <label className="text-[13px] font-medium text-text-muted">Timezone</label>
            <Input value={form.requirements.timezone ?? ''} onChange={(e) => setReq('timezone', e.target.value.slice(0, 40) || undefined)} placeholder="GMT±0…" className="mt-1" />
          </div>
        </div>
      </Group>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-gold px-4 py-2 text-[13.5px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>
        {!saving && saved && <span className="text-[13px] text-accent-green-light">Saved</span>}
        {error && <span className="text-[13px] text-accent-red">{error}</span>}
      </div>
    </div>
  );
}

function Group({ title, lede, children }: { title: string; lede: string; children: React.ReactNode }) {
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
