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
 *
 * A CLAN'S OWN IMAGE REPLACES IT, and nothing else changes. The generated crest is the floor rather
 * than a placeholder to be ashamed of: every clan has one from the moment it exists, so a clan that
 * has not uploaded anything is never an empty box, and one that has is simply itself.
 *
 * THE `letter` VARIANT is the second crest this codebase had. The nav switcher, the public clan home
 * and the co-host panel each carried a byte-identical copy of a different one — one initial on a
 * gradient keyed to the SLUG — so a clan uploading an image would have appeared in some places and
 * not others, and the gap would have stayed invisible until somebody noticed their logo missing from
 * a page they rarely open. Folded in here as a variant so there is one crest with two looks instead
 * of two crests.
 */
export default function ClanCrest({
  name,
  size = 20,
  logoUrl = null,
  variant = 'initials',
  slug = '',
  rounded,
  className = '',
}: {
  name: string;
  size?: number;
  /** The clan's own image, when it has uploaded one. */
  logoUrl?: string | null;
  /** 'initials' — two letters on a flat hue. 'letter' — one letter on a gradient keyed to the slug. */
  variant?: 'initials' | 'letter';
  /** Only read by the 'letter' variant, whose colour is the slug's rather than the name's. */
  slug?: string;
  /** Tailwind radius override — a nav chip and a hero badge want different corners. */
  rounded?: string;
  className?: string;
}) {
  const radius = rounded ?? (variant === 'letter' ? 'rounded-[5px]' : 'rounded');

  if (logoUrl) {
    return (
      // A plain <img>: these are object-storage URLs on a bucket next/image is not configured for,
      // and a crest is 18-48px, so the loader would cost more than it saves. `alt` is empty because
      // the clan's name is rendered beside it everywhere this appears — announcing it twice is noise.
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`shrink-0 object-cover ${radius} ${className}`}
      />
    );
  }

  if (variant === 'letter') {
    let lh = 0;
    for (let i = 0; i < slug.length; i++) lh = (lh * 31 + slug.charCodeAt(i)) % 360;
    return (
      <span
        aria-hidden
        className={`shrink-0 grid place-items-center font-bold text-white ${radius} ${className}`}
        style={{
          width: size,
          height: size,
          fontSize: size * 0.5,
          background: `linear-gradient(135deg, hsl(${lh} 42% 40%), hsl(${(lh + 34) % 360} 52% 54%))`,
        }}
      >
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }

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
      className={`grid shrink-0 place-items-center font-mono font-semibold text-brown-dark ${radius} ${className}`}
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
