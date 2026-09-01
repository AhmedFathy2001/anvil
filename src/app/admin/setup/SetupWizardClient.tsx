'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/Input';
import WebhookField from '@/components/WebhookField';
import type { BroadcastChannel } from '@/lib/discord-broadcast';
import { clanFetch, clanUrl } from '@/lib/clanFetch';
import ClanLink from '@/components/ClanLink';

interface Props {
  initial: {
    clanName: string;
    inGameClanName: string;
    inviteUrl: string;
    webhookUrl: string;
    pluginWebhook: string;
    rareDrops: string;
    deaths: string;
  };
  // Feed the in-wizard webhook creation flow. Empty / false when no bot is connected — WebhookField
  // then falls back to paste-only.
  channels: BroadcastChannel[];
  botEnabled: boolean;
  // Managed clan: identity fields were collected at sign-up (provisioner env → seeded settings),
  // not typed here — flavors the "already filled in" notice on skipped-into steps.
  provisioned: boolean;
}

type Msg = { type: 'success' | 'error'; text: string } | null;

// 3 input steps + a Done screen. Step 1 batch-saves its keys on Continue; steps 2–3 use WebhookField,
// which creates/pastes and saves each webhook immediately, so those steps just advance.
const TOTAL_STEPS = 3;

// A step whose fields are already satisfied is skipped at open (Back still reaches it, prefilled).
// Step 1's invite is optional — a set clan name alone satisfies it (managed sign-up asked for the
// invite already; leaving it blank there was a choice).
//
// Step 3 is all-optional, and satisfied by the ONE field that covers everything — a clan that set the
// base has answered the question the step is asking, and being shown it again would imply they had
// not. Failing that it wants both splits, since either alone leaves a feed still unrouted.
function firstIncompleteStep(initial: Props['initial']): number {
  const done = [
    !!initial.clanName.trim(),
    !!initial.webhookUrl.trim(),
    !!(initial.pluginWebhook.trim() || (initial.rareDrops.trim() && initial.deaths.trim())),
  ];
  const first = done.indexOf(false);
  return first === -1 ? TOTAL_STEPS : first; // everything done → straight to the Done screen
}

