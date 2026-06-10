'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Badge, statusVariant } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { PageSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Briefcase, Users, ShieldCheck, Laptop2, GraduationCap, FileCheck2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

function RecruitmentPanel() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.recruitment.jobs(), api.recruitment.applications()])
      .then(([j, a]) => {
        setJobs(Array.isArray(j) ? j : []);
        setApps(Array.isArray(a) ? a : []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton />;

  const inPipeline = apps.filter((a) => !['HIRED', 'REJECTED'].includes(a.status)).length;
  const hired = apps.filter((a) => a.status === 'HIRED').length;

  return (
    <div className="space-y-6">
      <div className="stagger grid gap-4 sm:grid-cols-3">
        <StatCard label="Open Roles" value={jobs.filter((j) => j.status === 'open').length} icon={Briefcase} tint="brand" />
        <StatCard label="In Pipeline" value={inPipeline} icon={Users} tint="sky" />
        <StatCard label="Hired" value={hired} icon={FileCheck2} tint="amber" />
      </div>
      <Card>
        <CardHeader><CardTitle>Candidates (pay & benefits hidden)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="data-table">
            <thead><tr><th>Candidate</th><th>Role</th><th>Stage</th><th>Applied</th></tr></thead>
            <tbody>
              {apps.slice(0, 20).map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar name={`${a.firstName} ${a.lastName}`} size="xs" />
                      <span className="font-medium">{a.firstName} {a.lastName}</span>
                    </div>
                  </td>
                  <td>{a.job?.title ?? '—'}</td>
                  <td><Badge variant={statusVariant(a.status)}>{a.status}</Badge></td>
                  <td className="tabular-nums">{formatDate(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function ItAssetsPanel() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.employees.list({ limit: '50' })
      .then((data) => setEmployees(Array.isArray(data) ? data : (data as any)?.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="stagger grid gap-4 sm:grid-cols-3">
        <StatCard label="Active Workers" value={employees.filter((e) => e.status === 'ACTIVE').length} icon={Users} tint="brand" />
        <StatCard label="To Provision" value={employees.filter((e) => e.status === 'PROBATION').length} icon={Laptop2} tint="amber" />
        <StatCard label="To Deprovision" value={employees.filter((e) => e.status === 'TERMINATED').length} icon={ShieldCheck} tint="rose" />
      </div>
      <Card>
        <CardHeader><CardTitle>Lifecycle & assignments (private files hidden)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="data-table">
            <thead><tr><th>Employee</th><th>Code</th><th>Department</th><th>Location</th><th>Status</th><th>Joined</th></tr></thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar name={`${e.firstName} ${e.lastName}`} size="xs" />
                      <span className="font-medium">{e.firstName} {e.lastName}</span>
                    </div>
                  </td>
                  <td className="tabular-nums">{e.employeeCode}</td>
                  <td>{e.department?.name ?? '—'}</td>
                  <td>{e.workLocation ?? '—'}</td>
                  <td><Badge variant={statusVariant(e.status)}>{e.status?.toLowerCase()}</Badge></td>
                  <td className="tabular-nums">{e.dateOfJoining ? formatDate(e.dateOfJoining) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function CompliancePanel() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.lms.courses()
      .then((data) => setCourses(Array.isArray(data) ? data : (data as any)?.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <p className="rounded-lg bg-sky-50 px-4 py-2 text-sm text-sky-800 dark:bg-sky-950 dark:text-sky-300">
        Read-only view for outside regulators — no editing access.
      </p>
      {courses.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No training programs" description="Courses and certifications will appear here for inspection." />
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-2">
          {courses.map((c) => {
            const total = c.enrollments?.length ?? c._count?.enrollments ?? 0;
            const completed = (c.enrollments ?? []).filter((e: any) => e.status === 'completed').length;
            const pct = total ? Math.round((completed / total) * 100) : 0;
            return (
              <Card key={c.id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{c.title}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{c.category ?? 'Training'} · {total} enrolled</p>
                    </div>
                    <Badge variant={pct === 100 ? 'success' : pct > 0 ? 'warning' : 'neutral'}>{pct}% complete</Badge>
                  </div>
                  <Progress value={pct} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

const PANELS: Record<string, { title: string; description: string; component: () => JSX.Element }> = {
  recruitment: {
    title: 'Recruitment Panel',
    description: 'ATS pipeline with employee pay histories and medical benefits hidden',
    component: RecruitmentPanel,
  },
  it_assets: {
    title: 'IT Asset Provisioning',
    description: 'Worker lifecycle, team assignments and equipment metadata for IT staff',
    component: ItAssetsPanel,
  },
  compliance: {
    title: 'Compliance Inspector',
    description: 'Safety certifications and training completion rates — strictly read-only',
    component: CompliancePanel,
  },
};

export default function ExtensionPanelPage() {
  const params = useParams<{ panel: string }>();
  const meta = PANELS[params.panel];

  if (!meta) {
    return (
      <div className="space-y-6">
        <PageHeader title="Unknown panel" backHref="/extensions" backLabel="Extensions" />
        <EmptyState title="This extension panel has no dedicated view yet" />
      </div>
    );
  }

  const Panel = meta.component;
  return (
    <div className="space-y-6">
      <PageHeader title={meta.title} description={meta.description} backHref="/extensions" backLabel="Extensions" />
      <Panel />
    </div>
  );
}
