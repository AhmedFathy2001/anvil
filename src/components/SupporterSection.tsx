import ClanLink from '@/components/ClanLink';
import CopyLinkButton from '@/components/CopyLinkButton';
import { REFERRAL_MILESTONES as MILESTONES } from '@/lib/referralRules';
import { SITE } from '@/lib/site';
import SupporterName from '@/components/SupporterName';
import SupporterAnnounceToggle from '@/components/SupporterAnnounceToggle';
import SupporterGameChatToggle from '@/components/SupporterGameChatToggle';
import SupporterStylePicker from '@/components/SupporterStylePicker';
import type { SupporterStyle } from '@/lib/supporterStyle';
import { tenureStep, type SupporterState, type SupporterTierId } from '@/lib/supporterTiers';

/** What the profile needs to show someone's Supporter status (serialisable for client islands). */
export interface SupporterView {
  tier: SupporterTierId;
  tierName: string;
  since: string;
  months: number;
  renewsAt: string | null;
  endsAt: string | null;
  earned: boolean;
  /** A gift from Anvil staff. */
  gift?: boolean;
  /** Their name colours as worn (already gated to the tier). */
  style: SupporterStyle | null;
}

/** The person's invite link and what it has earned (lib/referrals). */
export interface InviteView {
  link: string;
  held: number;
  granted: number;
  monthsEarned: number;
  /** Towards the next milestone, or null once every one is reached. */
  next: { from: number; to: number; label: string } | null;
}

export function supporterView(state: SupporterState | null): SupporterView | null {
  if (!state) return null;
  return {
    tier: state.tier.id,
    tierName: state.tier.name,
    since: state.since,
    months: state.months,
    renewsAt: state.renewsAt,
    endsAt: state.endsAt,
    earned: state.earned,
    gift: state.gift,
    style: state.style,
  };
}

