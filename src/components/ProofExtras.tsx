'use client';

// Extra screenshots and links on one proof (lib/proofAttachments).
//
//   ProofExtrasEditor — in a submit form: more screenshots, links, each optionally "start"/"end".
//   StartShotDraft    — on a tile you're grinding: save your starting counter now; it rides on the
//                       proof you send at the end.
//   ProofExtrasList   — on a sent proof: the extras, and (for whoever may) a way to add the end shot
//                       or a link later, or remove one.

import { useEffect, useState } from 'react';

import ImageUpload from '@/components/ImageUpload';
import Input from '@/components/Input';
import LocalTime from '@/components/LocalTime';
import { clanFetch } from '@/lib/clanFetch';
import { isWebLink, linkHost, MAX_ATTACHMENTS, orderAttachments, type AttachmentLabel, type ProofAttachment, type ProofAttachmentInput } from '@/lib/proofAttachments';

const LABEL_TEXT: Record<AttachmentLabel, string> = { start: 'Start', end: 'End' };

function LabelChip({ label }: { label: AttachmentLabel | null }) {
  if (!label) return null;
  return (
    <span className="absolute top-0.5 left-0.5 px-1 rounded bg-black/70 text-[10px] font-semibold text-gold">{LABEL_TEXT[label]}</span>
  );
}

function LabelPicker({ value, onChange }: { value: AttachmentLabel | null; onChange: (l: AttachmentLabel | null) => void }) {
  return (
    <div className="flex gap-1 text-[10px]" role="group" aria-label="Label">
      {([null, 'start', 'end'] as const).map((l) => (
        <button
          key={l ?? 'none'}
          type="button"
          onClick={() => onChange(l)}
          aria-pressed={value === l}
          className={`px-1.5 py-0.5 rounded border ${value === l ? 'border-gold text-gold' : 'border-card-border text-text-muted hover:text-foreground'}`}
        >
          {l ? LABEL_TEXT[l] : '—'}
        </button>
      ))}
    </div>
  );
}

/** Add a link: an input and a button, refusing anything that isn't http(s). */
function LinkAdder({ onAdd, disabled }: { onAdd: (url: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const add = () => {
    const v = value.trim();
    if (!isWebLink(v)) {
      setError('Paste a full link starting with https://');
      return;
    }
    onAdd(v);
    setValue('');
    setError('');
  };
  return (
    <div>
      <div className="flex gap-2">
        <Input
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="https://… (a clip, an album)"
          className="flex-1 px-3 py-1.5 bg-brown-dark border border-card-border rounded text-sm text-foreground"
          disabled={disabled}
        />
        <button type="button" onClick={add} disabled={disabled || !value.trim()} className="px-3 py-1.5 rounded border border-card-border text-xs text-foreground hover:border-gold disabled:opacity-50">
          Add link
        </button>
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function Thumb({ item, onRemove, footer }: { item: { kind: string; url: string; label: AttachmentLabel | null }; onRemove?: () => void; footer?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="relative">
        {item.kind === 'image' ? (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt={item.label ? `${LABEL_TEXT[item.label]} screenshot` : 'Extra screenshot'} className="w-full aspect-square object-cover rounded border border-card-border" />
          </a>
        ) : (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            title={item.url}
            className="flex w-full aspect-square items-center justify-center rounded border border-card-border bg-brown-dark p-1 text-center text-[11px] text-gold break-all hover:border-gold"
          >
            🔗 {linkHost(item.url)}
          </a>
        )}
        <LabelChip label={item.label} />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-400"
            aria-label="Remove"
          >
            ×
          </button>
        )}
      </div>
      {footer}
    </div>
  );
}

/** In a submit form: extras that go with the proof being sent. Controlled. */
export function ProofExtrasEditor({ value, onChange }: { value: ProofAttachmentInput[]; onChange: (v: ProofAttachmentInput[]) => void }) {
  const [open, setOpen] = useState(value.length > 0);
  const room = MAX_ATTACHMENTS - value.length;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-gold hover:underline">
        + More screenshots or links (before/after, a clip)
      </button>
    );
  }
  const set = (i: number, patch: Partial<ProofAttachmentInput>) => onChange(value.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  return (
    <div className="space-y-2 rounded border border-card-border p-2">
      <p className="text-xs text-text-muted">
        More screenshots or links for the reviewer — mark your starting and ending counters so they read as a before and after.
      </p>
      {value.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {value.map((v, i) => (
            <Thumb
              key={`${v.url}-${i}`}
              item={{ ...v, label: v.label ?? null }}
              onRemove={() => onChange(value.filter((_, j) => j !== i))}
              footer={<LabelPicker value={v.label ?? null} onChange={(l) => set(i, { label: l })} />}
            />
          ))}
        </div>
      )}
      {room > 0 ? (
        <>
          <ImageUpload
            multiple
            onImageSelected={() => {}}
            onImagesSelected={(urls) => onChange([...value, ...urls.slice(0, room).map((url) => ({ kind: 'image' as const, url, label: null }))])}
          />
          <LinkAdder onAdd={(url) => onChange([...value, { kind: 'link', url, label: null }])} />
        </>
      ) : (
        <p className="text-xs text-text-muted">That&apos;s the most one proof holds ({MAX_ATTACHMENTS}).</p>
      )}
    </div>
  );
}

