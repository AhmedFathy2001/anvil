'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import Checkbox from '@/components/Checkbox';
import Input from '@/components/Input';
import Select from '@/components/Select';
import Textarea from '@/components/Textarea';
import { BODY_MAX, TITLE_MAX } from '@/lib/noticeRules';

interface Row {
  id: number;
  title: string;
  body: string;
  audience: string;
  level: string;
  inPlugin: boolean;
  inBrief: boolean;
  byDm: boolean;
  createdAt: string;
  expiresAt: string | null;
  withdrawnAt: string | null;
  dmSentCount: number;
  reads: number;
}

const AUDIENCES = [
  { value: 'admins', label: 'Every clan owner and admin' },
  { value: 'supporters', label: 'Supporters (every tier)' },
  { value: 'tier:champion', label: 'Champions and Patrons' },
  { value: 'tier:patron', label: 'Patrons' },
  { value: 'clan', label: 'One clan’s owners and admins' },
  { value: 'user', label: 'One person' },
  { value: 'everyone', label: 'Everyone on Anvil' },
];

const EXPIRY = [
  { value: '0', label: 'Never' },
  { value: '3', label: 'After 3 days' },
  { value: '7', label: 'After a week' },
  { value: '30', label: 'After a month' },
];

function audienceText(a: string): string {
  const hit = AUDIENCES.find((o) => o.value === a);
  if (hit) return hit.label;
  if (a.startsWith('clan:')) return `Clan #${a.slice(5)} staff`;
  if (a.startsWith('user:')) return `Person #${a.slice(5)}`;
  return a;
}

export default function NoticesClient({ canWrite, initial }: { canWrite: boolean; initial: Row[] }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [audience, setAudience] = useState('admins');
  const [clanSlug, setClanSlug] = useState('');
  const [person, setPerson] = useState('');
  const [inPlugin, setInPlugin] = useState(true);
  const [inBrief, setInBrief] = useState(false);
  const [byDm, setByDm] = useState(false);
  const [important, setImportant] = useState(false);
  const [expires, setExpires] = useState('0');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/staff/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          linkUrl,
          linkLabel,
          audience,
          clanSlug,
          person,
          inPlugin,
          inBrief,
          byDm,
          level: important ? 'important' : 'info',
          expiresInDays: Number(expires),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: j.error ?? 'That didn’t send.' });
        return;
      }
      setMsg({ ok: true, text: byDm ? 'Sent. DMs are going out now.' : 'Sent.' });
      setTitle('');
      setBody('');
      setLinkUrl('');
      setLinkLabel('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(id: number) {
    await fetch('/api/staff/notices', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'withdraw' }) });
    router.refresh();
  }

  return (
    <>
      {canWrite && (
        <form onSubmit={send} className="space-y-4 rounded-xl border border-card-border bg-card-bg p-5">
          <div>
            <label className="mb-1.5 block text-sm text-gray-300">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} required placeholder="Plugin 1.16 needs a quick re-login" className="rounded-lg px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-300">Message</label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={BODY_MAX} rows={4} placeholder="Write it like you'd say it." className="rounded-lg px-3 py-2 text-sm outline-none" />
            <p className="mt-1 text-xs text-gray-500">The plugin shows the first couple of lines, as plain text.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <div>
              <label className="mb-1.5 block text-sm text-gray-300">
                Link <span className="text-gray-600">(optional, site inbox and DM only)</span>
              </label>
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="/settings or https://discord.gg/…" className="rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-300">Button text</label>
              <Input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} maxLength={30} placeholder="Open" className="rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
          </div>
          <p className="-mt-2 text-xs text-gray-500">Only Anvil pages or Discord invites, never a file. The plugin never gets the link.</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm text-gray-300">Who it&rsquo;s for</label>
              <Select value={audience} onChange={setAudience} options={AUDIENCES} ariaLabel="Who it's for" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-300">Take it down</label>
              <Select value={expires} onChange={setExpires} options={EXPIRY} ariaLabel="Take it down" />
            </div>
          </div>
          {audience === 'clan' && (
            <Input value={clanSlug} onChange={(e) => setClanSlug(e.target.value)} placeholder="Clan address, e.g. theafkspot" className="rounded-lg px-3 py-2 text-sm outline-none" />
          )}
          {audience === 'user' && (
            <Input value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Discord username or Anvil user id" className="rounded-lg px-3 py-2 text-sm outline-none" />
          )}

          <div className="space-y-2">
            <p className="text-sm text-gray-300">Also show it</p>
            <Checkbox checked={inPlugin} onChange={setInPlugin} label="In the plugin panel" description="A “From Anvil” card at the top until they read it or hide it." />
            <Checkbox checked={inBrief} onChange={setInBrief} label="In the login brief" description="One chat line the next time they log in, once." />
            <Checkbox checked={byDm} onChange={setByDm} label="As a Discord DM" description="Only to people who said yes to DMs. Each one has a Stop button." />
            <Checkbox checked={important} onChange={setImportant} label="Important" description="Gold, and pinned to the top of the inbox until read." />
          </div>

          {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-300'}`}>{msg.text}</p>}
          <button type="submit" disabled={busy || !title.trim()} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark disabled:opacity-40">
            {busy ? 'Sending…' : 'Send notice'}
          </button>
        </form>
      )}

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-text-muted">Sent</h2>
      {initial.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing sent yet.</p>
      ) : (
        <ul className="space-y-2">
          {initial.map((n) => (
            <li key={n.id} className={`rounded-lg border border-card-border bg-card-bg p-4 ${n.withdrawnAt ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${n.level === 'important' ? 'text-gold' : 'text-gray-100'}`}>{n.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {audienceText(n.audience)} · {new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {n.reads} read
                    {n.inPlugin && ' · panel'}
                    {n.inBrief && ' · brief'}
                    {n.byDm && ` · ${n.dmSentCount} DM'd`}
                    {n.withdrawnAt && ' · taken down'}
                  </p>
                </div>
                {canWrite && !n.withdrawnAt && (
                  <button type="button" onClick={() => void withdraw(n.id)} className="shrink-0 text-xs text-gray-400 hover:text-red-300">
                    Take down
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
