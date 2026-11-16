import { redirect } from 'next/navigation';
import { verifyUser } from '@/lib/auth';
import LinkDeviceClient from './LinkDeviceClient';
import { clansOfPerson } from '@/lib/myClans';
import { countLiveTeamInvolvements } from '@/lib/myTeamNav';

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

  // Told only to somebody with nothing yet (no clan, no live event): after approving they have a
  // game to go back to, and the site half of "where next" is two lines, not a tour.
  const [clans, involvements] = await Promise.all([
    clansOfPerson(session.playerId ?? null, session.userId).catch(() => [{}]),
    countLiveTeamInvolvements(session.userId).catch(() => 1),
  ]);
  const hasNothing = clans.length === 0 && involvements === 0;

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
        <p className="text-xs text-text-muted">
          Approving gives that client its own sign-in to Anvil. It does not get your Discord password.
          You can end it any time in Settings, under Account, Plugin sign-ins.
        </p>
        <LinkDeviceClient initialCode={code ?? ''} hasNothing={hasNothing} />
      </div>
    </main>
  );
}
