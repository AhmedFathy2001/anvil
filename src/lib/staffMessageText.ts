// The words of a staff note to a clan's owner (lib/staffMessage sends it). Pure, so the dialog that
// drafts it and the route that sends it share one limit and one first draft.

export const STAFF_MESSAGE_MAX = 1500;

/** A first draft for the reason a clan is on the list, for staff to rewrite. Pure. */
export function ownerMessageDraft(clanName: string, why: string | null, welcome = false): string {
  // A NEW clan gets a hello, not a problem report: who is writing, and that a person will answer.
  if (welcome) {
    return `Hi, and welcome to Anvil. I run it, and I saw you just set up ${clanName}.\n\nIf anything in the setup is unclear or not working, reply here and I will sort it out with you. I would also like to hear what you are hoping to use it for.`;
  }
  const lead = `Hi, this is Anvil. I'm writing about ${clanName}.`;
  const ask = 'Is there anything I can help with? Reply here and I will pick it up.';
  return why ? `${lead}\n\n${why}.\n\n${ask}` : `${lead}\n\n${ask}`;
}
