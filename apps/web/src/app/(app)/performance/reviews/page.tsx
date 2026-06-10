'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Badge, statusVariant } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Modal } from '@/components/ui/modal';
import { Avatar } from '@/components/ui/avatar';
import { ClipboardCheck, Users2, Plus, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

function StarRating({ value, onChange }: { value: number | null; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={cn('transition-transform', onChange && 'hover:scale-125')}
          aria-label={`${n} stars`}
        >
          <Star
            className={cn(
              'h-4 w-4',
              value != null && n <= value ? 'fill-amber-400 text-amber-400' : 'text-[hsl(var(--border))]',
            )}
          />
        </button>
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const [tab, setTab] = useState<'manager' | 'peer'>('manager');
  const [reviews, setReviews] = useState<any[]>([]);
  const [peerReviews, setPeerReviews] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ cycleId: '', employeeId: '', reviewerId: '', relationship: 'peer' });
  const [editing, setEditing] = useState<any>(null);
  const [editForm, setEditForm] = useState({ rating: 0, feedback: '' });

  const load = useCallback(() => {
    Promise.all([
      api.performance.reviews().catch(() => []),
      api.peerReviews.list().catch(() => []),
      api.performance.cycles().catch(() => []),
      api.employees.list({ limit: '100' }).catch(() => []),
    ])
      .then(([r, pr, c, e]) => {
        setReviews(Array.isArray(r) ? r : []);
        setPeerReviews(Array.isArray(pr) ? pr : []);
        setCycles(Array.isArray(c) ? c : []);
        const emps = Array.isArray(e) ? e : (e as any)?.data ?? [];
        setEmployees(emps);
        setError('');
      })
      .catch((err) => setError(err.message || 'Failed to load reviews'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const createReview = async () => {
    try {
      if (tab === 'manager') {
        await api.performance.createReview({ cycleId: form.cycleId, employeeId: form.employeeId, reviewerId: form.reviewerId });
      } else {
        await api.peerReviews.create({
          cycleId: form.cycleId,
          employeeId: form.employeeId,
          reviewerId: form.reviewerId,
          relationship: form.relationship,
        });
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const submitEdit = async () => {
    try {
      if (!editing) return;
      if (editing.__kind === 'manager') {
        await api.performance.submitReview(editing.id, { managerRating: editForm.rating, feedback: editForm.feedback, status: 'submitted' });
      } else {
        await api.peerReviews.update(editing.id, { rating: editForm.rating, feedback: editForm.feedback, status: 'submitted' });
      }
      setEditing(null);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <PageSkeleton />;

  const rows = tab === 'manager' ? reviews : peerReviews;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews & 360 Feedback"
        backHref="/performance"
        backLabel="Performance"
        description="Manager evaluations and anonymous peer feedback across review cycles"
        actions={
          <Button onClick={() => setModalOpen(true)} disabled={cycles.length === 0}>
            <Plus className="mr-2 h-4 w-4" /> New {tab === 'manager' ? 'Review' : '360 Request'}
          </Button>
        }
      />

      {error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>}
      {cycles.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          No review cycles exist yet — create one from the Performance page first.
        </p>
      )}

      <div className="flex w-fit gap-1 rounded-xl bg-[hsl(var(--muted))] p-1">
        {([['manager', 'Review Forms', ClipboardCheck], ['peer', '360 Peer Feedback', Users2]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-all',
              tab === key ? 'bg-[hsl(var(--card))] shadow-soft' : 'text-[hsl(var(--muted-foreground))]',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={tab === 'manager' ? ClipboardCheck : Users2}
          title={tab === 'manager' ? 'No reviews yet' : 'No 360 feedback requests yet'}
          description={tab === 'manager' ? 'Kick off a manager review for this cycle.' : 'Request anonymous peer feedback for an employee.'}
        />
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r: any) => {
            const emp = r.employee;
            const reviewer = r.reviewer;
            const rating = tab === 'manager' ? r.managerRating : r.rating;
            return (
              <Card key={r.id} className="transition-shadow hover:shadow-lifted">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={`${emp?.firstName ?? '?'} ${emp?.lastName ?? ''}`} size="sm" />
                      <div>
                        <p className="text-sm font-semibold">{emp?.firstName} {emp?.lastName}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                          {tab === 'peer' && r.isAnonymous ? 'Anonymous reviewer' : `by ${reviewer?.firstName ?? '—'} ${reviewer?.lastName ?? ''}`}
                          {tab === 'peer' && r.relationship ? ` · ${String(r.relationship).replace('_', ' ')}` : ''}
                        </p>
                      </div>
                    </div>
                    <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <StarRating value={rating ?? null} />
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{r.cycle?.name ?? ''}</span>
                  </div>
                  {r.feedback && <p className="line-clamp-3 text-sm text-[hsl(var(--muted-foreground))]">{r.feedback}</p>}
                  {r.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => {
                        setEditing({ ...r, __kind: tab });
                        setEditForm({ rating: rating ?? 0, feedback: r.feedback ?? '' });
                      }}
                    >
                      Write Review
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={tab === 'manager' ? 'New Manager Review' : 'New 360 Feedback Request'}>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Review cycle</label>
            <select className="input-base" value={form.cycleId} onChange={(e) => setForm({ ...form, cycleId: e.target.value })}>
              <option value="">Select…</option>
              {cycles.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Employee</label>
              <select className="input-base" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                <option value="">Select…</option>
                {employees.map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Reviewer</label>
              <select className="input-base" value={form.reviewerId} onChange={(e) => setForm({ ...form, reviewerId: e.target.value })}>
                <option value="">Select…</option>
                {employees.map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
          </div>
          {tab === 'peer' && (
            <div>
              <label className="mb-1 block text-sm font-medium">Relationship</label>
              <select className="input-base" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })}>
                <option value="peer">Peer</option>
                <option value="direct_report">Direct report</option>
                <option value="skip_level">Skip level</option>
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={createReview} disabled={!form.cycleId || !form.employeeId || !form.reviewerId}>Create</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Write Review" description="Score and share constructive feedback">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Rating</label>
            <StarRating value={editForm.rating || null} onChange={(v) => setEditForm({ ...editForm, rating: v })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Feedback</label>
            <textarea
              className="input-base min-h-[120px] resize-y py-2"
              placeholder="Strengths, growth areas, specific examples…"
              value={editForm.feedback}
              onChange={(e) => setEditForm({ ...editForm, feedback: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={submitEdit} disabled={!editForm.rating}>Submit Review</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
