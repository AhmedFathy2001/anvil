'use client';

import { useEffect, useMemo, useState } from 'react';

import ClanCrest from '@/components/ClanCrest';
import ClanLink, { useClanPrefixValue } from '@/components/ClanLink';
import Input from '@/components/Input';
import Radio from '@/components/Radio';
import Select from '@/components/Select';
import TimeSelect from '@/components/TimeSelect';
import { clanFetch } from '@/lib/clanFetch';
import {
  BIO_MAX,
  minuteToHhMm,
  PANEL_BODY_MAX,
  PANEL_TITLE_MAX,
  PANELS_MAX,
  POLICY_NOTE,
  SLOT_LABEL_MAX,
  SLOTS_MAX,
  WEEKDAYS,
} from '@/lib/spacePage/rules';
import Slider from '@/components/Slider';

interface Panel {
  id: number;
  title: string;
  body: string;
  imageUrl: string | null;
  linkUrl: string | null;
  hidden: boolean;
  hiddenByStaff: boolean;
}

interface Slot {
  weekday: number;
  minuteOfDay: number;
  label: string | null;
}

interface PageData {
  name: string;
  bio: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  bannerPosition: number | null;
  pageHiddenByStaff: boolean;
  scheduleTz: string | null;
  slots: Slot[];
  panels: Panel[];
  featured: { highlightId: number } | { clipUrl: string; title: string } | null;
  highlights: { id: number; title: string; eventName: string; occurredAt: string }[];
}

type Msg = { type: 'ok' | 'err'; text: string } | null;

const API = '/api/admin/creator/page';

