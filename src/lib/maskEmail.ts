// Masks an email address for places many people read (the ops Discord channel, the daily digest).
// The lead itself is kept; the operator reaches the person by their Discord profile link, and the
// full address stays in the staff view (/staff/clans), where it is needed.
//
// "ahmed@example.com" -> "a***@example.com". The domain stays because it says whether this is a
// throwaway or a real inbox; the name part does not, because that is the identifying part.

export function maskEmail(email: string | null | undefined): string | null {
  const v = (email ?? '').trim();
  if (!v) return null;
  const at = v.lastIndexOf('@');
  if (at < 1 || at === v.length - 1) return '***';
  const first = Array.from(v.slice(0, at))[0];
  return `${first}***${v.slice(at)}`;
}
