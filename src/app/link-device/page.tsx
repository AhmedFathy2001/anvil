import { redirect } from 'next/navigation';
import { verifyUser } from '@/lib/auth';
import LinkDeviceClient from './LinkDeviceClient';

export const dynamic = 'force-dynamic';

/**
 * The device-code approval page for the plugin's "Sign in with Discord" (home-native RFC 8628 flow).
 * The RuneLite client shows a short code and opens this page; the logged-in member confirms it here.
 * The account token is never exposed to the browser — approval only binds the code; the polling
 * plugin redeems it.
 */
export default async function LinkDevicePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const session = await verifyUser();
  if (!session?.userId) {
    const back = code ? `/link-device?code=${encodeURIComponent(code)}` : '/link-device';
    redirect(`/login?return=${encodeURIComponent(back)}`);
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-12">
      <div className="border border-card-border rounded-xl p-6 bg-card-bg space-y-4">
        <h1 className="text-xl font-bold text-gold flex items-center gap-2">
          <span className="w-1 h-5 bg-gold rounded-full" /> Link your RuneLite client
        </h1>
        <p className="text-sm text-text-muted">
          Your RuneLite client is asking to connect to this site as{' '}
          <span className="text-text font-medium">you</span>. Check that the code below matches the
          one shown in the plugin, then approve.
        </p>
        <p className="text-xs text-red-400/90">
          Only approve a code that <strong>your own</strong> RuneLite client is displaying right now.
          If someone sent you this link or a code, deny it — approving would give <em>their</em>{' '}
          client access to your account.
        </p>
        <LinkDeviceClient initialCode={code ?? ''} />
      </div>
    </main>
  );
}
