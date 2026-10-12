'use client';

import { PageHeader } from '@/components/ui/page-header';
import { BillingPanel } from '@/components/billing/billing-panel';
import { useAuth } from '@/hooks/use-auth';

export default function BillingPage() {
  const { refresh } = useAuth();
  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Your plan, how to pay by bank transfer, and your receipts" />
      <BillingPanel onChanged={refresh} />
    </div>
  );
}
