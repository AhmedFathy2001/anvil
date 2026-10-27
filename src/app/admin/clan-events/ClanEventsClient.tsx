'use client';

import { useCallback, useEffect, useState } from 'react';

import Input from '@/components/Input';
import { clanFetch } from '@/lib/clanFetch';

interface Ev {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  world: number | null;
  icon: string | null;
  host: string | null;
  repeat: 'none' | 'weekly';
  durationMin: number;
  startsAt: string;
  repeatUntil: string | null;
  ping: boolean;
  occurrence: { start: string; end: string };
  phase: 'upcoming' | 'soon' | 'live';
  going: number;
}

interface Form {
  title: string;
  description: string;
  location: string;
  world: string;
  icon: string;
  host: string;
  start: string; // datetime-local, in this browser's zone
  durationMin: string;
  repeat: 'none' | 'weekly';
  until: string; // date, this browser's zone
  ping: boolean;
}

const BLANK: Form = { title: '', description: '', location: '', world: '', icon: '', host: '', start: '', durationMin: '60', repeat: 'none', until: '', ping: true };

/** An ISO instant as a datetime-local value in this browser's zone. */
function localInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function ClanEventsClient() {
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      clanFetch('/api/admin/clan-events')
        .then((r) => (r.ok ? r.json() : { events: [] }))
        .then((data: { events?: Ev[] }) => setEvents(data.events ?? [])),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.start) return setError('Pick when it starts.');
    setBusy(true);
    const body = {
      title: form.title,
      description: form.description,
      location: form.location,
      world: form.world,
      icon: form.icon.trim().toLowerCase().replace(/\s+/g, '_'),
      host: form.host,
      startsAt: new Date(form.start).toISOString(),
      durationMin: Number(form.durationMin),
      repeat: form.repeat,
      repeatUntil: form.repeat === 'weekly' && form.until ? new Date(`${form.until}T23:59`).toISOString() : null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ping: form.ping,
    };
    const r = await clanFetch(editing ? `/api/admin/clan-events/${editing}` : '/api/admin/clan-events', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!r.ok) return setError(((await r.json().catch(() => ({}))) as { error?: string }).error ?? 'Couldn’t save it.');
    setForm(BLANK);
    setEditing(null);
    void load();
  }

  function edit(ev: Ev) {
    setEditing(ev.id);
    setError(null);
    setForm({
      title: ev.title,
      description: ev.description ?? '',
      location: ev.location ?? '',
      world: ev.world ? String(ev.world) : '',
      icon: ev.icon ?? '',
      host: ev.host ?? '',
      start: localInput(ev.startsAt),
      durationMin: String(ev.durationMin),
      repeat: ev.repeat,
      until: ev.repeatUntil ? localInput(ev.repeatUntil).slice(0, 10) : '',
      ping: ev.ping,
    });
  }

  async function cancel(ev: Ev) {
    if (!window.confirm(`Call off “${ev.title}”${ev.repeat === 'weekly' ? ' (every week)' : ''}? Its Discord post will say it’s cancelled.`)) return;
    await clanFetch(`/api/admin/clan-events/${ev.id}`, { method: 'DELETE' });
    if (editing === ev.id) {
      setEditing(null);
      setForm(BLANK);
    }
    void load();
  }

  const label = 'mb-1 block text-xs font-medium text-text-muted';
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="rounded-xl border border-card-border bg-card-bg p-5">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
          <span className="h-5 w-1 bg-gold" /> Coming up
        </h2>
        {events == null ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-text-muted">Nothing scheduled. Add one with the form.</p>
        ) : (
          <ul className="divide-y divide-card-border">
            {events.map((ev) => (
              <li key={ev.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">
                    {ev.title}
                    {ev.phase === 'live' && <span className="ml-2 rounded bg-accent-green/15 px-1.5 py-0.5 text-xs text-accent-green">Live now</span>}
                    {ev.repeat === 'weekly' && <span className="ml-2 rounded bg-gold/15 px-1.5 py-0.5 text-xs text-gold-light">Weekly</span>}
                  </p>
                  <p className="text-xs text-text-muted">
                    {when(ev.occurrence.start)}
                    {ev.location ? ` · ${ev.location}` : ''}
                    {ev.world ? ` · W${ev.world}` : ''} · {ev.going} going
                  </p>
                </div>
                <button type="button" onClick={() => edit(ev)} className="text-sm text-gold hover:text-gold-light">
                  Edit
                </button>
                <button type="button" onClick={() => void cancel(ev)} className="text-sm text-text-muted hover:text-red-400">
                  Call off
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={save} className="space-y-3 rounded-xl border border-card-border bg-card-bg p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gold">
          <span className="h-5 w-1 bg-gold" /> {editing ? 'Edit clan event' : 'New clan event'}
        </h2>
        <div>
          <label className={label}>Name</label>
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Sunday Nex mass" maxLength={80} required />
        </div>
        <div className="grid grid-cols-[1fr_96px] gap-2">
          <div>
            <label className={label}>Starts (your time)</label>
            <Input type="datetime-local" value={form.start} onChange={(e) => set('start', e.target.value)} required />
          </div>
          <div>
            <label className={label}>Minutes</label>
            <Input type="number" min={5} max={1440} value={form.durationMin} onChange={(e) => set('durationMin', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>Repeats</label>
            <select
              value={form.repeat}
              onChange={(e) => set('repeat', e.target.value as Form['repeat'])}
              className="w-full rounded border border-card-border bg-brown-dark px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
            >
              <option value="none">Just once</option>
              <option value="weekly">Every week</option>
            </select>
          </div>
          {form.repeat === 'weekly' && (
            <div>
              <label className={label}>Until (optional)</label>
              <Input type="date" value={form.until} onChange={(e) => set('until', e.target.value)} />
            </div>
          )}
        </div>
        <div className="grid grid-cols-[1fr_96px] gap-2">
          <div>
            <label className={label}>Where</label>
            <Input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Ancient Prison, GWD" maxLength={80} />
          </div>
          <div>
            <label className={label}>World</label>
            <Input type="number" min={300} max={700} value={form.world} onChange={(e) => set('world', e.target.value)} placeholder="330" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>Host</label>
            <Input value={form.host} onChange={(e) => set('host', e.target.value)} placeholder="Your RSN" maxLength={40} />
          </div>
          <div>
            <label className={label}>Boss or skill (picture)</label>
            <Input value={form.icon} onChange={(e) => set('icon', e.target.value)} placeholder="nex, slayer…" maxLength={40} />
          </div>
        </div>
        <div>
          <label className={label}>Details</label>
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Gear, requirements, what to bring…"
            className="w-full rounded border border-card-border bg-brown-dark px-3 py-2 text-sm text-foreground placeholder:text-text-muted/60 focus:border-gold focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={form.ping} onChange={(e) => set('ping', e.target.checked)} />
          Ping the member role on the reminder and the start
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="rounded bg-gold px-4 py-2 text-sm font-semibold text-brown-dark hover:bg-gold-light disabled:opacity-50">
            {editing ? 'Save changes' : 'Schedule it'}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(BLANK);
              }}
              className="rounded border border-card-border px-4 py-2 text-sm text-text-muted hover:text-foreground"
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
