/**
 * Requests the facts route built itself, after judging the facts on the site (lib/pluginFacts/match).
 *
 * A conditioned tile (lib/tileConditions: a raid tile, a start count, a ToA level) is only ever
 * credited from facts the site has judged. The submissions route can't tell that from the auth alone,
 * since the facts route files with the caller's own plugin token, so the facts route marks the very
 * Request object it hands in. Held weakly and in-process: a request from the network is a new object
 * and can never be in here, whatever headers it carries.
 */
const judged = new WeakSet<Request>();

export function markJudged(request: Request): Request {
  judged.add(request);
  return request;
}

export function isJudged(request: Request): boolean {
  return judged.has(request);
}
