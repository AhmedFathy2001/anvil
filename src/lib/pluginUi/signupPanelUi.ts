import { button, muted, row, type Action, type Node } from './nodes';
import { CARD_W, FAINT, GREEN, chip, section, small, title } from './sections';

// The side panel's sign-up pieces that are only drawing (no database), for homeUi's pages. The reads
// and the writes behind them are lib/pluginUi/signupPanel.

export interface BingoSignupState {
  open: boolean;
  /** Why it can't be signed up for now; null when open. */
  reason: string | null;
  /** The person's own entry: null when not signed up. */
  status: 'pending' | 'approved' | null;
  /** Their entry can still be taken back by them (open, no draft yet). */
  canWithdraw: boolean;
  /** A form is there to fill (a seat to sign up with). False: say why instead. */
  canSign: boolean;
  noSeat: boolean;
  /** Who's signed up, when the host shows the list (rules.signupFields.publicList); else null. */
  names: string[] | null;
  count: number;
}

/** The scheduled page's sign-up card: the button to the form, your entry, and (when shown) who's in. */
export function bingoSignupCard(s: BingoSignupState, eventId: number, backTo: string, backLabel: string, clan: string): Node | null {
  const form: Action = { a: 'load', v: 'event-signup', args: { event: String(eventId), back: backTo, backLabel, clan } };
  const out: Node[] = [];
  if (s.status) {
    out.push(row(chip(s.status === 'approved' ? 'Signed up ✓' : 'Signed up', s.status === 'approved' ? 'green' : 'gold'), s.status === 'pending' ? muted('waiting for the host') : undefined, undefined, { gap: 6 }));
    const acts: Node[] = [];
    if (s.open) acts.push(button('Edit answers', form, 'Change what you told the host'));
    if (s.canWithdraw) acts.push(button('Withdraw', { a: 'post', act: 'event-withdraw', args: { event: String(eventId), back: backTo, backLabel, clan } }, 'Take your name off this event'));
    if (acts.length) out.push({ t: 'grid', cols: acts.length, gap: 6, c: acts });
  } else if (s.open && s.canSign) {
    out.push(button('Sign up', form, 'Answer the host’s questions here and you’re in'));
  } else if (s.open && s.noSeat) {
    out.push(muted('Link a verified account in this clan to sign up.', { wrap: CARD_W }));
  } else if (!s.open && s.reason) {
    out.push(small(s.reason, FAINT, { wrap: CARD_W }));
  }
  if (s.names) {
    out.push(title(`Signed up · ${s.count}`));
    out.push(s.names.length ? muted(s.names.slice(0, 40).join(', ') + (s.names.length > 40 ? ` +${s.names.length - 40}` : ''), { wrap: CARD_W }) : muted('Nobody yet — be the first.'));
  }
  return out.length ? section(out) : null;
}

export interface WeeklyEntryState {
  entered: boolean;
  optedOut: boolean;
}

/** "You're in · Opt out" / "You've opted out · Opt back in" on a weekly's page. */
export function weeklyEntryRow(s: WeeklyEntryState, competitionId: number, upcoming: boolean): Node {
  const post: Action = { a: 'post', act: 'weekly-opt', args: { id: String(competitionId), out: s.optedOut ? '0' : '1' } };
  return row(
    s.optedOut ? chip('Opted out', 'gold') : chip(upcoming ? 'Entered ✓' : 'You’re in ✓', 'green'),
    undefined,
    small(s.optedOut ? 'Opt back in' : 'Opt out', s.optedOut ? GREEN : FAINT, { on: post, tip: s.optedOut ? 'Count me in again' : upcoming ? 'Leave this one out before it starts' : 'Take me off the board' }),
    { gap: 6 },
  );
}

