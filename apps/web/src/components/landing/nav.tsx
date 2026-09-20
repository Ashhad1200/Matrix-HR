'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '#product', label: 'Product' },
  { href: '#modules', label: 'Modules' },
  { href: '#payroll', label: 'Payroll' },
  { href: '#roles', label: 'Portals' },
  { href: '#security', label: 'Security' },
  { href: '#faq', label: 'FAQ' },
];

const cta =
  'inline-flex h-10 items-center justify-center whitespace-nowrap rounded-lg bg-brand-700 px-4 text-sm font-medium text-white shadow-soft transition-[background-color,box-shadow,transform] duration-200 hover:bg-brand-800 hover:shadow-lifted active:scale-[0.98] dark:bg-brand-600 dark:hover:bg-brand-500';
const quiet =
  'inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]';

export function LandingNav() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    try {
      setSignedIn(!!localStorage.getItem('accessToken'));
    } catch {
      /* storage blocked: treat as signed out */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const account = signedIn ? { href: '/dashboard', label: 'Open workspace' } : { href: '/login', label: 'Sign in' };

  return (
    <header className="sticky top-0 z-30 border-b border-[hsl(var(--border))]/70 bg-[hsl(var(--background))]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="MatrixHR home" className="rounded-md">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className={quiet}>
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Link href={account.href} className={cn(quiet, 'hidden sm:inline-flex')}>
            {account.label}
          </Link>
          <Link href="/signup" className={cn(cta, 'hidden sm:inline-flex')}>
            Start free trial
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="landing-menu"
            className="cursor-pointer rounded-lg p-2 text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))] md:hidden"
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="landing-menu" className="border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 pb-5 pt-3 md:hidden animate-fade-in">
          <nav aria-label="Mobile" className="flex flex-col">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-base font-medium hover:bg-[hsl(var(--muted))]">
                {l.label}
              </a>
            ))}
            <Link href={account.href} className="rounded-lg px-3 py-3 text-base font-medium hover:bg-[hsl(var(--muted))]">
              {account.label}
            </Link>
          </nav>
          <Link href="/signup" className={cn(cta, 'mt-3 h-12 w-full text-base')}>
            Start free trial
          </Link>
        </div>
      )}
    </header>
  );
}