async function send(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await clanFetch(url, {
    method,
    headers: body instanceof FormData || body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data };
}

function errText(d: Record<string, unknown>): string {
  return typeof d.error === 'string' ? d.error : 'That did not save.';
}

const sectionCls = 'rounded-xl border border-card-border bg-card-bg p-5';
const btnGold = 'rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50';
const btnPlain = 'rounded-lg border border-card-border px-3 py-1.5 text-sm transition-colors hover:border-gold/45 disabled:opacity-50';
const textareaCls =
  'w-full rounded-lg border border-card-border bg-card-bg px-3 py-2 text-sm text-foreground placeholder:text-text-muted/60 focus:border-gold/50 focus:outline-none';

function Heading({ children, lede }: { children: React.ReactNode; lede?: React.ReactNode }) {
  return (
    <>
      <h3 className="mb-1 flex items-center gap-2 text-[15.5px] font-semibold">
        <span className="h-4 w-1 rounded-full bg-gold" aria-hidden />
        {children}
      </h3>
      {lede && <p className="mb-3 text-[13px] text-text-muted">{lede}</p>}
    </>
  );
}

function Status({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return <p className={`text-[13px] ${msg.type === 'ok' ? 'text-accent-green-light' : 'text-accent-red'}`}>{msg.text}</p>;
}

/** The hidden file input behind a button. Uploads on choose. */
function Picker({ label, busy, onFile }: { label: string; busy: boolean; onFile: (f: File) => void }) {
  return (
    <label className={`${btnPlain} inline-flex cursor-pointer items-center`}>
      <input
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
      {busy ? 'Uploading…' : label}
    </label>
  );
}

/**
 * "Your page" — what visitors see on a creator space beyond the events (lib/spacePage): a bio, the
 * logo and banner, up to eight "About" panels, a weekly schedule and one featured clip. Each part
 * saves on its own. Everything is checked on the server against Jagex's rules (wording and links).
 */
export default function CreatorPageEditor() {
  // The space's own page: '/c/<slug>' on the shared host, '/' on its own subdomain. A ClanLink to '/'
  // would leave the path alone (the apex home is not clan-scoped) and open the Anvil home instead.
  const prefix = useClanPrefixValue();
  const [data, setData] = useState<PageData | null>(null);
  const [loadError, setLoadError] = useState(false);

  async function reload() {
    const r = await clanFetch(API);
    if (!r.ok) {
      setLoadError(true);
      return;
    }
    setData((await r.json()) as PageData);
  }

  useEffect(() => {
    let alive = true;
    clanFetch(API)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load'))))
      .then((d) => alive && setData(d as PageData))
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
    };
  }, []);

  if (loadError) return null;
  if (!data) return null;

  return (
    <section id="your-page" className={`${sectionCls} scroll-mt-24`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
            <span className="h-5 w-1 rounded-full bg-gold" />
            Your page
          </h2>
          <p className="max-w-[60ch] text-sm text-text-muted">
            What visitors see on your space: who you are, when you stream, and a few panels like the ones under a Twitch
            channel.
          </p>
        </div>
        <a href={prefix || '/'} target="_blank" rel="noopener" className={btnPlain}>
          Preview your page ↗
        </a>
      </div>

      <p className="mb-5 rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-[13px] text-foreground/90">{POLICY_NOTE}</p>

      {data.pageHiddenByStaff && (
        <p className="mb-5 rounded-lg border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-[13px]">
          Anvil staff have hidden this page&rsquo;s promotions after a report, so visitors don&rsquo;t see your bio, panels,
          schedule or featured clip. Reach out on the Anvil Discord if you think that&rsquo;s a mistake.
        </p>
      )}

      <div className="space-y-8">
        <BioEditor initial={data.bio} />
        <PicturesEditor data={data} onChange={reload} />
        <PanelsEditor panels={data.panels} onChange={reload} />
        <ScheduleEditor tz={data.scheduleTz} slots={data.slots} />
        <FeaturedEditor featured={data.featured} highlights={data.highlights} />
      </div>
    </section>
  );
}

function BioEditor({ initial }: { initial: string }) {
  const [bio, setBio] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  return (
    <div id="page-bio" className="scroll-mt-24">
      <Heading lede="A few lines about you. Plain text; https links become clickable.">Bio</Heading>
      <textarea value={bio} maxLength={BIO_MAX} rows={4} onChange={(e) => setBio(e.target.value)} className={textareaCls} placeholder="Who you are and what your streams are like…" />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          disabled={busy}
          className={btnGold}
          onClick={async () => {
            setBusy(true);
            const r = await send(API, 'PATCH', { bio });
            setMsg(r.ok ? { type: 'ok', text: 'Saved.' } : { type: 'err', text: errText(r.data) });
            setBusy(false);
          }}
        >
          {busy ? 'Saving…' : 'Save bio'}
        </button>
        <span className="text-[12px] text-text-dim">
          {bio.length}/{BIO_MAX}
        </span>
        <Status msg={msg} />
      </div>
    </div>
  );
}

function PicturesEditor({ data, onChange }: { data: PageData; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState<'logo' | 'banner' | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [pos, setPos] = useState(data.bannerPosition ?? 50);

  async function upload(kind: 'logo' | 'banner', file: File) {
    setBusy(kind);
    setMsg(null);
    const fd = new FormData();
    fd.append('kind', kind);
    fd.append('file', file);
    const r = await send(`${API}/media`, 'POST', fd);
    setMsg(r.ok ? { type: 'ok', text: 'Saved.' } : { type: 'err', text: errText(r.data) });
    if (r.ok && kind === 'banner') setPos(50);
    await onChange();
    setBusy(null);
  }
  async function remove(kind: 'logo' | 'banner') {
    setBusy(kind);
    await send(`${API}/media?kind=${kind}`, 'DELETE');
    await onChange();
    setBusy(null);
  }

  return (
    <div id="page-logo" className="scroll-mt-24">
      <Heading lede="Your logo shows wherever your space does; the banner goes across the top of your page (3:1, e.g. 1500×500). PNG, JPEG, GIF or WebP — both may be animated.">
        Logo and banner
      </Heading>
      <div className="flex flex-wrap items-center gap-4">
        <ClanCrest name={data.name} logoUrl={data.logoUrl} size={64} rounded="rounded-2xl" className="text-xl" />
        <Picker label={data.logoUrl ? 'Replace logo' : 'Upload a logo'} busy={busy === 'logo'} onFile={(f) => upload('logo', f)} />
        {data.logoUrl && (
          <button type="button" className="text-[13px] text-text-dim hover:text-gold" onClick={() => remove('logo')}>
            Remove
          </button>
        )}
      </div>
      <div className="mt-4">
        <div className="aspect-[3/1] w-full overflow-hidden rounded-lg border border-card-border bg-gradient-to-r from-gold/15 via-card-bg to-gold/10">
          {data.bannerUrl && (
            // Our own upload (lib/spacePage).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.bannerUrl} alt="" className="h-full w-full object-cover" style={{ objectPosition: `50% ${pos}%` }} />
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Picker label={data.bannerUrl ? 'Replace banner' : 'Upload a banner'} busy={busy === 'banner'} onFile={(f) => upload('banner', f)} />
          {data.bannerUrl && (
            <>
              <label className="flex items-center gap-2 text-[12.5px] text-text-muted">
                Show more of the
                <Slider
                  min={0}
                  max={100}
                  value={pos}
                  onChange={setPos}
                  onPointerUp={() => void send(API, 'PATCH', { bannerPosition: pos === 50 ? null : pos })}
                  onKeyUp={() => void send(API, 'PATCH', { bannerPosition: pos === 50 ? null : pos })}
                  ariaLabel="Which part of the banner shows"
                  className="w-32"
                />
                top / bottom
              </label>
              <button type="button" className="text-[13px] text-text-dim hover:text-gold" onClick={() => remove('banner')}>
                Remove
              </button>
            </>
          )}
        </div>
      </div>
      <div className="mt-2">
        <Status msg={msg} />
      </div>
    </div>
  );
}

function PanelsEditor({ panels, onChange }: { panels: Panel[]; onChange: () => Promise<void> }) {
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  async function move(index: number, dir: -1 | 1) {
    const ids = panels.map((p) => p.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    setBusy(true);
    const r = await send(`${API}/panels`, 'PUT', { ids });
    if (!r.ok) setMsg({ type: 'err', text: errText(r.data) });
    await onChange();
    setBusy(false);
  }

  return (
    <div id="page-panels" className="scroll-mt-24">
      <Heading lede={`Up to ${PANELS_MAX} cards under your events: a title, some text, an optional picture and link. Use the arrows to reorder.`}>
        Panels
      </Heading>
      <ul className="space-y-2">
        {panels.map((p, i) =>
          editing === p.id ? (
            <li key={p.id}>
              <PanelForm
                panel={p}
                onDone={async (saved) => {
                  setEditing(null);
                  if (saved) setMsg({ type: 'ok', text: 'Saved.' });
                  await onChange();
                }}
              />
            </li>
          ) : (
            <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-card-border px-3 py-2">
              <span className="flex flex-col">
                <button type="button" aria-label="Move up" disabled={busy || i === 0} onClick={() => move(i, -1)} className="text-[11px] leading-none text-text-muted hover:text-gold disabled:opacity-30">
                  ▲
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={busy || i === panels.length - 1}
                  onClick={() => move(i, 1)}
                  className="text-[11px] leading-none text-text-muted hover:text-gold disabled:opacity-30"
                >
                  ▼
                </button>
              </span>
              <span className={`min-w-0 flex-1 truncate text-sm ${p.hidden || p.hiddenByStaff ? 'text-text-dim line-through' : ''}`}>{p.title}</span>
              {p.hiddenByStaff && <span className="text-[11.5px] text-accent-red">Hidden by Anvil staff</span>}
              {p.hidden && !p.hiddenByStaff && <span className="text-[11.5px] text-text-dim">Hidden</span>}
              <button type="button" className="text-[13px] text-text-muted hover:text-gold" onClick={() => setEditing(p.id)}>
                Edit
              </button>
              <button
                type="button"
                className="text-[13px] text-text-muted hover:text-gold"
                onClick={async () => {
                  await send(`${API}/panels`, 'PATCH', { id: p.id, hidden: !p.hidden });
                  await onChange();
                }}
              >
                {p.hidden ? 'Show' : 'Hide'}
              </button>
              <button
                type="button"
                className="text-[13px] text-text-muted hover:text-accent-red"
                onClick={async () => {
                  if (!window.confirm(`Delete the panel “${p.title}”?`)) return;
                  await send(`${API}/panels?id=${p.id}`, 'DELETE');
                  await onChange();
                }}
              >
                Delete
              </button>
            </li>
          ),
        )}
      </ul>
      {editing === 'new' ? (
        <div className="mt-2">
          <PanelForm
            panel={null}
            onDone={async (saved) => {
              setEditing(null);
              if (saved) setMsg({ type: 'ok', text: 'Panel added.' });
              await onChange();
            }}
          />
        </div>
      ) : (
        <button type="button" className={`${btnPlain} mt-3`} disabled={panels.length >= PANELS_MAX} onClick={() => setEditing('new')}>
          {panels.length >= PANELS_MAX ? `${PANELS_MAX} panels — that's the most` : '+ Add a panel'}
        </button>
      )}
      <div className="mt-2">
        <Status msg={msg} />
      </div>
    </div>
  );
}

function PanelForm({ panel, onDone }: { panel: Panel | null; onDone: (saved: boolean) => Promise<void> }) {
  const [title, setTitle] = useState(panel?.title ?? '');
  const [body, setBody] = useState(panel?.body ?? '');
  const [linkUrl, setLinkUrl] = useState(panel?.linkUrl ?? '');
  const [imageUrl, setImageUrl] = useState<string | null>(panel?.imageUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append('kind', 'panel');
    fd.append('file', file);
    const r = await send(`${API}/media`, 'POST', fd);
    if (r.ok && typeof r.data.url === 'string') setImageUrl(r.data.url);
    else setError(errText(r.data));
    setUploading(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const payload = { title, body, linkUrl: linkUrl.trim() || null, imageUrl };
    const r = panel ? await send(`${API}/panels`, 'PATCH', { id: panel.id, ...payload }) : await send(`${API}/panels`, 'POST', payload);
    setBusy(false);
    if (!r.ok) {
      setError(errText(r.data));
      return;
    }
    await onDone(true);
  }

  return (
    <div className="space-y-3 rounded-lg border border-gold/30 bg-brown-dark/30 p-4">
      <div>
        <label className="mb-1 block text-[13px] text-text-muted">Title</label>
        <Input value={title} maxLength={PANEL_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="Schedule, Rules, My setup…" />
      </div>
      <div>
        <label className="mb-1 block text-[13px] text-text-muted">
          Text <span className="text-text-dim">({body.length}/{PANEL_BODY_MAX})</span>
        </label>
        <textarea value={body} maxLength={PANEL_BODY_MAX} rows={4} onChange={(e) => setBody(e.target.value)} className={textareaCls} />
      </div>
      <div>
        <label className="mb-1 block text-[13px] text-text-muted">Link (optional, https://)</label>
        <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://discord.gg/…" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {imageUrl && (
          // Our own upload (lib/spacePage).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-14 w-auto rounded border border-card-border" />
        )}
        <Picker label={imageUrl ? 'Replace picture' : 'Add a picture'} busy={uploading} onFile={upload} />
        {imageUrl && (
          <button type="button" className="text-[13px] text-text-dim hover:text-gold" onClick={() => setImageUrl(null)}>
            Remove picture
          </button>
        )}
        <span className="text-[12px] text-text-dim">Still image, up to 3 MB.</span>
      </div>
      {error && <p className="text-[13px] text-accent-red">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="button" className={btnGold} disabled={busy || uploading || !title.trim()} onClick={save}>
          {busy ? 'Saving…' : panel ? 'Save panel' : 'Add panel'}
        </button>
        <button type="button" className="text-sm text-text-muted hover:text-foreground" onClick={() => void onDone(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function browserTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function ScheduleEditor({ tz: initialTz, slots: initialSlots }: { tz: string | null; slots: Slot[] }) {
  const [tz, setTz] = useState(initialTz ?? browserTz());
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const zones = useMemo(() => {
    try {
      const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
      return list.includes(tz) ? list : [tz, ...list];
    } catch {
      return [tz];
    }
  }, [tz]);

  const set = (i: number, patch: Partial<Slot>) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div id="page-schedule" className="scroll-mt-24">
      <Heading lede="When you usually go live, in your own time zone. Visitors see each time on their own clock.">Schedule</Heading>
      <label className="mb-3 flex flex-wrap items-center gap-2 text-[13px] text-text-muted">
        Your time zone
        <Select value={tz} onChange={setTz} options={zones.map((z) => ({ value: z, label: z }))} ariaLabel="Your time zone" className="w-64 max-w-full" />
      </label>
      <ul className="space-y-2">
        {slots.map((s, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <Select
              value={String(s.weekday)}
              onChange={(v) => set(i, { weekday: Number(v) })}
              options={WEEKDAYS.map((d, n) => ({ value: String(n), label: d }))}
              ariaLabel="Day"
              className="w-36"
            />
            <TimeSelect
              value={minuteToHhMm(s.minuteOfDay)}
              ariaLabel="Time"
              onChange={(v) => {
                const [h, m] = v.split(':').map(Number);
                if (Number.isFinite(h) && Number.isFinite(m)) set(i, { minuteOfDay: h * 60 + m });
              }}
            />
            <Input
              value={s.label ?? ''}
              maxLength={SLOT_LABEL_MAX}
              placeholder="Label (optional), e.g. Bingo night"
              onChange={(e) => set(i, { label: e.target.value })}
              className="min-w-[12rem] flex-1"
            />
            <button type="button" className="text-[13px] text-text-dim hover:text-accent-red" onClick={() => setSlots((x) => x.filter((_, j) => j !== i))}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={btnPlain}
          disabled={slots.length >= SLOTS_MAX}
          onClick={() => setSlots((x) => [...x, { weekday: x.length ? x[x.length - 1].weekday : 5, minuteOfDay: 19 * 60, label: null }])}
        >
          + Add a time
        </button>
        <button
          type="button"
          className={btnGold}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await send(API, 'PATCH', { schedule: { tz, slots: slots.map((s) => ({ ...s, label: s.label?.trim() || null })) } });
            setMsg(r.ok ? { type: 'ok', text: 'Saved.' } : { type: 'err', text: errText(r.data) });
            setBusy(false);
          }}
        >
          {busy ? 'Saving…' : 'Save schedule'}
        </button>
        <Status msg={msg} />
      </div>
    </div>
  );
}

function FeaturedEditor({ featured, highlights }: { featured: PageData['featured']; highlights: PageData['highlights'] }) {
  const initialMode = !featured ? 'none' : 'highlightId' in featured ? 'highlight' : 'clip';
  const [mode, setMode] = useState<'none' | 'highlight' | 'clip'>(initialMode);
  const [highlightId, setHighlightId] = useState<number | null>(featured && 'highlightId' in featured ? featured.highlightId : (highlights[0]?.id ?? null));
  const [clipUrl, setClipUrl] = useState(featured && 'clipUrl' in featured ? featured.clipUrl : '');
  const [title, setTitle] = useState(featured && 'clipUrl' in featured ? featured.title : '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const radio = (value: typeof mode, label: string, disabled = false) => (
    <label className={`flex items-center gap-2 text-sm ${disabled ? 'opacity-50' : ''}`}>
      <Radio name="featured-mode" checked={mode === value} disabled={disabled} onChange={() => setMode(value)} />
      {label}
    </label>
  );

  return (
    <div id="page-featured" className="scroll-mt-24">
      <Heading lede="One clip pinned to the top of your page.">Featured</Heading>
      <div className="mb-3 flex flex-wrap gap-4">
        {radio('none', 'Nothing')}
        {radio('highlight', highlights.length ? 'One of your stream highlights' : 'One of your stream highlights (none yet)', highlights.length === 0)}
        {radio('clip', 'A clip link')}
      </div>
      {mode === 'highlight' && (
        <Select
          value={highlightId == null ? '' : String(highlightId)}
          onChange={(v) => setHighlightId(Number(v))}
          options={highlights.map((h) => ({ value: String(h.id), label: `${h.title} — ${h.eventName}` }))}
          ariaLabel="Highlight"
          className="mb-3 w-full max-w-lg"
        />
      )}
      {mode === 'clip' && (
        <div className="mb-3 grid max-w-lg gap-2">
          <Input value={clipUrl} onChange={(e) => setClipUrl(e.target.value)} placeholder="https://clips.twitch.tv/… (Twitch, YouTube, Kick or Medal)" />
          <Input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" />
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={btnGold}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const featuredBody = mode === 'highlight' ? { highlightId } : mode === 'clip' ? { clipUrl, title } : null;
            const r = await send(API, 'PATCH', { featured: featuredBody });
            setMsg(r.ok ? { type: 'ok', text: 'Saved.' } : { type: 'err', text: errText(r.data) });
            setBusy(false);
          }}
        >
          {busy ? 'Saving…' : 'Save featured'}
        </button>
        <Status msg={msg} />
      </div>
    </div>
  );
}