/**
 * Your saved starting screenshot on this tile. Upload it when you begin a long grind; the proof you
 * send at the end carries it automatically.
 */
export function StartShotDraft({ eventId, tileId, teamId, refreshKey = 0 }: { eventId: number; tileId: number; teamId: number; refreshKey?: number }) {
  const [drafts, setDrafts] = useState<ProofAttachment[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    clanFetch(`/api/events/${eventId}/proof-attachments?tileId=${tileId}&teamId=${teamId}`)
      .then((r) => (r.ok ? r.json() : { drafts: [] }))
      .then((d: { drafts?: ProofAttachment[] }) => live && setDrafts(d.drafts ?? []))
      .catch(() => live && setDrafts([]));
    return () => {
      live = false;
    };
  }, [eventId, tileId, teamId, refreshKey]);

  async function save(items: ProofAttachmentInput[]) {
    setError('');
    const res = await clanFetch(`/api/events/${eventId}/proof-attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tileId, teamId, items }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setError(d.error || 'Could not save that screenshot.');
    setDrafts((prev) => orderAttachments([...(prev ?? []), ...(d.added ?? [])]));
    setAdding(false);
  }

  async function remove(id: number) {
    const res = await clanFetch(`/api/events/${eventId}/proof-attachments?id=${id}`, { method: 'DELETE' });
    if (res.ok) setDrafts((prev) => (prev ?? []).filter((x) => x.id !== id));
  }

  if (drafts == null) return null;
  if (drafts.length === 0 && !adding) {
    return (
      <button type="button" onClick={() => setAdding(true)} className="text-xs text-gold hover:underline text-left">
        Starting a long grind? Save your starting counter now — it&apos;s attached when you submit.
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded border border-card-border p-2 bg-brown-dark/30">
      {drafts.length > 0 && (
        <>
          <p className="text-xs text-text-muted">
            Saved for this tile — sent with your next proof:
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {drafts.map((d) => (
              <Thumb key={d.id} item={d} onRemove={() => remove(d.id)} footer={<p className="text-[10px] text-text-muted"><LocalTime date={d.createdAt} /></p>} />
            ))}
          </div>
        </>
      )}
      {adding ? (
        <ImageUpload onImageSelected={(url) => save([{ kind: 'image', url, label: 'start' }])} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="text-xs text-gold hover:underline">
          + Another starting screenshot
        </button>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

/** A sent proof's extras, plus adding the end shot or a link later for whoever may. */
export function ProofExtrasList({
  eventId,
  submissionId,
  initial,
  canAdd,
  canRemove,
}: {
  eventId: number;
  submissionId: number;
  initial: ProofAttachment[];
  canAdd: boolean;
  canRemove: boolean;
}) {
  const [items, setItems] = useState<ProofAttachment[]>(initial);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState<AttachmentLabel | null>('end');
  const [error, setError] = useState('');
  // A refetch of the proof list hands in a fresh list: take it (React's adjust-state-on-prop pattern).
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setItems(initial);
  }

  async function add(extra: ProofAttachmentInput[]) {
    setError('');
    const res = await clanFetch(`/api/events/${eventId}/proof-attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId, items: extra }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setError(d.error || 'Could not add that.');
    setItems((prev) => orderAttachments([...prev, ...(d.added ?? [])]));
    setAdding(false);
  }

  async function remove(id: number) {
    const res = await clanFetch(`/api/events/${eventId}/proof-attachments?id=${id}`, { method: 'DELETE' });
    if (res.ok) setItems((prev) => prev.filter((x) => x.id !== id));
  }

  if (items.length === 0 && !canAdd) return null;
  return (
    <div className="mt-2 space-y-2">
      {items.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5">
          {items.map((a) => (
            <Thumb key={a.id} item={a} onRemove={canRemove ? () => remove(a.id) : undefined} />
          ))}
        </div>
      )}
      {canAdd && items.length < MAX_ATTACHMENTS && (
        adding ? (
          <div className="space-y-2 rounded border border-card-border p-2">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              Mark it as <LabelPicker value={label} onChange={setLabel} />
            </div>
            <ImageUpload
              multiple
              onImageSelected={() => {}}
              onImagesSelected={(urls) => add(urls.slice(0, MAX_ATTACHMENTS - items.length).map((url) => ({ kind: 'image', url, label })))}
            />
            <LinkAdder onAdd={(url) => add([{ kind: 'link', url, label }])} />
            <button type="button" onClick={() => setAdding(false)} className="text-xs text-text-muted hover:text-foreground">
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="text-xs text-gold hover:underline">
            + Add a screenshot or link (your end counter)
          </button>
        )
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
