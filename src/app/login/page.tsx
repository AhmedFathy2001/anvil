import { redirect } from 'next/navigation';
import AnvilMark from '@/components/AnvilMark';
import { verifyUser } from '@/lib/auth';
import { isDiscordOAuthConfigured } from '@/lib/discord-oauth';

interface SearchParams {
  return?: string;
  error?: string;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const user = await verifyUser();
  if (user) {
    redirect(params.return || '/');
  }

  const oauthConfigured = isDiscordOAuthConfigured();
  const returnTo = params.return && params.return.startsWith('/') && !params.return.startsWith('//')
    ? params.return
    : '/';
  const startHref = `/api/auth/discord/start?return=${encodeURIComponent(returnTo)}`;

  return (
    <section className="mx-auto flex min-h-[calc(100svh-9rem)] w-full max-w-[1040px] items-center py-5 sm:py-10 lg:py-14">
      <div className="grid w-full overflow-hidden rounded-2xl border border-card-border bg-card-bg shadow-[0_28px_90px_-48px_rgba(0,0,0,0.95)] lg:grid-cols-[0.92fr_1.08fr]">
        <div className="forge-ground forge-heat relative overflow-hidden border-b border-card-border p-5 sm:p-7 lg:min-h-[540px] lg:border-b-0 lg:border-r lg:p-11">
          <AnvilMark
            size={440}
            className="pointer-events-none absolute -bottom-28 -right-28 hidden text-gold/[0.045] sm:block"
          />
          <div className="relative flex h-full flex-col">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-48.png" alt="" width={42} height={42} className="rounded-lg" />
              <div>
                <div className="display text-lg font-semibold text-gold">Anvil</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">
                  OSRS clan events
                </div>
              </div>
            </div>

            <div className="my-auto hidden py-12 lg:block">
              <div className="mb-4 flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-gold-dark">
                Back to the forge
                <span className="h-px w-12 bg-gradient-to-r from-gold-dark to-transparent" />
              </div>
              <div className="display display-lg max-w-[10ch] text-[2.75rem] font-semibold leading-[1.04]">
                Your clan is waiting.
              </div>
              <p className="mt-5 max-w-[34ch] text-[15px] leading-relaxed text-text-muted">
                One sign-in gets you back to your events, teams, account progress, and every clan you call home.
              </p>
            </div>

            <div className="relative hidden gap-5 font-mono text-[10.5px] text-text-dim lg:flex">
              <span className="flex items-center gap-1.5"><Tick /> No password</span>
              <span className="flex items-center gap-1.5"><Tick /> One identity</span>
              <span className="flex items-center gap-1.5"><Tick /> Right back here</span>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 items-center p-6 sm:p-10 lg:p-14">
          <div className="w-full min-w-0">
            <div className="mb-4 flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-gold-dark">
              Member access
              <span className="h-px w-10 bg-gradient-to-r from-gold-dark to-transparent" />
            </div>
            <h1 className="display display-lg text-[clamp(2rem,5vw,2.75rem)] font-semibold leading-[1.05]">
              Sign in to Anvil
            </h1>
            <p className="mt-4 max-w-[44ch] text-[15px] leading-relaxed text-text-muted">
              Use the Discord account you use with your clan. Anvil will return you to where you left off.
            </p>

            {params.error && (
              <div role="alert" className="mt-6 flex gap-3 rounded-lg border border-red-500/30 bg-red-500/[0.08] p-3.5 text-sm text-red-300">
                <svg className="mt-0.5 h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 17h.01" />
                </svg>
                <span className="min-w-0">{params.error}</span>
              </div>
            )}

            <div className="my-7 h-px bg-gradient-to-r from-card-border via-card-border to-transparent" />

            {oauthConfigured ? (
              // clan-prefix: platform — /api/auth/discord/start is the platform's, and this has to be a
              // real navigation rather than a client-side route: it hands off to Discord.
              <a
                href={startHref}
                className="group flex w-full items-center justify-center gap-3 rounded-lg bg-[#5865f2] px-5 py-3.5 font-semibold text-white shadow-[0_12px_30px_-18px_rgba(88,101,242,0.9)] transition-all hover:-translate-y-px hover:bg-[#6875f5] hover:shadow-[0_16px_36px_-18px_rgba(88,101,242,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                <DiscordIcon />
                Continue with Discord
                <svg className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </a>
            ) : (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm leading-relaxed text-red-300">
                <div className="mb-1 font-semibold">Discord sign-in is not configured</div>
                Set <code className="font-mono text-xs">DISCORD_CLIENT_ID</code>,{' '}
                <code className="font-mono text-xs">DISCORD_CLIENT_SECRET</code>, and{' '}
                <code className="font-mono text-xs">DISCORD_REDIRECT_URI</code> on the server.
              </div>
            )}

            <div className="mt-6 flex items-start gap-3 rounded-lg border border-card-border-soft bg-brown-dark/35 p-3.5">
              <svg className="mt-0.5 h-[18px] w-[18px] shrink-0 text-gold-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3 4 6v5c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-3Z" /><path d="m9 12 2 2 4-4" />
              </svg>
              <p className="text-xs leading-relaxed text-text-dim">
                Discord handles your password. Anvil only receives the account details needed to identify you and match your clan access.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Tick() {
  return (
    <svg className="h-3.5 w-3.5 text-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}
