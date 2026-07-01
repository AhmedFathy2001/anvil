import { redirect } from 'next/navigation';
import { verifyUser } from '@/lib/auth';
import { getSetupStatus } from '@/lib/setupStatus';
import SetupWizardClient from './SetupWizardClient';

export const dynamic = 'force-dynamic';

// First-run guided setup. Admin-only — it writes clan-wide settings, and the settings API
// itself is admin-gated, so mods/editors are bounced to their dashboard.
export default async function SetupPage() {
  const session = await verifyUser();
  if (!session) redirect('/admin');
  if (session.role !== 'admin') redirect('/admin/dashboard');

  const status = await getSetupStatus();
  return <SetupWizardClient initial={status.values} />;
}