function day(stamp: string | null): string | null {
  if (!stamp) return null;
  const ms = Date.parse(stamp.includes('T') ? stamp : `${stamp.replace(' ', 'T')}Z`);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * The Anvil Supporter block on "your account across Anvil". A supporter sees their tier, tenure and
 * when it renews or ends, with a way to change tier or manage the subscription. Someone who isn't
 * supporting sees one quiet line pointing at the tier page: never a pitch to someone already paying.
 */
export default function SupporterSection({
  supporter,
  invite = null,
  name = null,
  announce = null,
  gameChat = null,
  characters = [],
  bare = false,
}: {
  /** On /settings, where the page already has its title: no section heading or top margin. */
  bare?: boolean;
  supporter: SupporterView | null;
  invite?: InviteView | null;
  /** Their "announce me" choice for the Anvil Discord; null hides the toggle. */
  announce?: boolean | null;
  /** Their "colours in game chat" choice; null hides the toggle. */
  gameChat?: boolean | null;
  /** Linked RuneScape characters and their own flair overrides. */
  characters?: { accountId: number; rsn: string; style: SupporterStyle | null }[];
  /** Their own display name, previewed in each tier's flair. */
  name?: string | null;
}) {
  if (!supporter) {
    const me = name || 'Your name';
    return (
      <section className={bare ? '' : 'mt-10'}>
        {!bare && <h2 className="mb-3 text-lg font-semibold">Anvil Supporter</h2>}
        <div className="relative overflow-hidden rounded-2xl border border-gold/35 bg-gradient-to-br from-gold/[0.07] via-card-bg to-card-bg p-5 sm:p-6">
          <div className="flex flex-wrap items-start gap-6">
            <div className="min-w-0 flex-[1_1_20rem]">
              <p className="display text-xl font-semibold">Keep Anvil running, and wear it.</p>
              <p className="mt-2 max-w-[54ch] text-[14px] leading-relaxed text-text-muted">
                Anvil is free and made by one indie dev. Supporters pay for the servers, and their name says so on
                every board, in the plugin panel and on Discord.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[12px]">
                <span className="rounded-full border border-accent-green/40 bg-accent-green/10 px-2.5 py-0.5 text-accent-green-light">
                  7 days free
                </span>
                <span className="rounded-full border border-card-border px-2.5 py-0.5 text-text-muted">from $1 a month</span>
                <span className="rounded-full border border-card-border px-2.5 py-0.5 text-text-muted">cancel any time</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <ClanLink
                  href="/supporter"
                  className="rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
                >
                  Try it free for 7 days
                </ClanLink>
                <ClanLink href="/supporter" className="text-[13.5px] text-gold hover:text-gold-light">
                  What each tier gets
                </ClanLink>
              </div>
            </div>
            {/* Their own name in each tier's flair: the perk, shown rather than described. */}
            <div className="grid min-w-0 flex-[1_1_14rem] gap-2" aria-label="Your name with each tier's flair">
              {(['supporter', 'champion', 'patron'] as const).map((t) => (
                <div key={t} className="flex items-center justify-between gap-3 rounded-lg border border-card-border bg-background/40 px-3 py-2">
                  <SupporterName name={me} tier={t} className="truncate font-semibold" plain />
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-dim">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {invite && <InviteCard invite={invite} />}
        <DiscordCard announce={announce} />
      </section>
    );
  }

  const { next } = tenureStep(supporter.months);
  const renews = day(supporter.renewsAt);
  const ends = day(supporter.endsAt);
  return (
    <section className={bare ? '' : 'mt-10'}>
      {!bare && <h2 className="mb-3 text-lg font-semibold">Anvil Supporter</h2>}
      <div className="rounded-xl border border-gold/40 bg-gold/[0.05] p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <SupporterName name={`Anvil ${supporter.tierName}`} tier={supporter.tier} style={supporter.style} className="text-lg font-bold" plain />
          <span className="text-sm text-text-muted">
            Since {day(supporter.since)}
            {supporter.months > 0 && <> · {supporter.months} month{supporter.months === 1 ? '' : 's'}</>}
          </span>
        </div>
        <p className="mt-2 text-sm text-text-muted">
          {supporter.gift && ends ? (
            <>A gift from Anvil. Your perks run until {ends}.</>
          ) : supporter.earned && ends ? (
            <>Earned through your invites. Your perks run until {ends}.</>
          ) : ends ? (
            <>Cancelled. Your perks stay until {ends}.</>
          ) : renews ? (
            <>Renews {renews}.</>
          ) : (
            <>Active.</>
          )}
          {next != null && <> Your flair gets a new look at {next} months.</>} Thank you for keeping Anvil
          running.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ClanLink
            href="/supporter"
            className="rounded-lg border border-gold/40 px-3 py-1.5 text-sm font-medium text-gold transition-colors hover:bg-gold/10"
          >
            Change tier
          </ClanLink>
          <a
            href="https://gumroad.com/library"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-gold/40"
          >
            Manage on Gumroad
          </a>
        </div>
        <div className="mt-4 space-y-3">
          {characters.length > 0 ? characters.map((character) => (
            <SupporterStylePicker
              key={character.accountId}
              tier={supporter.tier}
              name={character.rsn}
              accountId={character.accountId}
              initial={character.style ?? supporter.style}
            />
          )) : (
            <SupporterStylePicker tier={supporter.tier} name={name || 'Your name'} initial={supporter.style} />
          )}
        </div>
        {gameChat != null && <SupporterGameChatToggle initial={gameChat} />}
      </div>
      {invite && <InviteCard invite={invite} />}
      <DiscordCard announce={announce} />
    </section>
  );
}

/**
 * Invite friends. Only a purchase counts, and the reward is held two weeks so a refund can't farm it:
 * said plainly, so nobody wonders why a friend's sign-up didn't show up yet.
 */
function InviteCard({ invite }: { invite: InviteView }) {
  const path = (() => {
    try {
      return new URL(invite.link).pathname;
    } catch {
      return invite.link;
    }
  })();
  return (
    <div className="mt-3 rounded-2xl border border-card-border bg-card-bg p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-base font-semibold">Bring friends, earn free months</p>
        <span className="text-[13px] text-text-muted">
          <b className="text-gold">{invite.granted}</b> joined
          {invite.monthsEarned > 0 && <> · {invite.monthsEarned} month{invite.monthsEarned === 1 ? '' : 's'} earned</>}
          {invite.held > 0 && <> · {invite.held} on the way</>}
        </span>
      </div>
      <p className="mt-1 text-[13.5px] text-text-muted">
        Every friend who becomes a Supporter through your link gives you a free month (three for yearly), and the
        milestones stack on top.
      </p>

      {/* The ladder: what each milestone gives, and how far along it you are. */}
      <ol className="mt-4 grid grid-cols-3 gap-2">
        {MILESTONES.map((m) => {
          const reached = invite.granted >= m.at;
          return (
            <li
              key={m.at}
              className={`rounded-xl border px-3 py-2.5 ${reached ? 'border-gold/60 bg-gold/10' : 'border-card-border bg-background/30'}`}
            >
              <span className={`font-mono text-[11px] ${reached ? 'text-gold' : 'text-text-dim'}`}>
                {reached ? '✓ ' : ''}
                {m.at} friends
              </span>
              <span className="mt-0.5 block text-[13px] leading-snug">{m.label}</span>
            </li>
          );
        })}
      </ol>
      {invite.next && (
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-brown-dark"
          role="progressbar"
          aria-valuemin={invite.next.from}
          aria-valuemax={invite.next.to}
          aria-valuenow={invite.granted}
          aria-label="Friends towards the next reward"
        >
          <span
            className="block h-full rounded-full bg-gradient-to-r from-gold-dark to-gold-light"
            style={{ width: `${Math.max(3, Math.round(((invite.granted - invite.next.from) / (invite.next.to - invite.next.from)) * 100))}%` }}
          />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={invite.link}
          aria-label="Your invite link"
          className="min-w-0 flex-[1_1_16rem] rounded-lg border border-card-border bg-background/40 px-3 py-2 font-mono text-[13px]"
        />
        <CopyLinkButton
          path={path}
          label="Copy link"
          className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
        />
      </div>
      <p className="mt-2 text-[12px] text-text-dim">Rewards land two weeks after a friend&rsquo;s first payment.</p>
    </div>
  );
}

/** The Anvil Discord, where supporters and clan leaders actually talk to the person building it. */
function DiscordCard({ announce }: { announce: boolean | null }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 rounded-2xl border border-card-border bg-card-bg px-5 py-4">
      <p className="min-w-0 flex-[1_1_20rem] text-[14px] leading-relaxed text-text-muted">
        <b className="text-foreground">Come hang out in the Anvil Discord.</b> See new features first, report bugs and
        have a say in what gets built next. Supporters who join with the Discord they sign in with get their
        tier&rsquo;s role there automatically.
      </p>
      <a
        href={SITE.supportDiscord}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg bg-[#5865f2] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Join the Anvil Discord
      </a>
      {announce != null && <SupporterAnnounceToggle initial={announce} />}
    </div>
  );
}
