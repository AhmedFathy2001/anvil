// Pure decision-making for observations of the in-game Clan Coffer.
//
// Several RuneLite clients may see the same change, a client may reconnect after missing changes,
// and the very first thing Anvil sees is only a balance — not evidence that anybody just moved it.
// Keep those cases explicit here so the API can serialize storage without burying the money rules
// inside a transaction.

export type CofferObservationKind = 'snapshot' | 'deposit' | 'withdrawal';
export type CofferSyncOutcome = 'baseline' | 'movement' | 'duplicate' | 'reconciled';

export interface CofferObservation {
  kind: CofferObservationKind;
  beforeBalance: number;
  afterBalance: number;
  /** True only when this client saw the local player's matching game message. */
  actorConfirmed: boolean;
}

export interface CofferSyncDecision {
  outcome: CofferSyncOutcome;
  /** Signed movement to put in Anvil's ledger. Zero means no ledger row. */
  ledgerAmount: number;
  /** Whether the authenticated player may be named as the person who moved the gp. */
  attributeActor: boolean;
  nextBalance: number;
}

function directionMatches(kind: CofferObservationKind, amount: number): boolean {
  return (kind === 'deposit' && amount > 0) || (kind === 'withdrawal' && amount < 0);
}

export function decideCofferSync(
  knownBalance: number | null,
  observation: CofferObservation,
): CofferSyncDecision {
  const movement = observation.afterBalance - observation.beforeBalance;

  // A snapshot cannot prove where the existing coins came from. Remember it, but do not mint a
  // donation for whoever happened to install/open the plugin first.
  if (knownBalance == null && observation.kind === 'snapshot') {
    return { outcome: 'baseline', ledgerAmount: 0, attributeActor: false, nextBalance: observation.afterBalance };
  }

  // The same physical state from another observer (or a retried request with a fresh event key).
  if (knownBalance != null && knownBalance === observation.afterBalance) {
    return { outcome: 'duplicate', ledgerAmount: 0, attributeActor: false, nextBalance: knownBalance };
  }

  // The server agrees with what the client saw immediately before the action, so the delta is a
  // continuous movement. Attribution still needs the local player's matching in-game message.
  if (observation.kind !== 'snapshot' && (knownBalance == null || knownBalance === observation.beforeBalance)) {
    return {
      outcome: 'movement',
      ledgerAmount: movement,
      attributeActor: observation.actorConfirmed && directionMatches(observation.kind, movement),
      nextBalance: observation.afterBalance,
    };
  }

  // Something happened while no reporting client was looking (mobile, plugin off, or a lost POST).
  // Converge to the real balance, but never pretend the observing player caused the difference.
  const reconciliation = observation.afterBalance - (knownBalance ?? observation.beforeBalance);
  return {
    outcome: 'reconciled',
    ledgerAmount: reconciliation,
    attributeActor: false,
    nextBalance: observation.afterBalance,
  };
}

