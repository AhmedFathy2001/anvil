/**
 * A clan's mark: its initials on a colour derived from its name.
 *
 * Deterministic, so a clan keeps the same colour on every surface and between requests without
 * anybody storing or choosing one. That matters more than it sounds once a person is in a dozen
 * clans — at that point the colour is how you find the right row, and a crest that changed between
 * the rail and the page would be worse than none.
 *
 * Saturation and lightness are fixed so every crest sits at the same weight against the dark ground;
 * only the hue moves.
 */
export default function ClanCrest({ name, size = 20 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;

  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded font-mono font-semibold text-brown-dark"
      style={{
        width: size,
        height: size,
        background: `hsl(${h} 34% 44%)`,
        fontSize: Math.max(8, Math.round(size * 0.42)),
      }}
    >
      {initials}
    </span>
  );
}
