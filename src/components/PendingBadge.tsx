/** The count of things waiting on a platform operator (lib/staffPending), worn by the Platform link. */
export default function PendingBadge({ count, title }: { count: number; title: string }) {
  return (
    <span
      title={title}
      aria-label={`${count} waiting: ${title}`}
      className="ml-auto rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-yellow-400"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
