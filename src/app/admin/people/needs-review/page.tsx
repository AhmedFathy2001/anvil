import { db } from '@/db';
import { clanRoster, users } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { avatarUrl } from '@/lib/discord-oauth';
import { requireClan } from '@/lib/clanContext';
import { pendingClaimRequests } from '@/lib/claimRequests';
import { openReportAccountIds } from '@/lib/characterReports';
import VerificationsClient, { type PendingMember } from './VerificationsClient';
import ClaimRequestsClient from './ClaimRequestsClient';
import GuideLink from '@/components/GuideLink';

export const dynamic = 'force-dynamic';

// "Needs review" tab of the Clan hub — provisional members awaiting mod confirmation.
// Same query + client the standalone /admin/verifications page used; that route now just
// redirects here.
export default async function ClanNeedsReviewPage() {
  const clan = await requireClan();
  const claimRequests = await pendingClaimRequests(clan.id);
  const rows = await db
    .select({
      id: clanRoster.id,
      rsn: clanRoster.rsn,
      accountId: clanRoster.accountId,
      verifiedAt: clanRoster.verifiedAt,
      verificationMethod: clanRoster.verificationMethod,
      claimedAt: clanRoster.claimedAt,
      notes: clanRoster.notes,
      userId: users.id,
      displayName: users.displayName,
      discordId: users.discordId,
      discordUsername: users.discordUsername,
      discordAvatar: users.discordAvatar,
    })
    .from(clanRoster)
    // ON THE PERSON, not the login. This joined `clanRoster.playerId` (a PERSON id) against
    // `users.id` (a LOGIN id) — separate sequences — so the Discord identity shown next to each
    // pending claim was some UNRELATED person's, on the one screen where a mod decides whether a
    // claim is genuine by looking at exactly that identity. The claim gate above makes this screen
    // load-bearing, so the join it reads has to point at the right human.
    .leftJoin(users, eq(clanRoster.playerId, users.playerId))
    // THIS CLAN'S. Unscoped, the review screen listed every clan's provisional members — and this is
    // the page a moderator acts on, so it was cross-clan moderation, not just a cross-clan read.
    .where(and(eq(clanRoster.clanId, clan.id), eq(clanRoster.provisional, 1), isNull(clanRoster.leftAt)))
    .orderBy(clanRoster.claimedAt);

  // Which of these this clan (or another) has already raised with Anvil — shown as sent, not re-asked.
  const reported = await openReportAccountIds([...rows.map((r) => r.accountId), ...claimRequests.map((c) => c.accountId)]);
  const claimItems = claimRequests.map((c) => ({ ...c, forwarded: reported.has(c.accountId) }));

  const items: PendingMember[] = rows.map((r) => ({
    id: r.id,
    rsn: r.rsn,
    reported: reported.has(r.accountId),
    verifiedAt: r.verifiedAt,
    verificationMethod: r.verificationMethod,
    claimedAt: r.claimedAt,
    notes: r.notes,
    user: r.userId
      ? {
          id: r.userId,
          displayName: r.displayName,
          discordUsername: r.discordUsername,
          avatarUrl: avatarUrl(r.discordId ?? '', r.discordAvatar),
        }
      : null,
  }));

  return (
    <div>
      <ClaimRequestsClient items={claimItems} />

      <div className="mb-1.5 flex items-center gap-2.5">
        <span className="molten h-5 w-1 shrink-0 rounded-sm" />
        <h2 className="text-[16.5px] font-semibold">Awaiting confirmation</h2>
      </div>
      <p className="mb-1.5 ml-4 max-w-[64ch] text-[13.5px] text-text-muted">
        Discord logins matched to an RSN — by training the account (stat-delta), a manual request, or
        automatically the first time their plugin played it. They are already live and lose nothing while
        they wait; check the Discord identity against the RSN and approve to clear the flag. If it looks
        wrong, report it — taking a character off someone is Anvil&rsquo;s call, since it is theirs in
        every clan.
      </p>
      <p className="mb-3.5 ml-4">
        <GuideLink href="/guide/moderator#verify">What to check before you approve</GuideLink>
      </p>
      <VerificationsClient items={items} />
    </div>
  );
}
