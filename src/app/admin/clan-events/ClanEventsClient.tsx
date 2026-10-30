'use client';

import { useCallback, useEffect, useState } from 'react';

import ClanLink, { useClanUrl } from '@/components/ClanLink';
import DateTimePicker from '@/components/DateTimePicker';
import Input from '@/components/Input';
import Select, { type SelectOption } from '@/components/Select';
import { BOSSES, SKILLS, SKILL_LABELS } from '@/lib/constants';
import { CHANNEL_SLOTS, CHANNEL_SLOT_LABELS, type ChannelSlot, type ClanEventChannels } from '@/lib/clanEventChannels';
import { clanFetch } from '@/lib/clanFetch';
import { SIGNUP_TEMPLATES, surveyTemplateById } from '@/lib/surveyTemplates';

interface Ev {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  world: number | null;
  icon: string | null;
  imageUrl: string | null;
  channels: ClanEventChannels | null;
  host: string | null;
  repeat: 'none' | 'weekly';
  durationMin: number;
  startsAt: string;
  repeatUntil: string | null;
  ping: boolean;
  occurrence: { start: string; end: string };
  phase: 'upcoming' | 'soon' | 'live' | 'ended';
  going: number;
  signup: { cap: number | null } | null;
  modules: { fee: { on: boolean }; payouts: { on: boolean }; survey: { on: boolean } };
}

interface Form {
  title: string;
  description: string;
  location: string;
  world: string;
  icon: string;
  imageUrl: string;
  channels: ClanEventChannels;
  host: string;
  start: string; // ISO instant
  durationMin: string;
  repeat: 'none' | 'weekly';
  until: string; // YYYY-MM-DD, this browser's zone
  ping: boolean;
  // New events only — an existing one's sign-ups and fee live on its own page (ClanEventManageClient).
  /** Information only, the plain "I'm going" button, or sign-ups. */
  attend: 'info' | 'going' | 'signups';
  /** With sign-ups: no form, a starter template's id, or 'own' (built on its page next). */
  questions: string;
  cap: string;
  approval: boolean;
  fee: boolean;
  feeAmount: string;
}

const BLANK: Form = {
  title: '', description: '', location: '', world: '', icon: '', imageUrl: '', channels: {}, host: '', start: '', durationMin: '60', repeat: 'none', until: '', ping: true,
  attend: 'going', questions: 'none', cap: '', approval: false, fee: false, feeAmount: '',
};

const ATTEND: { value: Form['attend']; title: string; hint: string }[] = [
  { value: 'info', title: 'Just information', hint: 'No button, no count' },
  { value: 'going', title: '“I’m going”', hint: 'One tap, shows a count' },
  { value: 'signups', title: 'Sign-ups', hint: 'Spots, questions, a fee' },
];

const QUESTION_OPTIONS: SelectOption[] = [
  { value: 'none', label: 'No questions' },
  ...SIGNUP_TEMPLATES.map((t) => ({ value: t.id, label: `Template: ${t.name}` })),
  { value: 'own', label: 'Write my own' },
];

/** An ISO instant as a calendar date in this browser's zone. */
function localDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const REPEAT_OPTIONS: SelectOption[] = [
  { value: 'none', label: 'Just once' },
  { value: 'weekly', label: 'Every week' },
];

// The picture is a skill or boss key, as a weekly's metric is (clanEventThumbnail).
const ICON_OPTIONS: SelectOption[] = [
  { value: '', label: 'No picture' },
  ...SKILLS.filter((k) => k !== 'overall').map((k) => ({ value: k, label: SKILL_LABELS[k] ?? k, keywords: ['skill'] })),
  ...BOSSES.map((b) => ({ value: b.key, label: b.label, keywords: b.aliases })),
];

interface LinkableChannel {
  id: string;
  name: string;
  parentName: string | null;
  kind: 'text' | 'voice' | 'forum';
}

