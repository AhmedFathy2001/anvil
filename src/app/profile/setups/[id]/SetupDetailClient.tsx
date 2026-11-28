'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import ActionMenu from '@/components/ActionMenu';
import ClanLink from '@/components/ClanLink';
import Input from '@/components/Input';
import Select from '@/components/Select';
import Switch from '@/components/Switch';
import { useDialog } from '@/components/Confirm';
import { InventoryGrid, PaperDoll, RunePouchBox, StonePanel, type Names } from '@/components/guides/osrs';
import { clanFetch } from '@/lib/clanFetch';
import { bankTagString, type EquipSlot } from '@/lib/runeliteExport';
import { SETUP_NAME_MAX } from '@/lib/tripSetupNames';
import type { SetupCard } from '../cards';

const btn = 'inline-flex min-h-10 items-center justify-center rounded-lg border px-3.5 text-[13px] transition-colors disabled:opacity-50';
const plainBtn = `${btn} border-card-border bg-brown-dark/40 text-foreground hover:border-gold/40`;
const goldBtn = `${btn} border-transparent bg-gold font-semibold text-brown-dark hover:bg-gold-light`;

async function call(id: number, method: 'PATCH' | 'POST' | 'DELETE', body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await clanFetch(`/api/profile/setups/${id}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { ok: res.ok, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

/** One saved setup: the doll, inventory and pouch, and a toolbar of what can be done with it. */
export default function SetupDetailClient({ setup, names }: { setup: SetupCard; names: Names }) {
  const dialog = useDialog();
  const router = useRouter();
  const [s, setS] = useState(setup);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(setup.name);
  const [busy, setBusy] = useState(false);

  const patch = async (body: Record<string, unknown>, local: Partial<SetupCard>) => {
    setBusy(true);
    const r = await call(s.id, 'PATCH', body);
    setBusy(false);
    if (!r.ok) return dialog.notify(String(r.data.error ?? 'That didn’t save.'), 'error');
    setS((x) => ({ ...x, ...local }));
  };
  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      dialog.notify(done);
    } catch {
      await dialog.ask({ title: 'Copy this', label: 'Select it and copy', initial: text });
    }
  };
  const shareLink = async () => {
    setBusy(true);
    const r = await call(s.id, 'POST', { share: 'link' });
    setBusy(false);
    if (!r.ok || typeof r.data.path !== 'string') return dialog.notify(String(r.data.error ?? 'Couldn’t make a link.'), 'error');
    setS((x) => ({ ...x, shareToken: String(r.data.token) }));
    await copy(`${window.location.origin}${r.data.path}`, 'Share link copied. Anyone with it sees this setup, never your bank.');
  };
  const stopShare = async () => {
    setBusy(true);
    const r = await call(s.id, 'POST', { share: 'stop' });
    setBusy(false);
    if (r.ok) setS((x) => ({ ...x, shareToken: null }));
  };
  const bankTag = () =>
    copy(bankTagString({ name: s.name, gear: s.gear as Partial<Record<EquipSlot, number>>, inventory: s.inventory, runePouch: s.runePouch, ...(s.spellbook != null ? { spellbook: s.spellbook } : {}) }), 'Bank tag copied. In the game, right-click a bank tag tab and import it.');
  const remove = async () => {
    const yes = await dialog.confirm({ title: `Delete ${s.name}?`, body: `It leaves your plugin’s Setup list${s.shareToken ? ' and its share link stops working' : ''}. This can’t be undone.`, confirmLabel: 'Delete setup', tone: 'danger' });
    if (!yes) return;
    setBusy(true);
    const r = await call(s.id, 'DELETE');
    setBusy(false);
    if (!r.ok) return dialog.notify(String(r.data.error ?? 'Couldn’t delete it.'), 'error');
    router.push(window.location.pathname.replace(/\/\d+\/?$/, ''));
    router.refresh();
  };
  const saveName = async () => {
    const name = draft.replace(/\s+/g, ' ').trim();
    if (!name || name.length > SETUP_NAME_MAX) return dialog.notify(`A name is 1 to ${SETUP_NAME_MAX} characters.`, 'error');
    await patch({ name }, { name });
    setRenaming(false);
  };

  return (
    <div className="flex flex-col gap-5 pb-12">
      <div className="flex flex-col gap-1.5">
        <p className="text-[13px] text-text-muted">
          <ClanLink href="/profile" className="hover:text-gold">
            You
          </ClanLink>{' '}
          /{' '}
          <ClanLink href="/profile/setups" className="hover:text-gold">
            My setups
          </ClanLink>{' '}
          / {s.contentName}
        </p>
        {renaming ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={draft}
              maxLength={SETUP_NAME_MAX}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveName();
                if (e.key === 'Escape') setRenaming(false);
              }}
              aria-label="Setup name"
              autoFocus
              className="min-w-[200px] flex-1 sm:max-w-sm"
            />
            <button type="button" className={goldBtn} onClick={saveName} disabled={busy}>
              Save name
            </button>
            <button type="button" className={plainBtn} onClick={() => setRenaming(false)}>
              Cancel
            </button>
            <p className="w-full text-xs text-text-muted">Up to {SETUP_NAME_MAX} characters, {SETUP_NAME_MAX - draft.trim().length} left. The plugin’s Setup list shows it.</p>
          </div>
        ) : (
          <h1 className="flex flex-wrap items-center gap-2.5 text-3xl font-bold tracking-tight">
            <span className="h-7 w-1 rounded-full bg-gold" />
            {s.name}
            {s.tag && <span className="rounded-full bg-brown-dark px-2 py-0.5 text-xs font-normal text-text-muted">{s.tag}</span>}
            {s.isDefault && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold-light">Default for {s.contentShort}</span>}
          </h1>
        )}
        <p className="text-sm text-text-muted">Saved {s.saved}. Only you see it{s.shareClan ? ', and your clan in their Setup list' : ''}{s.shareToken ? ', and anyone with its link' : ''}.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-card-border bg-card-bg p-2.5">
        {!renaming && (
          <button
            type="button"
            className={plainBtn}
            onClick={() => {
              setDraft(s.name);
              setRenaming(true);
            }}
          >
            Rename
          </button>
        )}
        {s.presets.length > 0 && (
          <Select
            value={s.tag ?? ''}
            onChange={(v) => void patch({ tag: v || null }, { tag: v || null })}
            options={[{ value: '', label: 'No tag' }, ...s.presets.map((p) => ({ value: p, label: p }))]}
            ariaLabel={`Tag for ${s.name}`}
            className="w-32"
            disabled={busy}
          />
        )}
        {!s.isDefault && (
          <button type="button" className={plainBtn} onClick={() => void patch({ isDefault: true }, { isDefault: true })} disabled={busy}>
            Make default
          </button>
        )}
        <span className="px-1">
          <Switch checked={s.shareClan} onChange={(v) => void patch({ shareClan: v }, { shareClan: v })} disabled={busy}>
            Share with clan
          </Switch>
        </span>
        <span className="ml-auto flex flex-wrap gap-2">
          <button type="button" className={plainBtn} onClick={shareLink} disabled={busy}>
            Copy link
          </button>
          <button type="button" className={plainBtn} onClick={bankTag}>
            Copy bank tag
          </button>
          <ActionMenu
            label="More"
            items={[
              ...(s.shareToken ? [{ label: 'Stop the share link', onClick: () => void stopShare(), disabled: busy }] : []),
              { label: 'Delete setup', onClick: () => void remove(), variant: 'danger' as const, disabled: busy, separatorBefore: !!s.shareToken },
            ]}
          />
        </span>
      </div>

      <div className="flex flex-wrap items-start justify-center gap-4 rounded-xl border border-card-border bg-card-bg p-4 sm:justify-start">
        <StonePanel className="inline-flex p-3">
          <PaperDoll gear={s.gear} hasQuiver={false} twoHanded={false} names={names} size={40} />
        </StonePanel>
        <div className="flex flex-col gap-2">
          <InventoryGrid inventory={s.inventory} names={names} size={34} />
          {s.runePouch.length > 0 && <RunePouchBox runes={s.runePouch} divine={s.runePouch.length > 3} names={names} />}
        </div>
      </div>
    </div>
  );
}
