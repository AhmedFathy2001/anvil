import { notFound } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import { libraryActor } from '@/lib/guideAccess';
import CategoryManager from '@/components/guides/CategoryManager';

export const metadata = { title: 'Guide categories' };

export default async function StaffCategoriesPage() {
  if (!(await libraryActor())) notFound();
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <ClanLink href="/staff/guides" className="text-xs text-text-muted hover:text-gold">
          ← Guide library
        </ClanLink>
        <h1 className="mt-1 text-2xl font-bold text-gold">Guide categories</h1>
        <p className="mt-1 text-sm text-text-muted">
          The categories every clan sees. Clans can add their own on top for their own guides. &quot;Needs every level&quot; means library
          guides in that category can&apos;t be published without Beginner, Intermediate and Advanced sections.
        </p>
      </div>
      <CategoryManager scope="platform" />
    </div>
  );
}
