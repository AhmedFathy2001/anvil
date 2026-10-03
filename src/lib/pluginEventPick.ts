/**
 * Pick the one event a RuneLite request may act on.
 *
 * The plugin schedule already carries upcoming boards. Event-scoped config, submissions and the
 * activity feed must only receive a board whose start whistle has actually gone, otherwise an
 * upcoming enrollment can display prepared completion rows and accept event-scoped traffic.
 */
export function pickActivePluginEvent<
  T extends {
    eventId: number;
    teamId: number | null;
    startDate: string | null;
    endDate: string | null;
    forceEndedAt: string | null;
  },
>(rows: T[], nowIso: string = new Date().toISOString()): T | null {
  const nowMs = Date.parse(nowIso);
  const active = rows.filter(
    (row) => {
      const startMs = row.startDate == null ? Number.NaN : Date.parse(row.startDate);
      const endMs = row.endDate == null ? null : Date.parse(row.endDate);
      return (
        row.teamId != null &&
        !row.forceEndedAt &&
        Number.isFinite(nowMs) &&
        Number.isFinite(startMs) &&
        startMs <= nowMs &&
        (endMs == null || (Number.isFinite(endMs) && endMs > nowMs))
      );
    },
  );

  // A member can be in more than one running event. The freshest start wins; the event id makes an
  // exact timestamp tie deterministic instead of relying on database row order.
  active.sort(
    (a, b) => Date.parse(b.startDate!) - Date.parse(a.startDate!) || b.eventId - a.eventId,
  );
  return active[0] ?? null;
}
