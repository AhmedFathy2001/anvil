// The owner gate's decision, apart from how its inputs are read, so it is testable without a database.
// Allowed only on the apex, signed in, with the owner flag. Anything else — a support operator, a clan
// owner, a signed-out visitor, a clan host — is the same refusal.
export function ownerGate(i: { onApex: boolean; signedIn: boolean; isOwner: boolean }): boolean {
  return i.onApex && i.signedIn && i.isOwner === true;
}
