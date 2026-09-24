import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import './globals.css';
import { siteUrl } from '@/lib/site';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap', axes: ['opsz', 'wdth'] });
const body = Figtree({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

const title = 'MatrixHR | HR and payroll for companies in Pakistan';
const description =
  'Attendance, leave, expense claims and loans flow into a payroll run that a second person approves, then out as payslips and a bank file. HR and payroll for growing companies in Pakistan.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: title, template: '%s | MatrixHR' },
  description,
  applicationName: 'MatrixHR',
  alternates: { canonical: '/' },
  openGraph: { title, description, type: 'website', siteName: 'MatrixHR', url: '/', locale: 'en_PK' },
  twitter: { card: 'summary_large_image', title, description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f5f1' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1411' },
  ],
};

// Stored choice wins; otherwise follow the OS setting.
const THEME_SCRIPT = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${display.variable} ${body.variable} font-sans`}>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
