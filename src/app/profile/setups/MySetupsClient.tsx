'use client';

import { useMemo, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import Input from '@/components/Input';
import Select from '@/components/Select';
import Switch from '@/components/Switch';
import { useDialog } from '@/components/Confirm';
import { InventoryGrid, PaperDoll, RunePouchBox, StonePanel, type Names } from '@/components/guides/osrs';
import { clanFetch } from '@/lib/clanFetch';
import type { InvItem } from '@/lib/guideTiers';
import { bankTagString, type EquipSlot } from '@/lib/runeliteExport';
import { SETUP_NAME_MAX } from '@/lib/tripSetupNames';

export interface SetupCard {
  id: number;
  accountId: number;
  content: string;
  contentName: string;
  contentShort: string;
  raid: boolean;
  name: string;
  tag: string | null;
  presets: string[];
  isDefault: boolean;
  shareClan: boolean;
  shareToken: string | null;
  gear: Record<string, number>;
  inventory: (InvItem | null)[];
  runePouch: InvItem[];
  spellbook: number | null;
  /** "3 days ago", worked out on the server. */
  saved: string;
}

type Filter = 'all' | 'raids' | 'bosses' | 'clan';

const btn = 'inline-flex min-h-9 items-center rounded-lg border px-3 text-[13px] transition-colors disabled:opacity-50';
const plainBtn = `${btn} border-card-border bg-brown-dark/40 text-foreground hover:border-gold/40`;
const goldLink = `${btn} border-transparent text-gold hover:text-gold-light`;

async function call(id: number, method: 'PATCH' | 'POST' | 'DELETE', body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await clanFetch(`/api/profile/setups/${id}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data };
}

function Preview({ s, names }: { s: SetupCard; names: Names }) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <StonePanel className="inline-flex p-2.5">
        <PaperDoll gear={s.gear} hasQuiver={false} twoHanded={false} names={names} size={34} />
      </StonePanel>
      <div className="flex flex-col gap-2">
        <InventoryGrid inventory={s.inventory} names={names} size={30} />
        {s.runePouch.length > 0 && <RunePouchBox runes={s.runePouch} divine={s.runePouch.length > 3} names={names} />}
      </div>
    </div>
  );
}

function SetupArticle({ s, names, shortOf, onChanged }: { s: SetupCard; names: Names; shortOf: string; onChanged: (patch: Partial<SetupCard> | null) => void }) {
  const dialog = useDialog();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(s.name);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const patch = async (body: Record<string, unknown>, local: Partial<SetupCard>) => {
    setBusy(true);
    const r = await call(s.id, 'PATCH', body);
    setBusy(false);
    if (!r.ok) return dialog.notify(String(r.data.error ?? 'That didn’t save.'), 'error');
    onChanged(local);
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
    onChanged({ shareToken: String(r.data.token) });
    await copy(`${window.location.origin}${r.data.path}`, 'Share link copied. Anyone with it sees this setup, never your bank.');
  };

  const stopShare = async () => {
    setBusy(true);
    const r = await call(s.id, 'POST', { share: 'stop' });
    setBusy(false);
    if (r.ok) onChanged({ shareToken: null });
  };

  const bankTag = () =>
    copy(
      bankTagString({ name: s.name, gear: s.gear as Partial<Record<EquipSlot, number>>, inventory: s.inventory, runePouch: s.runePouch, ...(s.spellbook != null ? { spellbook: s.spellbook } : {}) }),
      'Bank tag copied. In the game, right-click a bank tag tab and import it.',
    );

  const remove = async () => {
    setBusy(true);
    const r = await call(s.id, 'DELETE');
    setBusy(false);
    if (!r.ok) return dialog.notify(String(r.data.error ?? 'Couldn’t delete it.'), 'error');
    onChanged(null);
  };

  const saveName = async () => {
    const name = draft.replace(/\s+/g, ' ').trim();
    if (!name || name.length > SETUP_NAME_MAX) return dialog.notify(`A name is 1 to ${SETUP_NAME_MAX} characters.`, 'error');
    await patch({ name }, { name });
    setRenaming(false);
  };

  if (deleting) {
    return (
      <article className="flex flex-wrap items-center gap-3 self-start rounded-xl border border-red-400/40 bg-card-bg p-4">
        <div className="min-w-[220px] flex-1">
          <h3 className="text-base font-semibold text-white">Delete {s.name}?</h3>
          <p className="text-sm text-text-muted">It leaves your plugin’s Setup list{s.shareToken ? ' and its share link stops working' : ''}. This can’t be undone.</p>
        </div>
        <button type="button" className={plainBtn} onClick={() => setDeleting(false)} disabled={busy}>
          Keep it
        </button>
        <button type="button" className={`${btn} border-transparent bg-red-500/80 font-semibold text-white hover:bg-red-500`} onClick={remove} disabled={busy}>
          Delete setup
        </button>
      </article>
    );
  }

  return (
    <article className={`flex flex-col gap-3 rounded-xl border bg-card-bg p-4 ${s.isDefault ? 'border-gold/50' : 'border-card-border'}`}>
      {renaming ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-text-muted">Renaming</span>
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
              className="min-w-[180px] flex-1"
            />
            <button type="button" className={`${btn} border-transparent bg-gold font-semibold text-brown-dark hover:bg-gold-light`} onClick={saveName} disabled={busy}>
              Save name
            </button>
            <button type="button" className={plainBtn} onClick={() => setRenaming(false)}>
              Cancel
            </button>
          </div>
          <p className="text-xs text-text-muted">
            Up to {SETUP_NAME_MAX} characters, {SETUP_NAME_MAX - draft.trim().length} left. This is what the plugin’s Setup list shows.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[17px] font-semibold text-white">{s.name}</h3>
          {s.tag && <span className="rounded-full bg-brown-dark px-2 py-0.5 text-xs text-text-muted">{s.tag}</span>}
          {s.isDefault && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold-light">Default for {shortOf}</span>}
        </div>
      )}
      <Preview s={s} names={names} />
      <p className="text-xs text-text-muted">Saved from the plugin {s.saved}.</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {s.presets.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-text-muted">
            Tag
            <Select
              value={s.tag ?? ''}
              onChange={(v) => void patch({ tag: v || null }, { tag: v || null })}
              options={[{ value: '', label: 'No tag' }, ...s.presets.map((p) => ({ value: p, label: p }))]}
              ariaLabel={`Tag for ${s.name}`}
              className="w-32"
              disabled={busy}
            />
          </label>
        )}
        <Switch checked={s.shareClan} onChange={(v) => void patch({ shareClan: v }, { shareClan: v })} disabled={busy}>
          Share with clan
        </Switch>
      </div>
      {s.shareToken && <p className="text-xs text-text-muted">Shared by link. Anyone with the link sees the setup, never your bank.</p>}
      <div className="flex flex-wrap gap-2">
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
        {!s.isDefault && (
          <button type="button" className={goldLink} onClick={() => void patch({ isDefault: true }, { isDefault: true })} disabled={busy}>
            Make default
          </button>
        )}
        <button type="button" className={plainBtn} onClick={shareLink} disabled={busy}>
          Copy share link
        </button>
        {s.shareToken && (
          <button type="button" className={plainBtn} onClick={stopShare} disabled={busy}>
            Stop sharing
          </button>
        )}
        <button type="button" className={plainBtn} onClick={bankTag}>
          Copy bank tag
        </button>
        <button type="button" className={`${btn} border-red-400/30 text-red-300 hover:border-red-400/60`} onClick={() => setDeleting(true)} disabled={busy}>
          Delete
        </button>
      </div>
    </article>
  );
}

export default function MySetupsClient({ setups: initial, characters, names }: { setups: SetupCard[]; characters: { id: number; rsn: string }[]; names: Names }) {
  const [setups, setSetups] = useState(initial);
  const withSetups = characters.filter((c) => setups.some((s) => s.accountId === c.id));
  const [account, setAccount] = useState<string>(withSetups.length > 1 ? 'all' : String(withSetups[0]?.id ?? 'all'));
  const [filter, setFilter] = useState<Filter>('all');

  const shown = setups.filter(
    (s) => (account === 'all' || String(s.accountId) === account) && (filter === 'all' || (filter === 'raids' ? s.raid : filter === 'bosses' ? !s.raid : s.shareClan)),
  );
  const groups = useMemo(() => {
    const m = new Map<string, SetupCard[]>();
    for (const s of shown) {
      const k = `${s.accountId}:${s.content}`;
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.values()];
  }, [shown]);
  const bosses = new Set(setups.filter((s) => account === 'all' || String(s.accountId) === account).map((s) => s.content)).size;
  const rsnOf = (id: number) => characters.find((c) => c.id === id)?.rsn ?? '';

  const changed = (id: number, patch: Partial<SetupCard> | null) => {
    setSetups((all) => {
      const me = all.find((s) => s.id === id);
      if (!me) return all;
      if (patch === null) {
        const rest = all.filter((s) => s.id !== id);
        // The trip's oldest setup left becomes its default (as the server does).
        if (me.isDefault) {
          const next = rest.filter((s) => s.accountId === me.accountId && s.content === me.content).sort((a, b) => a.id - b.id)[0];
          if (next) return rest.map((s) => (s.id === next.id ? { ...s, isDefault: true } : s));
        }
        return rest;
      }
      return all.map((s) => {
        if (s.id === id) return { ...s, ...patch };
        if (patch.isDefault && s.accountId === me.accountId && s.content === me.content) return { ...s, isDefault: false };
        return s;
      });
    });
  };

  const chip = (k: Filter, label: string) => (
    <button
      key={k}
      type="button"
      aria-pressed={filter === k}
      onClick={() => setFilter(k)}
      className={`min-h-9 rounded-full px-3.5 text-[13px] transition-colors ${filter === k ? 'bg-gold font-semibold text-brown-dark' : 'border border-card-border bg-card-bg text-text-muted hover:text-foreground'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-2xl flex-col gap-1.5">
          <p className="text-[13px] text-text-muted">
            <ClanLink href="/profile" className="hover:text-gold">
              You
            </ClanLink>{' '}
            / My setups
          </p>
          <h1 className="flex items-center gap-2.5 text-3xl font-bold tracking-tight">
            <span className="h-7 w-1 rounded-full bg-gold" />
            My setups
          </h1>
          <p className="text-sm text-text-muted">
            Only you see these. The pre-trip check in the plugin lists them in its Setup dropdown. Save new ones from the plugin, then name and tidy them here.
          </p>
        </div>
        {withSetups.length > 1 && (
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Character
            <Select
              value={account}
              onChange={setAccount}
              options={[{ value: 'all', label: 'All characters' }, ...withSetups.map((c) => ({ value: String(c.id), label: c.rsn }))]}
              ariaLabel="Character"
              className="w-48"
            />
          </label>
        )}
      </div>

      {setups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border p-6 text-sm text-text-muted">
          <h2 className="mb-1 text-base font-semibold text-foreground">No saved setups yet</h2>
          Gear up in game, open the pre-trip check in the Anvil plugin and pick “Save current as new” in its Setup dropdown. It shows up here to name and share.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter setups">
            {chip('all', `All ${bosses} boss${bosses === 1 ? '' : 'es'}`)}
            {chip('raids', 'Raids')}
            {chip('bosses', 'Bosses')}
            {chip('clan', 'Shared with clan')}
          </div>
          {groups.length === 0 && <p className="text-sm text-text-muted">Nothing here with that filter.</p>}
          {groups.map((g) => {
            const first = g[0];
            return (
              <section key={`${first.accountId}:${first.content}`} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="h-5 w-1 rounded-full bg-gold" />
                  <h2 className="text-lg font-semibold text-white">{first.contentName}</h2>
                  <span className="text-[13px] text-text-muted">
                    {g.length} setup{g.length === 1 ? '' : 's'}
                    {account === 'all' && withSetups.length > 1 ? `, ${rsnOf(first.accountId)}` : ''}
                  </span>
                </div>
                <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr))]">
                  {g.map((s) => (
                    <SetupArticle key={s.id} s={s} names={names} shortOf={s.contentShort} onChanged={(p) => changed(s.id, p)} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
