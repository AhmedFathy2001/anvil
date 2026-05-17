import { redirect } from 'next/navigation';
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
    <div className="max-w-sm mx-auto mt-16 sm:mt-24">
      <div className="border border-card-border rounded-2xl bg-card-bg p-6 sm:p-8 shadow-xl shadow-black/20">
        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-48.png" alt="" width={48} height={48} className="mx-auto rounded mb-3" />
          <h1 className="text-2xl font-bold text-gold">Sign in</h1>
          <p className="text-text-muted text-sm mt-1">
            Discord login is required to participate in clan events.
          </p>
        </div>

        {oauthConfigured ? (
          <a
            href={startHref}
            className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            Sign in with Discord
          </a>
        ) : (
          <div className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-lg p-3">
            Discord OAuth is not configured on the server. Set <code className="font-mono">DISCORD_CLIENT_ID</code>,{' '}
            <code className="font-mono">DISCORD_CLIENT_SECRET</code>, and{' '}
            <code className="font-mono">DISCORD_REDIRECT_URI</code> in your environment.
          </div>
        )}

        {params.error && (
          <p className="text-red-400 text-sm mt-4 text-center">{params.error}</p>
        )}
      </div>
    </div>
  );
}
