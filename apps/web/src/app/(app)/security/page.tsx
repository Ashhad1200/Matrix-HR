'use client';

import { useEffect, useState } from 'react';
import { api, type WhatsAppConsent } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function ErrorNote({ children }: { children: string }) {
  return <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{children}</p>;
}

export default function SecurityPage() {
  const { user, refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [setupCode, setSetupCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [savedCodes, setSavedCodes] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');

  const [consent, setConsent] = useState<WhatsAppConsent | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentError, setConsentError] = useState('');

  useEffect(() => {
    let active = true;
    api.whatsapp.myConsent()
      .then((value) => { if (active) setConsent(value); })
      .catch((error) => { if (active) setConsentError(messageFrom(error, 'Unable to load WhatsApp preferences')); });
    return () => { active = false; };
  }, []);

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);
    if (newPassword.length < 8 || newPassword.length > 72 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordError('New password must be 8–72 characters and include an uppercase letter, a lowercase letter, and a digit.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordBusy(true);
    try {
      const session = await api.auth.changePassword({ currentPassword, newPassword });
      localStorage.setItem('accessToken', session.accessToken);
      localStorage.setItem('refreshToken', session.refreshToken);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(true);
    } catch (error) {
      setPasswordError(messageFrom(error, 'Unable to change password'));
    } finally {
      setPasswordBusy(false);
    }
  }

  async function startSetup() {
    setMfaBusy(true);
    setMfaError('');
    try {
      setSetup(await api.auth.mfaSetup());
    } catch (error) {
      setMfaError(messageFrom(error, 'Unable to start two-factor setup'));
    } finally {
      setMfaBusy(false);
    }
  }

  async function enableMfa(event: React.FormEvent) {
    event.preventDefault();
    setMfaBusy(true);
    setMfaError('');
    try {
      const result = await api.auth.mfaEnable({ code: setupCode.trim() });
      setRecoveryCodes(result.recoveryCodes);
      setSetup(null);
      setSetupCode('');
      await refresh();
    } catch (error) {
      setMfaError(messageFrom(error, 'Unable to enable two-factor authentication'));
    } finally {
      setMfaBusy(false);
    }
  }

  async function disableMfa(event: React.FormEvent) {
    event.preventDefault();
    if (!window.confirm('Disable two-factor authentication for your account?')) return;
    setMfaBusy(true);
    setMfaError('');
    try {
      await api.auth.mfaDisable({ password: disablePassword, code: disableCode.trim() });
      setDisablePassword('');
      setDisableCode('');
      await refresh();
    } catch (error) {
      setMfaError(messageFrom(error, 'Unable to disable two-factor authentication'));
    } finally {
      setMfaBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      setMfaError(messageFrom(error, 'Unable to copy to the clipboard'));
    }
  }

  function downloadRecoveryCodes() {
    if (!recoveryCodes) return;
    const url = URL.createObjectURL(new Blob([`${recoveryCodes.join('\n')}\n`], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'matrixhr-recovery-codes.txt';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function toggleConsent() {
    if (!consent) return;
    setConsentBusy(true);
    setConsentError('');
    try {
      setConsent(await api.whatsapp.setMyConsent(consent.status === 'OPTED_IN' ? 'OPTED_OUT' : 'OPTED_IN'));
    } catch (error) {
      setConsentError(messageFrom(error, 'Unable to update WhatsApp preferences'));
    } finally {
      setConsentBusy(false);
    }
  }

  const mfaEnabled = user?.twoFaEnabled ?? false;
  const consentLabel = consent?.status === 'OPTED_IN' ? 'Opted in' : consent?.status === 'OPTED_OUT' ? 'Opted out' : consent?.status === 'NO_PHONE' ? 'No phone number' : 'Not set';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Security</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Manage your password, sign-in protection, and messaging consent.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
        <CardContent>
          <form data-testid="security-change-password" onSubmit={changePassword} className="max-w-lg space-y-4">
            <div><label htmlFor="current-password" className="mb-1.5 block text-sm font-medium">Current password</label><Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></div>
            <div><label htmlFor="new-password" className="mb-1.5 block text-sm font-medium">New password</label><Input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /><p className="mt-1.5 text-xs text-[hsl(var(--muted-foreground))]">8–72 characters with uppercase, lowercase, and a digit.</p></div>
            <div><label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium">Confirm new password</label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></div>
            {passwordError && <ErrorNote>{passwordError}</ErrorNote>}
            {passwordSuccess && <p className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Password changed. Other devices were signed out.</p>}
            <Button type="submit" disabled={passwordBusy}>{passwordBusy ? 'Changing…' : 'Change password'}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div className="flex flex-wrap items-center gap-3"><CardTitle>Two-factor authentication</CardTitle><Badge variant={mfaEnabled ? 'success' : 'neutral'}>{mfaEnabled ? 'Enabled' : 'Off'}</Badge></div></CardHeader>
        <CardContent className="space-y-4">
          {mfaError && <ErrorNote>{mfaError}</ErrorNote>}

          {recoveryCodes ? (
            <div data-testid="mfa-recovery-codes" className="space-y-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
              <div><p className="font-semibold">Save these recovery codes now — they will not be shown again</p><p className="mt-1 text-sm">Each code can be used once if you cannot access your authenticator.</p></div>
              <div className="grid gap-2 font-mono text-sm sm:grid-cols-2">{recoveryCodes.map((code) => <code key={code} className="rounded bg-white/60 px-3 py-2 dark:bg-black/20">{code}</code>)}</div>
              <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="secondary" onClick={() => void copy(recoveryCodes.join('\n'))}>Copy all</Button><Button type="button" size="sm" variant="secondary" onClick={downloadRecoveryCodes}>Download .txt</Button></div>
              <label className="flex items-start gap-2 text-sm"><input data-testid="mfa-saved-checkbox" type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" checked={savedCodes} onChange={(event) => setSavedCodes(event.target.checked)} /><span>I have saved them</span></label>
              <Button type="button" disabled={!savedCodes} onClick={() => { setRecoveryCodes(null); setSavedCodes(false); }}>Done</Button>
            </div>
          ) : mfaEnabled ? (
            <form data-testid="mfa-disable-form" onSubmit={disableMfa} className="max-w-lg space-y-4">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Your account requires a second factor when you sign in.</p>
              <div><label htmlFor="disable-password" className="mb-1.5 block text-sm font-medium">Current password</label><Input id="disable-password" type="password" autoComplete="current-password" value={disablePassword} onChange={(event) => setDisablePassword(event.target.value)} required /></div>
              <div><label htmlFor="disable-code" className="mb-1.5 block text-sm font-medium">Authentication or recovery code</label><Input id="disable-code" autoComplete="one-time-code" value={disableCode} onChange={(event) => setDisableCode(event.target.value)} required /></div>
              <Button type="submit" variant="danger" disabled={mfaBusy}>{mfaBusy ? 'Disabling…' : 'Disable two-factor authentication'}</Button>
            </form>
          ) : setup ? (
            <div className="max-w-2xl space-y-5">
              <div><p className="text-sm font-medium">Secret</p><div className="mt-1 flex flex-col gap-2 sm:flex-row"><code data-testid="mfa-secret" className="min-w-0 flex-1 break-all rounded-lg bg-[hsl(var(--muted))] px-3 py-2 font-mono text-sm">{setup.secret}</code><Button type="button" variant="secondary" onClick={() => void copy(setup.secret)}>Copy</Button></div></div>
              <div><p className="text-sm font-medium">Add to your authenticator app</p><div className="mt-1 flex flex-col gap-2 sm:flex-row"><a href={setup.otpauthUrl} className="min-w-0 flex-1 break-all rounded-lg bg-[hsl(var(--muted))] px-3 py-2 text-sm text-brand-700 underline dark:text-brand-400">{setup.otpauthUrl}</a><Button type="button" variant="secondary" onClick={() => void copy(setup.otpauthUrl)}>Copy</Button></div></div>
              <form onSubmit={enableMfa} className="max-w-sm space-y-3"><div><label htmlFor="enable-code" className="mb-1.5 block text-sm font-medium">6-digit authentication code</label><Input id="enable-code" data-testid="mfa-enable-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" value={setupCode} onChange={(event) => setSetupCode(event.target.value)} required /></div><Button data-testid="mfa-enable-submit" type="submit" disabled={mfaBusy}>{mfaBusy ? 'Verifying…' : 'Verify and enable'}</Button></form>
            </div>
          ) : (
            <div className="space-y-4"><p className="text-sm text-[hsl(var(--muted-foreground))]">Add an authenticator app to protect your account with a second sign-in step.</p><Button data-testid="mfa-setup-start" type="button" onClick={() => void startSetup()} disabled={mfaBusy}>{mfaBusy ? 'Starting…' : 'Set up'}</Button></div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>WhatsApp notifications</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {consentError && <ErrorNote>{consentError}</ErrorNote>}
          <div className="space-y-1 text-sm"><p><span className="font-medium">Phone on file:</span> {consent?.phone || 'No phone number is on your employee profile.'}</p><p><span className="font-medium">Status:</span> <Badge data-testid="wa-consent-status" variant={consent?.status === 'OPTED_IN' ? 'success' : 'neutral'}>{consent ? consentLabel : 'Loading…'}</Badge></p></div>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Leave-approval requests are only sent to opted-in numbers, and replying STOP also opts out.</p>
          <Button data-testid="wa-consent-toggle" type="button" disabled={!consent || consentBusy || consent.status === 'NO_PHONE'} onClick={() => void toggleConsent()}>{consentBusy ? 'Saving…' : consent?.status === 'OPTED_IN' ? 'Stop WhatsApp messages' : 'Opt in to WhatsApp messages'}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
