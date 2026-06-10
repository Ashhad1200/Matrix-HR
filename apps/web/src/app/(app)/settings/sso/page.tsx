'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Fingerprint, Save } from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');

export default function SsoSettingsPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.sso.config()
      .then(setConfig)
      .catch((err) => setError(err.message || 'Failed to load SSO config'));
  }, []);

  if (error) return <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>;
  if (!config) return <PageSkeleton />;

  const subdomain = user?.tenant?.subdomain ?? 'acme';
  const metadataUrl = `${API_BASE}/sso/${subdomain}/metadata`;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await api.sso.save({
        provider: config.provider,
        enabled: config.enabled,
        entryPoint: config.entryPoint || undefined,
        issuer: config.issuer || undefined,
        certificate: config.certificate || undefined,
        metadataUrl: config.metadataUrl || undefined,
        domains: config.domains ?? [],
      });
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Single Sign-On"
        backHref="/settings"
        backLabel="Settings"
        description="Connect your SAML identity provider (Okta, Entra ID, Google)"
        actions={
          <Button onClick={save} disabled={saving}>
            <Save className="mr-2 h-4 w-4" /> {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save'}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Identity Provider</CardTitle>
              <Badge variant={config.enabled ? 'success' : 'neutral'}>{config.enabled ? 'Enabled' : 'Disabled'}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] p-4">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="h-4 w-4 accent-[#1c7e57]"
              />
              <div>
                <p className="text-sm font-semibold">Enforce SSO login</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Users with matching email domains sign in via your IdP</p>
              </div>
            </label>

            <div>
              <label className="mb-1 block text-sm font-medium">IdP SSO URL (entry point)</label>
              <Input
                placeholder="https://your-org.okta.com/app/.../sso/saml"
                value={config.entryPoint ?? ''}
                onChange={(e) => setConfig({ ...config, entryPoint: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Issuer / Entity ID</label>
              <Input
                placeholder="http://www.okta.com/exk..."
                value={config.issuer ?? ''}
                onChange={(e) => setConfig({ ...config, issuer: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">x509 Certificate (PEM)</label>
              <textarea
                className="input-base min-h-[110px] resize-y py-2 font-mono text-xs"
                placeholder="-----BEGIN CERTIFICATE-----"
                value={config.certificate ?? ''}
                onChange={(e) => setConfig({ ...config, certificate: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Allowed email domains (comma separated)</label>
              <Input
                placeholder="acme.com, acme.pk"
                value={(config.domains ?? []).join(', ')}
                onChange={(e) =>
                  setConfig({ ...config, domains: e.target.value.split(',').map((d: string) => d.trim()).filter(Boolean) })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-brand-600" /> Service Provider Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-[hsl(var(--muted-foreground))]">Paste these into your IdP when creating the SAML app:</p>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">SP Metadata URL</p>
              <code className="mt-1 block break-all rounded-lg bg-[hsl(var(--muted))] p-2 text-xs">{metadataUrl}</code>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">ACS URL</p>
              <code className="mt-1 block break-all rounded-lg bg-[hsl(var(--muted))] p-2 text-xs">{API_BASE}/sso/{subdomain}/acs</code>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">NameID format</p>
              <code className="mt-1 block break-all rounded-lg bg-[hsl(var(--muted))] p-2 text-xs">emailAddress</code>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
