'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { TEXTAREA_CLASS } from '@/components/ui/field';

type Kind = 'department' | 'designation';

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return <div><label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>{children}{hint && <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{hint}</p>}</div>;
}

const SELECT = 'h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-transparent px-3 text-sm';

/** CSV-ish paste: "name, parent" for departments, "name, grade, department" for designations. */
function parseRows(kind: Kind, text: string) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [a, b, c] = l.split(',').map((x) => x.trim());
    return kind === 'department' ? { name: a, parent: b || undefined } : { name: a, grade: b || undefined, department: c || undefined };
  });
}

export default function StructurePage() {
  const [depts, setDepts] = useState<any[] | null>(null);
  const [desigs, setDesigs] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [edit, setEdit] = useState<{ kind: Kind; item: any } | null>(null);
  const [form, setForm] = useState<any>({});
  const [importing, setImporting] = useState<Kind | null>(null);
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const [d, g] = await Promise.all([api.employees.departments(), api.employees.designations()]); setDepts(d); setDesigns(g); }
    catch (e: any) { setError(e.message); }
  }, []);
  const setDesigns = setDesigs;
  useEffect(() => { load(); }, [load]);

  function open(kind: Kind, item: any = {}) {
    setError(''); setEdit({ kind, item });
    setForm(kind === 'department'
      ? { name: item.name ?? '', parentId: item.parentId ?? '' }
      : { name: item.name ?? '', grade: item.grade ?? '', departmentId: item.departmentId ?? '' });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!edit) return; setBusy(true); setError('');
    try {
      const { kind, item } = edit;
      if (kind === 'department') {
        if (item.id) await api.employees.updateDepartment(item.id, { name: form.name, parentId: form.parentId || null });
        else await api.employees.createDepartment({ name: form.name, ...(form.parentId ? { parentId: form.parentId } : {}) });
      } else if (item.id) {
        await api.employees.updateDesignation(item.id, { name: form.name, grade: form.grade || null, departmentId: form.departmentId || null });
      } else {
        await api.employees.createDesignation({ name: form.name, ...(form.grade ? { grade: form.grade } : {}), ...(form.departmentId ? { departmentId: form.departmentId } : {}) });
      }
      setNotice('Saved.'); setEdit(null); await load();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }

  async function remove(kind: Kind, item: any) {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    setError(''); setNotice('');
    try {
      await (kind === 'department' ? api.employees.deleteDepartment(item.id) : api.employees.deleteDesignation(item.id));
      setNotice(`${item.name} deleted.`); await load();
    } catch (err: any) { setError(err.message); }
  }

  async function runImport(e: React.FormEvent) {
    e.preventDefault(); if (!importing) return; setBusy(true); setError('');
    try {
      const rows = parseRows(importing, csv);
      const r = await (importing === 'department' ? api.employees.importDepartments(rows) : api.employees.importDesignations(rows as any));
      setNotice(`Imported ${r.created} new, skipped ${r.skipped} that already exist${r.errors?.length ? `; ${r.errors.length} rows had problems: ${r.errors.map((x: any) => x.message ?? x).join('; ')}` : ''}.`);
      setImporting(null); setCsv(''); await load();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }

  if (!depts) return <PageSkeleton />;
  const deptName = (id?: string | null) => depts.find((d) => d.id === id)?.name ?? '—';

  return (
    <div className="space-y-6">
      <PageHeader title="Departments & designations" description="The structure every employee is placed in. A department or designation cannot be deleted while people still use it."
        backHref="/settings" backLabel="Settings" />
      {error && !edit && !importing && <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{notice}</p>}

      <Card>
        <CardHeader className="!flex-row items-center justify-between space-y-0">
          <CardTitle>Departments</CardTitle>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setError(''); setImporting('department'); }}><Upload className="h-4 w-4" aria-hidden="true" /> Import</Button>
            <Button onClick={() => open('department')}><Plus className="h-4 w-4" aria-hidden="true" /> New department</Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {depts.length === 0 ? <EmptyState title="No departments yet" description="Add one, or import a list." /> : (
            <table className="data-table" data-testid="departments-table">
              <thead><tr><th>Name</th><th>Parent</th><th className="text-right">People</th><th /></tr></thead>
              <tbody>{depts.map((d) => (
                <tr key={d.id}>
                  <td className="font-medium">{d.name}</td><td>{deptName(d.parentId)}</td><td className="text-right tabular-nums">{d._count?.employees ?? 0}</td>
                  <td className="whitespace-nowrap text-right">
                    <Button size="sm" variant="secondary" onClick={() => open('department', d)}>Edit</Button>{' '}
                    <Button size="sm" variant="ghost" onClick={() => remove('department', d)}>Delete</Button>
                  </td>
                </tr>))}</tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="!flex-row items-center justify-between space-y-0">
          <CardTitle>Designations</CardTitle>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setError(''); setImporting('designation'); }}><Upload className="h-4 w-4" aria-hidden="true" /> Import</Button>
            <Button onClick={() => open('designation')}><Plus className="h-4 w-4" aria-hidden="true" /> New designation</Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {desigs.length === 0 ? <EmptyState title="No designations yet" description="Add job titles such as Accountant or Team Lead." /> : (
            <table className="data-table" data-testid="designations-table">
              <thead><tr><th>Title</th><th>Grade</th><th>Department</th><th className="text-right">People</th><th /></tr></thead>
              <tbody>{desigs.map((g) => (
                <tr key={g.id}>
                  <td className="font-medium">{g.name}</td><td>{g.grade || '—'}</td><td>{deptName(g.departmentId)}</td><td className="text-right tabular-nums">{g._count?.employees ?? 0}</td>
                  <td className="whitespace-nowrap text-right">
                    <Button size="sm" variant="secondary" onClick={() => open('designation', g)}>Edit</Button>{' '}
                    <Button size="sm" variant="ghost" onClick={() => remove('designation', g)}>Delete</Button>
                  </td>
                </tr>))}</tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {edit && (
        <Modal open onClose={() => setEdit(null)} title={`${edit.item.id ? 'Edit' : 'New'} ${edit.kind}`}>
          <form onSubmit={save} className="space-y-3">
            <Field id="s-name" label="Name"><Input id="s-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            {edit.kind === 'department' ? (
              <Field id="s-parent" label="Parent department (optional)">
                <select id="s-parent" className={SELECT} value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                  <option value="">None</option>{depts.filter((d) => d.id !== edit.item.id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
            ) : (<>
              <Field id="s-grade" label="Grade (optional)"><Input id="s-grade" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} /></Field>
              <Field id="s-dept" label="Department (optional)">
                <select id="s-dept" className={SELECT} value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                  <option value="">Any</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
            </>)}
            {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button></div>
          </form>
        </Modal>
      )}

      {importing && (
        <Modal open onClose={() => setImporting(null)} title={`Import ${importing === 'department' ? 'departments' : 'designations'}`}
          description={importing === 'department' ? 'One per line: name, parent department (optional). Existing names are skipped.' : 'One per line: title, grade (optional), department (optional). Existing titles are skipped.'}>
          <form onSubmit={runImport} className="space-y-3">
            <label htmlFor="s-csv" className="sr-only">Rows</label>
            <textarea id="s-csv" rows={8} required className={TEXTAREA_CLASS} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={importing === 'department' ? 'Engineering\nBackend, Engineering' : 'Accountant, G3, Finance'} />
            {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setImporting(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Importing…' : 'Import'}</Button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
