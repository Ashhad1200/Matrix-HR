'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { Avatar } from '@/components/ui/avatar';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const STAGES = ['APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'] as const;

const STAGE_TINTS: Record<string, string> = {
  APPLIED: 'border-t-sky-400',
  SCREENING: 'border-t-violet-400',
  SHORTLISTED: 'border-t-amber-400',
  INTERVIEW: 'border-t-orange-400',
  OFFER: 'border-t-brand-500',
  HIRED: 'border-t-emerald-500',
  REJECTED: 'border-t-rose-400',
};

export default function RecruitmentKanbanPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  useEffect(() => {
    api.recruitment.applications()
      .then((data) => setApplications(Array.isArray(data) ? data : (data as any)?.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function moveCard(id: string, status: string) {
    const prev = applications;
    setApplications((apps) => apps.map((a) => (a.id === id ? { ...a, status } : a)));
    try {
      await api.recruitment.updateApplicationStatus(id, status);
    } catch {
      setApplications(prev); // revert on failure
    }
  }

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="ATS Board"
        backHref="/recruitment"
        backLabel="Recruitment"
        description="Drag candidate cards through the hiring pipeline"
      />

      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const cards = applications.filter((a) => a.status === stage);
          const isOver = dragOver === stage;
          return (
            <div
              key={stage}
              className="w-[230px] flex-shrink-0"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(stage);
              }}
              onDragLeave={() => setDragOver((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                if (dragId) moveCard(dragId, stage);
                setDragId(null);
              }}
            >
              <div
                className={cn(
                  'flex h-full min-h-[300px] flex-col rounded-xl border border-t-4 bg-[hsl(var(--muted))]/40 transition-colors',
                  STAGE_TINTS[stage],
                  isOver ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40' : 'border-[hsl(var(--border))]',
                )}
              >
                <div className="flex items-center justify-between px-3 py-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider">{stage}</h3>
                  <span className="rounded-full bg-[hsl(var(--card))] px-2 py-0.5 text-xs font-semibold tabular-nums shadow-soft">
                    {cards.length}
                  </span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                  {cards.map((a) => (
                    <div
                      key={a.id}
                      draggable
                      onDragStart={() => setDragId(a.id)}
                      onDragEnd={() => { setDragId(null); setDragOver(null); }}
                      className={cn(
                        'cursor-grab rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 shadow-soft transition-all active:cursor-grabbing',
                        dragId === a.id ? 'rotate-2 opacity-60 shadow-lifted' : 'hover:-translate-y-0.5 hover:shadow-lifted',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar name={`${a.firstName} ${a.lastName}`} size="xs" />
                        <p className="truncate text-sm font-semibold">{a.firstName} {a.lastName}</p>
                      </div>
                      <p className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">{a.job?.title ?? '—'}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="truncate text-[10px] text-[hsl(var(--muted-foreground))]">{a.email}</span>
                        {a.score != null && (
                          <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-600">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />{a.score}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {cards.length === 0 && (
                    <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))]">
                      Drop here
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
