'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Briefcase, Laptop2, ShieldCheck, Wallet, GraduationCap, Puzzle, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const PANEL_META: Record<string, { name: string; description: string; scopes: string[]; icon: LucideIcon; openable: boolean }> = {
  recruitment: {
    name: 'Recruitment Panel',
    description: 'ATS and onboarding milestones without pay or benefits data',
    scopes: ['jobs', 'applications', 'onboarding'],
    icon: Briefcase,
    openable: true,
  },
  it_assets: {
    name: 'IT Asset Provisioning',
    description: 'Equipment and lifecycle actions for new hires',
    scopes: ['employees', 'equipment', 'assignments'],
    icon: Laptop2,
    openable: true,
  },
  compliance: {
    name: 'Compliance Inspector',
    description: 'Read-only safety certifications and training completion',
    scopes: ['certifications', 'training', 'audit'],
    icon: ShieldCheck,
    openable: true,
  },
  payroll: {
    name: 'Payroll Extension',
    description: 'Payroll runs and compensation (restricted)',
    scopes: ['payroll', 'compensation'],
    icon: Wallet,
    openable: false,
  },
  lms: {
    name: 'Learning Extension',
    description: 'Courses and training progress',
    scopes: ['courses', 'enrollments'],
    icon: GraduationCap,
    openable: false,
  },
};

export default function ExtensionsPage() {
  const [panels, setPanels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.extensions.list()
      .then((data) => {
        const panelIds: string[] = data?.panels ?? [];
        const access: any[] = data?.access ?? [];
        const items = panelIds.map((id) => {
          const meta = PANEL_META[id] ?? { name: id, description: 'Extension panel', scopes: [], icon: Puzzle, openable: false };
          const grants = access.filter((a) => a.panel === id);
          return { id, ...meta, grants };
        });
        setPanels(items);
      })
      .catch((err) => setError(err.message || 'Failed to load extensions'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Extensions"
        description="Specialized panels that expose one business area to non-HR staff without revealing private records"
      />

      {error ? (
        <EmptyState icon={Puzzle} title="Extensions unavailable" description={error} />
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {panels.map((ext) => {
            const Icon = ext.icon ?? Puzzle;
            const inner = (
              <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-brand-500/60 hover:shadow-lifted">
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className="rounded-xl bg-brand-100 p-2.5 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{ext.name}</CardTitle>
                  {ext.openable && <ChevronRight className="ml-auto h-4 w-4 text-[hsl(var(--muted-foreground))]" />}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">{ext.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {ext.scopes.map((m: string) => (
                      <span key={m} className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs">{m}</span>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
                    {ext.grants?.length ? `${ext.grants.length} access grant(s)` : ext.openable ? 'Open panel view →' : 'No access grants yet'}
                  </p>
                </CardContent>
              </Card>
            );
            return ext.openable ? (
              <Link key={ext.id} href={`/extensions/${ext.id}`}>{inner}</Link>
            ) : (
              <div key={ext.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
