import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import './globals.css';
import { siteUrl } from '@/lib/site';
import { getBrand, brandCss } from '@/lib/brand-server';
import { BrandProvider } from '@/lib/brand-context';

// The brand comes from the container env, so this tree is rendered per request, never baked at build time.
export const dynamic = 'force-dynamic';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap', axes: ['opsz', 'wdth'] });
const body = Figtree({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

const description =
  'Attendance, leave, expense claims and loans flow into a payroll run a second person approves, then out as payslips and a bank file. 30-day free trial.';

export function generateMetadata(): Metadata {
  const b = getBrand();
  const title = b.whiteLabel ? `${b.name} | HR and payroll` : 'HR & Payroll Software with ZKTeco Attendance | MatrixHR';
  const shareTitle = b.whiteLabel ? title : 'MatrixHR: HR and payroll that shows its working';
  return {
    metadataBase: new URL(b.websiteUrl && b.whiteLabel ? b.websiteUrl : siteUrl),
    title: { default: title, template: `%s | ${b.name}` },
    description: b.whiteLabel ? `HR and payroll with ${b.name}.` : description,
    applicationName: b.name,
    ...(b.faviconUrl ? { icons: { icon: b.faviconUrl, shortcut: b.faviconUrl, apple: b.faviconUrl } } : {}),
    alternates: { canonical: '/' },
    openGraph: { title: shareTitle, description: b.whiteLabel ? `HR and payroll with ${b.name}.` : description, type: 'website', siteName: b.name, url: '/', locale: 'en_US' },
    twitter: { card: 'summary_large_image', title: shareTitle, description: b.whiteLabel ? `HR and payroll with ${b.name}.` : description },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f5f1' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1411' },
  ],
};

// Stored choice wins; otherwise follow the OS setting.
const THEME_SCRIPT = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const brand = getBrand();
  const css = brandCss(brand);
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${display.variable} ${body.variable} font-sans`}>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
        <BrandProvider brand={brand}>{children}</BrandProvider>
      </body>
    </html>
  );
}
