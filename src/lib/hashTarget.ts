/**
 * The element id an address hash names: `#prizes` -> `prizes`, `#a%20b` -> `a b`, `` or `#` -> ''.
 * A malformed escape is looked for as typed. Pure, so the admin hash reveal can be tested without a DOM.
 */
export function hashTargetId(hash: string): string {
  const id = hash.replace(/^#/, '');
  if (!id) return '';
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}
