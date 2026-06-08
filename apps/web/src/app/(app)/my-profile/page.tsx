'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function MyProfilePage() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({ phone: '', address: '', emergencyContact: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user?.employee) {
      setForm({
        phone: user.employee.phone ?? '',
        address: user.employee.address ?? '',
        emergencyContact: user.employee.emergencyContact ?? '',
      });
    }
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await api.employees.updateSelf(form);
      await refresh();
      setMessage('Profile updated successfully.');
    } catch (err: any) {
      setMessage(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Info</h1>
        <p className="text-[hsl(var(--muted-foreground))]">Update your personal contact details</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Details</CardTitle>
        </CardHeader>
        <CardContent>
          {user?.employee && (
            <div className="mb-6 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <p className="text-[hsl(var(--muted-foreground))]">Name</p>
                <p className="font-medium">{user.employee.firstName} {user.employee.lastName}</p>
              </div>
              <div>
                <p className="text-[hsl(var(--muted-foreground))]">Department</p>
                <p className="font-medium">{user.employee.department?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[hsl(var(--muted-foreground))]">Designation</p>
                <p className="font-medium">{user.employee.designation?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[hsl(var(--muted-foreground))]">Email</p>
                <p className="font-medium">{user.email}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Phone</label>
              <Input
                placeholder="Phone number"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Address</label>
              <Input
                placeholder="Home address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Emergency Contact</label>
              <Input
                placeholder="Name and phone"
                value={form.emergencyContact}
                onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
              />
            </div>
            {message && (
              <p className={`text-sm ${message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                {message}
              </p>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
