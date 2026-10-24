/** Whether a lab session is still running — the same rule lib/lab applies on the server. */
export function sessionLive(s: { endDate: string | null; forceEndedAt: string | null }): boolean {
  return !s.forceEndedAt && (!s.endDate || Date.parse(s.endDate) > Date.now());
}
