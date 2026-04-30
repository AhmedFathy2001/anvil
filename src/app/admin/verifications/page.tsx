import Link from 'next/link';
import { db } from '@/db';
import { clanMembers, users } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { avatarUrl } from '@/lib/discord-oauth';
import VerificationsClient, { type PendingMember } from './VerificationsClient';

export const dynamic = 'force-dynamic';

export default async function VerificationsPage() {
  // Provisional clan members awaiting mod confirmation. Joined with their owning user
  // so the mod has Discord identity context for the decision.
  const rows = await db
    .select({
      id: clanMembers.id,
      rsn: clanMembers.rsn,
      verifiedAt: clanMembers.verifiedAt,
      verificationMethod: clanMembers.verificationMethod,
      claimedAt: clanMembers.claimedAt,
      notes: clanMembers.notes,
      userId: users.id,
      displayName: users.displayName,
      discordId: users.discordId,
      discordUsername: users.discordUsername,
      discordAvatar: users.discordAvatar,
    })
    .from(clanMembers)
    .leftJoin(users, eq(clanMembers.userId, users.id))
    .where(and(eq(clanMembers.provisional, 1), isNull(clanMembers.leftAt)))
    .orderBy(clanMembers.claimedAt);

  const items: PendingMember[] = rows.map((r) => ({
    id: r.id,
    rsn: r.rsn,
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
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="w-1 h-7 bg-gold rounded-full" />
          <h1 className="text-3xl font-bold text-gold">Verifications</h1>
        </div>
        <Link
          href="/admin/clan"
          className="text-sm text-text-muted hover:text-foreground underline-offset-2 hover:underline"
        >
          ← Back to clan
        </Link>
      </div>

      <p className="text-sm text-text-muted mb-4">
        Members verified via stat-delta land here for confirmation. Review the Discord identity and
        approve to clear the watchlist, or reject to revoke the verification and let them re-attempt.
      </p>

      <VerificationsClient items={items} />
    </div>
  );
}
