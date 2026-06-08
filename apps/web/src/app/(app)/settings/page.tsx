'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sliders, GitBranch, Shield, ChevronRight } from 'lucide-react';

const settingsLinks = [
  { href: '/settings/custom-fields', label: 'Custom Fields', description: 'Define custom employee data fields', icon: Sliders },
  { href: '/settings/workflows', label: 'Workflows', description: 'Configure approval automation rules', icon: GitBranch },
  { href: '/settings/audit', label: 'Audit Log', description: 'Review system activity and changes', icon: Shield },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-[hsl(var(--muted-foreground))]">Configure your HRIS workspace</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {settingsLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href}>
              <Card className="transition-colors hover:border-brand-600/50 hover:bg-[hsl(var(--muted))]/50">
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className="rounded-lg bg-brand-600/10 p-2">
                    <Icon className="h-5 w-5 text-brand-600" />
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
