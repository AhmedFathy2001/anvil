'use client';

import { useCallback, useEffect, useState } from 'react';
import Input from '@/components/Input';
import type { RolePanelConfig, RolePanelOption } from '@/lib/discordRolePanel';

/**
 * The self-serve role panel: a pinned message in a channel whose buttons hand out roles.
 *
 * Save and Publish are separate buttons, deliberately. Saving mid-edit must not push a half-written
 * panel into a channel members are reading, and re-publishing an unchanged panel is a normal thing
 * to want after somebody deletes the message.
 */

interface Channel {
  id: string;
  name: string;
}
interface Role {
  id: string;
  name: string;
  isEveryone?: boolean;
}

const BLANK_OPTION: Omit<RolePanelOption, 'id'> = {
  label: '',
  emoji: '',
  description: '',
  roleIds: [],
  asksRsn: false,
};

export default function DiscordRolePanelSettings() {
  const [config, setConfig] = useState<RolePanelConfig | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [botEnabled, setBotEnabled] = useState(false);
  const [maxOptions, setMaxOptions] = useState(5);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/discord/role-panel');
      if (!res.ok) return;
      const data = await res.json();
      setConfig(data.config);
      setChannels(data.channels ?? []);
      setRoles((data.roles ?? []).filter((r: Role) => !r.isEveryone));
      setBotEnabled(!!data.enabled);
      setMaxOptions(data.maxOptions ?? 5);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function patch(changes: Partial<RolePanelConfig>) {
    setConfig((c) => (c ? { ...c, ...changes } : c));
  }

  function patchOption(index: number, changes: Partial<RolePanelOption>) {
    setConfig((c) =>
      c ? { ...c, options: c.options.map((o, i) => (i === index ? { ...o, ...changes } : o)) } : c,
    );
  }

  async function save(): Promise<boolean> {
    if (!config) return false;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/discord/role-panel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Could not save' });
        return false;
      }
      setConfig(data.config);
      setMessage({ type: 'success', text: 'Saved.' });
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    // Always save first: publishing what's on screen is what the button appears to do.
    if (!(await save())) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/discord/role-panel', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      setMessage(
        res.ok
          ? { type: 'success', text: 'Panel posted. Re-publishing edits the same message.' }
          : { type: 'error', text: data.error || 'Could not post the panel' },
      );
      if (res.ok && data.config) setConfig(data.config);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="text-text-muted text-sm">Loading…</div>;
  if (!config) return <div className="text-text-muted text-sm">Could not load the role panel settings.</div>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-1">Role panel</h3>
        <p className="text-xs text-text-muted">
          A pinned message with buttons that hand out roles. Point Discord&apos;s own{' '}
          <strong>Welcome Screen</strong> at the channel and new members land on it — Anvil never sees
          the join itself, so the panel is what does the onboarding.
        </p>
      </div>

      {!botEnabled && (
        <p className="text-xs text-yellow-400">
          Connect the Discord bot above first — the panel is posted by the bot, and handing out roles
          needs <em>Manage Roles</em> with the bot&apos;s role above the ones it grants.
        </p>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
          className="accent-gold"
        />
        <span>
          Enabled
          <span className="text-text-muted"> — off means the buttons stop working, message and all</span>
        </span>
      </label>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-text-muted block mb-1">Channel</span>
          <select
            value={config.channelId}
            onChange={(e) => patch({ channelId: e.target.value })}
            className="w-full px-3 py-2 bg-bg border border-card-border rounded-lg text-sm focus:outline-none focus:border-gold"
          >
            <option value="">Pick a channel…</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-text-muted block mb-1">Heading</span>
          <Input
            value={config.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Pick your roles"
            className="w-full px-3 py-2 bg-bg border border-card-border rounded-lg text-sm focus:outline-none focus:border-gold"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs text-text-muted block mb-1">Message</span>
        <textarea
          value={config.body}
          onChange={(e) => patch({ body: e.target.value })}
          rows={3}
          placeholder="Tell us what you’re here for and we’ll set you up."
          className="w-full px-3 py-2 bg-bg border border-card-border rounded-lg text-sm focus:outline-none focus:border-gold"
        />
        <span className="text-xs text-text-muted">
          Discord markdown works. Your words, not Anvil&apos;s — this is the one part that isn&apos;t
          translated, because it&apos;s yours.
        </span>
      </label>

      <div className="space-y-3">
        {config.options.map((option, i) => (
          <div key={option.id} className="border border-card-border rounded-lg p-3 space-y-3 bg-tile-bg">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-text-muted">Button {i + 1}</span>
              <button
                type="button"
                onClick={() =>
                  patch({ options: config.options.filter((_, index) => index !== i) })
                }
                className="ml-auto text-[11px] px-2 py-0.5 rounded border border-card-border text-text-muted hover:text-red-400 hover:border-red-400/40"
              >
                Remove
              </button>
            </div>

            <div className="grid sm:grid-cols-[5rem_minmax(0,1fr)] gap-3">
              <label className="block">
                <span className="text-xs text-text-muted block mb-1">Emoji</span>
                <Input
                  value={option.emoji ?? ''}
                  onChange={(e) => patchOption(i, { emoji: e.target.value })}
                  placeholder="⚔️"
                  className="w-full px-3 py-2 bg-bg border border-card-border rounded-lg text-sm focus:outline-none focus:border-gold"
                />
              </label>
              <label className="block">
                <span className="text-xs text-text-muted block mb-1">Label</span>
                <Input
                  value={option.label}
                  onChange={(e) => patchOption(i, { label: e.target.value })}
                  placeholder="Member"
                  className="w-full px-3 py-2 bg-bg border border-card-border rounded-lg text-sm focus:outline-none focus:border-gold"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs text-text-muted block mb-1">Description (shown in the message)</span>
              <Input
                value={option.description ?? ''}
                onChange={(e) => patchOption(i, { description: e.target.value })}
                placeholder="You’re in the clan in game"
                className="w-full px-3 py-2 bg-bg border border-card-border rounded-lg text-sm focus:outline-none focus:border-gold"
              />
            </label>

            <div>
              <span className="text-xs text-text-muted block mb-1">Roles this grants</span>
              <div className="max-h-36 overflow-y-auto border border-card-border rounded-lg p-2 space-y-1 bg-bg">
                {roles.length === 0 && (
                  <p className="text-xs text-text-muted">No roles readable — is the bot connected?</p>
                )}
                {roles.map((role) => (
                  <label key={role.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={option.roleIds.includes(role.id)}
                      onChange={(e) =>
                        patchOption(i, {
                          roleIds: e.target.checked
                            ? [...option.roleIds, role.id]
                            : option.roleIds.filter((id) => id !== role.id),
                        })
                      }
                      className="accent-gold"
                    />
                    <span className="truncate">{role.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!option.asksRsn}
                onChange={(e) => patchOption(i, { asksRsn: e.target.checked })}
                className="accent-gold mt-0.5"
              />
              <span>
                Ask for their RuneScape name
                <span className="text-text-muted block text-xs">
                  Opens a form, saves the name, sets their nickname to match, and files it in the
                  verification queue. It does <strong>not</strong> mark the account verified — a
                  moderator still confirms it, and it stays a guest until an in-game roster sync says
                  otherwise.
                </span>
              </span>
            </label>
          </div>
        ))}

        {config.options.length < maxOptions && (
          <button
            type="button"
            onClick={() =>
              patch({
                options: [
                  ...config.options,
                  { ...BLANK_OPTION, id: `opt-${Date.now()}-${config.options.length}` },
                ],
              })
            }
            className="text-sm px-3 py-2 rounded-lg bg-gold/15 text-gold border border-gold/30 hover:bg-gold/25 transition-colors"
          >
            Add a button
          </button>
        )}
        {config.options.length >= maxOptions && (
          <p className="text-xs text-text-muted">
            {maxOptions} is the most Discord fits on one row of buttons.
          </p>
        )}
      </div>

      {message && (
        <div
          className={`text-sm px-3 py-2 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/30'
              : 'bg-red-500/10 text-red-400 border border-red-500/30'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="px-4 py-2 bg-gold text-bg font-semibold rounded-lg text-sm hover:bg-gold/90 transition-colors disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={publish}
          disabled={busy || !config.channelId || config.options.length === 0}
          className="px-4 py-2 rounded-lg text-sm border border-card-border hover:border-gold/40 hover:text-gold transition-colors disabled:opacity-50"
        >
          {config.messageId ? 'Save & update the posted panel' : 'Save & post the panel'}
        </button>
      </div>
    </div>
  );
}
