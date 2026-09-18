'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDate } from '@/lib/utils';

type ExpenseStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REIMBURSED' | 'CANCELLED';
type ExpenseCategory = { id: string; name: string; maxAmountPerItem: string | null; requiresReceipt: boolean; isActive: boolean };
type ExpenseItem = { id: string; categoryId: string; date: string; amount: string | number; description: string; receiptUrl: string | null; category: { id: string; name: string } };
type Approval = { action: 'APPROVE' | 'REJECT'; actorRole: string; comment?: string | null; createdAt: string };
type ExpenseClaim = {
  id: string; employeeId: string; title: string; description: string | null; status: ExpenseStatus;
  totalAmount: string | number; currency: string; submittedAt: string | null; decidedAt: string | null;
  decisionNote: string | null; reimbursedAt: string | null; reimbursedInPeriod: string | null;
  employee: { id: string; firstName: string; lastName: string; employeeCode: string; managerId: string | null };
  items: ExpenseItem[];
  approvals?: { status: 'pending' | 'approved' | 'rejected'; awaitingRole: 'MANAGER' | 'HR_MANAGER' | null; history: Approval[] } | null;
};
type ItemDraft = { categoryId: string; date: string; amount: string; description: string; receiptUrl: string; uploading: boolean };

const INPUT_CLASS = 'h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm';
const TEXTAREA_CLASS = 'min-h-20 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm';
const STATUSES: ExpenseStatus[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REIMBURSED', 'CANCELLED'];

function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function emptyItem(): ItemDraft {
  return { categoryId: '', date: today(), amount: '', description: '', receiptUrl: '', uploading: false };
}

function label(value: string | null | undefined) {
  return value ? value.toLowerCase().replaceAll('_', ' ') : '—';
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}

function ClaimTable({ claims, onView, onEdit, onSubmit, onDelete, onCancel, busy }: {
  claims: ExpenseClaim[]; onView: (id: string) => void; onEdit?: (claim: ExpenseClaim) => void;
  onSubmit?: (id: string) => void; onDelete?: (id: string) => void; onCancel?: (id: string) => void; busy: boolean;
}) {
  if (!claims.length) return <p className="py-4 text-sm text-[hsl(var(--muted-foreground))]">No claims found.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-sm">
        <thead><tr className="border-b text-left text-[hsl(var(--muted-foreground))]"><th className="p-3">Title</th><th className="p-3">Total</th><th className="p-3">Status</th><th className="p-3">Submitted</th><th className="p-3">Actions</th></tr></thead>
        <tbody>{claims.map((claim) => (
          <tr key={claim.id} data-testid="expense-claim-row" className="border-b border-[hsl(var(--border))]">
            <td className="p-3 font-medium">{claim.title}</td>
            <td className="p-3">{formatCurrency(Number(claim.totalAmount), claim.currency)}</td>
            <td className="p-3"><Badge variant={statusVariant(claim.status)}>{label(claim.status)}</Badge></td>
            <td className="p-3">{claim.submittedAt ? formatDate(claim.submittedAt) : '—'}</td>
            <td className="p-3"><div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => onView(claim.id)}>View</Button>
              {claim.status === 'DRAFT' && onEdit && <Button size="sm" variant="secondary" onClick={() => onEdit(claim)}>Edit</Button>}
              {claim.status === 'DRAFT' && onSubmit && <Button size="sm" disabled={busy} onClick={() => onSubmit(claim.id)}>Submit</Button>}
              {claim.status === 'DRAFT' && onDelete && <Button size="sm" variant="danger" disabled={busy} onClick={() => onDelete(claim.id)}>Delete</Button>}
              {claim.status === 'SUBMITTED' && onCancel && <Button size="sm" variant="secondary" disabled={busy} onClick={() => onCancel(claim.id)}>Cancel</Button>}
            </div></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export default function ExpensesPage() {
  const { user } = useAuth();
  const portal = user?.permissions.portal;
  const canApprove = portal === 'manager' || portal === 'admin';
  const isAdmin = portal === 'admin';
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [allCategories, setAllCategories] = useState<ExpenseCategory[]>([]);
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [inbox, setInbox] = useState<ExpenseClaim[]>([]);
  const [allClaims, setAllClaims] = useState<ExpenseClaim[]>([]);
  const [selected, setSelected] = useState<ExpenseClaim | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [decisionComment, setDecisionComment] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryForm, setCategoryForm] = useState({ name: '', maxAmountPerItem: '', requiresReceipt: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [categoryData, claimData] = await Promise.all([
        api.expenses.categories() as Promise<ExpenseCategory[]>,
        api.expenses.claims() as Promise<ExpenseClaim[]>,
      ]);
      setCategories(categoryData);
      setClaims(user.employeeId ? claimData.filter((claim) => claim.employeeId === user.employeeId) : claimData);
      if (canApprove) setInbox(await api.expenses.inbox() as ExpenseClaim[]);
      if (isAdmin) {
        const [adminClaims, categoryList] = await Promise.all([
          api.expenses.claims(statusFilter ? { status: statusFilter } : undefined) as Promise<ExpenseClaim[]>,
          api.expenses.categories(true) as Promise<ExpenseCategory[]>,
        ]);
        setAllClaims(adminClaims);
        setAllCategories(categoryList);
      }
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }, [canApprove, isAdmin, statusFilter, user]);

  useEffect(() => { void loadData(); }, [loadData]);

  async function viewClaim(id: string) {
    setError('');
    try { setSelected(await api.expenses.get(id) as ExpenseClaim); } catch (err) { setError(message(err)); }
  }

  function editClaim(claim: ExpenseClaim) {
    setEditingId(claim.id);
    setTitle(claim.title);
    setDescription(claim.description ?? '');
    setItems(claim.items.map((item) => ({ categoryId: item.categoryId, date: item.date.slice(0, 10), amount: String(item.amount), description: item.description, receiptUrl: item.receiptUrl ?? '', uploading: false })));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId(null); setTitle(''); setDescription(''); setItems([emptyItem()]);
  }

  function payloadItems() {
    return items.map(({ categoryId, date, amount, description: itemDescription, receiptUrl }) => ({
      categoryId, date, amount: Number(amount), description: itemDescription.trim(), ...(receiptUrl ? { receiptUrl } : {}),
    }));
  }

  async function saveDraft(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = { title: title.trim(), description: description.trim() || undefined, items: payloadItems() };
      const saved = editingId
        ? await api.expenses.update(editingId, data) as ExpenseClaim
        : await api.expenses.create(data) as ExpenseClaim;
      setEditingId(saved.id); setSelected(saved); await loadData();
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }

  async function act(id: string, action: () => Promise<unknown>, clearForm = false, clearSelected = false) {
    setBusy(true); setError('');
    try {
      const result = await action();
      if (result && typeof result === 'object' && 'id' in result) setSelected(result as ExpenseClaim);
      if (clearForm) resetForm();
      if (clearSelected) setSelected(null);
      await loadData();
      if (selected?.id === id && !clearForm && !clearSelected) await viewClaim(id);
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }

  async function uploadReceipt(index: number, file: File) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, uploading: true } : item));
    setError('');
    try {
      const { url } = await api.uploads.upload(file);
      setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, receiptUrl: url, uploading: false } : item));
    } catch (err) {
      setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, uploading: false } : item));
      setError(message(err));
    }
  }

  async function toggleCategory(category: ExpenseCategory) {
    setBusy(true); setError('');
    try {
      await api.expenses.updateCategory(category.id, { isActive: !category.isActive });
      await loadData();
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }

  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const selectedInInbox = selected ? inbox.some((item) => item.id === selected.id) : false;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Expenses &amp; reimbursements</h1><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Claims are approved by your manager, then HR. Approved claims are reimbursed automatically with the next payroll run.</p></div>
      {error && <p data-testid="expense-error" className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>}

      <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>{editingId ? 'Edit draft' : 'New claim'}</CardTitle>{editingId && <Button type="button" variant="ghost" size="sm" onClick={resetForm}>New claim</Button>}</CardHeader><CardContent>
        <form data-testid="expense-form" className="space-y-5" onSubmit={saveDraft}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">Title<Input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
            <label className="space-y-1 text-sm font-medium sm:col-span-2">Description (optional)<textarea className={TEXTAREA_CLASS} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          </div>
          <div className="space-y-4">
            {items.map((item, index) => {
              const category = categories.find((entry) => entry.id === item.categoryId);
              return <div key={index} data-testid="expense-item-row" className="rounded-xl border border-[hsl(var(--border))] p-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="space-y-1 text-sm font-medium">Category<select className={INPUT_CLASS} value={item.categoryId} onChange={(event) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, categoryId: event.target.value } : entry))} required><option value="">Select category</option>{categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select>{category && <span className="block text-xs font-normal text-[hsl(var(--muted-foreground))]">{category.maxAmountPerItem ? `Max ${formatCurrency(Number(category.maxAmountPerItem))} per item` : 'No per-item maximum'}{category.requiresReceipt ? ' · Receipt required' : ''}</span>}</label>
                  <label className="space-y-1 text-sm font-medium">Date<Input type="date" max={today()} value={item.date} onChange={(event) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, date: event.target.value } : entry))} required /></label>
                  <label className="space-y-1 text-sm font-medium">Amount<Input type="number" min="0.01" step="0.01" value={item.amount} onChange={(event) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, amount: event.target.value } : entry))} required /></label>
                  <label className="space-y-1 text-sm font-medium">Receipt {category?.requiresReceipt ? '' : '(optional)'}<Input type="file" accept="image/*,.pdf" required={Boolean(category?.requiresReceipt && !item.receiptUrl)} disabled={item.uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadReceipt(index, file); }} />{item.uploading && <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">Uploading…</span>}{item.receiptUrl && <a className="block text-xs font-normal text-brand-600 hover:underline" href={item.receiptUrl} target="_blank" rel="noreferrer">Receipt uploaded</a>}</label>
                  <label className="space-y-1 text-sm font-medium sm:col-span-2 lg:col-span-3">Item description<Input value={item.description} onChange={(event) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, description: event.target.value } : entry))} required /></label>
                  <div className="flex items-end">{items.length > 1 && <Button type="button" size="sm" variant="ghost" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove item</Button>}</div>
                </div>
              </div>;
            })}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Button type="button" variant="secondary" onClick={() => setItems((current) => [...current, emptyItem()])}>Add item</Button><p className="font-semibold">Running total: {formatCurrency(total)}</p></div>
          <div className="flex flex-wrap gap-2"><Button data-testid="expense-save-draft" type="submit" disabled={busy || items.some((item) => item.uploading)}>{busy ? 'Saving…' : 'Save draft'}</Button>{editingId && <><Button data-testid="expense-submit" type="button" disabled={busy} onClick={() => void act(editingId, () => api.expenses.submit(editingId), true)}>Submit for approval</Button><Button type="button" variant="danger" disabled={busy} onClick={() => { if (window.confirm('Delete this draft claim?')) void act(editingId, () => api.expenses.remove(editingId), true, true); }}>Delete draft</Button></>}</div>
        </form>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>My claims</CardTitle></CardHeader><CardContent>{loading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading claims…</p> : <ClaimTable claims={claims} onView={(id) => void viewClaim(id)} onEdit={editClaim} onSubmit={(id) => void act(id, () => api.expenses.submit(id))} onDelete={(id) => { if (window.confirm('Delete this draft claim?')) void act(id, () => api.expenses.remove(id), editingId === id, selected?.id === id); }} onCancel={(id) => { if (window.confirm('Cancel this submitted claim?')) void act(id, () => api.expenses.cancel(id)); }} busy={busy} />}</CardContent></Card>

      {canApprove && <Card><CardHeader><CardTitle>Awaiting my approval</CardTitle></CardHeader><CardContent><ClaimTable claims={inbox} onView={(id) => void viewClaim(id)} busy={busy} /></CardContent></Card>}

      {selected && <Card><CardHeader className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between"><div><CardTitle>{selected.title}</CardTitle><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{selected.employee.firstName} {selected.employee.lastName} · {selected.employee.employeeCode}</p></div><Badge data-testid="expense-status" variant={statusVariant(selected.status)}>{label(selected.status)}</Badge></CardHeader><CardContent className="space-y-5">
        {selected.description && <p className="text-sm">{selected.description}</p>}
        <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="border-b text-left text-[hsl(var(--muted-foreground))]"><th className="p-3">Date</th><th className="p-3">Category</th><th className="p-3">Description</th><th className="p-3">Receipt</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>{selected.items.map((item) => <tr key={item.id} className="border-b border-[hsl(var(--border))]"><td className="p-3">{formatDate(item.date)}</td><td className="p-3">{item.category.name}</td><td className="p-3">{item.description}</td><td className="p-3">{item.receiptUrl ? <a className="text-brand-600 hover:underline" href={item.receiptUrl} target="_blank" rel="noreferrer">View receipt</a> : '—'}</td><td className="p-3 text-right font-medium">{formatCurrency(Number(item.amount), selected.currency)}</td></tr>)}</tbody><tfoot><tr><th colSpan={4} className="p-3 text-right">Total</th><td className="p-3 text-right font-bold">{formatCurrency(Number(selected.totalAmount), selected.currency)}</td></tr></tfoot></table></div>
        {selected.decisionNote && <p className="rounded-lg bg-[hsl(var(--muted))] p-3 text-sm"><span className="font-medium">Decision note:</span> {selected.decisionNote}</p>}
        {selected.approvals && <section className="space-y-3"><div><h2 className="font-semibold">Approval history</h2>{selected.approvals.awaitingRole && <p className="text-sm text-[hsl(var(--muted-foreground))]">Waiting for: {label(selected.approvals.awaitingRole)}</p>}</div>{selected.approvals.history.length ? <ul className="space-y-2 text-sm">{selected.approvals.history.map((entry, index) => <li key={`${entry.createdAt}-${index}`} className="rounded-lg border border-[hsl(var(--border))] p-3"><span className="font-medium">{label(entry.actorRole)} · {label(entry.action)}</span><span className="ml-2 text-[hsl(var(--muted-foreground))]">{formatDate(entry.createdAt)}</span>{entry.comment && <p className="mt-1">{entry.comment}</p>}</li>)}</ul> : <p className="text-sm text-[hsl(var(--muted-foreground))]">No decisions recorded yet.</p>}</section>}
        {selectedInInbox && <div className="space-y-3 rounded-lg border border-[hsl(var(--border))] p-4"><label className="block space-y-1 text-sm font-medium">Comment (optional)<Input value={decisionComment} onChange={(event) => setDecisionComment(event.target.value)} /></label><div className="flex gap-2"><Button data-testid="expense-approve" disabled={busy} onClick={() => void act(selected.id, () => api.expenses.decide(selected.id, 'APPROVE', decisionComment.trim() || undefined))}>Approve</Button><Button data-testid="expense-reject" variant="danger" disabled={busy} onClick={() => void act(selected.id, () => api.expenses.decide(selected.id, 'REJECT', decisionComment.trim() || undefined))}>Reject</Button></div></div>}
      </CardContent></Card>}

      {isAdmin && <><Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><CardTitle>All claims</CardTitle><label className="text-sm font-medium">Status <select className={`${INPUT_CLASS} mt-1 sm:w-48`} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label></div></CardHeader><CardContent><ClaimTable claims={allClaims} onView={(id) => void viewClaim(id)} busy={busy} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Categories</CardTitle></CardHeader><CardContent className="space-y-5"><form data-testid="category-form" className="grid gap-4 sm:grid-cols-4 sm:items-end" onSubmit={async (event) => { event.preventDefault(); setBusy(true); setError(''); try { await api.expenses.createCategory({ name: categoryForm.name.trim(), ...(categoryForm.maxAmountPerItem ? { maxAmountPerItem: Number(categoryForm.maxAmountPerItem) } : {}), requiresReceipt: categoryForm.requiresReceipt }); setCategoryForm({ name: '', maxAmountPerItem: '', requiresReceipt: false }); await loadData(); } catch (err) { setError(message(err)); } finally { setBusy(false); } }}><label className="space-y-1 text-sm font-medium sm:col-span-2">Name<Input value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} required /></label><label className="space-y-1 text-sm font-medium">Max per item (optional)<Input type="number" min="0.01" step="0.01" value={categoryForm.maxAmountPerItem} onChange={(event) => setCategoryForm({ ...categoryForm, maxAmountPerItem: event.target.value })} /></label><div className="space-y-3"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={categoryForm.requiresReceipt} onChange={(event) => setCategoryForm({ ...categoryForm, requiresReceipt: event.target.checked })} />Requires receipt</label><Button type="submit" disabled={busy}>Add category</Button></div></form><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="border-b text-left text-[hsl(var(--muted-foreground))]"><th className="p-3">Name</th><th className="p-3">Maximum</th><th className="p-3">Receipt</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>{allCategories.map((category) => <tr key={category.id} data-testid="category-row" className="border-b border-[hsl(var(--border))]"><td className="p-3 font-medium">{category.name}</td><td className="p-3">{category.maxAmountPerItem ? formatCurrency(Number(category.maxAmountPerItem)) : '—'}</td><td className="p-3">{category.requiresReceipt ? 'Required' : 'Optional'}</td><td className="p-3"><Badge variant={category.isActive ? 'success' : 'neutral'}>{category.isActive ? 'Active' : 'Inactive'}</Badge></td><td className="p-3"><Button size="sm" variant="secondary" disabled={busy} onClick={() => void toggleCategory(category)}>{category.isActive ? 'Deactivate' : 'Activate'}</Button></td></tr>)}</tbody></table></div></CardContent></Card></>}
    </div>
  );
}
