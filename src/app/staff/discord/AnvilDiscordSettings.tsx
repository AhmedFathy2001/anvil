'use client';

import { useState } from 'react';

import { useDialog } from '@/components/Confirm';

import Input from '@/components/Input';
import type { AnvilBotStatus } from '@/lib/anvilDiscord';
import { CheckboxBox } from '@/components/Checkbox';

interface Initial {
  guildId: string;
  webhookSet: boolean;
  /** When everyone already supporting was posted (once), or null. */
  backfilledAt?: string | null;
  rolesEnabled: boolean;
}

const card = 'mb-6 rounded-xl border border-card-border bg-card-bg p-5';
const primary =
  'rounded-lg border border-gold/50 bg-gold/15 px-4 py-2 text-sm font-semibold text-gold-light hover:bg-gold/25 disabled:opacity-50';
const quiet = 'rounded-lg border border-card-border px-4 py-2 text-sm text-text-muted hover:text-foreground disabled:opacity-50';

async function call(method: 'GET' | 'PUT' | 'POST', body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch('/api/staff/discord', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: res.ok, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className={ok ? 'text-accent-green-light' : 'text-gold'}>{ok ? '✓' : '•'}</span>
      <span className={ok ? '' : 'text-text-muted'}>{children}</span>
    </li>
  );
}

