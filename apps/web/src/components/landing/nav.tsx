'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '#run', label: 'Payroll' },
  { href: '#whatsapp', label: 'Approvals' },
  { href: '#access', label: 'Who sees what' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'Questions' },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    try {
      setSignedIn(!!localStorage.getItem('accessToken'));
    } catch {
      /* storage blocked: treat as signed out */
    }
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const account = signedIn ? { href: '/dashboard', label: 'Open workspace' } : { href: '/login', label: 'Sign in' };

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-[background-color,box-shadow] duration-300',
        scrolled || open
          ? 'bg-[color-mix(in_srgb,var(--mx-paper)_86%,transparent)] shadow-[0_1px_0_var(--mx-rule)] backdrop-blur-md'
          : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="MatrixHR home" className="rounded-md">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="mx-link text-[0.9375rem] font-medium">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href={account.href} className="mx-link hidden px-2 text-[0.9375rem] font-medium sm:inline">
            {account.label}
          </Link>
          <Link href="/signup" className="mx-btn mx-btn-primary hidden h-10 px-4 text-[0.9375rem] sm:inline-flex">
            Start free trial
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="landing-menu"
            className="grid h-11 w-11 cursor-pointer place-items-center rounded-[10px] transition-colors hover:bg-[var(--mx-sheet)] lg:hidden"
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="landing-menu" className="animate-fade-in border-t border-[var(--mx-rule)] px-4 pb-6 pt-2 lg:hidden">
          <nav aria-label="Mobile" className="flex flex-col">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="border-b border-[var(--mx-rule)] py-4 font-display text-2xl font-bold tracking-tight"
              >
                {l.label}
              </a>
            ))}
            <Link href={account.href} className="py-4 text-base font-medium">
              {account.label}
            </Link>
          </nav>
          <Link href="/signup" className="mx-btn mx-btn-primary mt-2 w-full">
            Start free trial
          </Link>
        </div>
      )}
    </header>
  );
}
