import { db } from '@/db';
import {
  clanCofferSyncEvents,
  clanCofferSyncState,
  cofferEntries,
  type CofferEntry,
  type ClanCofferSyncState,
} from '@/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import {
  decideCofferSync,
  type CofferObservation,
  type CofferSyncOutcome,
} from '@/lib/cofferSyncDecision';

export interface PhysicalCofferSyncResult {
  duplicateEvent: boolean;
  outcome: CofferSyncOutcome;
  amount: number;
  balance: number;
  ledgerEntry: CofferEntry | null;
}

export interface PhysicalCofferObservation extends CofferObservation {
  clanId: number;
  eventKey: string;
  clanMemberId: number;
  userId: number;
  rsn: string;
  pluginVersion: string | null;
}

/** Latest physical OSRS coffer balance, separate from Anvil's available/reserved ledger balance. */
export async function getPhysicalCofferState(clanId: number): Promise<ClanCofferSyncState | null> {
  const [row] = await db
    .select()
    .from(clanCofferSyncState)
    .where(eq(clanCofferSyncState.clanId, clanId))
    .limit(1);
  return row ?? null;
}

/** Recent physical observations for the admin audit surface. */
export async function listPhysicalCofferEvents(clanId: number, limit = 20) {
  return db
    .select()
    .from(clanCofferSyncEvents)
    .where(eq(clanCofferSyncEvents.clanId, clanId))
    .orderBy(desc(clanCofferSyncEvents.id))
    .limit(Math.max(1, Math.min(100, limit)));
}

/**
 * Apply one plugin observation exactly once.
 *
 * The advisory transaction lock is per clan. It closes the gap between reading the known physical
 * balance and updating it, which is what lets ten open RuneLite clients report one withdrawal
 * without producing ten ledger rows.
 */
export async function syncPhysicalCoffer(args: PhysicalCofferObservation): Promise<PhysicalCofferSyncResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(1095651924, ${args.clanId})`);

    const [existing] = await tx
      .select({ outcome: clanCofferSyncEvents.outcome, amount: clanCofferSyncEvents.amount, afterBalance: clanCofferSyncEvents.afterBalance })
      .from(clanCofferSyncEvents)
      .where(and(eq(clanCofferSyncEvents.clanId, args.clanId), eq(clanCofferSyncEvents.eventKey, args.eventKey)))
      .limit(1);
    if (existing) {
      return {
        duplicateEvent: true,
        outcome: existing.outcome as CofferSyncOutcome,
        amount: Number(existing.amount),
        balance: Number(existing.afterBalance),
        ledgerEntry: null,
      };
    }

    const [state] = await tx
      .select({ balance: clanCofferSyncState.balance })
      .from(clanCofferSyncState)
      .where(eq(clanCofferSyncState.clanId, args.clanId))
      .limit(1);
    const decision = decideCofferSync(state ? Number(state.balance) : null, args);
    const now = new Date();
    let ledgerEntry: CofferEntry | null = null;

    if (decision.ledgerAmount !== 0) {
      const attributed = decision.attributeActor;
      const [row] = await tx
        .insert(cofferEntries)
        .values({
          clanId: args.clanId,
          kind: attributed ? (decision.ledgerAmount > 0 ? 'donation' : 'withdrawal') : 'adjustment',
          amount: decision.ledgerAmount,
          status: 'approved',
          clanMemberId: attributed ? args.clanMemberId : null,
          rsn: attributed ? args.rsn : null,
          createdByUserId: attributed ? args.userId : null,
          settledAt: now.toISOString(),
          note: decision.outcome === 'reconciled'
            ? `Automatic in-game coffer reconciliation observed by ${args.rsn}`
            : attributed
              ? 'Detected automatically from the in-game Clan Coffer'
              : `In-game coffer movement observed by ${args.rsn}; actor not confirmed`,
        })
        .returning();
      ledgerEntry = row ?? null;
    }

    await tx
      .insert(clanCofferSyncState)
      .values({
        clanId: args.clanId,
        balance: decision.nextBalance,
        observedByClanMemberId: args.clanMemberId,
        observedAt: now,
        lastEventKey: args.eventKey,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: clanCofferSyncState.clanId,
        set: {
          balance: decision.nextBalance,
          observedByClanMemberId: args.clanMemberId,
          observedAt: now,
          lastEventKey: args.eventKey,
          updatedAt: now,
        },
      });

    await tx.insert(clanCofferSyncEvents).values({
      clanId: args.clanId,
      eventKey: args.eventKey,
      kind: args.kind,
      outcome: decision.outcome,
      amount: decision.ledgerAmount,
      beforeBalance: args.beforeBalance,
      afterBalance: args.afterBalance,
      // Keep the raw chat evidence even when a state gap prevents us from safely attributing the
      // ledger row. `clanMemberId` is the observer; the linked entry is named only when the decision
      // also accepted that evidence.
      actorConfirmed: args.actorConfirmed,
      clanMemberId: args.clanMemberId,
      rsn: args.rsn,
      cofferEntryId: ledgerEntry?.id ?? null,
      pluginVersion: args.pluginVersion,
      createdAt: now,
    });

    return {
      duplicateEvent: false,
      outcome: decision.outcome,
      amount: decision.ledgerAmount,
      balance: decision.nextBalance,
      ledgerEntry,
    };
  });
}