export default function AnvilDiscordSettings({
  canWrite,
  initial,
  initialStatus,
}: {
  canWrite: boolean;
  initial: Initial;
  initialStatus: AnvilBotStatus;
}) {
  const [guildId, setGuildId] = useState(initial.guildId);
  const [hook, setHook] = useState('');
  const [webhookSet, setWebhookSet] = useState(initial.webhookSet);
  const [backfilledAt, setBackfilledAt] = useState(initial.backfilledAt ?? null);
  const [rolesEnabled, setRolesEnabled] = useState(initial.rolesEnabled);
  const [includeSubscriber, setIncludeSubscriber] = useState(initialStatus.roles.find((r) => r.key === 'subscriber')?.id != null || !initialStatus.roles.some((r) => r.id));
  const [status, setStatus] = useState(initialStatus);
  const { confirm } = useDialog();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(fn: () => Promise<string | null>) {
    setBusy(true);
    setMsg(null);
    try {
      setMsg(await fn());
    } finally {
      setBusy(false);
    }
  }

  const recheck = async () => {
    const r = await call('GET');
    if (r.ok) setStatus(r.data as unknown as AnvilBotStatus);
  };

  const saveGuild = () =>
    run(async () => {
      const r = await call('PUT', { guildId });
      if (!r.ok) return String(r.data.error ?? 'Could not save.');
      await recheck();
      return 'Server saved.';
    });

  const saveHook = (value: string) =>
    run(async () => {
      const r = await call('PUT', { webhook: value });
      if (!r.ok) return String(r.data.error ?? 'Could not save.');
      setWebhookSet(!!r.data.webhookSet);
      setHook('');
      return value ? 'Webhook saved.' : 'Webhook cleared.';
    });

  const toggleRoles = (next: boolean) =>
    run(async () => {
      const r = await call('PUT', { rolesEnabled: next });
      if (!r.ok) return String(r.data.error ?? 'Could not save.');
      setRolesEnabled(next);
      return next ? 'Supporter roles on: everyone is caught up within a minute.' : 'Supporter roles off. Roles already given stay until you turn this back on.';
    });

  const createRoles = () =>
    run(async () => {
      const r = await call('POST', { action: 'create-roles', includeSubscriber });
      if (!r.ok) return String(r.data.error ?? 'Could not create the roles.');
      setStatus(r.data.status as AnvilBotStatus);
      return 'Roles ready.';
    });

  const simple = (action: 'sweep' | 'test-post', done: string) =>
    run(async () => {
      const r = await call('POST', { action });
      return r.ok ? done : String(r.data.error ?? 'Failed.');
    });

  const rolesMade = status.roles.some((r) => r.id);
  const roleProblems = status.roles.filter((r) => r.problem);

  return (
    <>
      <section className={card}>
        <h2 className="mb-2 font-semibold">1. The bot and your server</h2>
        <ul className="mb-4 grid gap-1 text-sm">
          <Check ok={status.hasToken && !!status.bot}>
            {status.bot ? <>Anvil&rsquo;s bot: <b>{status.bot.name}</b></> : status.error ?? 'No bot.'}
          </Check>
          <Check ok={status.inGuild}>
            {status.inGuild ? (
              'The bot is in your server.'
            ) : status.inviteUrl && guildId.trim() ? (
              <>
                The bot isn&rsquo;t in that server yet.{' '}
                <a href={status.inviteUrl} target="_blank" rel="noopener noreferrer" className="text-gold hover:text-gold-light">
                  Invite it (Manage Roles only)
                </a>
                , then Recheck.
              </>
            ) : (
              'Paste your server id below first.'
            )}
          </Check>
          {status.inGuild && (
            <Check ok={status.canManageRoles}>
              {status.canManageRoles
                ? 'It can manage roles.'
                : "It can't manage roles: give the bot's role the Manage Roles permission in Server Settings → Roles."}
            </Check>
          )}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Input
            value={guildId}
            onChange={(e) => setGuildId(e.target.value)}
            placeholder="Server id (right-click the server → Copy Server ID)"
            aria-label="Anvil server id"
            disabled={!canWrite}
            className="min-w-0 flex-[1_1_18rem] rounded-lg px-3 py-2 text-sm"
          />
          {canWrite && (
            <button type="button" disabled={busy} onClick={() => void saveGuild()} className={primary}>
              Save
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => void run(async () => (await recheck(), null))} className={quiet}>
            Recheck
          </button>
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-2 font-semibold">2. New supporters channel</h2>
        <p className="mb-3 text-sm text-text-muted">
          {webhookSet
            ? 'Each new membership is posted here once, when it is first paid for (a free trial waits for its first charge). A name and a tier: never an email or an amount. People can opt out on their profile.'
            : 'No channel set: nothing is announced. Create a webhook on the channel (Edit Channel → Integrations → Webhooks) and paste its link.'}
        </p>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Input
              type="url"
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              placeholder={webhookSet ? 'Paste a new webhook link to replace it' : 'https://discord.com/api/webhooks/…'}
              aria-label="New supporters webhook link"
              className="min-w-0 flex-[1_1_18rem] rounded-lg px-3 py-2 text-sm"
            />
            <button type="button" disabled={busy || !hook.trim()} onClick={() => void saveHook(hook)} className={primary}>
              Save
            </button>
            {webhookSet && (
              <>
                <button type="button" disabled={busy} onClick={() => void simple('test-post', 'Test post sent.')} className={quiet}>
                  Send a test
                </button>
                <button type="button" disabled={busy} onClick={() => void saveHook('')} className={quiet}>
                  Clear
                </button>
              </>
            )}
          </div>
        )}
        {canWrite && webhookSet && (
          <div className="mt-4 border-t border-card-border pt-3 text-sm">
            {backfilledAt ? (
              <p className="text-text-muted">Everyone already supporting was posted on {new Date(backfilledAt).toLocaleDateString()}.</p>
            ) : (
              <>
                <p className="mb-2 text-text-muted">
                  People who started paying before this channel was set up never got a post. Post each of them once
                  (&ldquo;has been supporting Anvil since…&rdquo;), with their name as an @ mention (no ping) for anyone in the server. People who opted out,
                  staff gifts and invite time are left out. This can only run once.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  className={quiet}
                  onClick={() =>
                    void run(async () => {
                      const ok = await confirm({
                        title: 'Post every current supporter?',
                        body: 'Each one gets a post in the channel now, with their name as an @ mention (nobody is pinged). This runs once.',
                        confirmLabel: 'Post them',
                      });
                      if (!ok) return null;
                      const r = await call('POST', { action: 'announce-current' });
                      if (!r.ok) return String(r.data.error ?? 'Failed.');
                      setBackfilledAt(new Date().toISOString());
                      return `Posted ${r.data.posted}${r.data.skipped ? `, ${r.data.skipped} opted out` : ''}.`;
                    })
                  }
                >
                  Announce current supporters
                </button>
              </>
            )}
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-2 font-semibold">3. Supporter roles</h2>
        <p className="mb-3 text-sm text-text-muted">
          Each tier gets its own role in the tier&rsquo;s colour; time earned through invites counts too. Anvil only ever
          adds or removes these roles, never any other.
        </p>
        <ul className="mb-3 grid gap-1 text-sm">
          {status.roles.map((r) => (
            <Check key={r.key} ok={!!r.id && !r.problem}>
              <b>{r.name}</b>
              {r.key === 'subscriber' && <span className="text-text-dim"> (every tier)</span>}
              {' · '}
              {!r.id ? 'not created' : r.problem ?? 'ready'}
            </Check>
          ))}
        </ul>
        {roleProblems.length === 0 && rolesMade && (
          <p className="mb-3 text-xs text-text-dim">
            Keep the bot&rsquo;s own role above these in Server Settings → Roles, or Discord won&rsquo;t let it hand them out.
          </p>
        )}
        {canWrite && (
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm">
              <CheckboxBox checked={includeSubscriber} onChange={(e) => setIncludeSubscriber(e.target.checked)} />
              Also a shared <b>Anvil Subscriber</b> role every paying tier gets
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy || !status.inGuild} onClick={() => void createRoles()} className={primary}>
                {rolesMade ? 'Check / recreate roles' : 'Create roles'}
              </button>
              <label className="flex items-center gap-2 rounded-lg border border-card-border px-3 py-2 text-sm">
                <CheckboxBox
                  checked={rolesEnabled}
                  disabled={busy || (!rolesEnabled && !rolesMade)}
                  onChange={(e) => void toggleRoles(e.target.checked)}
                />
                Give supporter roles
              </label>
              {rolesEnabled && (
                <button type="button" disabled={busy} onClick={() => void simple('sweep', 'Everyone is re-checked on the next tick.')} className={quiet}>
                  Sync everyone now
                </button>
              )}
            </div>
          </div>
        )}
      </section>
      {msg && <p className="text-sm text-text-muted">{msg}</p>}
    </>
  );
}
