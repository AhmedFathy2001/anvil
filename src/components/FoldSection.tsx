'use client';

import { useState, type ReactNode } from 'react';

import ItemSlot, { type SpriteName } from '@/components/ItemSlot';
import { useRevealTarget } from '@/components/HashReveal';

/**
 * A settings section folded down to one line: what it is, and a summary of what it does now.
 * Long settings pages (Discord, Rules & scoring) read as a list of these, so an admin sees the
 * whole page at a glance and opens only the part they came for. `id` makes it deep-linkable
 * (#fees opens on fees).
 *
 * THE BODY IS NOT BUILT UNTIL THE FOLD IS OPENED. A closed <details> still puts all of its children
 * in the page, so Rules & scoring drew nearly three thousand elements (and every setting inside
 * fetched its value) for four closed rows. A link to a line inside a closed fold asks for it through
 * `useRevealTarget`, which builds the body so the line exists to be found and opened.
 */
export default function FoldSection({
  id,
  sprite,
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  id?: string;
  sprite: SpriteName;
  title: string;
  summary: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [built, setBuilt] = useState(defaultOpen);
  useRevealTarget((target) => {
    if (built) return;
    // Its own id, or an id nothing on the page has yet: a line inside a closed fold.
    if (target === id || !document.getElementById(target)) setBuilt(true);
  });
  return (
    <details
      id={id}
      open={defaultOpen}
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) setBuilt(true);
      }}
      className="group scroll-mt-24 rounded-xl border border-[#2e251d] bg-[#18130f]"
    >
      <summary className="cursor-pointer list-none flex items-center gap-3.5 px-5 py-4 [&::-webkit-details-marker]:hidden group-open:border-b group-open:border-[#2a221b]">
        <ItemSlot name={sprite} size={40} />
        <span className="min-w-0 flex-1">
          <span className="display block text-xl font-semibold">{title}</span>
          <span className="block text-sm text-text-muted">{summary}</span>
        </span>
        <span aria-hidden="true" className="text-lg text-text-dim transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="p-5 space-y-6">{built ? children : null}</div>
    </details>
  );
}
