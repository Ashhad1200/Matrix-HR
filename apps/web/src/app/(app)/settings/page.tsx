'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import {
  Sliders, GitBranch, Shield, ChevronRight, KeyRound, Fingerprint, Globe2, MonitorSmartphone, BookOpen, Webhook, ScanFace, UserPlus, CalendarDays, CreditCard, Building2, Coins,
} from 'lucide-react';

const settingsLinks = [
  { href: '/settings/logins', label: 'Staff logins', description: 'Invite employees to sign in and choose their role', icon: UserPlus },
  { href: '/settings/structure', label: 'Departments & designations', description: 'Create, rename, import and remove your org structure', icon: Building2 },
  { href: '/settings/compensation', label: 'Pay components', description: 'Allowances, bonuses, arrears and deductions per employee', icon: Coins },
  { href: '/settings/leave', label: 'Leave setup', description: 'Leave types, yearly days, carry-forward and holidays', icon: CalendarDays },
  { href: '/billing', label: 'Billing', description: 'Your plan, bank-transfer payments and receipts', icon: CreditCard },
  { href: '/settings/audit', label: 'Audit Log', description: 'Review system activity and changes', icon: Shield },
  { href: '/settings/api-keys', label: 'API Keys', description: 'Tenant keys for the public REST API', icon: KeyRound },
  { href: '/settings/webhooks', label: 'Webhooks', description: 'Send signed event notifications to external systems', icon: Webhook },
  { href: '/settings/devices', label: 'Biometric devices', description: 'Register and monitor ZKTeco attendance terminals', icon: ScanFace },
  { href: '/settings/sso', label: 'Single Sign-On', description: 'SAML identity provider configuration', icon: Fingerprint },
  { href: '/settings/eor', label: 'Global Hiring (EOR)', description: 'Employer-of-record coverage in 150+ countries', icon: Globe2 },
  { href: '/kiosk', label: 'Kiosk Mode', description: 'Shared-device attendance clock for deskless teams', icon: MonitorSmartphone },
  { href: 'http://localhost:3001/api/docs', label: 'API Docs', description: 'OpenAPI reference for developers', icon: BookOpen },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Configure your HRIS workspace, integrations, and developer access" />

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {settingsLinks.map((link) => {
          const Icon = link.icon;
          const external = link.href.startsWith('http');
          return (
            <Link key={link.href} href={link.href} target={external ? '_blank' : undefined}>
              <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-brand-500/60 hover:shadow-lifted">
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className="rounded-xl bg-brand-100 p-2.5 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{link.label}</CardTitle>
                  <ChevronRight className="ml-auto h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">{link.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
