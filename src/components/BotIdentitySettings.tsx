'use client';

import { useEffect, useRef, useState } from 'react';

import ClanCrest from '@/components/ClanCrest';
import Input from '@/components/Input';
import { useDialog } from '@/components/Confirm';
import { clanFetch } from '@/lib/clanFetch';

type Mode = 'anvil' | 'clan' | 'custom';

interface State {
  mode: Mode;
  name: string;
  avatarUrl: string;
  clan: { name: string; logoUrl: string | null };
}

const ANVIL_LOGO = '/icon-48.png';

/**
 * How the bot looks in YOUR server: Anvil (default), your clan's name and icon, or your own. Discord
 * lets a bot wear a different nickname and avatar per server, so this changes nothing anywhere else
 * — and "Powered by Anvil" stays on every post either way.
 */
export default function BotIdentitySettings() {
  const { notify } = useDialog();
  const [s, setS] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    clanFetch('/api/admin/discord/identity')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setS({ mode: j.mode, name: j.name, avatarUrl: j.avatarUrl, clan: j.clan }));
  }, []);

  async function save(next: State) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await clanFetch('/api/admin/discord/identity', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: next.mode, name: next.name, avatarUrl: next.avatarUrl }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return notify(j.error ?? 'Could not save', 'error');
      setStatus(j.applied ? { ok: true, text: 'Updated in your Discord server.' } : { ok: false, text: `Saved, but Discord refused: ${j.error}` });
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    if (!s) return;
    const body = new FormData();
    body.append('file', file);
    const res = await clanFetch('/api/upload', { method: 'POST', body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) return notify(data.error ?? 'That upload did not work.', 'error');
    setS({ ...s, avatarUrl: data.url });
  }

  if (!s) return null;

  const preview =
    s.mode === 'anvil'
      ? { name: 'Anvil', icon: /* eslint-disable-next-line @next/next/no-img-element */ <img src={ANVIL_LOGO} alt="" className="h-10 w-10 rounded-full bg-[#1e1f22] p-1" /> }
      : s.mode === 'clan'
        ? { name: s.clan.name, icon: <ClanCrest name={s.clan.name} logoUrl={s.clan.logoUrl} size={40} rounded="rounded-full" /> }
        : {
            name: s.name || s.clan.name,
            icon: s.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <ClanCrest name={s.clan.name} logoUrl={s.clan.logoUrl} size={40} rounded="rounded-full" />
            ),
          };

  const option = (mode: Mode, title: string, blurb: string) => (
    <button
      type="button"
      onClick={() => setS({ ...s, mode })}
      className={`rounded-lg border px-3 py-2 text-left ${s.mode === mode ? 'border-gold bg-gold/10' : 'border-card-border hover:border-gold/40'}`}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-text-muted">{blurb}</div>
    </button>
  );

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Bot appearance in your server</h3>
        <p className="text-xs text-text-muted">
          The bot&apos;s name and picture in your Discord only — other servers still see Anvil. Webhook posts follow the same choice.
          &quot;Powered by Anvil&quot; stays on every post.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {option('anvil', 'Anvil', 'The default name and logo.')}
        {option('clan', 'Your clan', 'Your clan name and icon — follows changes to your profile.')}
        {option('custom', 'Custom', 'A name and picture of your choosing.')}
      </div>
      {s.mode === 'custom' && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block flex-1 text-xs text-text-muted">
            Name (up to 32)
            <Input value={s.name} maxLength={32} onChange={(e) => setS({ ...s, name: e.target.value })} placeholder={s.clan.name} />
          </label>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <button type="button" onClick={() => fileRef.current?.click()} className="h-[38px] rounded border border-card-border px-3 text-sm text-text-muted hover:text-foreground">
            {s.avatarUrl ? 'Change picture' : 'Upload picture'}
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#313338] px-3 py-2">
        <div className="flex items-center gap-3">
          {preview.icon}
          <div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-[#f2f3f5]">
              {preview.name}
              <span className="rounded bg-[#5865f2] px-1 text-[10px] font-semibold leading-4 text-white">APP</span>
            </div>
            <div className="text-xs text-[#949ba4]">How the bot shows in your server</div>
          </div>
        </div>
        <button type="button" onClick={() => save(s)} disabled={busy} className="rounded-lg bg-gold px-4 py-1.5 text-sm font-semibold text-brown-dark hover:bg-gold-light disabled:opacity-40">
          {busy ? 'Applying…' : 'Save'}
        </button>
      </div>
      {status && <p className={`text-xs ${status.ok ? 'text-emerald-300' : 'text-amber-200'}`}>{status.text}</p>}
    </div>
  );
}