export default function SetupWizardClient({ initial, channels, botEnabled, provisioned }: Props) {
  const router = useRouter();
  // Open at the first step with anything left to do; already-satisfied steps are skipped.
  const [initialStep] = useState(() => firstIncompleteStep(initial));
  const [step, setStep] = useState(initialStep);

  const [clanName, setClanName] = useState(initial.clanName);
  // The exact in-game clan name gates the plugin's roster sync. Most clans use the same string for
  // both, so it mirrors the display name until the admin types in it — then it stays independent.
  const [inGameClanName, setInGameClanName] = useState(initial.inGameClanName);
  const [inGameTouched, setInGameTouched] = useState(!!initial.inGameClanName.trim());
  const [inviteUrl, setInviteUrl] = useState(initial.inviteUrl);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function saveKeys(keys: Record<string, string>): Promise<boolean> {
    setSaving(true);
    setMsg(null);
    try {
      const res = await clanFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keys),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMsg({ type: 'error', text: data.error || 'Could not save. Try again.' });
        return false;
      }
      return true;
    } catch {
      setMsg({ type: 'error', text: 'Could not save. Try again.' });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function next(keys: Record<string, string>) {
    const ok = await saveKeys(keys);
    if (ok) {
      setMsg(null);
      setStep((s) => s + 1);
    }
  }

  // Steps whose webhooks already saved themselves (via WebhookField) just move forward.
  function advance() {
    setMsg(null);
    setStep((s) => s + 1);
  }

  async function finish() {
    const ok = await saveKeys({ setup_completed: '1' });
    if (ok) setStep(TOTAL_STEPS); // Done screen
  }

  // "Skip setup" dismisses the wizard for good (sets the advisory flag) so a fresh clan
  // isn't auto-bounced here again, then drops them on the dashboard.
  async function skipAll() {
    await saveKeys({ setup_completed: '1' });
    router.push(clanUrl('/admin/dashboard'));
    router.refresh();
  }

  const isDone = step >= TOTAL_STEPS;

  return (
    <div className="max-w-xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gold mb-1">
          {isDone ? "You're all set 🎉" : 'Set up Anvil'}
        </h1>
        <p className="text-text-muted text-sm">
          {isDone
            ? 'Your clan is ready to run its first bingo.'
            : 'A few quick questions to get your clan running. You can change any of this later.'}
        </p>
      </header>

      {!isDone && <StepDots current={step} total={TOTAL_STEPS} />}

      <div className="border border-card-border rounded-xl bg-card-bg p-6 mt-5">
        {/* Skipped-ahead notice: shown on the step we opened at when earlier steps were auto-
            skipped, saying where the prefilled values came from and where to change them. */}
        {initialStep > 0 && step === initialStep && !isDone && (
          <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-gold/25 bg-gold/5 px-4 py-3">
            <span className="text-gold text-sm leading-5" aria-hidden>
              ✓
            </span>
            <p className="text-sm text-text-muted leading-relaxed">
              {provisioned
                ? 'Your clan name and Discord details from sign-up are already filled in, so we skipped what’s done. '
                : 'Steps you’ve already completed were skipped. '}
              Change any of it later in the{' '}
              <ClanLink href="/admin/people" className="text-gold hover:underline">
                Clan hub
              </ClanLink>{' '}
              or{' '}
              <ClanLink href="/admin/integrations" className="text-gold hover:underline">
                Advanced settings
              </ClanLink>
              .
            </p>
          </div>
        )}

        {/* Step 1 — Your clan */}
        {step === 0 && (
          <StepShell
            title="Your clan"
            subtitle="What should we call your clan across the site and in Discord posts?"
          >
            <Field label="Display name" hint="Shown on the site, in the plugin and in Discord posts.">
              <Input
                value={clanName}
                onChange={(e) => {
                  setClanName(e.target.value);
                  if (!inGameTouched) setInGameClanName(e.target.value);
                }}
                placeholder="e.g. Iron Anvils"
                autoFocus
              />
            </Field>
            <Field
              label="In-game clan name"
              hint="Optional — the exact OSRS clan name. The plugin's roster sync must report this name; leave blank to accept a sync from any clan."
            >
              <Input
                value={inGameClanName}
                onChange={(e) => {
                  setInGameTouched(true);
                  setInGameClanName(e.target.value);
                }}
                placeholder="e.g. Iron Anvils CC"
              />
            </Field>
            <Field
              label="Discord invite link"
              hint="Optional — shown as the “Join our Discord” link on your site. Leave blank to hide it."
            >
              <Input
                value={inviteUrl}
                onChange={(e) => setInviteUrl(e.target.value)}
                placeholder="https://discord.gg/your-invite"
              />
            </Field>
          </StepShell>
        )}

        {/* Step 2 — Connect Discord */}
        {step === 1 && (
          <StepShell
            title="Connect Discord"
            subtitle="Anvil posts event announcements, results and drops to your server. Pick a channel and let the bot create the webhook for you — or paste one you already have."
          >
            <WebhookField
              channels={channels}
              botEnabled={botEnabled}
              label="Announcements channel"
              helpText="Event start / end, draft, results and sign-up nudges post here. Create one with the bot, or paste a webhook URL."
            />
          </StepShell>
        )}

        {/* Step 3 — Optional extras */}
        {step === 2 && (
          <StepShell
            title="Plugin feeds (optional)"
            subtitle="If your clan uses the Anvil plugin, it can post drops, deaths, 99s, quests and more to Discord. One channel is enough to start — skip this and add it anytime under Advanced settings."
          >
            <WebhookField
              settingKey="webhook_plugin_default"
              label="Plugin notifications channel"
              helpText="Everything the plugin posts goes here. You can split any of it into its own channel later."
              channels={channels}
              botEnabled={botEnabled}
            />
            <div className="border-t border-card-border pt-4">
              <WebhookField
                settingKey="webhook_rare_drops"
                label="Rare drops channel (optional)"
                helpText="Give drops a channel of their own instead of the one above."
                channels={channels}
                botEnabled={botEnabled}
              />
            </div>
            <div className="border-t border-card-border pt-4">
              <WebhookField
                settingKey="webhook_deaths"
                label="Deaths channel (optional)"
                helpText="Give deaths a channel of their own instead of the one above."
                channels={channels}
                botEnabled={botEnabled}
              />
            </div>
          </StepShell>
        )}

        {/* Done */}
        {isDone && (
          <div className="text-center py-4">
            <p className="text-sm text-text-muted mb-6 leading-relaxed">
              You can fine-tune webhooks, roles, tiers and more anytime under{' '}
              <ClanLink href="/admin/integrations" className="text-gold hover:underline">
                Advanced settings
              </ClanLink>
              .
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <ClanLink
                href="/admin/events/new"
                className="bg-gold hover:bg-gold-light text-brown-dark font-bold px-5 py-2.5 rounded-lg transition-colors"
              >
                Create your first event →
              </ClanLink>
              <ClanLink
                href="/admin/dashboard"
                className="px-5 py-2.5 rounded-lg border border-card-border text-text-muted hover:text-foreground hover:border-gold/50 transition-colors"
              >
                Go to dashboard
              </ClanLink>
            </div>
          </div>
        )}

        {msg && (
          <p className={`text-sm mt-4 ${msg.type === 'success' ? 'text-accent-green-light' : 'text-red-400'}`}>
            {msg.text}
          </p>
        )}

        {/* Footer nav */}
        {!isDone && (
          <div className="flex items-center justify-between mt-7 pt-5 border-t border-card-border">
            <div>
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setMsg(null);
                    setStep((s) => s - 1);
                  }}
                  className="text-sm text-text-muted hover:text-foreground transition-colors"
                >
                  ← Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={skipAll}
                  className="text-sm text-text-muted hover:text-foreground transition-colors"
                >
                  Skip setup
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {step === 0 && (
                <PrimaryBtn
                  disabled={saving}
                  onClick={() =>
                    next({
                      clan_name: clanName.trim(),
                      clan_ingame_name: inGameClanName.trim(),
                      discord_invite_url: inviteUrl.trim(),
                    })
                  }
                >
                  {saving ? 'Saving…' : 'Continue'}
                </PrimaryBtn>
              )}
              {step === 1 && (
                <PrimaryBtn disabled={saving} onClick={advance}>
                  Continue
                </PrimaryBtn>
              )}
              {step === 2 && (
                <PrimaryBtn disabled={saving} onClick={finish}>
                  {saving ? 'Saving…' : 'Finish'}
                </PrimaryBtn>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i === current ? 'w-8 bg-gold' : i < current ? 'w-8 bg-gold/40' : 'w-8 bg-card-border'
          }`}
        />
      ))}
      <span className="ml-2 text-xs text-text-muted">
        Step {current + 1} of {total}
      </span>
    </div>
  );
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="font-semibold text-lg">{title}</h2>
      <p className="text-sm text-text-muted mt-1 mb-5 leading-relaxed">{subtitle}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground/70 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-text-muted mt-1 leading-relaxed">{hint}</p>}
    </div>
  );
}

function PrimaryBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="bg-gold hover:bg-gold-light text-brown-dark font-bold px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
    >
      {children}
    </button>
  );
}
