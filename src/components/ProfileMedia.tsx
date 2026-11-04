import type { CSSProperties } from 'react';

import type { ShownMedia, ShownProfileMedia } from '@/lib/profileMediaRules';

// A person's own avatar and banner (Anvil Supporter, lib/profileMediaRules).
//
// MOTION IS OPT-OUT FOR THE VIEWER, with no JavaScript: an animated picture is a <picture> whose
// reduced-motion source is the still frame, so somebody who asked their OS for less motion never
// sees it move. A page that shows many people at once passes the still in the first place (lists
// show still; only a person's own profile and card animate).

/** One stored picture, animated where allowed, still for reduced-motion viewers. */
export function MotionImage({
  media,
  alt = '',
  className,
  style,
  width,
  height,
  eager = false,
}: {
  media: ShownMedia;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  width?: number;
  height?: number;
  /** Above the fold on its own page; everything else loads lazily. */
  eager?: boolean;
}) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={media.src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
  if (!media.animated) return img;
  return (
    <picture>
      <source media="(prefers-reduced-motion: reduce)" srcSet={media.still} />
      {img}
    </picture>
  );
}

/** The banner across the top of a profile, cropped to a wide strip at the person's chosen focus. */
export function ProfileBanner({ banner, className = '' }: { banner: ShownProfileMedia['banner']; className?: string }) {
  if (!banner) return null;
  return (
    <div className={`overflow-hidden rounded-2xl border border-card-border bg-card-bg aspect-[3/1] sm:aspect-[4/1] ${className}`}>
      <MotionImage
        media={banner}
        eager
        className="h-full w-full object-cover"
        style={{ objectPosition: `50% ${banner.position}%` }}
      />
    </div>
  );
}

/** Their avatar in a round frame, or nothing (the caller keeps its own fallback). */
export function ProfileAvatar({
  avatar,
  size,
  className = '',
  eager = false,
}: {
  avatar: ShownProfileMedia['avatar'];
  size: number;
  className?: string;
  eager?: boolean;
}) {
  if (!avatar) return null;
  return (
    <MotionImage
      media={avatar}
      width={size}
      height={size}
      eager={eager}
      className={`shrink-0 rounded-full object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
