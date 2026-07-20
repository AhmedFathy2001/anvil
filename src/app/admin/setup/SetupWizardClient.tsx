'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Input from '@/components/Input';
import WebhookField from '@/components/WebhookField';
import type { BroadcastChannel } from '@/lib/discord-broadcast';

interface Props {
  initial: {
    clanName: string;
    inviteUrl: string;
    webhookUrl: string;
    rareDrops: string;
    deaths: string;
  };
  // Feed the in-wizard webhook creation flow. Empty / false when no bot is connected — WebhookField
  // then falls back to paste-only.
  channels: BroadcastChannel[];
  botEnabled: boolean;
}

type Msg = { type: 'success' | 'error'; text: string } | null;

// 3 input steps + a Done screen. Step 1 batch-saves its keys on Continue; steps 2–3 use WebhookField,
// which creates/pastes and saves each webhook immediately, so those steps just advance.
const TOTAL_STEPS = 3;

export default function SetupWizardClient({ initial, channels, botEnabled }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const [clanName, setClanName] = useState(initial.clanName);
  const [inviteUrl, setInviteUrl] = useState(initial.inviteUrl);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function saveKeys(keys: Record<string, string>): Promise<boolean> {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/settings', {
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
    router.push('/admin/dashboard');
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
        {/* Step 1 — Your clan */}
        {step === 0 && (
          <StepShell
            title="Your clan"
            subtitle="What should we call your clan across the site and in Discord posts?"
          >
            <Field label="Clan name">
              <Input
                value={clanName}
                onChange={(e) => setClanName(e.target.value)}
                placeholder="e.g. Iron Anvils"
                autoFocus
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
            title="Drop & death feeds (optional)"
            subtitle="If your clan uses the Anvil plugin, it can post rare drops and deaths to their own channels. Skip this — you can add it anytime under Advanced settings."
          >
            <WebhookField
              settingKey="webhook_rare_drops"
              label="Rare drops channel"
              helpText="Valuable drops and pets post here (optional)."
              channels={channels}
              botEnabled={botEnabled}
            />
            <div className="border-t border-card-border pt-4">
              <WebhookField
                settingKey="webhook_deaths"
                label="Deaths channel"
                helpText="Death notifications post here (optional)."
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
              <Link href="/admin/integrations" className="text-gold hover:underline">
                Advanced settings
              </Link>
              .
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/admin/events/new"
                className="bg-gold hover:bg-gold-light text-brown-dark font-bold px-5 py-2.5 rounded-lg transition-colors"
              >
                Create your first event →
              </Link>
              <Link
                href="/admin/dashboard"
                className="px-5 py-2.5 rounded-lg border border-card-border text-text-muted hover:text-foreground hover:border-gold/50 transition-colors"
              >
                Go to dashboard
              </Link>
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
                  onClick={() => next({ clan_name: clanName.trim(), discord_invite_url: inviteUrl.trim() })}
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
