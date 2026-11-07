'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

import { Segmented } from '@/app/admin/events/[eventId]/settings/controls';
import { withBilling, type BillingInterval } from '@/lib/billingInterval';

/**
 * Monthly / Yearly for the whole of /pricing. The choice lives in the URL (?billing=yearly) and the
 * page is rendered from it on the server, so every price and every button's destination follow one
 * switch, and a link (the admin "Compare plans") can open it on yearly.
 */
export default function BillingSwitch({ value }: { value: BillingInterval }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const q = params.toString();
  return (
    <div className={pending ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
      <Segmented<BillingInterval>
        label="Billing"
        value={value}
        showHint={false}
        options={[
          { value: 'monthly', label: 'Monthly' },
          { value: 'yearly', label: 'Yearly · 2 months free' },
        ]}
        onChange={(v) =>
          start(() => {
            router.replace(withBilling(`${pathname}${q ? `?${q}` : ''}${window.location.hash}`, v), { scroll: false });
          })
        }
      />
    </div>
  );
}
