import AnvilMark from '@/components/AnvilMark';
import ClanCrest from '@/components/ClanCrest';
import ClanLink from '@/components/ClanLink';

/**
 * The clan's card, for somebody it does not share with.
 *
 * A PAGE, NOT A 404. "Not found" is a lie here — the clan exists, you are simply not in it — and it
 * is the unhelpful kind of lie: somebody following a link from Discord cannot tell whether they
 * mistyped, whether the event was deleted, or whether they need to ask for an invite. This says
 * which of those it is and offers the way in.
 *
 * SIGNED OUT IS ITS OWN CASE. Most people who land here are members who have not logged in, and
 * telling them the clan is private would be wrong — from their side it is theirs. So the sign-in
 * prompt leads, and the private notice is the explanation underneath.
 */
export default function ClanPrivate({
  name,
  slug,
  signedIn,
  guestPolicy,
}: {
  name: string;
  slug: string;
  signedIn: boolean;
  /** 'approval' | 'open' | 'closed' — whether asking to join is even a thing here. */
  guestPolicy: string;
}) {
  const canApply = guestPolicy === 'approval' || guestPolicy === 'open';

  return (
    <div className="mx-auto flex w-full max-w-[540px] flex-col items-center py-16 text-center sm:py-24">
      <div className="relative mb-6">
        <AnvilMark
          size={220}
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-gold/[0.05]"
        />
        <ClanCrest name={name} size={56} />
      </div>

      <h1 className="display display-lg text-[26px] font-semibold">{name}</h1>

      {signedIn ? (
        <>
          <p className="mt-3 text-[15px] leading-relaxed text-text-muted">
            This clan keeps its events and roster to its own members. Nothing is missing — you are
            just not on the list.
          </p>
          {canApply && (
            <p className="mt-1.5 text-[14px] text-text-dim">
              {guestPolicy === 'open'
                ? 'It takes guests, though.'
                : 'It takes guests by approval, though.'}
            </p>
          )}
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {canApply && (
              <ClanLink
                href={`/c/${slug}/join`}
                className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
              >
                Ask to join
              </ClanLink>
            )}
            <ClanLink
              href="/clans"
              className="rounded-lg border border-card-border px-5 py-2.5 text-sm transition-colors hover:border-gold-dark hover:bg-card-bg"
            >
              Find another clan
            </ClanLink>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-[15px] leading-relaxed text-text-muted">
            This clan shares its events with its members only. If you are one of them, sign in and
            it will be here.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <ClanLink
              href="/login"
              className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
            >
              Sign in
            </ClanLink>
            <ClanLink
              href="/clans"
              className="rounded-lg border border-card-border px-5 py-2.5 text-sm transition-colors hover:border-gold-dark hover:bg-card-bg"
            >
              Browse clans
            </ClanLink>
          </div>
        </>
      )}
    </div>
  );
}