// Which channels each slot offers: a guide can live in a forum, a voice slot only takes voice.
const SLOT_KINDS: Record<ChannelSlot, LinkableChannel['kind'][]> = { chat: ['text', 'forum'], guide: ['text', 'forum'], voice: ['voice'] };
const SLOT_HINTS: Record<ChannelSlot, string> = { chat: 'Where to talk about it', guide: 'Its guide or info', voice: 'Where to meet' };

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function ClanEventsClient() {
  const clanUrl = useClanUrl();
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  // The server's channels for the pickers; null while loading, and `enabled` false without a bot.
  const [discord, setDiscord] = useState<{ enabled: boolean; channels: LinkableChannel[] } | null>(null);

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
  useEffect(() => {
    clanFetch('/api/admin/clan-events/channels')
      .then((r) => (r.ok ? r.json() : { enabled: false, channels: [] }))
      .then((d: { enabled?: boolean; channels?: LinkableChannel[] }) => setDiscord({ enabled: !!d.enabled, channels: d.channels ?? [] }))
      .catch(() => setDiscord({ enabled: false, channels: [] }));
  }, []);

  function pickChannel(slot: ChannelSlot, id: string) {
    const picked = discord?.channels.find((c) => c.id === id);
    setForm((f) => {
      const channels = { ...f.channels };
      if (picked) channels[slot] = { id: picked.id, name: picked.name };
      else delete channels[slot];
      return { ...f, channels };
    });
  }

  function channelOptions(slot: ChannelSlot): SelectOption[] {
    const current = form.channels[slot];
    const listed = (discord?.channels ?? []).filter((c) => SLOT_KINDS[slot].includes(c.kind));
    return [
      { value: '', label: 'None' },
      // A channel picked before that the list no longer has (deleted, or Discord unreachable) still shows.
      ...(current && !listed.some((c) => c.id === current.id) ? [{ value: current.id, label: `#${current.name}` }] : []),
      ...listed.map((c) => ({ value: c.id, label: `${slot === 'voice' ? '🔊 ' : '#'}${c.name}${c.parentName ? ` · ${c.parentName}` : ''}`, keywords: c.parentName ? [c.parentName.toLowerCase()] : [] })),
    ];
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.start) return setError('Pick when it starts.');
    if (!editing && form.attend === 'signups' && form.fee && !(Number(form.feeAmount) > 0)) return setError('Set the entry fee in gp.');
    setBusy(true);
    const body = {
      title: form.title,
      description: form.description,
      location: form.location,
      world: form.world,
      icon: form.icon,
      imageUrl: form.imageUrl || null,
      channels: form.channels,
      host: form.host,
      startsAt: form.start,
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
    if (!r.ok) {
      setBusy(false);
      return setError(((await r.json().catch(() => ({}))) as { error?: string }).error ?? 'Couldn’t save it.');
    }
    if (!editing && form.attend !== 'going') {
      // Sign-ups, the fee and the "I'm going" switch are the event's modules; payouts and the survey
      // stay on its own page, where this hands over.
      const { id } = (await r.json()) as { id: number };
      const signups = form.attend === 'signups';
      const m = await clanFetch(`/api/admin/clan-events/${id}/modules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'occurrence',
          rsvp: form.attend !== 'info',
          signups: { on: signups, cap: form.cap ? Number(form.cap) : null, approval: form.approval, closes: 'start' },
          fee: { on: signups && form.fee, amount: Number(form.feeAmount) || 0 },
          payouts: { on: false, addedGp: 0 },
          survey: { on: false },
        }),
      });
      if (!m.ok) {
        setError('Scheduled, but sign-ups didn’t save — set them from “Sign-ups & more”.');
      } else if (signups && form.questions === 'own') {
        // Their own questions are built where the rest of the form lives.
        window.location.assign(clanUrl(`/admin/clan-events/${id}`));
        return;
      } else if (signups && form.questions !== 'none') {
        const template = surveyTemplateById(form.questions);
        const q = template
          ? await clanFetch(`/api/admin/clan-events/${id}/survey/questions`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stage: 'signup', questions: template.questions }),
            })
          : null;
        if (q && !q.ok) setError('Scheduled, but the questions didn’t save — add them from “Sign-ups & more”.');
      }
    }
    setBusy(false);
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
      imageUrl: ev.imageUrl ?? '',
      channels: ev.channels ?? {},
      host: ev.host ?? '',
      start: ev.startsAt,
      durationMin: String(ev.durationMin),
      repeat: ev.repeat,
      until: ev.repeatUntil ? localDate(ev.repeatUntil) : '',
      ping: ev.ping,
      attend: 'going',
      questions: 'none',
      cap: '',
      approval: false,
      fee: false,
      feeAmount: '',
    });
  }

  async function uploadPicture(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const r = await clanFetch('/api/upload', { method: 'POST', body });
      const data = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!r.ok || !data.url) throw new Error(data.error ?? 'That upload didn’t work.');
      set('imageUrl', data.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
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
                    {ev.phase === 'ended' && <span className="ml-2 rounded bg-text-muted/15 px-1.5 py-0.5 text-xs text-text-muted">Ended</span>}
                  </p>
                  <p className="text-xs text-text-muted">
                    {when(ev.occurrence.start)}
                    {ev.location ? ` · ${ev.location}` : ''}
                    {ev.world ? ` · W${ev.world}` : ''} · {ev.signup ? `${ev.going}${ev.signup.cap != null ? `/${ev.signup.cap}` : ''} signed up` : `${ev.going} going`}
                    {[ev.modules.fee.on && 'fee', ev.modules.payouts.on && 'payouts', ev.modules.survey.on && 'survey'].filter(Boolean).map((x) => ` · ${x}`).join('')}
                  </p>
                </div>
                <ClanLink href={`/admin/clan-events/${ev.id}`} className="text-sm text-gold hover:text-gold-light">
                  Sign-ups &amp; more
                </ClanLink>
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
            <DateTimePicker value={form.start} onChange={(iso) => set('start', iso)} ariaLabel="Starts" required />
          </div>
          <div>
            <label className={label}>Minutes</label>
            <Input type="number" min={5} max={1440} value={form.durationMin} onChange={(e) => set('durationMin', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>Repeats</label>
            <Select value={form.repeat} onChange={(v) => set('repeat', v as Form['repeat'])} options={REPEAT_OPTIONS} ariaLabel="Repeats" />
          </div>
          {form.repeat === 'weekly' && (
            <div>
              <label className={label}>Until (optional)</label>
              <DateTimePicker dateOnly value={form.until} onChange={(v) => set('until', v)} placeholder="No end" ariaLabel="Repeats until" />
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
        <div className={form.imageUrl ? '' : 'grid grid-cols-2 gap-2'}>
          <div>
            <label className={label}>Host</label>
            <Input value={form.host} onChange={(e) => set('host', e.target.value)} placeholder="Your RSN" maxLength={40} />
          </div>
          {/* Their own picture replaces the boss/skill one, so only one picker shows at a time. */}
          {!form.imageUrl && (
            <div>
              <label className={label}>Boss or skill (picture)</label>
              <Select value={form.icon} onChange={(v) => set('icon', v)} options={ICON_OPTIONS} placeholder="No picture" ariaLabel="Picture" searchable />
            </div>
          )}
        </div>
        <div>
          <label className={label}>{form.imageUrl ? 'Your picture' : 'Or your own picture'}</label>
          <div className="flex items-center gap-2">
            {form.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.imageUrl} alt="" className="h-10 w-10 rounded border border-card-border object-cover" />
            )}
            <label className="inline-flex cursor-pointer items-center rounded border border-card-border px-3 py-1.5 text-xs text-text-muted hover:border-gold/45 hover:text-foreground">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void uploadPicture(f);
                }}
              />
              {uploading ? 'Uploading…' : form.imageUrl ? 'Replace' : 'Upload'}
            </label>
            {form.imageUrl && (
              <button type="button" onClick={() => set('imageUrl', '')} className="text-xs text-text-muted hover:text-red-400">
                Remove
              </button>
            )}
          </div>
          <p className="mt-1 text-[11px] text-text-muted">
            {form.imageUrl
              ? 'Shown on the site and in the Discord post. Remove it to pick a boss or skill instead.'
              : 'Shown on the site and in the Discord post. The plugin shows the boss or skill above, since it can’t load pictures.'}
          </p>
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
        {editing ? (
          <p className="text-xs text-text-muted">
            Sign-ups, entry fee, payouts and the survey are on{' '}
            <ClanLink href={`/admin/clan-events/${editing}`} className="text-gold hover:text-gold-light">
              its own page
            </ClanLink>
            .
          </p>
        ) : (
          <div className="space-y-2 rounded border border-card-border/70 p-3">
            <span className={label}>Who&rsquo;s coming</span>
            <div role="radiogroup" aria-label="Who's coming" className="grid gap-1.5 sm:grid-cols-3">
              {ATTEND.map((o) => (
                <label
                  key={o.value}
                  className={`cursor-pointer rounded border px-2.5 py-2 text-sm transition-colors ${
                    form.attend === o.value ? 'border-gold/60 bg-gold/5 text-foreground' : 'border-card-border text-text-muted hover:border-gold/30'
                  }`}
                >
                  <input type="radio" name="attend" value={o.value} checked={form.attend === o.value} onChange={() => set('attend', o.value)} className="sr-only" />
                  <span className="block font-medium text-foreground">{o.title}</span>
                  <span className="block text-[11px]">{o.hint}</span>
                </label>
              ))}
            </div>
            {form.attend === 'signups' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={label}>Spots (optional)</label>
                    <Input type="number" min={1} value={form.cap} onChange={(e) => set('cap', e.target.value)} placeholder="No limit" />
                  </div>
                  <label className="mt-5 flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={form.approval} onChange={(e) => set('approval', e.target.checked)} />
                    Approve each one
                  </label>
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={form.fee} onChange={(e) => set('fee', e.target.checked)} />
                  Entry fee
                </label>
                {form.fee && (
                  <div>
                    <label className={label}>Fee (gp)</label>
                    <Input type="number" min={1} value={form.feeAmount} onChange={(e) => set('feeAmount', e.target.value)} placeholder="1000000" />
                  </div>
                )}
                <div>
                  <label className={label}>Questions</label>
                  <Select value={form.questions} onChange={(v) => set('questions', v)} options={QUESTION_OPTIONS} ariaLabel="Sign-up questions" />
                  <p className="mt-1 text-[11px] text-text-muted">
                    {form.questions === 'own'
                      ? 'You’ll land on its page to write them once it’s scheduled.'
                      : form.questions === 'none'
                        ? 'Signing up is one tap — in the plugin too.'
                        : `${SIGNUP_TEMPLATES.find((t) => t.id === form.questions)?.description ?? ''} Editable on its page afterwards.`}
                  </p>
                </div>
                <p className="text-[11px] text-text-muted">Payouts and a survey can be added from the event&rsquo;s page once it&rsquo;s scheduled.</p>
              </>
            )}
          </div>
        )}
        <div>
          <label className={label}>Discord channels (optional)</label>
          {discord && !discord.enabled ? (
            <p className="text-[11px] text-text-muted">
              Connect the clan&rsquo;s Discord bot in{' '}
              <ClanLink href="/admin/integrations" className="text-gold hover:text-gold-light">
                Discord settings
              </ClanLink>{' '}
              to point this event at a chat, guide or voice channel.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              {CHANNEL_SLOTS.map((slot) => (
                <div key={slot}>
                  <Select
                    value={form.channels[slot]?.id ?? ''}
                    onChange={(v) => pickChannel(slot, v)}
                    options={channelOptions(slot)}
                    placeholder={discord ? CHANNEL_SLOT_LABELS[slot] : 'Loading…'}
                    ariaLabel={`${CHANNEL_SLOT_LABELS[slot]} channel`}
                    disabled={!discord}
                    searchable
                  />
                  <span className="mt-0.5 block text-[11px] text-text-muted">
                    {CHANNEL_SLOT_LABELS[slot]} · {SLOT_HINTS[slot]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={form.ping} onChange={(e) => set('ping', e.target.checked)} />
          Ping the member role on the announcement, the reminder and the start
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
