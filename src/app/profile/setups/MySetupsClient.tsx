'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import Select from '@/components/Select';
import { useDialog } from '@/components/Confirm';
import { ItemSprite, type Names } from '@/components/guides/osrs';
import { clanFetch } from '@/lib/clanFetch';
import type { SetupCard } from './cards';

export type { SetupCard } from './cards';

type Filter = 'all' | 'raids' | 'bosses' | 'clan';

const btn = 'inline-flex min-h-10 items-center justify-center rounded-lg border px-3.5 text-[13px] transition-colors disabled:opacity-50';
const goldBtn = `${btn} border-transparent bg-gold font-semibold text-brown-dark hover:bg-gold-light`;
const plainBtn = `${btn} border-card-border bg-brown-dark/40 text-foreground hover:border-gold/40`;

const PLANS = [
  { value: 'learner', label: 'Learner' },
  { value: 'experienced', label: 'Experienced' },
  { value: 'max', label: 'Max DPS' },
];
/** The worn pieces a row shows, in the order they say the most about a setup. */
const STRIP = ['weapon', 'head', 'body', 'legs', 'shield', 'cape'] as const;

function Badge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'gold' | 'green' }) {
  const cls = tone === 'gold' ? 'bg-gold/15 text-gold-light' : tone === 'green' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-brown-dark text-text-muted';
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

/** One setup as a row: its worn gear in a strip, the name and badges, when it was saved; opens its page. */
function SetupRow({ s, names }: { s: SetupCard; names: Names }) {
  const strip = STRIP.map((slot) => s.gear[slot]).filter((id): id is number => typeof id === 'number');
  const packed = s.inventory.filter(Boolean).length;
  return (
    <ClanLink
      href={`/profile/setups/${s.id}`}
      className={`group flex items-center gap-3 rounded-xl border bg-card-bg px-3 py-2.5 transition-colors hover:border-gold/50 ${s.isDefault ? 'border-gold/35' : 'border-card-border'}`}
    >
      <span className="flex shrink-0 items-center gap-0.5 rounded-lg bg-[#3e3529] p-1 shadow-[inset_0_0_0_1px_#14100b]">
        {strip.slice(0, 4).map((id) => (
          <ItemSprite key={id} id={id} name={names[id]} size={26} />
        ))}
        {strip.length === 0 && <span className="px-2 text-xs text-text-muted">Empty</span>}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold text-white group-hover:text-gold-light">{s.name}</span>
          {s.tag && <Badge>{s.tag}</Badge>}
          {s.isDefault && <Badge tone="gold">Default</Badge>}
          {s.shareClan && <Badge tone="green">Clan</Badge>}
          {s.shareToken && <Badge tone="green">Link</Badge>}
        </span>
        <span className="text-xs text-text-muted">
          {packed} in the inventory, saved {s.saved}
        </span>
      </span>
      <span aria-hidden className="text-lg text-text-muted group-hover:text-gold">
        ›
      </span>
    </ClanLink>
  );
}

/** "Start from Anvil's loadout": a boss and a plan, worked out from the character's bank into a new setup. */
function StartFromAnvil({ characters, bosses, account }: { characters: { id: number; rsn: string }[]; bosses: { key: string; name: string }[]; account: string }) {
  const dialog = useDialog();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState(account !== 'all' ? account : String(characters[0]?.id ?? ''));
  const [boss, setBoss] = useState(bosses[0]?.key ?? '');
  const [plan, setPlan] = useState('experienced');
  const [busy, setBusy] = useState(false);
  if (!characters.length || !bosses.length) return null;
  const build = async () => {
    setBusy(true);
    const res = await clanFetch('/api/profile/setups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: Number(who), content: boss, plan }) });
    const data = (await res.json().catch(() => ({}))) as { id?: number; name?: string; error?: string };
    setBusy(false);
    if (!res.ok || typeof data.id !== 'number') return dialog.notify(data.error ?? 'Couldn’t build it.', 'error');
    router.push(`${window.location.pathname.replace(/\/$/, '')}/${data.id}`);
  };
  if (!open) {
    return (
      <button type="button" className={plainBtn} onClick={() => setOpen(true)}>
        Start from Anvil’s loadout
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gold/30 bg-card-bg p-4">
      <div>
        <h2 className="text-base font-semibold text-white">Start from Anvil’s loadout</h2>
        <p className="text-sm text-text-muted">Anvil works a setup out from your bank for the boss and plan, the same one the plugin’s pre-trip check shows, and saves it as a new setup you can rename.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {characters.length > 1 && (
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Character
            <Select value={who} onChange={setWho} options={characters.map((c) => ({ value: String(c.id), label: c.rsn }))} ariaLabel="Character" />
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Boss
          <Select value={boss} onChange={setBoss} options={bosses.map((b) => ({ value: b.key, label: b.name }))} ariaLabel="Boss" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Plan
          <Select value={plan} onChange={setPlan} options={PLANS} ariaLabel="Plan" />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={goldBtn} onClick={build} disabled={busy}>
          {busy ? 'Working it out…' : 'Build the setup'}
        </button>
        <button type="button" className={plainBtn} onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function MySetupsClient({ setups, characters, names, bosses }: { setups: SetupCard[]; characters: { id: number; rsn: string }[]; names: Names; bosses: { key: string; name: string }[] }) {
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
  const bossCount = new Set(setups.filter((s) => account === 'all' || String(s.accountId) === account).map((s) => s.content)).size;
  const rsnOf = (id: number) => characters.find((c) => c.id === id)?.rsn ?? '';

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
    <div className="flex flex-col gap-5 pb-12">
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
          <p className="text-sm text-text-muted">Only you see these. The plugin’s pre-trip check lists them in its Setup dropdown. Open one to rename, share or copy it.</p>
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

      <StartFromAnvil characters={characters} bosses={bosses} account={account} />

      {setups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border p-6 text-sm text-text-muted">
          <h2 className="mb-1 text-base font-semibold text-foreground">No saved setups yet</h2>
          Gear up in game, open the pre-trip check in the Anvil plugin and pick “Save current as new” in its Setup dropdown, or start from Anvil’s loadout above.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter setups">
            {chip('all', `All ${bossCount} boss${bossCount === 1 ? '' : 'es'}`)}
            {chip('raids', 'Raids')}
            {chip('bosses', 'Bosses')}
            {chip('clan', 'Shared with clan')}
          </div>
          {groups.length === 0 && <p className="text-sm text-text-muted">Nothing here with that filter.</p>}
          {groups.map((g) => {
            const first = g[0];
            return (
              <section key={`${first.accountId}:${first.content}`} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="h-5 w-1 rounded-full bg-gold" />
                  <h2 className="text-lg font-semibold text-white">{first.contentName}</h2>
                  <span className="text-[13px] text-text-muted">
                    {g.length} setup{g.length === 1 ? '' : 's'}
                    {account === 'all' && withSetups.length > 1 ? `, ${rsnOf(first.accountId)}` : ''}
                  </span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {g.map((s) => (
                    <SetupRow key={s.id} s={s} names={names} />
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
