'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { PermissionGate } from '@/components/permission-gate';
import { formatDate, formatCurrency } from '@/lib/utils';

const STATUSES = ['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'RESIGNED'];
const DOCUMENT_TYPES = ['CNIC', 'Degree', 'Contract', 'Experience Letter', 'Other'];

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<any>(null);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [docType, setDocType] = useState(DOCUMENT_TYPES[0]);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', cnic: '', status: 'ACTIVE' });

  function load() {
    if (!id) return;
    api.employees.get(id)
      .then(setEmployee)
      .catch((e) => setError(e.message || 'Failed to load employee'));
  }

  useEffect(() => { load(); }, [id]);

  function openEdit() {
    setForm({
      firstName: employee.firstName ?? '',
      lastName: employee.lastName ?? '',
      email: employee.email ?? '',
      phone: employee.phone ?? '',
      cnic: employee.cnic ?? '',
      status: employee.status ?? 'ACTIVE',
    });
    setSaveError('');
    setEditOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      await api.employees.update(id, form);
      setEditOpen(false);
      load();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!docFile) return;
    setUploading(true);
    setUploadError('');
    try {
      const { url } = await api.uploads.upload(docFile);
      await api.employees.addDocument(id, { type: docType, name: docFile.name, fileUrl: url });
      setDocFile(null);
      load();
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/employees"><Button variant="secondary">← Back</Button></Link>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!employee) {
    return <p className="text-[hsl(var(--muted-foreground))]">Loading employee...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/employees"><Button variant="secondary">← Back</Button></Link>
          <div>
            <h1 className="text-2xl font-bold">{employee.firstName} {employee.lastName}</h1>
            <p className="text-[hsl(var(--muted-foreground))]">{employee.employeeCode} · {employee.designation?.name || '—'}</p>
          </div>
        </div>
        <PermissionGate action="employees" subAction="update">
          <Button onClick={openEdit}>Edit</Button>
        </PermissionGate>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Employee" description={`${employee.employeeCode} · ${employee.firstName} ${employee.lastName}`}>
        <form onSubmit={handleSave} className="space-y-4">
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">First Name</label>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Last Name</label>
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Phone</label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">CNIC</label>
              <Input value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Status</label>
              <select
                className="h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </form>
      </Modal>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Email</span><span>{employee.email || '—'}</span></div>
            <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Phone</span><span>{employee.phone || '—'}</span></div>
            <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">CNIC</span><span>{employee.cnic || '—'}</span></div>
            <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Department</span><span>{employee.department?.name || '—'}</span></div>
            <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Manager</span><span>{employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : '—'}</span></div>
            <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Joined</span><span>{employee.dateOfJoining ? formatDate(employee.dateOfJoining) : '—'}</span></div>
            <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Status</span><span>{employee.status}</span></div>
            {employee.baseSalary && (
              <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Base Salary</span><span>{formatCurrency(employee.baseSalary)}</span></div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Direct Reports ({employee.directReports?.length || 0})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(employee.directReports || []).map((r: any) => (
              <Link key={r.id} href={`/employees/${r.id}`} className="block rounded-lg border border-[hsl(var(--border))] p-3 hover:bg-[hsl(var(--muted))]">
                {r.firstName} {r.lastName}
              </Link>
            ))}
            {!employee.directReports?.length && <p className="text-sm text-[hsl(var(--muted-foreground))]">No direct reports</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Documents ({employee.documents?.length || 0})</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[hsl(var(--muted-foreground))]">
                  <th className="p-2">Type</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Verified</th>
                </tr>
              </thead>
              <tbody>
                {(employee.documents || []).map((d: any) => (
                  <tr key={d.id} className="border-b">
                    <td className="p-2">{d.type}</td>
                    <td className="p-2">
                      {d.fileUrl ? (
                        <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">{d.name}</a>
                      ) : d.name}
                    </td>
                    <td className="p-2">{d.verified ? '✓' : '—'}</td>
                  </tr>
                ))}
                {!employee.documents?.length && (
                  <tr><td colSpan={3} className="p-2 text-[hsl(var(--muted-foreground))]">No documents uploaded</td></tr>
                )}
              </tbody>
            </table>

            <PermissionGate action="employees" subAction="update">
              <form onSubmit={handleUploadDocument} className="flex flex-wrap items-end gap-2 border-t border-[hsl(var(--border))] pt-4">
                {uploadError && <p className="w-full text-sm text-red-600">{uploadError}</p>}
                <div>
                  <label className="mb-1 block text-xs font-medium">Type</label>
                  <select
                    className="h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm"
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                  >
                    {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium">File</label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                    onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm"
                  />
                </div>
                <Button type="submit" disabled={!docFile || uploading}>{uploading ? 'Uploading...' : 'Add Document'}</Button>
              </form>
            </PermissionGate>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
