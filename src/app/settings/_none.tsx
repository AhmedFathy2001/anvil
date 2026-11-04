import ClanLink from '@/components/ClanLink';

/** For a section that needs a character before it has anything to set. */
export function NeedsCharacter({ what }: { what: string }) {
  return (
    <div className="rounded-xl border border-dashed border-card-border bg-card-bg px-4 py-6 text-center text-sm text-text-muted">
      {what} start once you have a character linked.{' '}
      <ClanLink href="/settings/add" className="text-gold hover:text-gold-light">
        Add a character →
      </ClanLink>
    </div>
  );
}
